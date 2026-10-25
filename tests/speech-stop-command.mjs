import fs from "node:fs";
import assert from "node:assert/strict";
import {Window} from "./LanguageWindow.mjs";

const window = new Window({url:"https://clock.example/"});
Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    CustomEvent: window.CustomEvent,
    EventTarget: window.EventTarget,
    customElements: window.customElements,
    getComputedStyle:
        window.getComputedStyle.bind(
            window
        )
});
Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: window.navigator
});

globalThis.WMOFLanguagePack = window.WMOFLanguagePack;

let rafId = 0;
window.requestAnimationFrame = globalThis.requestAnimationFrame = callback => ++rafId;
window.cancelAnimationFrame = globalThis.cancelAnimationFrame = () => {};

const ParameterParser = Function(
    fs.readFileSync(new URL("../ParameterParser.js", import.meta.url), "utf8") +
    "\nreturn ParameterParser;"
)();
globalThis.ParameterParser = ParameterParser;
window.ParameterParser = ParameterParser;

const SpeechMenu = Function(
    fs.readFileSync(new URL("../SpeechMenu.js", import.meta.url), "utf8") +
    "\nreturn SpeechMenu;"
)();
globalThis.SpeechMenu = SpeechMenu;
window.SpeechMenu = SpeechMenu;

const SpeechMicBar = Function(
    fs.readFileSync(new URL("../SpeechMicBar.js", import.meta.url), "utf8") +
    "\nreturn SpeechMicBar;"
)();
globalThis.SpeechMicBar = SpeechMicBar;
window.SpeechMicBar = SpeechMicBar;

if (!window.customElements.get("speech-mic-bar")) {
    window.customElements.define("speech-mic-bar", SpeechMicBar);
}
const bar = window.document.createElement("speech-mic-bar");
window.document.body.append(bar);

const system = bar.querySelector('speech-menu[speech-modal="system"]');
assert(system);
const commands = [...system.querySelectorAll('speech-command')];
assert(commands.some(c => new RegExp(c.getAttribute('speech-pattern'), 'i').test('sleep')));
assert(commands.some(c => new RegExp(c.getAttribute('speech-pattern'), 'i').test('wake')));
assert(!commands.some(c => new RegExp(c.getAttribute('speech-pattern'), 'i').test('off')), 'Off must not resolve to a system command');
assert(!commands.some(c => c.getAttribute('speech-function')?.includes('disableSpeechRecognition')), 'no voice action may stop capture');
assert.equal(window.WMOFLanguagePack.language.speech.offPhrase, undefined);
assert.throws(() => window.WMOFLanguagePack.patternFor('system:off'));
bar.setSystemSpeechPatterns({wake:'^wake$',sleep:'^sleep$',off:'^off$'});
assert.equal(system.querySelector('[data-speech-system-command="off"]'),null,'legacy configuration cannot reinstall Off');
bar.remove();
await window.happyDOM.abort();
console.log('PASS no voice stop command; Sleep/Wake remain and legacy Off configuration is ignored');
