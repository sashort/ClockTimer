<?php
declare(strict_types=1);

class ApiFailure extends RuntimeException
{
    public function __construct(public int $status, public string $apiCode)
    {
        parent::__construct($apiCode);
    }
}

function api_error(string $message, int $status = 400, string $code = 'bad_request'): never
{
    throw new ApiFailure($status, $code);
}

function authenticated_user_id(): int
{
    return 1;
}

require_once __DIR__ . '/../api/_core/permissions.php';

function expect(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$viewer = ['id' => 1, 'permissions' => PERMISSION_VIEW_LIVE_STREAMS];
$ordinary = ['id' => 2, 'permissions' => 0];
$super = ['id' => 3, 'permissions' => PERMISSION_SUPERUSER];

expect(
    has_permission($viewer, PERMISSION_VIEW_LIVE_STREAMS),
    'viewer permission should authorize live stream viewing'
);
expect(
    !has_permission($ordinary, PERMISSION_VIEW_LIVE_STREAMS),
    'ordinary users should not inherit live stream viewing'
);
expect(
    has_permission($super, PERMISSION_VIEW_LIVE_STREAMS),
    'superuser should imply live stream viewing'
);
expect(
    require_permission_assignment($super, 255) === 255,
    'permission assignment should accept all eight flags'
);

try {
    require_permission_assignment($super, 256);
    throw new RuntimeException('permission mask 256 should be rejected');
} catch (ApiFailure $error) {
    expect(
        $error->status === 422 &&
        $error->apiCode === 'invalid_argument',
        'invalid permission mask should return invalid_argument'
    );
}

$endpoint = file_get_contents(__DIR__ . '/../api/live-stream/index.php');
expect(is_string($endpoint) && $endpoint !== '', 'live stream endpoint should exist');

foreach (
    [
        "require_positive_int(\$input, 'targetUserId')",
        "require_positive_int(\$_GET, 'targetUserId')",
        'PERMISSION_VIEW_LIVE_STREAMS',
        'PERMISSION_LOOKUP_USERS',
        'User lookup and live stream permissions are required.',
        'live_stream_require_viewer',
        "if (\$action === 'trainer-message')",
        "if (\$action === 'socket-token')",
        'live_stream_socket_tokens',
    ] as $needle
) {
    expect(
        str_contains($endpoint, $needle),
        'live stream endpoint should enforce target-scoped viewer access: ' . $needle
    );
}

$socket = file_get_contents(__DIR__ . '/../services/live-stream-websocket.php');
expect(is_string($socket) && $socket !== '', 'live stream WebSocket service should exist');
foreach (
    [
        'LIVE_WS_PERMISSION_SWEEP_SECONDS = 2',
        'live_ws_can_view',
        "if (\$type === 'targets.request')",
        "if (\$type === 'peer.join')",
        "if (\$type === 'trainer.tts')",
        "'permission_revoked'",
    ] as $needle
) {
    expect(
        str_contains($socket, $needle),
        'WebSocket signaling should enforce live permissions: ' . $needle
    );
}
expect(
    !str_contains($socket, 'viewerName') &&
    !str_contains($socket, 'viewerUsername'),
    'publisher signaling should not disclose trainer identity'
);

echo "PASS live stream permission, anonymous trainer signaling, revocation, and trainer TTS guard" . PHP_EOL;
