import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const standalone = read('../settings.html');
const dropInTemplate = read('../templates/pages/drop-in/body.html');
const dropInMenu = read('../templates/pages/drop-in/menu.html');
const dropInDialogs = read('../templates/pages/drop-in/dialogs.html');
const dropInScripts = read('../templates/pages/drop-in/scripts.html');
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


const graphical = read('../graphical-settings.html');
assert.match(graphical, /GraphicalSettingsPage.js/);
assert.match(graphical, /id="graphicalSettingsDialog"/);
assert.doesNotMatch(graphical, /src="(?:app|SpeechMenu|drop-in)\.js|id="app"|loginDialog/,'graphical settings has no second application');
assert.match(read('../graphical-settings.php'), /templates\/graphical-settings.html/);
assert.match(read('../templates/pages/order-filler/dialogs.html'), /include:shared\/graphical-settings.html/,'both pages share the original dialog');
for(const markup of [dropInDialogs, orderDialogs, dropInBuilt, orderBuilt]) {
 const match=markup.match(/<dialog id="clockTimerSettingsFrameDialog"[\s\S]*?<\/dialog>/);
 assert(match);assert.match(match[0], /<iframe id="clockTimerSettingsFrame"/);assert.doesNotMatch(match[0], /<button|<h[1-6]/);
}
for(const controller of [dropInScripts,orderScripts]) {
 assert.match(controller,/surface === "graphicalSettingsDialog" \? "graphical-settings" : "settings"/);
 assert.match(controller,/event.source !== frame.contentWindow/);
 assert.match(controller,/event.origin !== window.location.origin/);
 assert.match(controller,/frame.src = "about:blank"/,'closing unloads the iframe instead of navigating the host');
}
assert.match(dropInMenu,/id="dropInClockSettingsButton"[^>]*data-open-clock-timer-settings/);
assert.match(orderTemplate,/id="openGraphicalSettingsFrame"[^>]*data-open-clock-timer-settings/);

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
