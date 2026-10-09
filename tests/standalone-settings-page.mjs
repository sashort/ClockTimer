import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const standalone = read('../settings.html');
const dropInTemplate = read('../templates/pages/drop-in/body.html');
const dropInBuilt = read('../drop-in.html');
const orderTemplate = read('../templates/pages/order-filler/timer-header.html');
const orderBuilt = read('../order-filler.html');
const orderDialogs = read('../templates/pages/order-filler/dialogs.html');
const orderScripts = read('../templates/pages/order-filler/scripts.html');
const fsmDoc = read('../docs/clock-timer-fsm.md');
const fsm = JSON.parse(read('../docs/mainline-fsm.json'));
const fsmHtml = read('../docs/mainline-fsm.html');

const settingsSurfaces = [
    'graphicalSettingsDialog',
    'audioSettingsDialog',
    'audioAnnouncementsDialog',
    'stateSettingsDialog',
    'tripSettingsDialog',
];

assert.match(standalone, /<body class="settings-page">/, 'settings has a dedicated standalone page mode');
assert.match(standalone, /id="settingsPageHeader"/, 'standalone page retains its own header');
assert.match(standalone, /window\.self !== window\.top/, 'embedded settings hide the standalone return header');
assert.match(standalone, /standaloneSettingsPageStyles/, 'standalone page has dedicated layout styles');
assert.match(standalone, /standaloneSettingsPageBootstrap/, 'standalone page initializes settings surfaces');
assert.match(standalone, /new URLSearchParams\(window\.location\.search\)/, 'surface-specific launches are selected from the query string');
assert.match(standalone, /if \(focusedSurface && id !== focusedSurface\) continue;/, 'only the selected surface opens for a specific launcher');
assert.match(standalone, /settings-surface-focused > dialog#graphicalSettingsDialog:not\(\[data-requested-settings-surface\]\)/, 'focused CSS overrides the normal visible settings-surface layout');
for (const id of settingsSurfaces) {
    assert.match(standalone, new RegExp(`<dialog id="${id}"(?:\\s|>)`), `${id} is included in the standalone page`);
    assert.match(standalone, new RegExp(`"${id}"`), `${id} is listed for page initialization`);
}
assert.match(standalone, /dialog\.show\(\)/, 'settings surfaces are shown as page sections');
assert.match(standalone, /position:static !important/, 'settings surfaces flow in the page instead of overlaying it');

function assertIframeOnlyDialog(markup, label, checkController = true) {
    const start = markup.indexOf('<dialog id="clockTimerSettingsFrameDialog"');
    const end = markup.indexOf('</dialog>', start);
    assert(start >= 0 && end > start, `${label} includes the settings modal`);
    const dialog = markup.slice(start, end + '</dialog>'.length);
    assert.match(dialog, /^<dialog[^>]*>\s*<iframe id="clockTimerSettingsFrame"[^>]*><\/iframe>\s*<\/dialog>$/, `${label} modal contains only the iframe`);
    assert.doesNotMatch(dialog, /<button|<h[1-6]|<label|<p[ >]/, `${label} modal adds no extra controls or labels around the iframe`);
    if (checkController) {
        assert.match(markup, /frame\.src = surface[\s\S]*?settings\.html\?surface=/, `${label} chooses requested surfaces in the iframe`);
        assert.match(markup, /event\.target === dialog\) dialog\.close\(\)/, `${label} supports backdrop dismissal without an extra close button`);
    }
}
assert.match(dropInTemplate, /data-open-clock-timer-settings/, 'Drop-In exposes its existing settings trigger');
assert.match(dropInBuilt, /data-open-clock-timer-settings/, 'built Drop-In includes its settings trigger');
assertIframeOnlyDialog(dropInTemplate, 'Drop-In template');
assertIframeOnlyDialog(dropInBuilt, 'built Drop-In');
assert.match(orderTemplate, /data-settings-surface="graphicalSettingsDialog"/, 'Order-Filler keeps a distinct graphical-settings entry');
assert.match(orderTemplate, /data-settings-surface="audioSettingsDialog"/, 'Order-Filler keeps a distinct audio-settings entry');
assert.match(orderTemplate, />Clock\/Timer Settings<\/button>/, 'graphical entry keeps its existing label');
assert.match(orderTemplate, />Audio Settings<\/span>/, 'audio entry keeps its existing label');
assert.match(orderBuilt, /data-settings-surface="graphicalSettingsDialog"/, 'built Order-Filler has a distinct graphical-settings entry');
assert.match(orderBuilt, /data-settings-surface="audioSettingsDialog"/, 'built Order-Filler has a distinct audio-settings entry');
assert.doesNotMatch(orderTemplate, /All ClockTimer Settings/, 'Order-Filler does not merge the separate entries');
assertIframeOnlyDialog(orderDialogs, 'Order-Filler dialog template', false);
assertIframeOnlyDialog(orderBuilt, 'built Order-Filler');
assert.match(orderScripts, /data-settings-surface/, 'Order-Filler controller handles surface-specific entry points');
assert.doesNotMatch(dropInBuilt, /href="settings\.html" target="_blank"/, 'Drop-In does not open settings in a new tab');

assert.match(fsmDoc, /Settings navigation is orthogonal to the trip lifecycle/, 'FSM documentation defines settings navigation as lifecycle-neutral');
assert.equal(fsm.external_surfaces.settings_page.lifecycle_effect, 'none', 'structured FSM marks settings navigation as lifecycle-neutral');
assert.deepEqual(fsm.external_surfaces.settings_page.surfaces, settingsSurfaces, 'structured FSM enumerates all supported settings surfaces');
assert.equal(fsm.external_surfaces.settings_page.order_filler_access.surface_specific, true, 'FSM documents separate Order-Filler entry points');
assert.equal(fsm.external_surfaces.settings_page.drop_in_access.container, 'iframe', 'FSM documents iframe access in Drop-In');

const embeddedStart = fsmHtml.indexOf('<script id="fsm-data" type="application/json">');
const embeddedEnd = fsmHtml.indexOf('</script>', embeddedStart);
assert(embeddedStart >= 0 && embeddedEnd > embeddedStart, 'interactive FSM contains an embedded structured model');
const embeddedModel = JSON.parse(fsmHtml.slice(embeddedStart + '<script id="fsm-data" type="application/json">'.length, embeddedEnd));
assert.deepEqual(embeddedModel.external_surfaces, fsm.external_surfaces, 'interactive and standalone FSM data stay synchronized');

console.log('PASS: iframe-only settings modal, separate settings entry points, and lifecycle-neutral FSM checks');
