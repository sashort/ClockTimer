import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const catalog=JSON.parse(read('api/audio/catalog.json'));
const associations=JSON.parse(read('lang/en-US/associations.json'));
const options=associations.selects['af44f0e0-01a0-57a7-9b13-d56b283ac0b8'];
for(const {value} of options){const url=catalog.songs[value].mediaUrl;assert.match(url,/^api\/audio\/samples\/[a-z0-9-]+\.wav$/);const wav=fs.readFileSync(new URL('../'+url,import.meta.url));assert.equal(wav.subarray(0,4).toString(),'RIFF');assert.equal(wav.subarray(8,12).toString(),'WAVE');}
const endpoint=read('api/audio/easter-eggs/index.php');
assert.match(endpoint,/<audio controls preload="metadata"/);assert.doesNotMatch(endpoint,/<script|AudioContext|SherpaRecognizer/);assert.match(endpoint,/http_response_code\(400\)/);assert.match(endpoint,/!is_string\(\$requested\)/);
assert.match(read('api/admin/speech-editor/index.php'),/order-filler\.php\?speech-editor-preview=1/);
console.log('PASS native WAV song choices, isolated playback page, invalid selection guard, and editor preview target');
