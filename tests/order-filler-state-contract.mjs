import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {stateContract, assertState, assertCommands, assertAudio, assertFamily, assertAnnouncements, assertInventoryBindings} from './state-contract-fixture.mjs';

assert.throws(() => assertInventoryBindings({speechRecognition:'awake-ish'}, 'negative'), /unmapped value/);
const root = new URL('../', import.meta.url);
assert.equal(stateContract.schemaVersion, 1);
assert.equal(stateContract.defaults.totalScope, 'day');
assert.equal(stateContract.defaults.goalPercent, 100);
assert.equal(stateContract.implementation.appMode, 'debug');
assert.equal(stateContract.implementation.implicitDefault, false);
assert.equal(stateContract.implementation.productionImplemented, false);
assert.equal(stateContract.implementation.simulationImplemented, false);
assert.deepEqual(stateContract.axes.appMode.values, ['debug', 'production', 'simulation']);
assert.equal(stateContract.status, 'incremental', 'Partial coverage cannot claim exhaustive enumeration');
assert(stateContract.backlog.length, 'Unreviewed state families remain explicit');
const ids = new Set();
for (const scenario of stateContract.cases) {
    assert(!ids.has(scenario.id), `Duplicate case ${scenario.id}`); ids.add(scenario.id);
    assert(['microphone', 'time', 'sleep-command', 'manual-command', 'auto-defaults', 'workflow'].includes(scenario.group));
    assert.equal(scenario.coverage, 'runtime');
    assert(stateContract.announcementCategories[scenario.announcementCategory], scenario.id + ': announcement category');
    if(scenario.group==='time'||scenario.id==='FLOW-SUMMARY-OPEN')assert.equal(scenario.announcementCategory,'user-activated');
    if(scenario.id==='FLOW-READY-ENDS-RUNNING')assert.equal(scenario.announcementCategory,'transitional');
    assert(Object.keys(scenario.given).length && Object.keys(scenario.expect.state).length);
    assert(['voice', 'pointer', 'automatic'].includes(scenario.input.method));
    if (scenario.input.method === 'voice') assert(scenario.input.text && typeof scenario.expect.committed === 'boolean');
    assert(Number.isInteger(scenario.expect.writes) && scenario.expect.writes >= 0);
    for (const family of [scenario.modeFamily, scenario.givenFamily, scenario.expect.family].filter(Boolean)) assert(stateContract.stateFamilies[family], scenario.id + ': known family ' + family);
    for (const requirement of [...(scenario.expect.announcements?.required || []), ...(scenario.expect.announcements?.forbidden || [])]) {assert(requirement.text || requirement.pattern); if(requirement.pattern)new RegExp(requirement.pattern);}
    assert.equal(scenario.expect.locks, 0);
    for (const event of scenario.expect.audio || []) {
        assert(['speech', 'chime'].includes(event.kind));
        if (event.kind === 'speech') assert(event.text || event.format === 'duration-only');
        else assert(event.name);
    }
}
for (const [id, family] of Object.entries(stateContract.stateFamilies)) {
    assert(family.region && Object.keys(family.match).length, id + ': region and snapshot binding');
    assert(['named-cases','unreviewed'].includes(family.coverage), id + ': explicit coverage');
    for (const constraint of family.constraints || []) assert(['gt','lt'].includes(constraint.op) && Number.isFinite(constraint.value));
    if(family.coverage==='named-cases')assert(stateContract.cases.some(test=>test.modeFamily===id||test.givenFamily===id||test.expect.family===id), id + ': runnable family evidence');
}
for (const invariant of stateContract.invariants) {
    if (invariant.evidence) {
        const file = invariant.evidence.match(/node\s+(\S+)/)?.[1];
        assert(file && fs.existsSync(new URL(file, root)), `${invariant.id}: evidence exists`);
    }
}
// Prove the oracle catches missing state, empty/overbroad grammar, duplicate
// announcements and reversed audio. Comparing runtime with itself cannot pass.
assert.throws(() => assertState({}, {'clock.trip_active': true}, 'missing snapshot'));
assert.throws(() => assertCommands([], {only: ['SpeechMenu.wake']}, 'empty grammar'));
assert.throws(() => assertCommands(['SpeechMenu.wake', 'WMOFActions.openSpeechOptions'], {only: ['SpeechMenu.wake']}, 'wide grammar'));
assert.throws(() => assertAudio([{kind: 'speech', text: 'one'}, {kind: 'speech', text: 'one'}], [{kind: 'speech', text: 'one'}], 'duplicate'));
assert.throws(() => assertAudio([{kind: 'chime', name: 'time-reference'}, {kind: 'speech', text: 'one'}], [{kind: 'speech', format: 'duration-only'}, {kind: 'chime', name: 'time-reference'}], 'reversed'));
assert.throws(() => assertAudio([{kind: 'speech', text: 'banana'}], [{kind: 'speech', format: 'duration-only'}], 'nonnumeric'));
assert.throws(() => assertFamily({tripActive:true,clockPhase:'running',clock:{dispatch_state:{goalProgress:'past'},goal_component:{value:1.2},current_percent_component:{value:0.9}}}, 'TRIP-B-GAME', 'below standard'));
assert.throws(() => assertAnnouncements([{kind:'speech',text:'unexpected'}], {required:[{text:'expected'}]}, 'missing announcement'));
assert.throws(() => assertAnnouncements([{kind:'speech',text:'duplicate'},{kind:'speech',text:'duplicate'}], {required:[{text:'duplicate'}]}, 'duplicate announcement'));
const familyReport=Object.entries(stateContract.stateFamilies).map(([id,family])=>({family:id,region:family.region,cases:stateContract.cases.filter(test=>test.givenFamily===id||test.expect.family===id).map(test=>test.id).join(', ')||'unreviewed'}));
if(process.argv.includes('--inventory'))console.table(familyReport);
console.log(`PASS state contract structure and negative oracle checks (${ids.size} named cases)`);
if (!process.argv.includes('--validate-only')) {
    const prefix=process.argv.find(value=>value.startsWith('--case-prefix='))?.slice(14);
    const selected=[...ids].filter(id=>!prefix||id.startsWith(prefix));assert(selected.length,'case filter selects a known case');
    for (const id of selected) {
        execFileSync(process.execPath, ['tests/app-state-transactions.mjs', '--state-contract', `--case=${id}`, '--voice-feedback'], {
            cwd: root, env: {...process.env, TZ: 'UTC'}, stdio: 'inherit', timeout: 30000
        });
    }
    console.log(`PASS ${selected.length} coupled-state runtime contracts; remaining families explicitly unreviewed`);
}
