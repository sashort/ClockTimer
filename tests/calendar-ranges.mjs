import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

const window = new Window({url: 'https://clock.example/'});
const context = vm.createContext({Date, Intl, URL, URLSearchParams, location: {origin: 'https://clock.example'}, localStorage: window.localStorage});
vm.runInContext(fs.readFileSync(new URL('../CalendarRange.js', import.meta.url), 'utf8'), context);
const CalendarRange = context.CalendarRange;
const rules = {weekStartDay: 6, cutoffTime: '00:00:00', payPeriodDays: 14,
    payPeriodAnchorDate: '2026-01-03', recurring: true, effectiveFrom: '1970-01-01', effectiveThrough: '2026-12-31'};
const results = [];
async function check(test, fn) { await fn(); results.push({test, passed: true}); console.log('PASS', test); }
const calc = (range, at, timezone = 'America/New_York', selectedRules = rules) => CalendarRange.calculate(selectedRules, range, at, timezone);
try {
    await check('Friday ends at following Saturday midnight', () => {
        const r = calc('week', '2026-09-18T23:59:59-04:00');
        assert.equal(r.startTime, '2026-09-12T04:00:00.000Z'); assert.equal(r.endTime, '2026-09-19T04:00:00.000Z');
    });
    await check('Saturday midnight is included only in the new week', () => {
        assert.equal(calc('week', '2026-09-19T00:00:00-04:00').startTime, '2026-09-19T04:00:00.000Z');
    });
    await check('2028 leap day week', () => assert.equal(calc('week', '2028-02-29T12:00:00-05:00').startTime, '2028-02-26T05:00:00.000Z'));
    await check('2028 recurring pay period is extrapolated explicitly', () => {
        const r = calc('pay-period', '2028-02-29T12:00:00-05:00');
        assert.equal(r.startTime, '2028-02-26T05:00:00.000Z'); assert.equal(r.endTime, '2028-03-11T05:00:00.000Z'); assert.equal(r.extrapolated, true);
    });
    await check('spring DST uses civil dates, giving 167 hours', () => {
        const r = calc('week', '2028-03-12T12:00:00-04:00'); assert.equal((Date.parse(r.endTime) - Date.parse(r.startTime)) / 3600000, 167);
    });
    await check('fall DST uses civil dates, giving 169 hours', () => {
        const r = calc('week', '2028-11-05T12:00:00-05:00'); assert.equal((Date.parse(r.endTime) - Date.parse(r.startTime)) / 3600000, 169);
    });
    await check('inclusive API maximum excludes next week midnight', () => {
        const r = calc('week', '2026-09-18T12:00:00-04:00'); assert.equal(CalendarRange.tripWindow(r).endTime, '2026-09-19T03:59:59.999Z');
    });
    await check('negative pay-cycle offsets use floor', () => assert.equal(calc('pay-period', '2026-01-02T12:00:00Z', 'UTC').startTime, '2025-12-20T00:00:00.000Z'));
    await check('different employer week and cutoff', () => assert.equal(calc('week', '2028-02-27T03:00:00Z', 'UTC', {...rules, weekStartDay: 0, cutoffTime: '04:00:00'}).startTime, '2028-02-20T04:00:00.000Z'));
    await check('nonexistent DST cutoff is rejected', () => assert.throws(() => calc('day', '2028-03-12T12:00:00-04:00', 'America/New_York', {...rules, cutoffTime: '02:30:00'}), /does not exist/));
    await check('year-specific pay calendars cannot silently extrapolate', () => assert.throws(() => calc('pay-period', '2028-02-29T12:00:00Z', 'UTC', {...rules, recurring: false}), /No verified/));
    await check('missing pay-period anchor is not invented', () => assert.throws(() => calc('pay-period', '2028-02-29T12:00:00Z', 'UTC', {...rules, payPeriodDays: null, payPeriodAnchorDate: null}), /anchor/));
    await check('Gregorian month includes leap day', () => assert.equal(calc('month', '2028-02-29T12:00:00Z', 'UTC').endTime, '2028-03-01T00:00:00.000Z'));
    await check('Gregorian year ends in the following year', () => assert.equal(calc('year', '2028-02-29T12:00:00Z', 'UTC').endTime, '2029-01-01T00:00:00.000Z'));
    const cached = {...calc('week', '2026-09-18T12:00:00-04:00'), rules, sources: [], profile: 'walmart-us', provenance: 'web-search'};
    const client = new CalendarRange({baseUrl: 'https://clock.example/', storage: window.localStorage,
        fetcher: async url => {assert.equal(url.searchParams.get('at'), '2026-09-18T16:00:00.000Z'); return {ok: true, json: async () => cached};}});
    await check('server rule is persisted for offline use', async () => assert.equal((await client.resolve({range: 'week', at: '2026-09-18T16:00:00Z', timezone: 'America/New_York'})).offline, false));
    client.fetcher = async () => {throw new TypeError('offline');};
    await check('offline cached recurrence computes a new 2028 range', async () => {
        const r = await client.resolve({range: 'pay-period', at: '2028-02-29T17:00:00Z', timezone: 'America/New_York'});
        assert.equal(r.offline, true); assert.equal(r.startTime, '2028-02-26T05:00:00.000Z');
    });
    client.fetcher = async () => ({ok: false, status: 422, json: async () => ({message: 'No verified calendar'})});
    await check('authoritative coverage errors cannot be bypassed with cache', async () => assert.rejects(client.resolve({at: '2028-02-29T17:00:00Z', timezone: 'America/New_York'}), /No verified/));
    const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
    const handlers = appSource.slice(appSource.indexOf('    async function dispatchTripListRequest('), appSource.indexOf('    function animateTripLogBody('));
    const body = window.document.createElement('section'); window.document.body.append(body);
    const calls = [], totals = [], events = [];
    window.addEventListener('wmof:trip-list-request', event => events.push(event.detail));
    const apiTrip = index => ({id: index, startTime: '2026-09-17 16:00:00.000', standardTimeMilliseconds: 1200000, actualTimeMilliseconds: 600000});
    const createHandlers = new Function('calendarRanges', 'CalendarRange', 'clockTimer', 'tripLogBody', 'getTripLogRange', 'window', 'document', 'fetch',
        'const API_BASE = window.location.origin + "/"; const CustomEvent = window.CustomEvent; let tripLogRequestSequence = 0; let tripTotalsRefreshQueue = Promise.resolve(); let tripRangeRevision = 0; const resolveTripLogCalendar = range => calendarRanges.resolve({range}); const updateSummaryValues = () => {};\n' + handlers + '\nreturn {dispatchTripListRequest, renderTripLog, updateTripTotals, refreshGoalTotalsForRange};');
    const app = createHandlers({resolve: async () => cached}, CalendarRange,
        {nonProductionFilter: 'none', calculateTripTotals: async (...args) => totals.push(args)}, body, () => 'week', window, window.document,
        async url => {calls.push(url.toString()); const offset = Number(url.searchParams.get('offset')); return {ok: true, json: async () => ({trips: offset ? [apiTrip(1001)] : Array.from({length: 1000}, (_, i) => apiTrip(i + 1))})};});
    await check('Trip Log fetch uses resolved dates and paginates all rows', async () => {
        await app.dispatchTripListRequest(); assert.equal(calls.length, 2); assert.equal(body.querySelectorAll('tbody tr').length, 1001);
        assert.equal(new URL(calls[0]).searchParams.get('maxDateTime'), '2026-09-19T03:59:59.999Z');
        assert.equal(new URL(calls[1]).searchParams.get('offset'), '1000');
    });
    await check('Trip Log and goal totals use identical boundaries', () => {
        assert.equal(totals[0][0], cached.startTime); assert.equal(totals[0][1], CalendarRange.tripWindow(cached).endTime);
        assert.equal(events.at(-1).endTime, totals[0][1]); assert.equal(events.at(-1).trips.length, 1001);
    });
    await check('Trip Log renders untrusted fields as text', () => {
        app.renderTripLog({trips: [{...apiTrip(1), id: '<img src=x onerror=alert(1)>'}]}, cached);
        assert.equal(body.querySelector('img'), null); assert.ok(body.textContent.includes('<img'));
    });
    await check('old async range request cannot overwrite a newer selection', async () => {
        let release, count = 0;
        const stale = createHandlers({resolve: () => ++count === 1 ? new Promise(resolve => {release = resolve;}) : Promise.resolve({...cached, range: 'day'})},
            CalendarRange, {nonProductionFilter: 'none', calculateTripTotals: async () => {}}, body, () => count ? 'day' : 'week', window, window.document,
            async () => ({ok: true, json: async () => ({trips: []})}));
        const old = stale.dispatchTripListRequest(); await stale.dispatchTripListRequest(); const current = body.textContent;
        release(cached); await old; assert.equal(body.textContent, current); assert.equal(events.at(-1).range, 'day');
    });
    await check('lookup failures expose a clear Trip Log error', async () => {
        const failing = createHandlers({resolve: async () => {throw new Error('No verified pay-period anchor');}}, CalendarRange, {}, body, () => 'pay-period', window, window.document, async () => {});
        await failing.dispatchTripListRequest(); assert.equal(body.textContent, 'No verified pay-period anchor');
    });
    await check('aggregate refreshes serialize so an old response cannot replace new totals', async () => {
        let release, latest;
        const order = [];
        const queued = createHandlers({}, CalendarRange, {calculateTripTotals: async start => {
            order.push(start);
            if (start === 'older') await new Promise(resolve => {release = resolve;});
            latest = start;
        }}, body, () => 'week', window, window.document, async () => {});
        const first = queued.updateTripTotals({startTime: 'older', endTime: 'older-end'});
        await Promise.resolve(); await Promise.resolve();
        const second = queued.updateTripTotals({startTime: 'newer', endTime: 'newer-end'});
        await Promise.resolve(); assert.deepEqual(order, ['older']);
        release(); await Promise.all([first, second]); assert.equal(latest, 'newer');
    });
    await check('goal totals can refresh without opening Trip Log', async () => {
        const updated = [];
        const closed = createHandlers({resolve: async () => cached}, CalendarRange,
            {calculateTripTotals: async (...args) => updated.push(args)}, body, () => 'week', window, window.document, async () => {});
        await closed.refreshGoalTotalsForRange('week'); assert.equal(updated[0][1], CalendarRange.tripWindow(cached).endTime);
    });
    console.log(`${results.length} client calendar checks passed.`);
} catch (error) {
    results.push({test: 'execution', passed: false, error: error.message}); throw error;
} finally {
    if (process.env.CLOCKTIMER_CALENDAR_TEST_OUTPUT) fs.writeFileSync(process.env.CLOCKTIMER_CALENDAR_TEST_OUTPUT, JSON.stringify({environment: 'Local calendar and DOM tests; mocked upstream search and API responses', passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results}, null, 2));
    await window.happyDOM.close();
}
