import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const {compose}=createRequire(import.meta.url)('../scripts/build-pages.cjs');
import assert from 'node:assert/strict';
import fs from 'node:fs';
const model=JSON.parse(fs.readFileSync(new URL('../docs/mainline-fsm-draft.json',import.meta.url),'utf8'));
const loops=model.transitions.filter(edge=>edge.source===edge.target);
const audit=model.contracts['setting-chimes'].fsm_loopback_audit;
assert.equal(audit.count,loops.length);
assert.deepEqual(new Set(audit.edges.map(edge=>edge.transition)),new Set(loops.map(edge=>edge.id)),'Every self-loop is reviewed exactly once');
for(const edge of loops){const rule=edge.contract.loopback_feedback;assert(rule?.rule && ['unchanged','attribute-change','conditional','pointer','rejection','superseded'].includes(rule.classification),edge.id+' needs an explicit feedback contract');if(rule.classification==='unchanged'){const audio=model.audio[edge.audio];assert(audio.chime.includes('setting-unchanged'),edge.id+' must allow the unchanged cue');assert.equal(audio.sequence[0].kind,'Chime',edge.id+' chime precedes speech');}}
assert(loops.some(edge=>edge.contract.loopback_feedback.classification==='attribute-change'),'Do not equate graph self-loops with unchanged data');
for(const file of ['../order-filler.html','../templates/order-filler.html'])assert.match(compose(fileURLToPath(new URL('..',import.meta.url)),fs.readFileSync(new URL(file,import.meta.url),'utf8')),/<a id="bluetoothAudioTestLink" href="diagnostics\/audio-routing\/" target="_blank" rel="noopener"/,'Both main pages expose the diagnostic safely');
console.log('PASS all '+loops.length+' FSM self-loop contracts, conditional data changes, unchanged audio ordering, and diagnostic menu access');
