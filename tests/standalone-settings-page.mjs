import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const standalone = read('../settings.html');
const dropInTemplate = read('../templates/pages/drop-in/body.html');
const dropInBuilt = read('../drop-in.html');
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
assert.match(standalone, /id="settingsPageHeader"/, 'standalone page provides a page-level heading and return link');
assert.match(standalone, /standaloneSettingsPageStyles/, 'standalone page has dedicated layout styles');
assert.match(standalone, /standaloneSettingsPageBootstrap/, 'standalone page initializes settings surfaces');
for (const id of settingsSurfaces) {
    assert.match(standalone, new RegExp(`<dialog id="${id}"(?:\\s|>)`), `${id} is included in the standalone page`);
    assert.match(standalone, new RegExp(`"${id}"`), `${id} is listed for page initialization`);
}
assert.match(standalone, /dialog\.show\(\)/, 'settings surfaces are shown as non-modal page sections');
assert.match(standalone, /position:static !important/, 'settings surfaces flow in the page instead of overlaying it');
assert.match(dropInTemplate, /href="settings\.html" target="_blank" rel="noopener noreferrer"/, 'Drop-In opens settings in a new tab');
assert.match(dropInBuilt, /href="settings\.html" target="_blank" rel="noopener noreferrer"/, 'built Drop-In page includes the standalone settings link');
assert.match(fsmDoc, /Settings-page navigation is orthogonal to the trip lifecycle/, 'FSM documentation defines settings navigation as lifecycle-neutral');
assert.equal(fsm.external_surfaces.settings_page.lifecycle_effect, 'none', 'structured FSM marks settings navigation as lifecycle-neutral');
assert.deepEqual(fsm.external_surfaces.settings_page.surfaces, settingsSurfaces, 'structured FSM enumerates all supported settings surfaces');

const embeddedStart = fsmHtml.indexOf('<script id="fsm-data" type="application/json">');
const embeddedEnd = fsmHtml.indexOf('</script>', embeddedStart);
assert(embeddedStart >= 0 && embeddedEnd > embeddedStart, 'interactive FSM contains an embedded structured model');
const embedded = JSON.parse(fsmHtml.slice(embeddedStart + '<script id="fsm-data" type="application/json">'.length, embeddedEnd));
assert.deepEqual(embedded.external_surfaces, fsm.external_surfaces, 'interactive and standalone FSM data stay synchronized');

console.log('PASS standalone settings page, Drop-In new-tab access, and lifecycle-neutral FSM regression checks');
