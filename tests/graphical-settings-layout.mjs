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
const titleStart = dialog.indexOf('<div class="preview-title">Live Preview</div>', previewStart);
assert(gridStart >= 0, 'graphical settings content region exists');
assert(previewStart > gridStart && previewStart < groupsStart, 'live preview is layered inside the settings region');
assert(titleStart > previewStart, 'Live Preview title remains in the overlay');

const overlayMarker = css.indexOf('graphical-settings-scroll-overlay-v2');
assert(overlayMarker >= 0, 'Clock/Timer settings v2 overlay styles are present');
const overlayCss = css.slice(overlayMarker);

assert.match(overlayCss, /\.graphical-dialog\s*\{[^}]*min-height:\s*90dvh;[^}]*height:\s*90dvh;[^}]*max-height:\s*90dvh;[^}]*overflow:\s*hidden;/s);
assert.match(overlayCss, /#graphicalSettingsForm\s*\{[^}]*height:\s*100%;[^}]*max-height:\s*100%;[^}]*block-size:\s*100%;[^}]*display:\s*grid;[^}]*grid-template-rows:\s*auto auto minmax\(0, 1fr\);/s);
assert.match(overlayCss, /\.graphical-dialog \.graphical-settings-grid\s*\{[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;[^}]*display:\s*block;/s);
assert.match(overlayCss, /\.graphical-dialog \.graphical-settings-grid > \.settings-groups\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*overflow-y:\s*auto;[^}]*touch-action:\s*pan-y;/s);
assert.match(overlayCss, /\.graphical-dialog \.clock-preview\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*pointer-events:\s*none !important;/s);
assert.match(overlayCss, /\.graphical-dialog \.clock-preview \.preview-title\s*\{[^}]*opacity:\s*1;/s);
assert.match(overlayCss, /\.graphical-dialog \.clock-preview clock-timer\s*\{[^}]*pointer-events:\s*none !important;[^}]*opacity:\s*0\.72;/s);
assert.match(overlayCss, /@media \(max-width:\s*720px\)[\s\S]*?\.graphical-dialog\s*\{[^}]*min-height:\s*92dvh;[^}]*height:\s*92dvh;[^}]*max-height:\s*92dvh;/s);

console.log('PASS Clock/Timer settings keep a fixed-height modal, bounded scroller, and visible click-through Live Preview');
