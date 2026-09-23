<?php
declare(strict_types=1);

function ensure_speech_corrections_schema(PDO $pdo): void
{
    static $ready = false;

    if ($ready) {
        return;
    }

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS speech_corrections ('
        . 'id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, '
        . 'language VARCHAR(32) NOT NULL DEFAULT "en-US", '
        . 'observed VARCHAR(500) NOT NULL, '
        . 'observed_compact VARCHAR(500) NOT NULL, '
        . 'canonical VARCHAR(500) NOT NULL, '
        . 'canonical_compact VARCHAR(500) NOT NULL, '
        . 'match_type ENUM("exact","prefix") NOT NULL DEFAULT "exact", '
        . 'enabled TINYINT(1) NOT NULL DEFAULT 1, '
        . 'occurrences INT UNSIGNED NOT NULL DEFAULT 1, '
        . 'created_by_user_id BIGINT UNSIGNED NULL, '
        . 'created_at BIGINT UNSIGNED NOT NULL, '
        . 'updated_at BIGINT UNSIGNED NOT NULL, '
        . 'PRIMARY KEY (id), '
        . 'UNIQUE KEY uq_speech_corrections_mapping '
        . '(language, observed_compact, canonical_compact, match_type), '
        . 'KEY idx_speech_corrections_runtime '
        . '(language, enabled, observed_compact), '
        . 'KEY idx_speech_corrections_creator '
        . '(created_by_user_id), '
        . 'CONSTRAINT fk_speech_corrections_creator '
        . 'FOREIGN KEY (created_by_user_id) REFERENCES users(id) '
        . 'ON UPDATE RESTRICT ON DELETE SET NULL, '
        . 'CONSTRAINT chk_speech_corrections_enabled '
        . 'CHECK (enabled IN (0,1)), '
        . 'CONSTRAINT chk_speech_corrections_occurrences '
        . 'CHECK (occurrences > 0)'
        . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 '
        . 'COLLATE=utf8mb4_unicode_ci'
    );

    $ready = true;
}

function normalize_speech_correction_text(string $value): string
{
    $value = trim($value);

    if (function_exists('mb_strtolower')) {
        $value = mb_strtolower($value, 'UTF-8');
    } else {
        $value = strtolower($value);
    }

    $value = preg_replace(
        '/([^\p{L}\p{N}\s:.])+?/u',
        ' ',
        $value
    ) ?? $value;

    $value = preg_replace(
        '/\s+/u',
        ' ',
        $value
    ) ?? $value;

    return trim($value);
}

function compact_speech_correction_text(string $value): string
{
    return preg_replace(
        '/\s+/u',
        '',
        normalize_speech_correction_text($value)
    ) ?? '';
}

function speech_correction_language(mixed $value): string
{
    if ($value === null || $value === '') {
        return 'en-US';
    }

    if (
        !is_string($value) ||
        !preg_match('/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})*$/D', $value)
    ) {
        api_error('language is invalid.', 422, 'invalid_argument');
    }

    return $value;
}

function speech_correction_match_type(mixed $value): string
{
    $type =
        is_string($value)
            ? strtolower(trim($value))
            : 'exact';

    if (!in_array($type, ['exact', 'prefix'], true)) {
        api_error('matchType must be exact or prefix.', 422, 'invalid_argument');
    }

    return $type;
}

function speech_correction_boolean(mixed $value, string $name): bool
{
    if (is_bool($value)) {
        return $value;
    }

    if ($value === 1 || $value === 0 || $value === '1' || $value === '0') {
        return (bool) $value;
    }

    api_error($name . ' must be a boolean.', 422, 'invalid_argument');
}

function validate_speech_correction_pair(
    mixed $observedValue,
    mixed $canonicalValue
): array {
    if (!is_string($observedValue) || !is_string($canonicalValue)) {
        api_error('observed and canonical must be strings.', 422, 'invalid_argument');
    }

    $observed =
        normalize_speech_correction_text(
            $observedValue
        );

    $canonical =
        normalize_speech_correction_text(
            $canonicalValue
        );

    if ($observed === '' || $canonical === '') {
        api_error('observed and canonical must not be empty.', 422, 'invalid_argument');
    }

    if (
        strlen($observed) > 500 ||
        strlen($canonical) > 500
    ) {
        api_error('Speech corrections are limited to 500 characters.', 422, 'invalid_argument');
    }

    $observedCompact =
        compact_speech_correction_text(
            $observed
        );

    $canonicalCompact =
        compact_speech_correction_text(
            $canonical
        );

    if ($observedCompact === $canonicalCompact) {
        api_error(
            'Whitespace-only variants are handled automatically and should not be trained.',
            422,
            'redundant_correction'
        );
    }

    return [
        'observed' => $observed,
        'observedCompact' => $observedCompact,
        'canonical' => $canonical,
        'canonicalCompact' => $canonicalCompact,
    ];
}

function speech_correction_row(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'language' => (string) $row['language'],
        'observed' => (string) $row['observed'],
        'observedCompact' => (string) $row['observed_compact'],
        'canonical' => (string) $row['canonical'],
        'canonicalCompact' => (string) $row['canonical_compact'],
        'matchType' => (string) $row['match_type'],
        'enabled' => (bool) $row['enabled'],
        'occurrences' => (int) $row['occurrences'],
        'createdByUserId' =>
            $row['created_by_user_id'] === null
                ? null
                : (int) $row['created_by_user_id'],
        'createdAt' => (int) $row['created_at'],
        'updatedAt' => (int) $row['updated_at'],
    ];
}
