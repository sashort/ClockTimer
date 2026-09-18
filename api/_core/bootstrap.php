<?php
declare(strict_types=1);

date_default_timezone_set('UTC');

require_once __DIR__ . '/response.php';

$isHttps = !empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off';

session_set_cookie_params([
    'httponly' => true,
    'secure' => $isHttps,
    'samesite' => 'Lax',
    'path' => '/',
]);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/permissions.php';
require_once __DIR__ . '/user_accounts.php';
require_once __DIR__ . '/migrations.php';
require_once __DIR__ . '/csrf.php';
require_once __DIR__ . '/trip_events.php';

set_exception_handler(static function (Throwable $error): never {
    error_log($error->__toString());
    api_error('The server could not complete the request.', 500, 'server_error');
});
