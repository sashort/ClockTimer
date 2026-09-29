<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit(1);
}

function api_error(string $message, int $status = 400, string $code = 'bad_request'): never
{
    throw new RuntimeException($code . ': ' . $message);
}

require_once dirname(__DIR__) . '/api/_core/database.php';
require_once dirname(__DIR__) . '/api/_core/permissions.php';

const LIVE_WS_TOKEN_TTL_SECONDS = 60;
const LIVE_WS_MAX_FRAME_BYTES = 1048576;
const LIVE_WS_PERMISSION_SWEEP_SECONDS = 2;
const LIVE_WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function live_ws_now(): int
{
    return time();
}

function live_ws_config(): array
{
    $config = api_config()['live_stream'] ?? [];
    return is_array($config) ? $config : [];
}

function live_ws_bind(): string
{
    $value = trim((string) (live_ws_config()['websocket_bind'] ?? '127.0.0.1:8765'));
    return $value !== '' ? $value : '127.0.0.1:8765';
}

function live_ws_user(PDO $pdo, int $userId): ?array
{
    $statement = $pdo->prepare(
        'SELECT id, username, first_name, last_name, preferred_name, permissions '
        . 'FROM users WHERE id = :id LIMIT 1'
    );
    $statement->execute([':id' => $userId]);
    $row = $statement->fetch();

    if (!$row) {
        return null;
    }

    $row['id'] = (int) $row['id'];
    $row['permissions'] = (int) $row['permissions'];
    return $row;
}

function live_ws_can_view(array $user): bool
{
    return has_permission($user, PERMISSION_VIEW_LIVE_STREAMS);
}

function live_ws_consume_token(PDO $pdo, string $token): ?array
{
    if (!preg_match('/^[A-Za-z0-9_-]{32,256}$/D', $token)) {
        return null;
    }

    $hash = hash('sha256', $token);
    $now = live_ws_now();

    $pdo->beginTransaction();

    try {
        $deleteExpired = $pdo->prepare(
            'DELETE FROM live_stream_socket_tokens WHERE expires_at <= :now'
        );
        $deleteExpired->execute([':now' => $now]);

        $statement = $pdo->prepare(
            'SELECT t.id AS token_id, u.id, u.username, u.first_name, '
            . 'u.last_name, u.preferred_name, u.permissions '
            . 'FROM live_stream_socket_tokens t '
            . 'INNER JOIN users u ON u.id = t.user_id '
            . 'WHERE t.token_hash = :token_hash AND t.expires_at > :now '
            . 'LIMIT 1 FOR UPDATE'
        );
        $statement->execute([
            ':token_hash' => $hash,
            ':now' => $now,
        ]);
        $row = $statement->fetch();

        if (!$row) {
            $pdo->rollBack();
            return null;
        }

        $delete = $pdo->prepare(
            'DELETE FROM live_stream_socket_tokens WHERE id = :id'
        );
        $delete->execute([':id' => (int) $row['token_id']]);
        $pdo->commit();

        return [
            'id' => (int) $row['id'],
            'username' => (string) $row['username'],
            'first_name' => (string) $row['first_name'],
            'last_name' => (string) $row['last_name'],
            'preferred_name' =>
                $row['preferred_name'] === null
                    ? null
                    : (string) $row['preferred_name'],
            'permissions' => (int) $row['permissions'],
        ];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function live_ws_display_name(array $user): string
{
    foreach (['preferred_name', 'first_name', 'username'] as $key) {
        $value = trim((string) ($user[$key] ?? ''));
        if ($value !== '') {
            return $value;
        }
    }

    return 'User';
}

function live_ws_frame(string $payload, int $opcode = 1): string
{
    $length = strlen($payload);
    $header = chr(0x80 | ($opcode & 0x0f));

    if ($length < 126) {
        return $header . chr($length) . $payload;
    }

    if ($length <= 0xffff) {
        return $header . chr(126) . pack('n', $length) . $payload;
    }

    $high = intdiv($length, 4294967296);
    $low = $length % 4294967296;

    return $header . chr(127) . pack('NN', $high, $low) . $payload;
}

function live_ws_write(array &$client, string $bytes): bool
{
    $socket = $client['socket'] ?? null;

    if (!is_resource($socket)) {
        return false;
    }

    $length = strlen($bytes);
    $offset = 0;

    while ($offset < $length) {
        $written = @fwrite($socket, substr($bytes, $offset));

        if ($written === false || $written === 0) {
            return false;
        }

        $offset += $written;
    }

    return true;
}

function live_ws_send(array &$client, array $message): bool
{
    try {
        $payload = json_encode(
            $message,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
        );
    } catch (JsonException) {
        return false;
    }

    return live_ws_write($client, live_ws_frame($payload));
}

function live_ws_send_response(
    array &$client,
    mixed $requestId,
    array $payload = []
): void {
    live_ws_send(
        $client,
        [
            'type' => 'response',
            'requestId' => $requestId,
            'ok' => true,
            ...$payload,
        ]
    );
}

function live_ws_send_error(
    array &$client,
    mixed $requestId,
    string $code,
    string $message
): void {
    live_ws_send(
        $client,
        [
            'type' => 'response',
            'requestId' => $requestId,
            'ok' => false,
            'error' => $code,
            'message' => $message,
        ]
    );
}

function live_ws_http_error($socket, int $status, string $message): void
{
    $reason = match ($status) {
        400 => 'Bad Request',
        401 => 'Unauthorized',
        404 => 'Not Found',
        default => 'Error',
    };

    $body = $message . "\n";
    @fwrite(
        $socket,
        "HTTP/1.1 {$status} {$reason}\r\n"
        . "Connection: close\r\n"
        . "Content-Type: text/plain; charset=utf-8\r\n"
        . 'Content-Length: ' . strlen($body) . "\r\n\r\n"
        . $body
    );
}

function live_ws_handshake(array &$client, PDO $pdo): bool
{
    $buffer = $client['buffer'];
    $end = strpos($buffer, "\r\n\r\n");

    if ($end === false) {
        return false;
    }

    $headerText = substr($buffer, 0, $end + 4);
    $client['buffer'] = substr($buffer, $end + 4);
    $lines = preg_split('/\r\n/', trim($headerText));

    if (!$lines || !preg_match('/^GET\s+(\S+)\s+HTTP\/1\.[01]$/', $lines[0], $match)) {
        live_ws_http_error($client['socket'], 400, 'Invalid WebSocket request.');
        $client['close'] = true;
        return false;
    }

    $target = $match[1];
    $path = (string) parse_url($target, PHP_URL_PATH);

    if ($path !== '/live-stream-ws' && $path !== '/live-stream-ws/') {
        live_ws_http_error($client['socket'], 404, 'WebSocket endpoint not found.');
        $client['close'] = true;
        return false;
    }

    $headers = [];

    foreach (array_slice($lines, 1) as $line) {
        $position = strpos($line, ':');

        if ($position === false) {
            continue;
        }

        $name = strtolower(trim(substr($line, 0, $position)));
        $headers[$name] = trim(substr($line, $position + 1));
    }

    $key = $headers['sec-websocket-key'] ?? '';

    if (
        $key === '' ||
        strtolower((string) ($headers['upgrade'] ?? '')) !== 'websocket'
    ) {
        live_ws_http_error($client['socket'], 400, 'WebSocket upgrade is required.');
        $client['close'] = true;
        return false;
    }

    $query = (string) parse_url($target, PHP_URL_QUERY);
    parse_str($query, $parameters);
    $token = is_string($parameters['token'] ?? null)
        ? $parameters['token']
        : '';

    $user = live_ws_consume_token($pdo, $token);

    if ($user === null) {
        live_ws_http_error($client['socket'], 401, 'Live stream authorization failed.');
        $client['close'] = true;
        return false;
    }

    $accept = base64_encode(sha1($key . LIVE_WS_GUID, true));
    $response =
        "HTTP/1.1 101 Switching Protocols\r\n"
        . "Upgrade: websocket\r\n"
        . "Connection: Upgrade\r\n"
        . "Sec-WebSocket-Accept: {$accept}\r\n\r\n";

    if (!live_ws_write($client, $response)) {
        $client['close'] = true;
        return false;
    }

    $client['handshake'] = true;
    $client['user'] = $user;
    $client['connected_at'] = microtime(true);
    $client['snapshot'] = null;
    $client['available'] = false;
    $client['fragment_opcode'] = null;
    $client['fragment_data'] = '';

    live_ws_send(
        $client,
        [
            'type' => 'ready',
            'userId' => $user['id'],
        ]
    );

    return true;
}

function live_ws_decode_frames(array &$client): array
{
    $messages = [];
    $buffer =& $client['buffer'];

    while (strlen($buffer) >= 2) {
        $first = ord($buffer[0]);
        $second = ord($buffer[1]);
        $fin = ($first & 0x80) !== 0;
        $opcode = $first & 0x0f;
        $masked = ($second & 0x80) !== 0;
        $length = $second & 0x7f;
        $offset = 2;

        if ($length === 126) {
            if (strlen($buffer) < 4) {
                break;
            }

            $length = unpack('nlength', substr($buffer, 2, 2))['length'];
            $offset = 4;
        } elseif ($length === 127) {
            if (strlen($buffer) < 10) {
                break;
            }

            $parts = unpack('Nhigh/Nlow', substr($buffer, 2, 8));

            if ($parts['high'] !== 0) {
                $client['close'] = true;
                return $messages;
            }

            $length = $parts['low'];
            $offset = 10;
        }

        if ($length > LIVE_WS_MAX_FRAME_BYTES || !$masked) {
            $client['close'] = true;
            return $messages;
        }

        if (strlen($buffer) < $offset + 4 + $length) {
            break;
        }

        $mask = substr($buffer, $offset, 4);
        $offset += 4;
        $payload = substr($buffer, $offset, $length);
        $buffer = substr($buffer, $offset + $length);

        for ($index = 0; $index < $length; $index++) {
            $payload[$index] =
                chr(ord($payload[$index]) ^ ord($mask[$index % 4]));
        }

        if ($opcode === 0x8) {
            live_ws_write($client, live_ws_frame('', 0x8));
            $client['close'] = true;
            return $messages;
        }

        if ($opcode === 0x9) {
            live_ws_write($client, live_ws_frame($payload, 0xA));
            continue;
        }

        if ($opcode === 0xA) {
            continue;
        }

        if ($opcode === 0x0) {
            if ($client['fragment_opcode'] === null) {
                $client['close'] = true;
                return $messages;
            }

            $client['fragment_data'] .= $payload;

            if (strlen($client['fragment_data']) > LIVE_WS_MAX_FRAME_BYTES) {
                $client['close'] = true;
                return $messages;
            }

            if ($fin) {
                if ($client['fragment_opcode'] === 0x1) {
                    $messages[] = $client['fragment_data'];
                }

                $client['fragment_opcode'] = null;
                $client['fragment_data'] = '';
            }

            continue;
        }

        if ($opcode !== 0x1) {
            continue;
        }

        if ($fin) {
            $messages[] = $payload;
            continue;
        }

        $client['fragment_opcode'] = $opcode;
        $client['fragment_data'] = $payload;
    }

    return $messages;
}

function live_ws_validate_description(mixed $value, string $type): ?array
{
    if (
        !is_array($value) ||
        ($value['type'] ?? null) !== $type ||
        !is_string($value['sdp'] ?? null) ||
        trim($value['sdp']) === ''
    ) {
        return null;
    }

    return $value;
}

function live_ws_target_client(
    array $clients,
    int $targetUserId
): ?int {
    $bestId = null;
    $bestTime = -INF;

    foreach ($clients as $clientId => $client) {
        if (
            !($client['handshake'] ?? false) ||
            !($client['available'] ?? false) ||
            (int) ($client['user']['id'] ?? 0) !== $targetUserId
        ) {
            continue;
        }

        $connectedAt = (float) ($client['connected_at'] ?? 0);

        if ($connectedAt >= $bestTime) {
            $bestId = (int) $clientId;
            $bestTime = $connectedAt;
        }
    }

    return $bestId;
}

function live_ws_targets(
    array $clients,
    int $viewerUserId
): array {
    $targets = [];

    foreach ($clients as $client) {
        $user = $client['user'] ?? null;

        if (
            !($client['handshake'] ?? false) ||
            !($client['available'] ?? false) ||
            !is_array($user) ||
            (int) $user['id'] === $viewerUserId
        ) {
            continue;
        }

        $id = (int) $user['id'];

        if (!isset($targets[$id])) {
            $targets[$id] = [
                'userId' => $id,
                'username' => (string) $user['username'],
                'firstName' => (string) $user['first_name'],
                'lastName' => (string) $user['last_name'],
                'preferredName' => $user['preferred_name'],
            ];
        }
    }

    uasort(
        $targets,
        static fn (array $left, array $right): int =>
            strcasecmp(
                (string) ($left['preferredName'] ?: $left['firstName'] ?: $left['username']),
                (string) ($right['preferredName'] ?: $right['firstName'] ?: $right['username'])
            )
    );

    return array_values($targets);
}

function live_ws_close_peer(
    int $peerId,
    array &$peers,
    array &$clients,
    string $reason = 'closed'
): void {
    $peer = $peers[$peerId] ?? null;

    if (!$peer) {
        return;
    }

    foreach (['viewerClientId', 'publisherClientId'] as $key) {
        $clientId = (int) $peer[$key];

        if (isset($clients[$clientId])) {
            live_ws_send(
                $clients[$clientId],
                [
                    'type' => 'peer.closed',
                    'peerId' => $peerId,
                    'reason' => $reason,
                ]
            );
        }
    }

    unset($peers[$peerId]);
}

function live_ws_disconnect_client(
    int $clientId,
    array &$clients,
    array &$peers
): void {
    foreach (array_keys($peers) as $peerId) {
        $peer = $peers[$peerId];

        if (
            (int) $peer['viewerClientId'] === $clientId ||
            (int) $peer['publisherClientId'] === $clientId
        ) {
            live_ws_close_peer(
                (int) $peerId,
                $peers,
                $clients,
                'peer_disconnected'
            );
        }
    }

    if (isset($clients[$clientId]['socket']) && is_resource($clients[$clientId]['socket'])) {
        @fclose($clients[$clientId]['socket']);
    }

    unset($clients[$clientId]);
}

function live_ws_current_user(PDO $pdo, array &$client): ?array
{
    $userId = (int) ($client['user']['id'] ?? 0);

    if ($userId < 1) {
        return null;
    }

    $fresh = live_ws_user($pdo, $userId);

    if ($fresh !== null) {
        $client['user'] = $fresh;
    }

    return $fresh;
}

function live_ws_handle_message(
    int $clientId,
    array $message,
    PDO $pdo,
    array &$clients,
    array &$peers,
    int &$nextPeerId
): void {
    if (!isset($clients[$clientId])) {
        return;
    }

    $client =& $clients[$clientId];
    $type = (string) ($message['type'] ?? '');
    $requestId = $message['requestId'] ?? null;
    $user = live_ws_current_user($pdo, $client);

    if ($user === null) {
        live_ws_send_error($client, $requestId, 'unauthorized', 'Authentication is required.');
        $client['close'] = true;
        return;
    }

    if ($type === 'presence.start') {
        $client['available'] = true;
        $client['snapshot'] =
            $message['snapshot'] ??
            null;

        live_ws_send_response(
            $client,
            $requestId,
            [
                'available' => true,
            ]
        );
        return;
    }

    if ($type === 'presence.stop') {
        $client['available'] = false;
        $client['snapshot'] = null;

        foreach (array_keys($peers) as $peerId) {
            $peer = $peers[$peerId];

            if ((int) $peer['publisherClientId'] === $clientId) {
                live_ws_close_peer(
                    (int) $peerId,
                    $peers,
                    $clients,
                    'publisher_unavailable'
                );
            }
        }

        live_ws_send_response(
            $client,
            $requestId,
            [
                'available' => false,
            ]
        );
        return;
    }

    if ($type === 'targets.request') {
        if (!live_ws_can_view($user)) {
            live_ws_send_error(
                $client,
                $requestId,
                'permission_required',
                'Viewing live streams requires permission.'
            );
            return;
        }

        live_ws_send_response(
            $client,
            $requestId,
            [
                'targets' => live_ws_targets($clients, (int) $user['id']),
            ]
        );
        return;
    }

    if ($type === 'peer.join') {
        if (!live_ws_can_view($user)) {
            live_ws_send_error(
                $client,
                $requestId,
                'permission_required',
                'Viewing live streams requires permission.'
            );
            return;
        }

        $targetUserId = (int) ($message['targetUserId'] ?? 0);
        $offer = live_ws_validate_description($message['offer'] ?? null, 'offer');

        if ($targetUserId < 1 || $targetUserId === (int) $user['id'] || $offer === null) {
            live_ws_send_error($client, $requestId, 'invalid_argument', 'A valid target and offer are required.');
            return;
        }

        $publisherClientId = live_ws_target_client($clients, $targetUserId);

        if ($publisherClientId === null || !isset($clients[$publisherClientId])) {
            live_ws_send_error($client, $requestId, 'live_stream_not_found', 'The target user is not connected.');
            return;
        }

        $peerId = $nextPeerId++;
        $peers[$peerId] = [
            'viewerClientId' => $clientId,
            'publisherClientId' => $publisherClientId,
            'viewerUserId' => (int) $user['id'],
            'targetUserId' => $targetUserId,
            'createdAt' => microtime(true),
        ];

        live_ws_send_response(
            $client,
            $requestId,
            [
                'peerId' => $peerId,
                'targetUserId' => $targetUserId,
                'snapshot' => $clients[$publisherClientId]['snapshot'] ?? null,
            ]
        );

        live_ws_send(
            $clients[$publisherClientId],
            [
                'type' => 'peer.offer',
                'peerId' => $peerId,
                'offer' => $offer,
            ]
        );
        return;
    }

    if ($type === 'peer.answer') {
        $peerId = (int) ($message['peerId'] ?? 0);
        $peer = $peers[$peerId] ?? null;
        $answer = live_ws_validate_description($message['answer'] ?? null, 'answer');

        if (
            !$peer ||
            (int) $peer['publisherClientId'] !== $clientId ||
            $answer === null
        ) {
            return;
        }

        $viewerClientId = (int) $peer['viewerClientId'];

        if (isset($clients[$viewerClientId])) {
            live_ws_send(
                $clients[$viewerClientId],
                [
                    'type' => 'peer.answer',
                    'peerId' => $peerId,
                    'answer' => $answer,
                ]
            );
        }
        return;
    }

    if ($type === 'peer.candidate') {
        $peerId = (int) ($message['peerId'] ?? 0);
        $peer = $peers[$peerId] ?? null;
        $candidate = $message['candidate'] ?? null;

        if (!$peer || !is_array($candidate)) {
            return;
        }

        if ((int) $peer['publisherClientId'] === $clientId) {
            $destinationId = (int) $peer['viewerClientId'];
        } elseif ((int) $peer['viewerClientId'] === $clientId) {
            if (!live_ws_can_view($user)) {
                live_ws_close_peer($peerId, $peers, $clients, 'permission_revoked');
                return;
            }

            $destinationId = (int) $peer['publisherClientId'];
        } else {
            return;
        }

        if (isset($clients[$destinationId])) {
            live_ws_send(
                $clients[$destinationId],
                [
                    'type' => 'peer.candidate',
                    'peerId' => $peerId,
                    'candidate' => $candidate,
                ]
            );
        }
        return;
    }

    if ($type === 'peer.leave') {
        $peerId = (int) ($message['peerId'] ?? 0);
        $peer = $peers[$peerId] ?? null;

        if (
            $peer &&
            (
                (int) $peer['viewerClientId'] === $clientId ||
                (int) $peer['publisherClientId'] === $clientId
            )
        ) {
            live_ws_close_peer($peerId, $peers, $clients, 'left');
        }
        return;
    }

    if ($type === 'trainer.tts') {
        if (!live_ws_can_view($user)) {
            live_ws_send_error(
                $client,
                $requestId,
                'permission_required',
                'Live stream permission is required.'
            );
            return;
        }

        $peerId = (int) ($message['peerId'] ?? 0);
        $peer = $peers[$peerId] ?? null;
        $text = trim((string) ($message['text'] ?? ''));

        if (
            !$peer ||
            (int) $peer['viewerClientId'] !== $clientId ||
            (int) $peer['targetUserId'] !== (int) ($message['targetUserId'] ?? 0)
        ) {
            live_ws_send_error($client, $requestId, 'permission_required', 'Live stream peer access is denied.');
            return;
        }

        $length = function_exists('mb_strlen') ? mb_strlen($text, 'UTF-8') : strlen($text);

        if ($text === '' || $length > 500) {
            live_ws_send_error($client, $requestId, 'invalid_argument', 'Trainer TTS text must contain 1-500 characters.');
            return;
        }

        $publisherClientId = (int) $peer['publisherClientId'];

        if (!isset($clients[$publisherClientId])) {
            live_ws_send_error($client, $requestId, 'live_stream_not_found', 'The target user is not connected.');
            return;
        }

        live_ws_send(
            $clients[$publisherClientId],
            [
                'type' => 'trainer.tts',
                'peerId' => $peerId,
                'text' => $text,
            ]
        );

        live_ws_send_response(
            $client,
            $requestId,
            [
                'sent' => true,
            ]
        );
        return;
    }

    if ($type === 'publisher.event') {
        if (!($client['available'] ?? false)) {
            return;
        }

        $eventType = (string) ($message['eventType'] ?? '');

        if (!preg_match('/^[a-z0-9][a-z0-9._-]{0,63}$/D', $eventType)) {
            return;
        }

        $payload = $message['payload'] ?? null;

        if ($eventType === 'snapshot') {
            $client['snapshot'] = $payload;
        }

        foreach ($peers as $peerId => $peer) {
            if ((int) $peer['publisherClientId'] !== $clientId) {
                continue;
            }

            $viewerClientId = (int) $peer['viewerClientId'];

            if (!isset($clients[$viewerClientId])) {
                continue;
            }

            live_ws_send(
                $clients[$viewerClientId],
                [
                    'type' => 'publisher.event',
                    'peerId' => (int) $peerId,
                    'eventType' => $eventType,
                    'payload' => $payload,
                    'timestamp' => gmdate('c'),
                ]
            );
        }
        return;
    }

    if ($type === 'ping') {
        live_ws_send_response($client, $requestId, ['pong' => true]);
        return;
    }

    live_ws_send_error($client, $requestId, 'invalid_action', 'Unknown live stream message type.');
}

$pdo = db();
$bind = live_ws_bind();
$server = @stream_socket_server(
    'tcp://' . $bind,
    $errorNumber,
    $errorMessage,
    STREAM_SERVER_BIND | STREAM_SERVER_LISTEN
);

if (!is_resource($server)) {
    fwrite(STDERR, "Unable to bind live stream WebSocket server to {$bind}: {$errorMessage}\n");
    exit(1);
}

stream_set_blocking($server, false);
fwrite(STDOUT, "ClockTimer live stream WebSocket listening on {$bind}\n");

$clients = [];
$peers = [];
$nextPeerId = 1;
$lastPermissionSweep = microtime(true);

while (true) {
    $read = [$server];

    foreach ($clients as $client) {
        if (isset($client['socket']) && is_resource($client['socket'])) {
            $read[] = $client['socket'];
        }
    }

    $write = null;
    $except = null;
    $changed = @stream_select($read, $write, $except, 1);

    if ($changed === false) {
        usleep(100000);
        continue;
    }

    foreach ($read as $socket) {
        if ($socket === $server) {
            while (($connection = @stream_socket_accept($server, 0)) !== false) {
                stream_set_blocking($connection, false);
                $clientId = get_resource_id($connection);
                $clients[$clientId] = [
                    'socket' => $connection,
                    'buffer' => '',
                    'handshake' => false,
                    'close' => false,
                    'user' => null,
                ];
            }

            continue;
        }

        $clientId = get_resource_id($socket);

        if (!isset($clients[$clientId])) {
            continue;
        }

        $chunk = @fread($socket, 65536);

        if ($chunk === '' || $chunk === false) {
            if (feof($socket)) {
                live_ws_disconnect_client($clientId, $clients, $peers);
            }

            continue;
        }

        $clients[$clientId]['buffer'] .= $chunk;

        if (!$clients[$clientId]['handshake']) {
            try {
                live_ws_handshake($clients[$clientId], $pdo);
            } catch (Throwable $error) {
                fwrite(STDERR, "Live stream handshake failed: {$error->getMessage()}\n");
                $clients[$clientId]['close'] = true;
            }
        }

        if (($clients[$clientId]['handshake'] ?? false) && isset($clients[$clientId])) {
            foreach (live_ws_decode_frames($clients[$clientId]) as $payload) {
                try {
                    $message = json_decode($payload, true, 64, JSON_THROW_ON_ERROR);

                    if (!is_array($message)) {
                        continue;
                    }

                    live_ws_handle_message(
                        $clientId,
                        $message,
                        $pdo,
                        $clients,
                        $peers,
                        $nextPeerId
                    );
                } catch (Throwable $error) {
                    if (isset($clients[$clientId])) {
                        live_ws_send_error(
                            $clients[$clientId],
                            null,
                            'invalid_message',
                            'Invalid live stream message.'
                        );
                    }
                }
            }
        }

        if (($clients[$clientId]['close'] ?? false) === true) {
            live_ws_disconnect_client($clientId, $clients, $peers);
        }
    }

    $now = microtime(true);

    if ($now - $lastPermissionSweep >= LIVE_WS_PERMISSION_SWEEP_SECONDS) {
        $lastPermissionSweep = $now;
        $permissionCache = [];

        foreach (array_keys($peers) as $peerId) {
            $peer = $peers[$peerId];

            if (
                !isset($clients[(int) $peer['viewerClientId']]) ||
                !isset($clients[(int) $peer['publisherClientId']])
            ) {
                live_ws_close_peer((int) $peerId, $peers, $clients, 'peer_disconnected');
                continue;
            }

            $viewerUserId = (int) $peer['viewerUserId'];

            if (!array_key_exists($viewerUserId, $permissionCache)) {
                $fresh = live_ws_user($pdo, $viewerUserId);
                $permissionCache[$viewerUserId] =
                    $fresh !== null && live_ws_can_view($fresh);
            }

            if (!$permissionCache[$viewerUserId]) {
                live_ws_close_peer((int) $peerId, $peers, $clients, 'permission_revoked');
            }
        }
    }
}
