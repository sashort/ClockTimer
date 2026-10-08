<?php
declare(strict_types=1);

function api_error(string $message, int $status = 400, string $code = 'bad_request'): never {
    throw new RuntimeException($code, $status);
}
require_once __DIR__ . '/../api/_core/permissions.php';
function live_stream_target_user(PDO $pdo, int $target): void {}
function live_stream_peer(PDO $pdo, int $peer): array { return $GLOBALS['testPeer']; }
// Execute the actual shared authorization function, without a database or web session.
$source = file_get_contents(__DIR__ . '/../api/live-stream/index.php');
$start = strpos($source, 'function live_stream_require_viewer(');
$end = strpos($source, '$method = require_method(', $start);
eval(substr($source, $start, $end - $start));
$pdo = new class extends PDO { public function __construct() {} };
$viewer = ['id'=>7, 'permissions'=>PERMISSION_VIEW_LIVE_STREAMS];
$GLOBALS['testPeer'] = ['viewer_user_id'=>7, 'owner_user_id'=>42];
if (live_stream_require_viewer($pdo, $viewer, 42, 9) !== $GLOBALS['testPeer']) throw new RuntimeException('Authorized peer rejected');
foreach ([
    [['id'=>7,'permissions'=>0],42],
    [['id'=>8,'permissions'=>PERMISSION_VIEW_LIVE_STREAMS],42],
    [$viewer,43]
] as [$actor,$target]) {
    try { live_stream_require_viewer($pdo,$actor,$target,9); }
    catch (RuntimeException $error) { if ($error->getCode() === 403) continue; throw $error; }
    throw new RuntimeException('Unauthorized historical totals allowed');
}
$branch = substr($source, strpos($source, "if (\$action === 'viewer' || \$action === 'totals')"));
if (!(strpos($branch, 'live_stream_require_viewer(') < strpos($branch, "if (\$action === 'totals')") &&
      strpos($branch, "api_error('The live stream has expired.'") < strpos($branch, 'CLOCKTIMER_DROP_IN_TRIP_USER_ID'))) {
    throw new RuntimeException('Totals must check authorization and expiry before handoff');
}
if (!str_contains($branch, "\$_GET['result'] = 'totals';")) throw new RuntimeException('Drop-In must only expose aggregates');
echo "PASS Drop-In totals require viewer permission, matching peer owner/viewer and unexpired session; handoff exposes totals only\n";
