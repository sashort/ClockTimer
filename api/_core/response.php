<?php
declare(strict_types=1);

function json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}

function api_error(string $message, int $status = 400, string $code = 'bad_request'): never
{
    json_response([
        'error' => $code,
        'message' => $message,
    ], $status);
}

function json_input(): array
{
    $raw = file_get_contents('php://input');

    if ($raw === false || trim($raw) === '') {
        return [];
    }

    try {
        $value = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        api_error('Request body must be valid JSON.', 400, 'invalid_json');
    }

    if (!is_array($value)) {
        api_error('Request body must be a JSON object.', 400, 'invalid_json');
    }

    return $value;
}

function require_method(string ...$allowed): string
{
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if (!in_array($method, $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed));
        api_error('Method not allowed.', 405, 'method_not_allowed');
    }

    return $method;
}

function require_string(array $input, string $name, bool $allowEmpty = false): string
{
    if (!array_key_exists($name, $input) || !is_string($input[$name])) {
        api_error("{$name} must be a string.", 422, 'invalid_argument');
    }

    $value = trim($input[$name]);

    if (!$allowEmpty && $value === '') {
        api_error("{$name} must not be empty.", 422, 'invalid_argument');
    }

    return $value;
}

function require_positive_int(array $input, string $name): int
{
    $value = $input[$name] ?? null;

    if (is_string($value) && ctype_digit($value)) {
        $value = (int) $value;
    }

    if (!is_int($value) || $value < 1) {
        api_error("{$name} must be a positive integer.", 422, 'invalid_argument');
    }

    return $value;
}

function normalize_datetime(string $value, string $name): string
{
    try {
        $date = new DateTimeImmutable($value);
    } catch (Throwable) {
        api_error("{$name} must be a valid date/time.", 422, 'invalid_argument');
    }

    return $date
        ->setTimezone(new DateTimeZone('UTC'))
        ->format('Y-m-d H:i:s.v');
}
