<?php
declare(strict_types=1);

function calendar_definition_hash(string $profile, array $definition): string
{
    if (!preg_match('/^[a-z0-9-]{1,64}$/D', $profile)) throw new InvalidArgumentException('Invalid calendar profile.');
    return hash('sha256', json_encode($definition, JSON_THROW_ON_ERROR));
}

/** Exact annual records take priority; earlier records remain available during outages. */
function calendar_stored_record(PDO $pdo, string $profile, array $definition, int $year): ?array
{
    $statement = $pdo->prepare('SELECT record_json FROM calendar_rules
        WHERE profile = :profile AND definition_hash = :hash AND calendar_year <= :year
        ORDER BY calendar_year DESC LIMIT 1');
    $statement->execute([':profile' => $profile, ':hash' => calendar_definition_hash($profile, $definition), ':year' => $year]);
    $json = $statement->fetchColumn();
    return $json === false ? null : json_decode($json, true, 64, JSON_THROW_ON_ERROR);
}

function calendar_save_record(PDO $pdo, string $profile, array $definition, array $record): void
{
    $record['rules'] = calendar_validate_rules($record['rules']);
    $record['definitionHash'] = calendar_definition_hash($profile, $definition);
    $mysql = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    $sql = 'INSERT INTO calendar_rules (profile, definition_hash, calendar_year, record_json, verified_at)
        VALUES (:profile, :hash, :year, :record, :verified) ' . ($mysql
        ? 'ON DUPLICATE KEY UPDATE record_json = VALUES(record_json), verified_at = VALUES(verified_at)'
        : 'ON CONFLICT(profile, definition_hash, calendar_year) DO UPDATE SET record_json = excluded.record_json, verified_at = excluded.verified_at');
    $pdo->prepare($sql)->execute([':profile' => $profile, ':hash' => $record['definitionHash'],
        ':year' => $record['searchedYear'], ':verified' => $record['verifiedAt'], ':record' => json_encode($record, JSON_THROW_ON_ERROR)]);
}

/**
 * Calendar reads/writes must never take an advisory database lock.
 *
 * A stalled request must not be able to lock another live production
 * database session out. Callers still perform their normal validation
 * and atomic SQL writes; this wrapper now only preserves the existing
 * call structure.
 */
function calendar_with_lock(PDO $pdo, string $profile, callable $callback): mixed
{
    return $callback();
}

function calendar_refresh_stored(PDO $pdo, string $profile, array $definition, int $year, callable $discover,
    bool $explicit = false, ?string $legacyDirectory = null): array
{
    calendar_definition_hash($profile, $definition);
    return calendar_with_lock($pdo, $profile, static function () use ($pdo, $profile, $definition, $year, $discover, $explicit, $legacyDirectory): array {
        $current = calendar_stored_record($pdo, $profile, $definition, $year);
        if ($current === null && $legacyDirectory !== null) {
            $legacy = calendar_cached_record($legacyDirectory, $profile);
            if ($legacy && ($legacy['definitionHash'] ?? null) === calendar_definition_hash($profile, $definition)
                && is_int($legacy['searchedYear'] ?? null) && $legacy['searchedYear'] <= $year
                && is_int($legacy['verifiedAt'] ?? null)) {
                calendar_save_record($pdo, $profile, $definition, $legacy);
                $current = $legacy;
            }
        }
        // Explicit requests also reuse a successfully saved year.
        if (!calendar_needs_refresh($current, $year, time())) return $current;
        $attempt = $pdo->prepare('SELECT attempted_at FROM calendar_refresh_attempts WHERE profile = :profile');
        $attempt->execute([':profile' => $profile]);
        $last = $attempt->fetchColumn();
        if ($last !== false && time() - (int) $last < ($explicit ? 60 : 3600)) {
            throw new RuntimeException($explicit ? 'Explicit calendar refresh is limited to once per minute per profile.'
                : 'Calendar refresh is limited to once per hour per profile.');
        }
        $sql = $last === false
            ? 'INSERT INTO calendar_refresh_attempts (profile, attempted_at) VALUES (:profile, :at)'
            : 'UPDATE calendar_refresh_attempts SET attempted_at = :at WHERE profile = :profile';
        $pdo->prepare($sql)->execute([':profile' => $profile, ':at' => time()]);
        $record = $discover($definition, $year);
        $record['verifiedAt'] = time();
        $record['searchedYear'] = $year;
        $record['definitionHash'] = calendar_definition_hash($profile, $definition);
        calendar_save_record($pdo, $profile, $definition, $record);
        return $record;
    });
}

function calendar_manual_save(PDO $pdo, string $profile, array $definition, int $year, array $rules,
    string $note, int $actor): array
{
    if ($year < 1970 || $year > 9999) throw new InvalidArgumentException('Calendar year must be between 1970 and 9999.');
    if (strtolower($definition['organization'] ?? '') === 'walmart' && ($rules['payPeriodDays'] ?? null) !== null) {
        $rules['payPeriodAnchorBasis'] = 'fiscal-year-start';
    }
    foreach (['effectiveFrom', 'effectiveThrough', 'payPeriodAnchorDate'] as $field) {
        if (isset($rules[$field]) && !is_string($rules[$field])) throw new InvalidArgumentException('Calendar dates must be strings.');
    }
    $rules = calendar_validate_rules($rules);
    if ($rules['effectiveFrom'] > "$year-12-31" || ($rules['effectiveThrough'] !== null && $rules['effectiveThrough'] < "$year-01-01")) {
        throw new InvalidArgumentException('Rules must cover the selected calendar year.');
    }
    if (trim($note) === '' || strlen($note) > 2000) throw new InvalidArgumentException('Enter a correction note of at most 2000 bytes.');
    calendar_definition_hash($profile, $definition);
    return calendar_with_lock($pdo, $profile, static function () use ($pdo, $profile, $definition, $year, $rules, $note, $actor): array {
        $previous = calendar_stored_record($pdo, $profile, $definition, $year);
        $history = $previous['manualHistory'] ?? [];
        $history[] = ['at' => time(), 'userId' => $actor, 'note' => trim($note), 'previousRules' => $previous['rules'] ?? null];
        $record = ['rules' => $rules, 'sources' => $previous['sources'] ?? [], 'provenance' => 'manual',
            'searchedYear' => $year, 'verifiedAt' => time(), 'definitionHash' => calendar_definition_hash($profile, $definition),
            'manualHistory' => $history];
        calendar_save_record($pdo, $profile, $definition, $record);
        return $record;
    });
}

/** Login bootstrap contains only database rules, never external discovery. */
function calendar_login_records(PDO $pdo, array $config): array
{
    $records = [];
    foreach (calendar_profiles($config) as $profile => $definition) {
        $statement = $pdo->prepare('SELECT record_json FROM calendar_rules WHERE profile = :profile AND definition_hash = :hash ORDER BY calendar_year DESC');
        $statement->execute([':profile' => $profile, ':hash' => calendar_definition_hash($profile, $definition)]);
        while (($json = $statement->fetchColumn()) !== false) {
            $record = json_decode($json, true, 64, JSON_THROW_ON_ERROR);
            $records[] = ['profile' => $profile, 'timezone' => $definition['timezone'] ?? null,
                'rules' => calendar_validate_rules($record['rules']), 'searchedYear' => $record['searchedYear'],
                'verifiedAt' => $record['verifiedAt'], 'sources' => $record['sources'] ?? [], 'provenance' => $record['provenance']];
        }
    }
    return $records;
}
