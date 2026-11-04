<?php
declare(strict_types=1);
// Remove only the retired preference, preserving all other user settings.
return [
    "UPDATE users SET settings_json=JSON_REMOVE(settings_json, '$.speech.\"wmof-recognizer-names-v1\"'), settings_revision=settings_revision+1 WHERE JSON_CONTAINS_PATH(settings_json, 'one', '$.speech.\"wmof-recognizer-names-v1\"')=1",
];
