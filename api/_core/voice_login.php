<?php
declare(strict_types=1);
function four_digit_credential(mixed $value, string $field): string
{
    if (!is_string($value) || !preg_match('/^[0-9]{4}$/D', $value)) {
        api_error($field . ' must contain exactly four digits.', 422, 'invalid_argument');
    }
    return $value;
}
function authenticate_voice_login(PDO $pdo, array $input, string $origin, ?int $now = null): array
{
    $id = four_digit_credential($input['loginId'] ?? null, 'loginId');
    $pin = four_digit_credential($input['pin'] ?? null, 'pin');
    $now ??= time();
    $accountBucket = hash('sha256', 'account:' . $id);
    $limits = [$accountBucket => 5, hash('sha256', 'origin:' . $origin) => 20];
    ksort($limits);
    $sqlite = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
    $pdo->beginTransaction();
    try {
        foreach ($limits as $bucket => $limit) {
            $pdo->prepare(($sqlite ? 'INSERT OR IGNORE' : 'INSERT IGNORE') . ' INTO voice_login_attempts (bucket, window_start, attempts) VALUES (:bucket, :now, 0)')->execute([':bucket' => $bucket, ':now' => $now]);
            $query = $pdo->prepare('SELECT window_start, attempts FROM voice_login_attempts WHERE bucket = :bucket' . ($sqlite ? '' : ' FOR UPDATE'));
            $query->execute([':bucket' => $bucket]);
            $row = $query->fetch(PDO::FETCH_ASSOC);
            if ($now - (int) $row['window_start'] >= 60) {
                $pdo->prepare('UPDATE voice_login_attempts SET window_start = :now, attempts = 0 WHERE bucket = :bucket')->execute([':bucket' => $bucket, ':now' => $now]);
            } elseif ((int) $row['attempts'] >= $limit) {
                $pdo->rollBack();
                api_error('Please wait before trying to log in again.', 429, 'login_rate_limited');
            }
        }
        foreach ($limits as $bucket => $limit) $pdo->prepare('UPDATE voice_login_attempts SET attempts = attempts + 1 WHERE bucket = :bucket')->execute([':bucket' => $bucket]);
        $query = $pdo->prepare('SELECT id, first_name, last_name, preferred_name, username, permissions, pin_hash FROM users WHERE login_id = :login_id LIMIT 1');
        $query->execute([':login_id' => $id]);
        $user = $query->fetch(PDO::FETCH_ASSOC);
        $hash = $user['pin_hash'] ?? '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi';
        $matched = password_verify($pin, $hash) && $user && !empty($user['pin_hash']);
        if ($matched) $pdo->prepare('DELETE FROM voice_login_attempts WHERE bucket = :bucket')->execute([':bucket' => $accountBucket]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    if (!$matched) api_error('The user ID or PIN is incorrect.', 401, 'invalid_credentials');
    unset($user['pin_hash']);
    return $user;
}
