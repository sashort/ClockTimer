<?php
declare(strict_types=1);

/** Calendar rules are civil dates, never fixed numbers of UTC milliseconds. */
function calendar_date(string $value): DateTimeImmutable
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, new DateTimeZone('UTC'));
    if (!$date || $date->format('Y-m-d') !== $value) {
        throw new InvalidArgumentException('Calendar dates must use YYYY-MM-DD.');
    }
    return $date;
}

function calendar_validate_rules(array $rules): array
{
    if (!is_int($rules['weekStartDay'] ?? null) || $rules['weekStartDay'] < 0 || $rules['weekStartDay'] > 6) {
        throw new InvalidArgumentException('weekStartDay must be 0 (Sunday) through 6 (Saturday).');
    }
    if (!is_string($rules['cutoffTime'] ?? null) || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/D', $rules['cutoffTime'])) {
        throw new InvalidArgumentException('cutoffTime must be HH:mm:ss.');
    }
    $days = $rules['payPeriodDays'] ?? null;
    $anchor = $rules['payPeriodAnchorDate'] ?? null;
    if (($days === null) !== ($anchor === null) || ($days !== null && (!is_int($days) || $days < 1 || $days > 366))) {
        throw new InvalidArgumentException('A recurring pay period requires both its length and anchor date.');
    }
    if ($anchor !== null) {
        if (!is_string($anchor)) throw new InvalidArgumentException('Invalid pay-period anchor.');
        calendar_date($anchor);
    }
    if (!is_bool($rules['recurring'] ?? null)) throw new InvalidArgumentException('recurring must be a boolean.');
    calendar_date($rules['effectiveFrom'] ?? '');
    $through = $rules['effectiveThrough'] ?? null;
    if ($through !== null) {
        calendar_date($through);
        if ($through < $rules['effectiveFrom']) throw new InvalidArgumentException('Invalid effective date window.');
    }
    if (!$rules['recurring'] && $through === null) {
        throw new InvalidArgumentException('A nonrecurring calendar must have an effective end date.');
    }
    $basis = $rules['payPeriodAnchorBasis'] ?? 'period-start';
    if (!in_array($basis, ['period-start', 'fiscal-year-start'], true)) throw new InvalidArgumentException('Invalid pay-period anchor basis.');
    if ($basis === 'fiscal-year-start' && ($days !== 14 || (int) calendar_date($anchor)->format('w') !== $rules['weekStartDay'])) {
        throw new InvalidArgumentException('A fiscal-year anchor requires a 14-day cycle starting on the first weekday.');
    }
    return [
        'payPeriodAnchorBasis' => $basis,
        'weekStartDay' => $rules['weekStartDay'], 'cutoffTime' => $rules['cutoffTime'],
        'payPeriodDays' => $days, 'payPeriodAnchorDate' => $anchor,
        'recurring' => $rules['recurring'], 'effectiveFrom' => $rules['effectiveFrom'],
        'effectiveThrough' => $through,
    ];
}

function calendar_boundary(string $date, string $time, DateTimeZone $zone): DateTimeImmutable
{
    $input = "$date $time";
    $boundary = new DateTimeImmutable($input, $zone);
    // Reject cutoffs that do not exist during a daylight-saving transition.
    if ($boundary->format('Y-m-d H:i:s') !== $input) {
        throw new InvalidArgumentException('The calendar cutoff does not exist in this timezone on this date.');
    }
    return $boundary;
}

function calendar_moment(string $at, string $timezone): DateTimeImmutable
{
    if (!in_array($timezone, DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC), true) && $timezone !== 'UTC') {
        throw new InvalidArgumentException('An IANA store timezone is required.');
    }
    if (!preg_match('/T.*(?:Z|[+-]\d{2}:\d{2})$/D', $at)) {
        throw new InvalidArgumentException('at must be an ISO timestamp with an explicit timezone offset.');
    }
    $zone = new DateTimeZone($timezone);
    try { $moment = (new DateTimeImmutable($at))->setTimezone($zone); }
    catch (Throwable) { throw new InvalidArgumentException('Invalid calendar timestamp.'); }
    $errors = DateTimeImmutable::getLastErrors();
    if ($errors && ($errors['warning_count'] || $errors['error_count'])) throw new InvalidArgumentException('Invalid calendar timestamp.');
    return $moment;
}

function calendar_range(array $input, string $range, string $at, string $timezone): array
{
    $rules = calendar_validate_rules($input);
    $moment = calendar_moment($at, $timezone);
    $zone = $moment->getTimezone();
    $date = calendar_date($moment->format('Y-m-d'));
    if ($moment < calendar_boundary($date->format('Y-m-d'), $rules['cutoffTime'], $zone)) {
        $date = $date->modify('-1 day');
    }
    $day = $date->format('Y-m-d');
    if ($day < $rules['effectiveFrom'] || (!$rules['recurring'] && $day > $rules['effectiveThrough'])) {
        throw new InvalidArgumentException('No verified calendar covers this date. Refresh the calendar source.');
    }
    switch ($range) {
        case 'day':
            $start = $date; $end = $date->modify('+1 day'); break;
        case 'week':
            $offset = ((int) $date->format('w') - $rules['weekStartDay'] + 7) % 7;
            $start = $date->modify("-$offset days"); $end = $start->modify('+7 days'); break;
        case 'pay-period':
            if ($rules['payPeriodDays'] === null) {
                throw new InvalidArgumentException('No verified recurring pay-period anchor is available.');
            }
            $anchor = calendar_date($rules['payPeriodAnchorDate']);
            $offset = (int) $anchor->diff($date)->format('%r%a');
            $cycles = (int) floor($offset / $rules['payPeriodDays']);
            $shift = $cycles * $rules['payPeriodDays'];
            $start = $anchor->modify("$shift days");
            $end = $start->modify('+' . $rules['payPeriodDays'] . ' days'); break;
        // Month and Year retain their ordinary Gregorian meaning.
        case 'month':
            $start = $date->modify('first day of this month'); $end = $start->modify('+1 month'); break;
        case 'year':
            $start = calendar_date($date->format('Y') . '-01-01'); $end = $start->modify('+1 year'); break;
        default: throw new InvalidArgumentException('Unknown Trip Log Range.');
    }
    $startLocal = calendar_boundary($start->format('Y-m-d'), $rules['cutoffTime'], $zone);
    $endLocal = calendar_boundary($end->format('Y-m-d'), $rules['cutoffTime'], $zone);
    if (!$rules['recurring'] && $end->modify('-1 day')->format('Y-m-d') > $rules['effectiveThrough']) {
        throw new InvalidArgumentException('The complete range is not covered by the verified calendar.');
    }
    if ($start->format('Y-m-d') < $rules['effectiveFrom']) {
        throw new InvalidArgumentException('The range crosses a calendar rule change.');
    }
    $utc = new DateTimeZone('UTC');
    return [
        'range' => $range, 'timezone' => $timezone,
        'startTime' => $startLocal->setTimezone($utc)->format('Y-m-d\TH:i:s.v\Z'),
        'endTime' => $endLocal->setTimezone($utc)->format('Y-m-d\TH:i:s.v\Z'),
        'startLocal' => $startLocal->format(DateTimeInterface::ATOM),
        'endLocal' => $endLocal->format(DateTimeInterface::ATOM),
        'endExclusive' => true,
        'payWeek' => $range === 'pay-period' && $rules['payPeriodDays'] === 14 ? (int) floor(($offset - $cycles * 14) / 7) + 1 : null,
        'payPeriodNumber' => $range === 'pay-period' && $offset >= 0 ? $cycles + 1 : null,
        'payPeriodAnchorBasis' => $rules['payPeriodAnchorBasis'],
        'extrapolated' => $rules['effectiveThrough'] !== null && $end->modify('-1 day')->format('Y-m-d') > $rules['effectiveThrough'],
    ];
}

function calendar_profiles(array $config): array
{
    return $config['calendar_profiles'] ?? [
        'walmart-us' => [
            'organization' => 'Walmart', 'locale' => 'United States',
            'allowedDomains' => ['one.walmart.com', 'corporate.walmart.com'],
        ],
    ];
}

function calendar_cache_directory(array $config): string
{
    $directory = $config['calendar_cache_directory'] ?? '/var/lib/clocktimer/calendars';
    if (!is_string($directory) || $directory === '') throw new RuntimeException('Calendar cache is not configured.');
    return $directory;
}

function calendar_cached_record(string $directory, string $profile): ?array
{
    if (!preg_match('/^[a-z0-9-]{1,64}$/D', $profile)) throw new InvalidArgumentException('Invalid calendar profile.');
    $path = $directory . '/' . $profile . '.json';
    if (!is_file($path)) return null;
    $value = json_decode((string) file_get_contents($path), true, 64, JSON_THROW_ON_ERROR);
    if (!is_array($value)) throw new RuntimeException('Invalid calendar cache.');
    return $value;
}

/** Successful discovery remains valid throughout its calendar year. */
function calendar_needs_refresh(?array $record, int $year, int $now): bool
{
    return !$record || ($record['searchedYear'] ?? null) !== $year ||
        !is_int($record['verifiedAt'] ?? null);
}

/** Only a source-supported candidate is ever saved; failed searches keep the old record. */
function calendar_refresh(string $directory, string $profile, array $definition, int $year, callable $discover, bool $force = false): array
{
    if (!preg_match('/^[a-z0-9-]{1,64}$/D', $profile)) throw new InvalidArgumentException('Invalid calendar profile.');
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Calendar cache is not writable.');
    }
    $handle = fopen($directory . '/' . $profile . '.lock', 'c');
    if (!$handle || !flock($handle, LOCK_EX | LOCK_NB)) throw new RuntimeException('Calendar refresh is already running.');
    try {
        $current = calendar_cached_record($directory, $profile);
        if (($current['definitionHash'] ?? null) !== hash('sha256', json_encode($definition, JSON_THROW_ON_ERROR))) $current = null;
        if (!$force && !calendar_needs_refresh($current, $year, time())) return $current;
        $attemptPath = $directory . '/' . $profile . '.attempt';
        $lastAttempt = is_file($attemptPath) ? (int) file_get_contents($attemptPath) : 0;
        // Bound upstream costs even when search repeatedly fails or clients select arbitrary years.
        $retryInterval = $force ? 60 : 3600;
        if (time() - $lastAttempt < $retryInterval) {
            throw new RuntimeException($force ? 'Explicit calendar refresh is limited to once per minute per profile.'
                : 'Calendar refresh is limited to once per hour per profile.');
        }
        file_put_contents($attemptPath, (string) time(), LOCK_EX);
        $candidate = $discover($definition, $year);
        $candidate['rules'] = calendar_validate_rules($candidate['rules']);
        $candidate['verifiedAt'] = time();
        $candidate['searchedYear'] = $year;
        $candidate['definitionHash'] = hash('sha256', json_encode($definition, JSON_THROW_ON_ERROR));
        $temporary = tempnam($directory, '.calendar-');
        if ($temporary === false) throw new RuntimeException('Could not create calendar cache.');
        try {
            if (file_put_contents($temporary, json_encode($candidate, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT)) === false ||
                !rename($temporary, $directory . '/' . $profile . '.json')) {
                throw new RuntimeException('Could not save calendar cache.');
            }
        } finally { if (is_file($temporary)) unlink($temporary); }
        return $candidate;
    } finally { flock($handle, LOCK_UN); fclose($handle); }
}
