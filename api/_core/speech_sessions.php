<?php
declare(strict_types=1);

function speech_service_config(): array
{
    $path = getenv('CLOCKTIMER_SPEECH_CONFIG') ?: '/etc/clocktimer/speech.json';
    if (!is_file($path)) api_error('Server speech recognition is not configured.', 503, 'speech_unavailable');
    $config = json_decode((string)file_get_contents($path), true, 16, JSON_THROW_ON_ERROR);
    if (!is_array($config) || strlen($config['secret'] ?? '') < 64 || empty($config['models']) || empty($config['origins']))
        api_error('Server speech configuration is incomplete.', 503, 'speech_unavailable');
    return $config;
}

function speech_language(mixed $language, array $models): string
{
    if (is_string($language) && preg_match('/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/iD', $language)) {
        foreach ($models as $supported => $_) if (strcasecmp($language, $supported) === 0) return $supported;
    }
    api_error('No speech model is installed for this language/region.', 422, 'unsupported_language');
}

function speech_issue_ticket(array $config, string $origin, string $language, string $subject, ?int $now = null, bool $authenticated = false): array
{
    $now ??= time();
    $grant = ['v'=>1, 'aud'=>'clocktimer-speech', 'origin'=>$origin, 'language'=>$language,
        'sub'=>hash_hmac('sha256', $subject, $config['secret']), 'authenticated'=>$authenticated,
        'iat'=>$now, 'exp'=>$now+60, 'jti'=>bin2hex(random_bytes(16))];
    $encoded = rtrim(strtr(base64_encode(json_encode($grant, JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES)), '+/', '-_'), '=');
    return ['ticket'=>$encoded.'.'.hash_hmac('sha256', $encoded, $config['secret']), 'expiresAt'=>$grant['exp']];
}

function speech_check_rate(string $address): void
{
    // Cross-session limit; opening a new anonymous PHP session cannot bypass it.
    $root = getenv('CLOCKTIMER_SPEECH_TICKET_DIR') ?: '/var/lib/clocktimer/speech/tickets';
    $path = $root.'/'.hash('sha256', $address).'.json';
    $file = @fopen($path, 'c+');
    if (!$file || !flock($file, LOCK_EX)) api_error('Speech admission is unavailable.', 503, 'speech_unavailable');
    try {
        $events = json_decode(stream_get_contents($file) ?: '[]', true) ?: [];
        $now = time();
        $events = array_values(array_filter($events, static fn($at) => is_int($at) && $at > $now-60));
        if (count($events) >= 20) api_error('Too many speech session requests.', 429, 'speech_rate_limit');
        $events[] = $now;
        rewind($file); ftruncate($file, 0); fwrite($file, json_encode($events, JSON_THROW_ON_ERROR));
    } finally {flock($file, LOCK_UN); fclose($file);}
}
