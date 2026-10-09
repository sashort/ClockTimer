import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const standalone = read('../settings.html');
const dropInTemplate = read('../templates/pages/drop-in/body.html');
const dropInBuilt = read('../drop-in.html');
const orderTemplate = read('../templates/pages/order-filler/timer-header.html');
const orderBuilt = read('../order-filler.html');
const orderDialogs = read('../templates/pages/order-filler/dialogs.html');
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
assert.match(standalone, /id="settingsPageHeader"/, 'standalone page provides a page-level heading');
assert.match(standalone, /window\.self !== window\.top/, 'embedded settings hide the standalone return header');
assert.match(standalone, /standaloneSettingsPageStyles/, 'standalone page has dedicated layout styles');
assert.match(standalone, /standaloneSettingsPageBootstrap/, 'standalone page initializes settings surfaces');
for (const id of settingsSurfaces) {
    assert.match(standalone, new RegExp(`<dialog id="${id}"(?:\\s|>)`), `${id} is included in the standalone page`);
    assert.match(standalone, new RegExp(`"${id}"`), `${id} is listed for page initialization`);
}
assert.match(standalone, /dialog\.show\(\)/, 'settings surfaces are shown as non-modal page sections');
assert.match(standalone, /position:static !important/, 'settings surfaces flow in the page instead of overlaying it');
assert.match(dropInTemplate, /data-open-clock-timer-settings/, 'Drop-In exposes the settings dialog trigger');
assert.match(dropInBuilt, /data-open-clock-timer-settings/, 'built Drop-In page includes the settings dialog trigger');
assert.match(dropInTemplate, /id="clockTimerSettingsFrameDialog"/, 'Drop-In includes the iframe settings dialog');
assert.match(dropInBuilt, /id="clockTimerSettingsFrameDialog"/, 'built Drop-In page includes the iframe settings dialog');
assert.match(orderTemplate, /data-open-clock-timer-settings/, 'Order-Filler exposes the settings dialog trigger');
assert.match(orderBuilt, /data-open-clock-timer-settings/, 'built Order-Filler page includes the settings dialog trigger');
assert.match(orderDialogs, /id="clockTimerSettingsFrameDialog"/, 'Order-Filler template includes the iframe settings dialog');
assert.match(orderBuilt, /id="clockTimerSettingsFrameDialog"/, 'built Order-Filler page includes the iframe settings dialog');
assert.match(dropInBuilt, /<iframe id="clockTimerSettingsFrame" src="settings.html"/, 'Drop-In embeds the shared settings page in an iframe');
assert.match(orderBuilt, /<iframe id="clockTimerSettingsFrame" src="settings.html"/, 'Order-Filler embeds the shared settings page in an iframe');
assert.doesNotMatch(dropInBuilt, /href="settings.html" target="_blank"/, 'Drop-In no longer opens settings in a new tab');
assert.match(fsmDoc, /Settings-page navigation is orthogonal to the trip lifecycle/, 'FSM documentation defines settings navigation as lifecycle-neutral');
assert.equal(fsm.external_surfaces.settings_page.lifecycle_effect, 'none', 'structured FSM marks settings navigation as lifecycle-neutral');
assert.deepEqual(fsm.external_surfaces.settings_page.surfaces, settingsSurfaces, 'structured FSM enumerates all supported settings surfaces');

const embeddedStart = fsmHtml.indexOf('<script id="fsm-data" type="application/json">');
const embeddedEnd = fsmHtml.indexOf('</script>', embeddedStart);
assert(embeddedStart >= 0 && embeddedEnd > embeddedStart, 'interactive FSM contains an embedded structured model');
const embedded = JSON.parse(fsmHtml.slice(embeddedStart + '<script id="fsm-data" type="application/json">'.length, embeddedEnd));
assert.deepEqual(embedded.external_surfaces, fsm.external_surfaces, 'interactive and standalone FSM data stay synchronized');

console.log('PASS iframe settings dialog in Order-Filler and Drop-In, and lifecycle-neutral FSM regression checks');
