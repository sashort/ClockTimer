<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/_core/bootstrap.php';

const LIVE_STREAM_TTL_SECONDS = 45;
const LIVE_STREAM_RETENTION_SECONDS = 300;
const LIVE_STREAM_MAX_DESCRIPTION_BYTES = 262144;
const LIVE_STREAM_MAX_SIGNAL_BYTES = 32768;
const LIVE_STREAM_MAX_MESSAGE_BYTES = 131072;
const LIVE_STREAM_MAX_SNAPSHOT_BYTES = 131072;

function live_stream_encode_object(mixed $value, string $name, int $maxBytes): string
{
    if (!is_array($value)) {
        api_error($name . ' must be a JSON object.', 422, 'invalid_argument');
    }

    try {
        $encoded = json_encode(
            $value,
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
        );
    } catch (JsonException) {
        api_error($name . ' must be JSON serializable.', 422, 'invalid_argument');
    }

    if (strlen($encoded) > $maxBytes) {
        api_error($name . ' is too large.', 413, 'payload_too_large');
    }

    return $encoded;
}

function live_stream_decode(?string $value): mixed
{
    if ($value === null || $value === '') {
        return null;
    }

    try {
        return json_decode($value, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        return null;
    }
}

function live_stream_description(mixed $value, string $type): string
{
    $encoded = live_stream_encode_object(
        $value,
        $type,
        LIVE_STREAM_MAX_DESCRIPTION_BYTES
    );

    if (
        ($value['type'] ?? null) !== $type ||
        !is_string($value['sdp'] ?? null) ||
        trim((string) $value['sdp']) === ''
    ) {
        api_error(
            $type . ' must contain a matching type and non-empty SDP.',
            422,
            'invalid_argument'
        );
    }

    return $encoded;
}

function live_stream_after_id(string $name): int
{
    $value = $_GET[$name] ?? '0';

    if (is_int($value)) {
        return max(0, $value);
    }

    if (!is_string($value) || !preg_match('/^\d+$/D', $value)) {
        api_error($name . ' must be a non-negative integer.', 422, 'invalid_argument');
    }

    return (int) $value;
}

function live_stream_cleanup(PDO $pdo): void
{
    $now = time();

    foreach (
        [
            ['DELETE FROM live_stream_peers WHERE expires_at <= :value', $now],
            ['DELETE FROM live_stream_sessions WHERE expires_at <= :value', $now],
            [
                'DELETE FROM live_stream_signals WHERE created_at < :value',
                $now - LIVE_STREAM_RETENTION_SECONDS,
            ],
            [
                'DELETE FROM live_stream_messages WHERE created_at < :value',
                $now - LIVE_STREAM_RETENTION_SECONDS,
            ],
        ] as [$sql, $value]
    ) {
        $statement = $pdo->prepare($sql);
        $statement->execute([':value' => $value]);
    }
}

function live_stream_target_user(PDO $pdo, int $targetUserId): array
{
    $statement = $pdo->prepare(
        'SELECT id, username, first_name, last_name, preferred_name '
        . 'FROM users WHERE id = :id LIMIT 1'
    );
    $statement->execute([':id' => $targetUserId]);
    $row = $statement->fetch();

    if (!$row) {
        api_error('Target user was not found.', 404, 'target_user_not_found');
    }

    $row['id'] = (int) $row['id'];
    return $row;
}

function live_stream_ice_servers(): array
{
    $servers = api_config()['webrtc']['ice_servers'] ?? [];

    if (!is_array($servers)) {
        return [];
    }

    $result = [];

    foreach ($servers as $server) {
        if (!is_array($server)) {
            continue;
        }

        $urls = $server['urls'] ?? null;
        $valid =
            is_string($urls)
                ? trim($urls) !== ''
                : (
                    is_array($urls) &&
                    $urls !== [] &&
                    count(
                        array_filter(
                            $urls,
                            static fn (mixed $url): bool =>
                                is_string($url) && trim($url) !== ''
                        )
                    ) === count($urls)
                );

        if (!$valid) {
            continue;
        }

        $item = ['urls' => $urls];

        foreach (['username', 'credential'] as $key) {
            if (isset($server[$key]) && is_string($server[$key])) {
                $item[$key] = $server[$key];
            }
        }

        $result[] = $item;
    }

    return $result;
}

function live_stream_active_session(PDO $pdo, int $ownerUserId): ?array
{
    $statement = $pdo->prepare(
        'SELECT id, owner_user_id, snapshot, created_at, updated_at, expires_at '
        . 'FROM live_stream_sessions '
        . 'WHERE owner_user_id = :owner_user_id AND expires_at > :now LIMIT 1'
    );
    $statement->execute([
        ':owner_user_id' => $ownerUserId,
        ':now' => time(),
    ]);
    $row = $statement->fetch();

    if (!$row) {
        return null;
    }

    foreach (['id', 'owner_user_id', 'created_at', 'updated_at', 'expires_at'] as $key) {
        $row[$key] = (int) $row[$key];
    }

    return $row;
}

function live_stream_peer(PDO $pdo, int $peerId): array
{
    $statement = $pdo->prepare(
        'SELECT p.id, p.session_id, p.viewer_user_id, p.offer, p.answer, '
        . 'p.state, p.created_at, p.updated_at, p.expires_at, '
        . 's.owner_user_id, s.snapshot, s.expires_at AS session_expires_at '
        . 'FROM live_stream_peers p '
        . 'INNER JOIN live_stream_sessions s ON s.id = p.session_id '
        . 'WHERE p.id = :peer_id LIMIT 1'
    );
    $statement->execute([':peer_id' => $peerId]);
    $row = $statement->fetch();

    if (!$row) {
        api_error('Live stream peer was not found.', 404, 'live_stream_peer_not_found');
    }

    foreach (
        [
            'id',
            'session_id',
            'viewer_user_id',
            'created_at',
            'updated_at',
            'expires_at',
            'owner_user_id',
            'session_expires_at',
        ] as $key
    ) {
        $row[$key] = (int) $row[$key];
    }

    return $row;
}

function live_stream_require_viewer(
    PDO $pdo,
    array $actor,
    int $targetUserId,
    int $peerId
): array {
    if (!has_permission($actor, PERMISSION_VIEW_LIVE_STREAMS)) {
        api_error(
            'Viewing live streams requires permission.',
            403,
            'permission_required'
        );
    }

    live_stream_target_user($pdo, $targetUserId);
    $peer = live_stream_peer($pdo, $peerId);

    if (
        $peer['viewer_user_id'] !== (int) $actor['id'] ||
        $peer['owner_user_id'] !== $targetUserId
    ) {
        api_error('Live stream peer access is denied.', 403, 'permission_required');
    }

    return $peer;
}

$method = require_method('GET', 'POST', 'DELETE');
$actor = current_user();
$actorId = (int) $actor['id'];
$pdo = db();

live_stream_cleanup($pdo);

if ($method === 'GET') {
    $action = $_GET['action'] ?? 'targets';

    if (!is_string($action)) {
        api_error('action must be a string.', 422, 'invalid_argument');
    }

    if ($action === 'targets') {
        if (!has_permission($actor, PERMISSION_VIEW_LIVE_STREAMS)) {
            api_error(
                'Viewing live streams requires permission.',
                403,
                'permission_required'
            );
        }

        $statement = $pdo->prepare(
            'SELECT s.owner_user_id, s.created_at, s.updated_at, s.expires_at, '
            . 'u.username, u.first_name, u.last_name, u.preferred_name '
            . 'FROM live_stream_sessions s '
            . 'INNER JOIN users u ON u.id = s.owner_user_id '
            . 'WHERE s.expires_at > :now '
            . 'ORDER BY COALESCE(NULLIF(u.preferred_name, \'\'), u.first_name), '
            . 'u.last_name, u.username'
        );
        $statement->execute([':now' => time()]);

        $targets = [];

        while ($row = $statement->fetch()) {
            $targets[] = [
                'userId' => (int) $row['owner_user_id'],
                'username' => (string) $row['username'],
                'firstName' => (string) $row['first_name'],
                'lastName' => (string) $row['last_name'],
                'preferredName' =>
                    $row['preferred_name'] === null
                        ? null
                        : (string) $row['preferred_name'],
                'startedAt' => (int) $row['created_at'],
                'updatedAt' => (int) $row['updated_at'],
                'expiresAt' => (int) $row['expires_at'],
            ];
        }

        json_response([
            'targets' => $targets,
            'permission' => PERMISSION_VIEW_LIVE_STREAMS,
            'iceServers' => live_stream_ice_servers(),
        ]);
    }

    if ($action === 'publisher') {
        $session = live_stream_active_session($pdo, $actorId);

        if ($session === null) {
            json_response([
                'session' => null,
                'peers' => [],
                'signals' => [],
                'iceServers' => live_stream_ice_servers(),
            ]);
        }

        $afterSignalId = live_stream_after_id('afterSignalId');

        $statement = $pdo->prepare(
            'SELECT p.id, p.viewer_user_id, p.offer, p.answer, p.state, '
            . 'p.created_at, p.updated_at, p.expires_at, '
            . 'u.username, u.preferred_name, u.first_name '
            . 'FROM live_stream_peers p '
            . 'INNER JOIN users u ON u.id = p.viewer_user_id '
            . 'WHERE p.session_id = :session_id '
            . 'AND p.expires_at > :now AND p.state <> \'closed\' '
            . 'ORDER BY p.id'
        );
        $statement->execute([
            ':session_id' => $session['id'],
            ':now' => time(),
        ]);

        $peers = [];

        while ($row = $statement->fetch()) {
            $peers[] = [
                'peerId' => (int) $row['id'],
                'viewerUserId' => (int) $row['viewer_user_id'],
                'viewerUsername' => (string) $row['username'],
                'viewerName' =>
                    trim(
                        (string) (
                            $row['preferred_name'] ??
                            $row['first_name'] ??
                            $row['username']
                        )
                    ),
                'offer' => live_stream_decode((string) $row['offer']),
                'answered' =>
                    is_string($row['answer']) &&
                    $row['answer'] !== '',
                'state' => (string) $row['state'],
                'expiresAt' => (int) $row['expires_at'],
            ];
        }

        $statement = $pdo->prepare(
            'SELECT sig.id, sig.peer_id, sig.payload '
            . 'FROM live_stream_signals sig '
            . 'INNER JOIN live_stream_peers p ON p.id = sig.peer_id '
            . 'WHERE p.session_id = :session_id '
            . 'AND sig.sender = \'viewer\' AND sig.id > :after_signal_id '
            . 'ORDER BY sig.id LIMIT 500'
        );
        $statement->execute([
            ':session_id' => $session['id'],
            ':after_signal_id' => $afterSignalId,
        ]);

        $signals = [];

        while ($row = $statement->fetch()) {
            $signals[] = [
                'id' => (int) $row['id'],
                'peerId' => (int) $row['peer_id'],
                'candidate' => live_stream_decode((string) $row['payload']),
            ];
        }

        json_response([
            'session' => [
                'id' => $session['id'],
                'snapshot' => live_stream_decode($session['snapshot']),
                'expiresAt' => $session['expires_at'],
            ],
            'peers' => $peers,
            'signals' => $signals,
            'iceServers' => live_stream_ice_servers(),
        ]);
    }

    if ($action === 'viewer') {
        $targetUserId = require_positive_int($_GET, 'targetUserId');
        $peerId = require_positive_int($_GET, 'peerId');
        $peer = live_stream_require_viewer(
            $pdo,
            $actor,
            $targetUserId,
            $peerId
        );

        if (
            $peer['expires_at'] <= time() ||
            $peer['session_expires_at'] <= time()
        ) {
            api_error('The live stream has expired.', 410, 'live_stream_expired');
        }

        $afterSignalId = live_stream_after_id('afterSignalId');
        $afterMessageId = live_stream_after_id('afterMessageId');

        $statement = $pdo->prepare(
            'SELECT id, payload FROM live_stream_signals '
            . 'WHERE peer_id = :peer_id AND sender = \'publisher\' '
            . 'AND id > :after_signal_id ORDER BY id LIMIT 500'
        );
        $statement->execute([
            ':peer_id' => $peerId,
            ':after_signal_id' => $afterSignalId,
        ]);

        $signals = [];

        while ($row = $statement->fetch()) {
            $signals[] = [
                'id' => (int) $row['id'],
                'candidate' => live_stream_decode((string) $row['payload']),
            ];
        }

        $statement = $pdo->prepare(
            'SELECT id, type, payload, created_at '
            . 'FROM live_stream_messages '
            . 'WHERE session_id = :session_id AND id > :after_message_id '
            . 'ORDER BY id LIMIT 500'
        );
        $statement->execute([
            ':session_id' => $peer['session_id'],
            ':after_message_id' => $afterMessageId,
        ]);

        $messages = [];

        while ($row = $statement->fetch()) {
            $messages[] = [
                'id' => (int) $row['id'],
                'type' => (string) $row['type'],
                'payload' => live_stream_decode((string) $row['payload']),
                'createdAt' => (int) $row['created_at'],
            ];
        }

        json_response([
            'active' => true,
            'targetUserId' => $targetUserId,
            'peerId' => $peerId,
            'answer' => live_stream_decode($peer['answer']),
            'snapshot' => live_stream_decode($peer['snapshot']),
            'signals' => $signals,
            'messages' => $messages,
            'iceServers' => live_stream_ice_servers(),
        ]);
    }

    api_error('Unknown live stream action.', 422, 'invalid_action');
}

require_csrf();
$input = json_input();
$action = require_string($input, 'action');

if ($method === 'POST') {
    if ($action === 'publish') {
        $now = time();
        $snapshot = null;

        if (array_key_exists('snapshot', $input) && $input['snapshot'] !== null) {
            $snapshot = live_stream_encode_object(
                $input['snapshot'],
                'snapshot',
                LIVE_STREAM_MAX_SNAPSHOT_BYTES
            );
        }

        try {
            $pdo->beginTransaction();

            $delete = $pdo->prepare(
                'DELETE FROM live_stream_sessions WHERE owner_user_id = :owner_user_id'
            );
            $delete->execute([':owner_user_id' => $actorId]);

            $insert = $pdo->prepare(
                'INSERT INTO live_stream_sessions '
                . '(owner_user_id, snapshot, created_at, updated_at, expires_at) '
                . 'VALUES (:owner_user_id, :snapshot, :created_at, :updated_at, :expires_at)'
            );
            $insert->execute([
                ':owner_user_id' => $actorId,
                ':snapshot' => $snapshot,
                ':created_at' => $now,
                ':updated_at' => $now,
                ':expires_at' => $now + LIVE_STREAM_TTL_SECONDS,
            ]);

            $sessionId = (int) $pdo->lastInsertId();
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }

        json_response([
            'sessionId' => $sessionId,
            'expiresAt' => $now + LIVE_STREAM_TTL_SECONDS,
            'iceServers' => live_stream_ice_servers(),
        ], 201);
    }

    if ($action === 'join') {
        if (!has_permission($actor, PERMISSION_VIEW_LIVE_STREAMS)) {
            api_error(
                'Viewing live streams requires permission.',
                403,
                'permission_required'
            );
        }

        $targetUserId = require_positive_int($input, 'targetUserId');
        live_stream_target_user($pdo, $targetUserId);
        $offer = live_stream_description($input['offer'] ?? null, 'offer');
        $session = live_stream_active_session($pdo, $targetUserId);

        if ($session === null) {
            api_error(
                'The target user is not publishing a live stream.',
                404,
                'live_stream_not_found'
            );
        }

        $now = time();
        $statement = $pdo->prepare(
            'INSERT INTO live_stream_peers '
            . '(session_id, viewer_user_id, offer, answer, state, created_at, updated_at, expires_at) '
            . 'VALUES (:session_id, :viewer_user_id, :offer, NULL, \'pending\', '
            . ':created_at, :updated_at, :expires_at)'
        );
        $statement->execute([
            ':session_id' => $session['id'],
            ':viewer_user_id' => $actorId,
            ':offer' => $offer,
            ':created_at' => $now,
            ':updated_at' => $now,
            ':expires_at' => $now + LIVE_STREAM_TTL_SECONDS,
        ]);

        $peerId = (int) $pdo->lastInsertId();

        $cursorStatement = $pdo->prepare(
            'SELECT COALESCE(MAX(id), 0) FROM live_stream_messages '
            . 'WHERE session_id = :session_id'
        );
        $cursorStatement->execute([
            ':session_id' => $session['id'],
        ]);
        $messageCursor =
            (int) ($cursorStatement->fetchColumn() ?: 0);

        json_response([
            'peerId' => $peerId,
            'targetUserId' => $targetUserId,
            'snapshot' => live_stream_decode($session['snapshot']),
            'messageCursor' => $messageCursor,
            'iceServers' => live_stream_ice_servers(),
        ], 201);
    }

    if ($action === 'answer') {
        $peerId = require_positive_int($input, 'peerId');
        $answer = live_stream_description($input['answer'] ?? null, 'answer');
        $peer = live_stream_peer($pdo, $peerId);

        if ($peer['owner_user_id'] !== $actorId) {
            api_error(
                'Only the stream publisher can answer this peer.',
                403,
                'permission_required'
            );
        }

        $now = time();
        $statement = $pdo->prepare(
            'UPDATE live_stream_peers '
            . 'SET answer = :answer, state = \'connected\', '
            . 'updated_at = :updated_at, expires_at = :expires_at '
            . 'WHERE id = :peer_id'
        );
        $statement->execute([
            ':answer' => $answer,
            ':updated_at' => $now,
            ':expires_at' => $now + LIVE_STREAM_TTL_SECONDS,
            ':peer_id' => $peerId,
        ]);

        json_response([
            'peerId' => $peerId,
            'answered' => true,
        ]);
    }

    if ($action === 'candidate') {
        $peerId = require_positive_int($input, 'peerId');
        $candidate = live_stream_encode_object(
            $input['candidate'] ?? null,
            'candidate',
            LIVE_STREAM_MAX_SIGNAL_BYTES
        );
        $peer = live_stream_peer($pdo, $peerId);
        $sender = null;

        if ($peer['owner_user_id'] === $actorId) {
            $sender = 'publisher';
        } else {
            $targetUserId = require_positive_int($input, 'targetUserId');
            live_stream_require_viewer(
                $pdo,
                $actor,
                $targetUserId,
                $peerId
            );
            $sender = 'viewer';
        }

        $statement = $pdo->prepare(
            'INSERT INTO live_stream_signals '
            . '(peer_id, sender, payload, created_at) '
            . 'VALUES (:peer_id, :sender, :payload, :created_at)'
        );
        $statement->execute([
            ':peer_id' => $peerId,
            ':sender' => $sender,
            ':payload' => $candidate,
            ':created_at' => time(),
        ]);

        json_response([
            'signalId' => (int) $pdo->lastInsertId(),
            'peerId' => $peerId,
            'sender' => $sender,
        ], 201);
    }

    if ($action === 'message') {
        $session = live_stream_active_session($pdo, $actorId);

        if ($session === null) {
            api_error(
                'No active publisher session exists.',
                409,
                'live_stream_not_active'
            );
        }

        $type = require_string($input, 'type');

        if (!preg_match('/^[a-z0-9][a-z0-9._-]{0,63}$/D', $type)) {
            api_error('type is invalid.', 422, 'invalid_argument');
        }

        $payload = live_stream_encode_object(
            $input['payload'] ?? null,
            'payload',
            LIVE_STREAM_MAX_MESSAGE_BYTES
        );

        $statement = $pdo->prepare(
            'INSERT INTO live_stream_messages '
            . '(session_id, type, payload, created_at) '
            . 'VALUES (:session_id, :type, :payload, :created_at)'
        );
        $statement->execute([
            ':session_id' => $session['id'],
            ':type' => $type,
            ':payload' => $payload,
            ':created_at' => time(),
        ]);

        json_response([
            'messageId' => (int) $pdo->lastInsertId(),
            'type' => $type,
        ], 201);
    }

    if ($action === 'heartbeat') {
        $now = time();

        if (isset($input['peerId'])) {
            $targetUserId = require_positive_int($input, 'targetUserId');
            $peerId = require_positive_int($input, 'peerId');
            live_stream_require_viewer(
                $pdo,
                $actor,
                $targetUserId,
                $peerId
            );

            $statement = $pdo->prepare(
                'UPDATE live_stream_peers '
                . 'SET updated_at = :updated_at, expires_at = :expires_at '
                . 'WHERE id = :peer_id'
            );
            $statement->execute([
                ':updated_at' => $now,
                ':expires_at' => $now + LIVE_STREAM_TTL_SECONDS,
                ':peer_id' => $peerId,
            ]);

            json_response([
                'peerId' => $peerId,
                'targetUserId' => $targetUserId,
                'expiresAt' => $now + LIVE_STREAM_TTL_SECONDS,
            ]);
        }

        $hasSnapshot =
            array_key_exists('snapshot', $input) &&
            $input['snapshot'] !== null;
        $snapshot =
            $hasSnapshot
                ? live_stream_encode_object(
                    $input['snapshot'],
                    'snapshot',
                    LIVE_STREAM_MAX_SNAPSHOT_BYTES
                )
                : null;

        $sql =
            'UPDATE live_stream_sessions '
            . 'SET updated_at = :updated_at, expires_at = :expires_at'
            . ($hasSnapshot ? ', snapshot = :snapshot' : '')
            . ' WHERE owner_user_id = :owner_user_id';

        $statement = $pdo->prepare($sql);
        $parameters = [
            ':updated_at' => $now,
            ':expires_at' => $now + LIVE_STREAM_TTL_SECONDS,
            ':owner_user_id' => $actorId,
        ];

        if ($hasSnapshot) {
            $parameters[':snapshot'] = $snapshot;
        }

        $statement->execute($parameters);

        if ($statement->rowCount() < 1) {
            api_error(
                'No active publisher session exists.',
                409,
                'live_stream_not_active'
            );
        }

        json_response([
            'expiresAt' => $now + LIVE_STREAM_TTL_SECONDS,
        ]);
    }

    api_error('Unknown live stream action.', 422, 'invalid_action');
}

if ($action === 'unpublish') {
    $statement = $pdo->prepare(
        'DELETE FROM live_stream_sessions WHERE owner_user_id = :owner_user_id'
    );
    $statement->execute([':owner_user_id' => $actorId]);

    json_response(['unpublished' => true]);
}

if ($action === 'leave') {
    $targetUserId = require_positive_int($input, 'targetUserId');
    $peerId = require_positive_int($input, 'peerId');
    live_stream_require_viewer(
        $pdo,
        $actor,
        $targetUserId,
        $peerId
    );

    $statement = $pdo->prepare(
        'DELETE FROM live_stream_peers WHERE id = :peer_id'
    );
    $statement->execute([':peer_id' => $peerId]);

    json_response([
        'left' => true,
        'peerId' => $peerId,
        'targetUserId' => $targetUserId,
    ]);
}

api_error('Unknown live stream action.', 422, 'invalid_action');
