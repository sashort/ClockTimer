<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

$method = require_method('GET', 'POST', 'DELETE');

if ($method === 'GET') {
    json_response([
        'user' => current_user(),
        'csrfToken' => csrf_token(),
    ]);
}

if ($method === 'DELETE') {
    authenticated_user_id();
    require_csrf();

    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            [
                'expires' => time() - 42000,
                'path' => $params['path'],
                'domain' => $params['domain'],
                'secure' => $params['secure'],
                'httponly' => $params['httponly'],
                'samesite' => $params['samesite'] ?? 'Lax',
            ]
        );
    }

    session_destroy();

    json_response([
        'connected' => false,
    ]);
}

$input = json_input();
$username = require_string($input, 'username');
$password = require_string($input, 'password', true);

$statement = db()->prepare(
    'SELECT id, first_name, last_name, preferred_name, username, password_hash, permissions FROM users WHERE username = :username LIMIT 1'
);
$statement->execute([':username' => $username]);
$user = $statement->fetch();

if (!$user || !password_verify($password, (string) $user['password_hash'])) {
    api_error('The username or password is incorrect.', 401, 'invalid_credentials');
}

session_regenerate_id(true);
$_SESSION['user_id'] = (int) $user['id'];
$_SESSION['csrf_token'] = bin2hex(random_bytes(32));

unset($user['password_hash']);
$user['id'] = (int) $user['id'];
$user['permissions'] = (int) $user['permissions'];

json_response([
    'user' => $user,
    'csrfToken' => $_SESSION['csrf_token'],
]);
