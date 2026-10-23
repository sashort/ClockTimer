import fs from 'node:fs';
import assert from 'node:assert/strict';

export const stateContract = JSON.parse(fs.readFileSync(
    new URL('../docs/order-filler-state-contract.json', import.meta.url), 'utf8'));

const inventory = JSON.parse(fs.readFileSync(
    new URL('../docs/application-state-inventory.json', import.meta.url), 'utf8'));

export function assertInventoryBindings(expected, label) {
    for (const [path, regionId] of Object.entries(stateContract.inventoryBindings)) {
        const region = inventory.regions.find(region => region.id === regionId);
        assert(region, label + ': registered inventory region ' + regionId);
        if (Object.hasOwn(expected, path)) {
            assert(region.values.some(state => state.value === expected[path]),
                label + ': unmapped value for ' + regionId + ': ' + expected[path]);
        }
    }
}
for (const scenario of stateContract.cases) {
    assertInventoryBindings(scenario.given, scenario.id + ' Given');
    assertInventoryBindings(scenario.expect.state, scenario.id + ' Expect');
}
for (const [id, family] of Object.entries(stateContract.stateFamilies)) {
    assertInventoryBindings(family.match, id);
}

// Expectations come from the reviewed contract, never from runtime availability.
export function assertState(actual, expected, label) {
    assertInventoryBindings(expected, label);
    for (const [path, value] of Object.entries(expected)) {
        const observed = path.split('.').reduce((object, key) => object?.[key], actual);
        // Browser-realm arrays have a different prototype; compare JSON contract data.
        const comparable = observed === undefined ? undefined : JSON.parse(JSON.stringify(observed));
        assert.deepEqual(comparable, value, `${label}: ${path}`);
    }
}

export function assertCommands(actions, expected, label) {
    const available = new Set(actions);
    assert(available.size, `${label}: command inventory must not be empty`);
    for (const action of expected.required || []) assert(available.has(action), `${label}: missing ${action}; got ${[...available]}`);
    for (const action of expected.forbidden || []) assert(!available.has(action), `${label}: forbidden ${action}`);
    if (expected.only) assert.deepEqual([...available].sort(), [...expected.only].sort(), `${label}: exclusive command inventory`);
}

export function assertAudio(actual, expected, label) {
    assert.equal(actual.length, expected.length, `${label}: audio count; got ${JSON.stringify(actual)}`);
    for (const [index, item] of expected.entries()) {
        const event = actual[index];
        assert.equal(event.kind, item.kind, `${label}: audio order at ${index}`);
        if (item.name) assert.equal(event.name, item.name, `${label}: chime`);
        if (item.text) assert.equal(event.text, item.text, `${label}: announcement`);
        if (item.format === 'duration-only') {
            let duration=event.text.toLowerCase().trim();
            if(item.prefix){
                assert(duration.startsWith(item.prefix.toLowerCase()),`${label}: required duration prefix`);
                duration=duration.slice(item.prefix.length).trim();
            }
            const words = duration.split(/[ -]+/);
            const numbers = new Set('minus zero oh one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand'.split(' '));
            assert(words.length && words.every(word => numbers.has(word)), `${label}: numeric duration must be spoken`);
            assert(!/at the tone|minutes?|seconds?|hours?/i.test(event.text), `${label}: duration has no preamble or units`);
        }
        if (item.scheduled !== undefined) assert.equal(Number.isFinite(event.startAtPerformanceMs), item.scheduled, `${label}: scheduled cue`);
    }
}


export function assertFamily(actual, id, label) {
    const family = stateContract.stateFamilies[id];
    assert(family, label + ': named state family exists: ' + id);
    assertState(actual, family.match, label + ': family ' + id);
    for (const constraint of family.constraints || []) {
        const value = constraint.path.split('.').reduce((object, key) => object?.[key], actual);
        assert(Number.isFinite(value), label + ': numeric ' + constraint.path);
        assert(constraint.op === 'gt' ? value > constraint.value : value < constraint.value, label + ': ' + constraint.path + ' ' + constraint.op + ' ' + constraint.value);
    }
}

// Partial announcement requirements are explicit; only audio[] specifies the
// complete sequence. Required speech defaults to exactly one occurrence.
export function assertAnnouncements(audio, expected, label) {
    const spoken = audio.filter(event => event.kind === 'speech').map(event => event.text);
    const matches = (text, requirement) => requirement.text !== undefined
        ? text === requirement.text : new RegExp(requirement.pattern).test(text);
    for (const requirement of expected.required || []) {
        assert.equal(spoken.filter(text => matches(text, requirement)).length, requirement.count ?? 1,
            label + ': required announcement ' + JSON.stringify(requirement) + '; got ' + JSON.stringify(spoken));
    }
    for (const requirement of expected.forbidden || []) {
        assert(!spoken.some(text => matches(text, requirement)), label + ': forbidden announcement ' + JSON.stringify(requirement));
    }
}
