import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app.css', import.meta.url), 'utf8');

const dialogStart = html.indexOf('<dialog id="graphicalSettingsDialog"');
const dialogEnd = html.indexOf('</dialog>', dialogStart);
assert(dialogStart >= 0 && dialogEnd > dialogStart, 'Clock/Timer Settings dialog exists');

const dialog = html.slice(dialogStart, dialogEnd);
const gridStart = dialog.indexOf('<div class="settings-grid graphical-settings-grid">');
const groupsStart = dialog.indexOf('<div class="settings-groups">', gridStart);
const previewStart = dialog.indexOf('<aside class="clock-preview"', gridStart);
assert(gridStart >= 0, 'graphical settings scroll/overlay region exists');
assert(previewStart > gridStart && previewStart < groupsStart, 'live preview is layered inside the settings region');

const overlayMarker = css.indexOf('graphical-settings-scroll-overlay-v1');
assert(overlayMarker >= 0, 'Clock/Timer settings overlay styles are present');
const overlayCss = css.slice(overlayMarker);

assert.match(overlayCss, /\.graphical-dialog\s*\{[^}]*overflow:\s*hidden;/s);
assert.match(overlayCss, /#graphicalSettingsForm\s*\{[^}]*max-height:\s*90dvh;[^}]*overflow:\s*hidden;[^}]*display:\s*flex;/s);
assert.match(overlayCss, /\.graphical-dialog \.graphical-settings-grid\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;[^}]*display:\s*grid;[^}]*grid-template-rows:\s*minmax\(0, 1fr\);/s);
assert.match(overlayCss, /\.graphical-dialog \.graphical-settings-grid > \.settings-groups\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s);
assert.doesNotMatch(overlayCss, /\.graphical-dialog \.graphical-settings-grid > \.settings-groups\s*\{[^}]*height:\s*100%;/s);
assert.match(overlayCss, /\.graphical-dialog \.clock-preview\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*opacity:\s*0\.78;[^}]*pointer-events:\s*none !important;/s);
assert.match(overlayCss, /\.graphical-dialog \.clock-preview clock-timer\s*\{[^}]*pointer-events:\s*none !important;/s);

console.log('PASS Clock/Timer settings use one scroll region with a click-through live preview overlay');
