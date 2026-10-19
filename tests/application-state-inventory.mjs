import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Window} from 'happy-dom';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const inventory = JSON.parse(read('docs/application-state-inventory.json'));
const {sharedRows, rowsForMode, render} = createRequire(import.meta.url)('../scripts/build-application-state-inventory.cjs');
assert.equal(inventory.stateSet, 'shared');
assert.equal(inventory.modeIsPartOfStateIdentity, false);
assert.deepEqual(new Set(inventory.appModes), new Set(['debug', 'simulation', 'production']));
const regions = new Map(), ids = new Set();
for (const region of inventory.regions) {
    assert(!regions.has(region.id), 'Unique region ' + region.id);
    regions.set(region.id, region);
    assert(region.values.length && region.source.file && region.source.owner);
    assert(read(region.source.file).length, region.id + ': source exists');
    const values = new Set();
    for (const state of region.values) {
        assert(/^[A-Z][A-Z0-9_-]*$/.test(state.id), 'Readable stable state ID: ' + state.id);
        assert(!ids.has(state.id), 'Unique state ID: ' + state.id); ids.add(state.id);
        assert(!values.has(state.value), region.id + ': unique value'); values.add(state.value);
        assert(state.meaning);
    }
}
for (const alias of [...inventory.sharedAliases, ...inventory.debugWorkflows]) {
    assert(!ids.has(alias.id)); ids.add(alias.id);
    for (const [key, value] of Object.entries(alias.when)) {
        if (key === 'tripActive') {assert.equal(typeof value, 'boolean'); continue;}
        assert(regions.has(key), alias.id + ': condition uses a registered region');
        for (const item of Array.isArray(value) ? value : [value]) {
            assert(regions.get(key).values.some(state => state.value === item), alias.id + ': known condition ' + key + '=' + item);
        }
    }
}
const debug = rowsForMode(inventory, 'debug');
for (const mode of ['simulation', 'production']) {
    assert.deepEqual(rowsForMode(inventory, mode).shared, debug.shared, 'Same shared state vocabulary in ' + mode);
}
assert.throws(() => rowsForMode(inventory), /explicit/);
assert.throws(() => rowsForMode(inventory, 'unknown'), /explicit/);
assert(debug.exclusive.length);
for (const state of inventory.debugWorkflows) assert.deepEqual(state.appliesTo, ['debug']);
assert(!sharedRows(inventory).some(state => /^APP-(DEBUG|PRODUCTION|SIMULATION)$/.test(state.id)), 'Mode selectors are not workflow states');

for (const entry of inventory.sourceAudit) for (const owner of entry.owners) {
    assert(read(entry.file).includes(owner), entry.file + ': audited owner exists: ' + owner);
}
// Cover real surface identities, including dynamically loaded Numberpad, and
// fail when a new static dialog/popover is introduced without registration.
const window = new Window({settings:{disableJavaScriptEvaluation:true, disableJavaScriptFileLoading:true, disableCSSFileLoading:true}});
try {
    window.document.write(read('order-filler.html'));
    const loaded = window.document.createElement('div'); loaded.innerHTML = read('numberpad.html');
    window.document.body.append(loaded);
    const declared = new Set(inventory.surfaces.filter(surface => surface.kind !== 'dynamic').map(surface => surface.id));
    const actual = new Set([...window.document.querySelectorAll('dialog[id],[popover][id]')].map(element => element.id));
    assert.deepEqual(declared, actual, 'Every current static/loaded modal and popover is enumerated');
    for (const surface of inventory.surfaces) {
        assert.deepEqual(surface.states, ['closed','opening','open','closing']);
        assert(read(surface.source).length);
        for (const state of surface.states) {
            const id = surface.stateIdPrefix + '__' + state.toUpperCase();
            assert(!ids.has(id), id + ': unique surface state'); ids.add(id);
        }
    }
    const controls = new Set([...window.document.querySelectorAll('#mainMenu [aria-controls]')].map(element => element.getAttribute('aria-controls')));
    assert.deepEqual(new Set(regions.get('menuPane').values.map(state => state.value)), new Set(['root', ...controls]), 'Every promoted parent pane has a state');
} finally {await window.happyDOM.close();}
const dynamicDialogs = inventory.surfaces.filter(surface => surface.kind === 'dynamic' && surface.id !== 'modeDropdown');
for (const file of ['app.js', 'ModeMenu.js']) {
    const creations = [...read(file).matchAll(/createElement\(\s*['"]dialog['"]\s*\)/g)].length;
    assert.equal(dynamicDialogs.filter(surface => surface.source === file).length, creations, file + ': dynamically created dialogs are registered');
}
// Audit literal operation/continuation labels independently of fixture results.
const operationSource = read('StateTransactions.js');
const operationPhases = new Set([...operationSource.matchAll(/(?:setPhase|recordPhase)\([^\n]*?["']([a-z-]+)["']\s*\)/g)].map(match => match[1]));
for (const phase of operationPhases) assert(regions.get('operation').values.some(value => value.value === phase), 'Operation phase ' + phase);
for (const phase of [...read('SpeechContinuationSession.js').matchAll(/#phase\s*=\s*"([a-z-]+)"/g)].map(match => match[1])) {
    assert(regions.get('continuation').values.some(value => value.value === phase), 'Continuation phase ' + phase);
}
const model = JSON.parse(read('docs/mainline-fsm-draft.json'));
assert.deepEqual(new Set(inventory.referenceMapping.map(item => item.legacyId)), new Set(Object.keys(model.states)), 'Every legacy chart node has an explicit disposition');
for (const item of inventory.referenceMapping) {
    assert(['mapped','retired','out-of-scope'].includes(item.disposition), 'Reviewed legacy node ' + item.legacyId);
    for (const region of item.regions) assert(regions.has(region));
}
const html = read('docs/application-state-inventory.html');
assert.equal(html, render(inventory), 'Searchable view matches the exact inventory');
const embedded = JSON.parse(html.match(/<script id="state-inventory" type="application\/json">([\s\S]*?)<\/script>/)[1]);
assert.deepEqual(embedded, inventory);
assert(inventory.constraints.length && inventory.observabilityGaps.length);
assert(inventory.exclusions.includes('Server-assigned trips and assignment handling'));
assert.equal(inventory.futureBranch.name, 'test');
assert.equal(inventory.futureBranch.created, false, 'The future branch is a plan, not an action performed');
console.log(`PASS shared inventory: ${inventory.regions.length} regions, ${inventory.surfaces.length} surface types, ${inventory.debugWorkflows.length} Debug-only workflows; source/legacy coverage and view parity`);
