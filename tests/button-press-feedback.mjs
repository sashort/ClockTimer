import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

class FakeButton {
    constructor() { this.disabled = false; this.animations = []; }
    animate(frames, options) {
        let resolve;
        const animation = {
            frames, options, cancelled: false,
            finished: new Promise(done => { resolve = done; }),
            cancel() { this.cancelled = true; },
            finish() { resolve(); }
        };
        this.animations.push(animation);
        return animation;
    }
}
const listeners = new Map();
const documentRef = {
    addEventListener(type, handler, options) { listeners.set(type, {handler, options}); },
    removeEventListener(type) { listeners.delete(type); }
};
const sandbox = {console, HTMLButtonElement: FakeButton, getComputedStyle: () => ({boxShadow:"none", textShadow:"none"})};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../ButtonPressFeedback.js", import.meta.url), "utf8"), sandbox);
const controller = sandbox.ClockTimerButtonPressFeedback.install({
    documentRef, buttonClass: FakeButton,
    getComputedStyleRef: sandbox.getComputedStyle,
    pressInDuration: 10, pressOutDuration: 20
});
const button = new FakeButton();
const event = (extra = {}) => ({composedPath: () => [button], ...extra});
listeners.get("pointerdown").handler(event({pointerType:"mouse", button:0, pointerId:1}));
assert.equal(button.animations.length, 1);
assert.equal(button.animations[0].options.duration, 10);
listeners.get("pointerup").handler(event({pointerId:1}));
assert.equal(button.animations.length, 1, "release waits for press animation completion");
button.animations[0].finish();
await Promise.resolve();
await Promise.resolve();
assert.equal(button.animations.length, 2, "release animation begins after a released press finishes");
assert.equal(button.animations[1].options.duration, 20);
button.animations[1].finish();
await Promise.resolve();
await Promise.resolve();
const disabled = new FakeButton();
disabled.disabled = true;
listeners.get("pointerdown").handler({composedPath: () => [disabled], pointerType:"touch", pointerId:2});
assert.equal(disabled.animations.length, 0, "disabled buttons are ignored");
controller.dispose();
assert.equal(listeners.size, 0, "controller removes its event listeners");
console.log("PASS button press feedback controller");
