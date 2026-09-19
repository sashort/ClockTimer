<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/_core/bootstrap.php';
require_once dirname(__DIR__,2).'/_core/new_user_invites.php';
$actor=require_permission(PERMISSION_CREATE_USERS);
$method=require_method('GET','POST');
if($method==='POST'){$provided=$_POST['csrf_token']??'';$expected=$_SESSION['csrf_token']??'';if(!is_string($provided)||!is_string($expected)||$provided===''||!hash_equals($expected,$provided))api_error('The CSRF token is invalid or expired.',403,'invalid_csrf');$token=renew_or_create_new_user_token(db(),(int)$actor['id'],is_string($_POST['token']??null)?$_POST['token']:'');}
else $token=create_new_user_token(db(),(int)$actor['id']);
$scheme=(!empty($_SERVER['HTTPS'])&&strtolower((string)$_SERVER['HTTPS'])!=='off')?'https':'http';
$host=(string)($_SERVER['HTTP_HOST']??'');
if(!preg_match('/^[A-Za-z0-9.\-:\[\]]+$/D',$host))api_error('Invalid request host.',400,'invalid_host');
$link=$scheme.'://'.$host.'/api/new-user/?token='.rawurlencode($token);
header('Content-Type: text/html; charset=utf-8');header('Cache-Control: no-store');
?><!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>New User Invitation</title><style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#a9ddf7;color:#001e60}html,body{width:100%;height:100%;overflow:hidden}body{margin:0;padding:calc(18px + .5in) 0 .5in;display:grid;grid-template-rows:28px 58px 24px minmax(0,1fr) 48px;row-gap:0;justify-items:center;text-align:center;background:#a9ddf7;color:#001e60;box-sizing:border-box}header{width:100%;display:grid;place-items:center}h1{width:calc(100% - 36px);max-width:460px;height:58px;margin:0;padding:10px 14px;box-sizing:border-box;background:linear-gradient(180deg,#46515c 0%,#2f3943 45%,#202933 100%);border-bottom:1px solid rgb(255 255 255 / 54%);border-radius:14px;color:#fff;font-size:clamp(20px,5vw,30px);white-space:nowrap}p{margin:7px 0}header+p{margin:0 8px;align-self:start;line-height:20px}#qr{display:inline-block;place-self:center;background:#fff;padding:10px;border-radius:10px}#qr img,#qr canvas,#qr svg{display:block;width:min(66vw,43vh,300px)!important;height:auto!important}.expires{margin:0;align-self:center;color:#001e60;font-weight:700}form{align-self:start;margin:0}button{font:inherit;font-weight:700;padding:10px 20px;border:1px solid #a9ddf7;border-radius:7px;background:#0053e2;color:#fff}</style></head><body><p class="expires">This single-use invitation expires in 15 minutes.</p><header><h1>Scan to Create Profile</h1></header><p>Have the new user scan this code with their camera.</p><div id="qr" aria-label="QR code for the new-user invitation"></div><form method="post"><input type="hidden" name="csrf_token" value="<?=htmlspecialchars(csrf_token(),ENT_QUOTES)?>"><input type="hidden" name="token" value="<?=htmlspecialchars($token,ENT_QUOTES)?>"><button type="submit">Regenerate</button></form><script src="../../vendor/qrcode.min.js"></script><script>
new QRCode(document.getElementById('qr'),{text:<?=json_encode($link,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT)?>,width:360,height:360,colorDark:'#001e60',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
</script></body></html>
