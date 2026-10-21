<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/_core/bootstrap.php';
require_once dirname(__DIR__, 2) . '/_core/order_filler_diagnostics.php';
require_once dirname(__DIR__, 2) . '/_core/diagnostics_jobs.php';
if (empty($_SERVER['HTTPS']) || strtolower((string)$_SERVER['HTTPS']) === 'off') api_error('HTTPS is required.', 403, 'https_required');
$method = require_method('GET', 'POST');
// Exchange a permitted one-use token for this diagnostics session once. Further
// writes use its HttpOnly cookie and CSRF token, never consume the token again.
$bearer = access_token_bearer();
$authorization = $bearer !== null && access_token_query_value() === null
    ? consume_access_token($bearer, [PERMISSION_DEVELOPER], ACCESS_TOKEN_SCOPE_DIAGNOSTICS, true, 'token_bearer')
    : authorize_guarded_access([PERMISSION_DEVELOPER], ACCESS_TOKEN_SCOPE_DIAGNOSTICS);
if ($method === 'POST' && guarded_access_requires_csrf($authorization)) require_csrf();
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 1048576) api_error('Diagnostics batch exceeds 1 MiB.', 413, 'report_too_large');
$input = $method === 'GET' ? ['action'=>'read','suite'=>$_GET['suite'] ?? 'order-filler','locale'=>$_GET['locale'] ?? 'en-US'] : json_input();
$buildPath = dirname(__DIR__, 3) . '/build-version.json';
$build = is_file($buildPath) ? json_decode((string)file_get_contents($buildPath), true, 16, JSON_THROW_ON_ERROR) : [];
try {
    if (($method==='GET' && ($_GET['job']??'')==='1') || ($method==='POST' && str_starts_with((string)($input['action']??''),'job-'))) {
        $jobs=new DiagnosticsJobs('/var/lib/clocktimer/diagnostics/jobs',dirname(__DIR__,3).'/tests/languages');
        $result=$jobs->handle($method==='GET'?['action'=>'job-status']:$input,guarded_access_principal_key($authorization),['cookie'=>session_name().'='.session_id(),'csrf'=>csrf_token()]);
        json_response($result+['csrfToken'=>csrf_token()]);
    }
    $store = new OrderFillerDiagnostics('/var/lib/clocktimer/diagnostics');
    if ($method === 'GET' && ($_GET['status'] ?? '') === '1') json_response(['last'=>$store->last((string)$input['suite'],(string)$input['locale']),'statistics'=>$store->statistics((string)$input['suite'],(string)$input['locale']),'csrfToken'=>csrf_token()]);
    if ($method === 'GET' && ($_GET['results'] ?? '') === '1') {
        $cursor=filter_var($_GET['cursor']??0,FILTER_VALIDATE_INT,['options'=>['min_range'=>0]]);
        if($cursor===false)throw new InvalidArgumentException('Invalid results cursor.');
        json_response($store->results((string)$input['suite'],(string)$input['locale'],$cursor,(string)($_GET['runId']??''),(string)($_GET['delivery']??''),($_GET['failures']??'')==='1')+['csrfToken'=>csrf_token()]);
    }
    $result = $store->apply($input, guarded_access_principal_key($authorization), $build);
    $result['csrfToken'] = csrf_token();
    json_response($result);
} catch (InvalidArgumentException $error) { api_error($error->getMessage(), 422, 'invalid_diagnostics'); }
catch (DomainException $error) { api_error($error->getMessage(), 409, 'diagnostics_run_conflict'); }
catch (RuntimeException $error) { api_error($error->getMessage(), 503, 'diagnostics_unavailable'); }
