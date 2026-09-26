<?php
declare(strict_types=1);

function csrf_token(): string
{
    $token = $_SESSION['csrf_token'] ?? null;

    if (!is_string($token) || strlen($token) < 32) {
        $token = bin2hex(random_bytes(32));
        $_SESSION['csrf_token'] = $token;
    }

    return $token;
}

function csrf_is_valid(mixed $provided): bool
{
    $expected = $_SESSION['csrf_token'] ?? '';

    return
        is_string($provided) &&
        is_string($expected) &&
        $provided !== '' &&
        $expected !== '' &&
        hash_equals($expected, $provided);
}

function require_csrf(): void
{
    if (!csrf_is_valid($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
        api_error('The CSRF token is invalid or expired.', 403, 'invalid_csrf');
    }
}

function require_csrf_form(string $field = 'csrf_token'): void
{
    if (!csrf_is_valid($_POST[$field] ?? '')) {
        api_error('The CSRF token is invalid or expired.', 403, 'invalid_csrf');
    }
}
