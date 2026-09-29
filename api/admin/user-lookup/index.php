<?php
declare(strict_types=1);

require_once dirname(dirname(__DIR__)) . '/_core/bootstrap.php';

const USER_LOOKUP_DEFAULT_LIMIT = 25;
const USER_LOOKUP_MAX_LIMIT = 50;

function user_lookup_optional_text(string $name, int $maxLength): ?string
{
    if (!array_key_exists($name, $_GET)) {
        return null;
    }

    $value = $_GET[$name];

    if (!is_string($value)) {
        api_error($name . ' must be a string.', 422, 'invalid_argument');
    }

    $value = trim($value);

    if ($value === '') {
        return null;
    }

    $length = preg_match_all('/./us', $value);

    if ($length === false || $length > $maxLength) {
        api_error($name . ' is too long or is invalid UTF-8.', 422, 'invalid_argument');
    }

    return $value;
}

function user_lookup_optional_positive_int(string $name): ?int
{
    if (!array_key_exists($name, $_GET) || $_GET[$name] === '') {
        return null;
    }

    $value = $_GET[$name];

    if (
        is_int($value) ||
        (
            is_string($value) &&
            preg_match('/^[1-9]\d*$/D', $value)
        )
    ) {
        $number = (int) $value;

        if ($number > 0) {
            return $number;
        }
    }

    api_error($name . ' must be a positive integer.', 422, 'invalid_argument');
}

function user_lookup_identity(array $row): array
{
    return [
        'type' => 'user',
        'version' => 1,
        'userId' => (int) $row['id'],
        'firstName' => (string) $row['first_name'],
        'lastName' => (string) $row['last_name'],
        'preferredName' =>
            $row['preferred_name'] === null
                ? null
                : (string) $row['preferred_name'],
        'username' => (string) $row['username'],
    ];
}

require_method('GET');
require_permission(PERMISSION_LOOKUP_USERS);

$id = user_lookup_optional_positive_int('id');
$username = user_lookup_optional_text('username', 191);
$firstName = user_lookup_optional_text('firstName', 100);
$lastName = user_lookup_optional_text('lastName', 100);
$preferredName = user_lookup_optional_text('preferredName', 100);
$afterId = user_lookup_optional_positive_int('afterId') ?? 0;

$limit = USER_LOOKUP_DEFAULT_LIMIT;

if (isset($_GET['limit']) && $_GET['limit'] !== '') {
    $rawLimit = $_GET['limit'];

    if (
        !is_string($rawLimit) ||
        !preg_match('/^\d+$/D', $rawLimit)
    ) {
        api_error('limit must be a positive integer.', 422, 'invalid_argument');
    }

    $limit = (int) $rawLimit;

    if ($limit < 1 || $limit > USER_LOOKUP_MAX_LIMIT) {
        api_error(
            'limit must be between 1 and ' . USER_LOOKUP_MAX_LIMIT . '.',
            422,
            'invalid_argument'
        );
    }
}

if (
    $id === null &&
    $username === null &&
    $firstName === null &&
    $lastName === null &&
    $preferredName === null
) {
    api_error(
        'At least one user lookup criterion is required.',
        422,
        'invalid_argument'
    );
}

$where = [];
$params = [];

if ($id !== null) {
    $where[] = 'id = :id';
    $params[':id'] = $id;
}

if ($username !== null) {
    $where[] = 'LEFT(username, CHAR_LENGTH(:username)) = :username';
    $params[':username'] = $username;
}

if ($firstName !== null) {
    $where[] = 'LOCATE(:first_name, first_name) > 0';
    $params[':first_name'] = $firstName;
}

if ($lastName !== null) {
    $where[] = 'LOCATE(:last_name, last_name) > 0';
    $params[':last_name'] = $lastName;
}

if ($preferredName !== null) {
    $where[] = 'preferred_name IS NOT NULL AND LOCATE(:preferred_name, preferred_name) > 0';
    $params[':preferred_name'] = $preferredName;
}

if ($afterId > 0) {
    $where[] = 'id > :after_id';
    $params[':after_id'] = $afterId;
}

$sql =
    'SELECT id, first_name, last_name, preferred_name, username '
    . 'FROM users WHERE '
    . implode(' AND ', $where)
    . ' ORDER BY id ASC LIMIT '
    . ($limit + 1);

$statement = db()->prepare($sql);
$statement->execute($params);
$rows = $statement->fetchAll();

$hasMore = count($rows) > $limit;

if ($hasMore) {
    array_pop($rows);
}

$identities =
    array_map(
        'user_lookup_identity',
        $rows
    );

$nextAfterId =
    $hasMore && $identities !== []
        ? $identities[
            count($identities) -
            1
        ]['userId']
        : null;

json_response([
    'identities' => $identities,
    'hasMore' => $hasMore,
    'nextAfterId' => $nextAfterId,
    'permission' => PERMISSION_LOOKUP_USERS,
]);
