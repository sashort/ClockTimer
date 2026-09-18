<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/_core/bootstrap.php';

function destroy_current_session(): void
{
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
}

$method = require_method('GET', 'POST', 'DELETE');

if ($method === 'GET') {
    json_response([
        'user' => current_user(),
        'csrfToken' => csrf_token(),
    ]);
}

$input = json_input();

if ($method === 'DELETE') {
    $currentUserId = authenticated_user_id();
    require_csrf();

    $userId = require_positive_int($input, 'userId');

    if ($userId !== $currentUserId) {
        api_error(
            'Deleting another user requires an administrative permission.',
            403,
            'permission_required'
        );
    }

    audited_write(static function (PDO $pdo) use ($userId): void {
        $deleteEvents = $pdo->prepare(
            'DELETE e FROM trip_events e '
            . 'INNER JOIN trips t ON t.id = e.trip_id '
            . 'WHERE t.user_id = :user_id'
        );
        $deleteEvents->execute([':user_id' => $userId]);

        $deleteTrips = $pdo->prepare(
            'DELETE FROM trips WHERE user_id = :user_id'
        );
        $deleteTrips->execute([':user_id' => $userId]);

        $deleteUser = $pdo->prepare(
            'DELETE FROM users WHERE id = :user_id'
        );
        $deleteUser->execute([':user_id' => $userId]);

        if ($deleteUser->rowCount() !== 1) {
            api_error('User was not found.', 404, 'user_not_found');
        }
    });

    destroy_current_session();

    json_response([
        'userId' => $userId,
        'deleted' => true,
        'connected' => false,
    ]);
}

$action = require_string($input, 'action');

if ($action === 'disconnect') {
    authenticated_user_id();
    require_csrf();
    destroy_current_session();

    json_response([
        'connected' => false,
    ]);
}

if ($action !== 'connect') {
    api_error('Unknown user action.', 422, 'invalid_action');
}

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
