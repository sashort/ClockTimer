<?php
declare(strict_types=1);

function authenticated_user_id(): int
{
    $value = $_SESSION['user_id'] ?? null;

    if (!is_int($value) && !(is_string($value) && ctype_digit($value))) {
        api_error('Authentication is required.', 401, 'unauthorized');
    }

    $id = (int) $value;

    if ($id < 1) {
        api_error('Authentication is required.', 401, 'unauthorized');
    }

    return $id;
}

function current_user(): array
{
    $statement = db()->prepare(
        'SELECT id, first_name, last_name, preferred_name, username, permissions FROM users WHERE id = :id LIMIT 1'
    );
    $statement->execute([':id' => authenticated_user_id()]);
    $user = $statement->fetch();

    if (!$user) {
        $_SESSION = [];
        api_error('Authentication is required.', 401, 'unauthorized');
    }

    $user['id'] = (int) $user['id'];
    $user['permissions'] = (int) $user['permissions'];
    return $user;
}

function require_trip_owner(PDO $pdo, int $tripId): array
{
    $statement = $pdo->prepare(
        'SELECT id, user_id, start_time, end_time FROM trips WHERE id = :id AND user_id = :user_id LIMIT 1'
    );
    $statement->execute([
        ':id' => $tripId,
        ':user_id' => authenticated_user_id(),
    ]);
    $trip = $statement->fetch();

    if (!$trip) {
        api_error('Trip was not found.', 404, 'trip_not_found');
    }

    return $trip;
}
