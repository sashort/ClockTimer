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

function require_csrf(): void
{
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $expected = $_SESSION['csrf_token'] ?? '';

    if (
        !is_string($provided) ||
        !is_string($expected) ||
        $provided === '' ||
        $expected === '' ||
        !hash_equals($expected, $provided)
    ) {
        api_error('The CSRF token is invalid or expired.', 403, 'invalid_csrf');
    }
}
