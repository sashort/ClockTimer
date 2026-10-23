import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('speech/vosk/runtime/alternatives/build.json',root),'utf8'));
const runtime=new URL(manifest.runtime,new URL('speech/vosk/runtime/alternatives/',root));
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(runtime)).digest('hex'),manifest.sha256,'packaged runtime matches verified artifact');
const config=fs.readFileSync(new URL('speech/VoskTestConfig.js',root),'utf8');
assert(config.includes(runtime.pathname.split('/').at(-1)),'production config uses the verified runtime');
assert.match(config,/requireAlternatives:\s*true/,'runtime capability is required explicitly');
for(const file of ['COPYING','NOTICE','upstream-commit.txt','vosk-submodule.txt','builder-image.json'])
 assert(fs.statSync(new URL('speech/vosk/runtime/alternatives/'+file,root)).size>0,'provenance: '+file);
console.log('PASS verified Vosk runtime hash, production selection, required alternatives and build provenance');
