import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app.css', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const dialogStart = html.indexOf('<dialog id="graphicalSettingsDialog"');
const dialogEnd = html.indexOf('</dialog>', dialogStart);
assert(dialogStart >= 0 && dialogEnd > dialogStart, 'Clock/Timer Settings dialog exists');

const dialog = html.slice(dialogStart, dialogEnd);
const gridStart = dialog.indexOf('<div class="settings-grid graphical-settings-grid">');
const groupsStart = dialog.indexOf('<div class="settings-groups">', gridStart);
const previewStart = dialog.indexOf('<aside class="clock-preview"', gridStart);
assert(gridStart >= 0, 'graphical settings content region exists');
assert(groupsStart > gridStart, 'settings groups exist inside the graphical settings region');
assert(previewStart > groupsStart, 'live preview is ordered after the settings groups at the bottom of the region');
assert(!dialog.includes('Live Preview'), 'Live Preview title is removed');

const detailsTags = dialog.match(/<details\b[^>]*class="settings-category[^"]*"[^>]*>/g) || [];
assert.equal(detailsTags.length, 4, 'Clock/Timer Settings contains four top-level categories');
for (const tag of detailsTags) {
    assert(!/\sopen(?:\s|>)/.test(tag), 'every Clock/Timer category starts collapsed');
    assert(!/name="clock-timer-settings-category"/.test(tag), 'native named-details exclusivity is disabled for managed animation');
}

const overlayMarker = css.indexOf('graphical-settings-scroll-overlay-v3');
assert(overlayMarker >= 0, 'Clock/Timer settings v3 overlay styles are present');
const overlayCss = css.slice(overlayMarker);

assert.match(overlayCss, /\.graphical-dialog\s*\{[^}]*min-height:\s*90dvh;[^}]*height:\s*90dvh;[^}]*max-height:\s*90dvh;[^}]*overflow:\s*hidden;/s);
assert.match(overlayCss, /#graphicalSettingsForm\s*\{[^}]*height:\s*100%;[^}]*max-height:\s*100%;[^}]*block-size:\s*100%;[^}]*display:\s*grid;[^}]*grid-template-rows:\s*auto auto minmax\(0, 1fr\);/s);
assert.match(overlayCss, /\.graphical-dialog \.graphical-settings-grid\s*\{[^}]*--graphical-preview-height:\s*clamp\(210px, 46%, 270px\);[^}]*overflow:\s*hidden;[^}]*display:\s*block;/s);
assert.match(overlayCss, /\.graphical-dialog \.graphical-settings-grid > \.settings-groups\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*padding:\s*12px 16px calc\(var\(--graphical-preview-height\) \+ 16px\);[^}]*overflow-y:\s*auto;[^}]*touch-action:\s*pan-y;/s);
assert.match(overlayCss, /\.graphical-dialog \.clock-preview\s*\{[^}]*--graphical-preview-clock-size:[^}]*position:\s*absolute;[^}]*inset:\s*auto 0 0;[^}]*height:\s*var\(--graphical-preview-height\);[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;[^}]*pointer-events:\s*none !important;/s);
assert.doesNotMatch(overlayCss, /\.graphical-dialog \.clock-preview\.has-settings-overlap\s*\{/s);
assert.match(overlayCss, /\.graphical-dialog \.clock-preview clock-timer\s*\{[^}]*inline-size:\s*var\(--graphical-preview-clock-size\);[^}]*block-size:\s*var\(--graphical-preview-clock-size\);[^}]*width:\s*var\(--graphical-preview-clock-size\);[^}]*height:\s*var\(--graphical-preview-clock-size\);[^}]*aspect-ratio:\s*1 \/ 1;[^}]*pointer-events:\s*none !important;[^}]*opacity:\s*1;[^}]*transition:\s*opacity 150ms ease-out;/s);
assert.match(overlayCss, /\.graphical-dialog \.clock-preview\.has-settings-overlap clock-timer\s*\{[^}]*opacity:\s*0\.68;/s);
assert.match(overlayCss, /\.graphical-dialog \.settings-category > summary\s*\{[^}]*min-height:\s*38px;[^}]*padding:\s*7px 36px 7px 12px;[^}]*font-size:\s*17px;/s);
assert.match(overlayCss, /\.graphical-dialog \.settings-category\.is-closing > summary::after\s*\{[^}]*rotate\(0deg\);/s);
assert.match(overlayCss, /@media \(max-width:\s*720px\)[\s\S]*?--graphical-preview-height:\s*clamp\(190px, 44%, 250px\);[\s\S]*?--graphical-preview-clock-size:[\s\S]*?220px,[\s\S]*?64vw,/s);
assert.match(overlayCss, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.graphical-dialog \.clock-preview clock-timer\s*\{[^}]*transition-duration:\s*0ms;/s);

assert.match(js, /const GRAPHICAL_DETAILS_DURATION = 180;/);
assert.match(js, /function updateGraphicalPreviewOverlap\(/);
assert.match(js, /graphicalRectsOverlap\(\s*rect,\s*visiblePreviewRect\s*\)/s);
assert.match(js, /preview\.classList\.toggle\(\s*"has-settings-overlap",\s*overlaps\s*\)/s);
assert.match(js, /function animateGraphicalCategory\(/);
assert.match(js, /category\.animate\([\s\S]*?cubic-bezier\(\.2,\.8,\.2,1\)/s);
assert.match(js, /content\.animate\([\s\S]*?Math\.min\(\s*duration,\s*150\s*\)/s);
assert.match(js, /summary\?\.addEventListener\(\s*"click",[\s\S]*?event\.preventDefault\(\);[\s\S]*?toggleGraphicalCategory/s);
assert.match(js, /graphicalDialog\.addEventListener\(\s*"opening",\s*resetGraphicalSettingsAccordion\s*\)/s);
assert.match(js, /category\.open = false;/);
assert.match(js, /groups\.scrollTop = 0;/);
assert.match(js, /groups\?\.addEventListener\(\s*"scroll",\s*scheduleGraphicalPreviewOverlap/s);
assert.match(js, /new ResizeObserver\(\s*scheduleGraphicalPreviewOverlap\s*\)/s);
assert.match(js, /opened &&\s*dialog === graphicalDialog[\s\S]*?updateGraphicalPreviewOverlap\(\{\s*immediate:\s*true\s*\}\)/s);

console.log('PASS Clock/Timer settings start collapsed, animate details, and render only a circular fading clock at the bottom');
