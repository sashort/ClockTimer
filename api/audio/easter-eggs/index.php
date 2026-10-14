<?php
 declare(strict_types=1);
 if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
     header('Allow: GET'); http_response_code(405); exit;
 }
 $root = dirname(__DIR__, 3);
 $catalog = json_decode((string) file_get_contents(dirname(__DIR__) . '/catalog.json'), true, 512, JSON_THROW_ON_ERROR);
 $texts = json_decode((string) file_get_contents($root . '/lang/en-US/ui-text.json'), true, 512, JSON_THROW_ON_ERROR)['texts'];
 $associations = json_decode((string) file_get_contents($root . '/lang/en-US/associations.json'), true, 512, JSON_THROW_ON_ERROR);
 $options = $associations['selects']['af44f0e0-01a0-57a7-9b13-d56b283ac0b8'];
 $songs = [];
 foreach ($options as $option) {
     $song = $catalog['songs'][$option['value']] ?? [];
     $url = $song['mediaUrl'] ?? null;
     if (is_string($url) && preg_match('#^api/audio/samples/[a-z0-9-]+\.wav$#D', $url)) {
         $songs[$option['value']] = ['label' => $texts[$option['textId']]['text'], 'url' => '/' . $url];
     }
 }
 $requested = $_GET['song'] ?? 'dark-eighties';
 if (!is_string($requested) || !isset($songs[$requested])) {
     http_response_code(400); header('Content-Type: text/plain; charset=utf-8'); echo 'Unknown song.'; exit;
 }
 $selected = $songs[$requested];
 $escape = static fn(string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
 $text = static fn(string $key): string => $escape($texts[$associations['elements'][$key]['texts']['text0'] ?? $key]['text']);
 header('Content-Type: text/html; charset=utf-8');
 header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="en-US">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= $text('64d936b8-f973-541b-8f75-b7ab6e9f10bf') ?></title>
<style>
:root{color-scheme:dark;font:18px system-ui,sans-serif;background:#06172f;color:#eff5ff}body{margin:0;padding:24px 16px}main{max-width:640px;margin:5vh auto;padding:24px;background:#102748;border:1px solid #7893b4;border-radius:18px}h1{margin:0 0 24px;font-size:1.7rem}label{display:block;margin-bottom:8px}select,button{font:inherit;padding:12px;border-radius:8px;border:1px solid #7893b4;background:#15355d;color:inherit}select{width:100%;box-sizing:border-box}button{margin-top:12px;cursor:pointer}audio{display:block;width:100%;margin:28px 0 20px}nav{display:flex;gap:20px;flex-wrap:wrap}a{color:#c1deff;text-underline-offset:4px}a:focus-visible,select:focus-visible,button:focus-visible{outline:3px solid #ffd775;outline-offset:3px}@media(max-width:380px){main{padding:18px}body{padding:12px}}
</style>
</head>
<body><main>
<h1><?= $text('64d936b8-f973-541b-8f75-b7ab6e9f10bf') ?></h1>
<form method="get">
<label for="song"><?= $text('6f46e3e5-c548-5dc7-b36c-d03a486456da') ?></label>
<select id="song" name="song" onchange="this.form.requestSubmit()">
<?php foreach ($songs as $key => $song): ?>
<option value="<?= $escape($key) ?>"<?= $key === $requested ? ' selected' : '' ?>><?= $escape($song['label']) ?></option>
<?php endforeach; ?>
</select>
<noscript><button type="submit"><?= $text('f5213d8d-d342-5b00-9557-64a3e3537ef1') ?></button></noscript>
</form>
<audio controls preload="metadata" aria-label="<?= $escape($selected['label']) ?>" src="<?= $escape($selected['url']) ?>"></audio>
<nav><a download href="<?= $escape($selected['url']) ?>"><?= $text('e86c75d7-7ca3-50de-88e0-5e969867ab09') ?></a><a href="/order-filler.php"><?= $text('d050a12d-e79b-5dfe-9a5e-ff3ea25b8ef1') ?></a></nav>
</main></body></html>
