<?php
 declare(strict_types=1);
 $root = dirname(__DIR__);
 $catalog = json_decode(file_get_contents($root . '/api/audio/catalog.json'), true, 512, JSON_THROW_ON_ERROR);
 foreach (['neon-afterglow', 'chrome-velocity', 'chime-easter-egg', 'dark-eighties'] as $songKey) {
     $_SERVER['REQUEST_METHOD'] = 'GET'; $_GET = ['song' => $songKey];
     ob_start(); include $root . '/api/audio/easter-eggs/index.php'; $html = ob_get_clean();
     if (!str_contains($html, 'src="/' . $catalog['songs'][$songKey]['mediaUrl'] . '"')) throw new RuntimeException('Wrong media selected: ' . $songKey);
     if (!str_contains($html, 'value="' . $songKey . '" selected')) throw new RuntimeException('Wrong selected song: ' . $songKey);
     if (substr_count($html, '<option ') !== 4 || str_contains($html, '<script')) throw new RuntimeException('Unexpected player markup');
 }
 echo "PASS PHP native player renders all four catalog selections\n";
