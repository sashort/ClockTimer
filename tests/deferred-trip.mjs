import fs from 'node:fs';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
let prepared = 0, started = 0, frame;
const clockTimer = { status: 'ready', prepareTrip() { prepared++; return {tripId: 42}; }, start() { started++; } };
const bindings = {
    clockTimer, uiReturnStack: [], resetTripSettingsNavigation() {},
    renderDeferredTrip() {},
    getTripMomentDefaults: date => ({ creationDate: '2026-09-18', creationTime: '12:00:00', scheduledStart: '12:00:00', startTime: '12:00:00' }),
    getTripPreferences: () => ({ syncGoals: false }),
    parseDateInput: value => new Date(value + 'T00:00:00'),
    parseTimelineTime: value => value ? value.split(':').reduce((total, part) => total * 60 + Number(part), 0) * 1000 : NaN,
    formatTimelineMilliseconds: value => `${Math.floor(value / 3600000)}:${String(Math.floor(value / 60000) % 60).padStart(2, '0')}:${String(Math.floor(value / 1000) % 60).padStart(2, '0')}`,
    openNumberPad: options => { frame = options; return true; }
};
const controller = new Function(...Object.keys(bindings), `
    let tripDraft, tripSettingsSession, tripStartsNowState, stagedStandardTime;
    ${section('    function tripDraftCanStart(', '    function cloneTripSettingsValues(')}
    ${section('    function resumedTripStarts(', '    $("#newTripButton").addEventListener(')}
    return {beginNewTripWorkflow, startTripDraft, tripDraftCanStart,
        draft: () => tripDraft, defer() { tripDraft.deferred=true; tripDraft.startTime=undefined; tripDraft.scheduledStart=tripDraft.creationTime; }};
`)(...Object.values(bindings));
await controller.beginNewTripWorkflow({ initialValue: '0:30:00', tripMoment: new Date('2026-09-18T12:00:00') });
assert.equal(prepared, 1);
controller.defer();
const creation = controller.draft().creationTime;
assert(controller.tripDraftCanStart());
assert.equal(await controller.startTripDraft(), false);
assert.equal(started, 0);
assert.equal(controller.draft().startTime, undefined);
assert.equal(controller.draft().scheduledStart, creation);
console.log('PASS deferred draft stays unstarted with blank actual start and scheduled start matching creation');
await controller.beginNewTripWorkflow({ tripMoment: new Date('2026-09-20T09:05:00') });
assert.equal(prepared, 1);
assert.equal(controller.draft().creationTime, creation);
assert.equal(controller.draft().creationDate, '2026-09-18');
assert.equal(controller.draft().startTime, '57:05:00');
assert.equal(controller.draft().scheduledStart, creation);
assert.equal(controller.draft().deferred, false);
assert.equal(frame.initialValue, '0:30:00');
console.log('PASS resume reuses reservation and creation time across days');
controller.draft().scheduledStart = '56:30:00';
assert.equal(controller.draft().scheduledStart, '56:30:00');
console.log('PASS reopened trip accepts a scheduled start adjustment');
controller.defer();
await controller.beginNewTripWorkflow({ tripMoment: new Date('2026-09-21T10:00:00') });
assert.equal(prepared, 1);
assert.equal(controller.draft().startTime, '82:00:00');
assert.equal(controller.draft().scheduledStart, creation);
console.log('PASS repeated deferring and resuming never reserves a new ID');
