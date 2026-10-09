import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function createRuntime() {
    const handlers = {};
    const windowHandlers = {};
    const messages = [];
    const dialog = {
        dataset: {}, open: false, closed: 0, listeners: {},
        showModal() { this.open = true; },
        close() { this.open = false; this.closed++; },
        addEventListener(name, callback) { this.listeners[name] = callback; }
    };
    const frame = { dataset: {}, contentWindow: {}, src: "" };
    const menu = { hidden: 0, hidePopover() { this.hidden++; } };
    const button = {
        dataset: { settingsSurface: "tripSettingsDialog" },
        addEventListener(name, callback) { handlers[name] = callback; },
        closest: selector => selector === "hamburger-menu" ? menu : null
    };
    const document = {
        readyState: "complete",
        getElementById(id) {
            if (id === "clockTimerSettingsFrameDialog") return dialog;
            if (id === "clockTimerSettingsFrame") return frame;
            return null;
        },
        querySelectorAll: selector => selector === "[data-open-clock-timer-settings]" ? [button] : [],
        addEventListener() {}
    };
    const window = {
        location: { origin: "https://example.test" },
        addEventListener(name, callback) { windowHandlers[name] = callback; }
    };
    const sandbox = { document, window, location: window.location, encodeURIComponent, console };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    sandbox.ClockTimerSettingsSurfaces = {
        isValid: value => ["graphicalSettingsDialog", "audioSettingsDialog", "audioAnnouncementsDialog", "stateSettingsDialog", "tripSettingsDialog"].includes(value)
    };
    vm.runInContext(readFileSync(new URL("../SettingsFrameController.js", import.meta.url), "utf8"), sandbox);
    return { sandbox, dialog, frame, menu, button, handlers, windowHandlers };
}

{
    const r = createRuntime();
    assert.equal(r.dialog.dataset.controllerReady, "true");
    r.handlers.click();
    assert.equal(r.frame.dataset.settingsSurface, "tripSettingsDialog");
    assert.equal(r.frame.src, "settings.html?surface=tripSettingsDialog");
    assert.equal(r.dialog.open, true);
    assert.equal(r.menu.hidden, 1);

    r.windowHandlers.message({
        source: r.frame.contentWindow,
        origin: "https://example.test",
        data: { type: "clocktimer-settings-closed" }
    });
    assert.equal(r.dialog.open, false);
    assert.equal(r.dialog.closed, 1);

    r.dialog.open = true;
    r.windowHandlers.message({
        source: {},
        origin: "https://example.test",
        data: { type: "clocktimer-settings-closed" }
    });
    assert.equal(r.dialog.open, true, "messages from another frame are ignored");
    assert.equal(r.sandbox.ClockTimerSettingsFrameController.install(), false, "controller installs once");
}
console.log("PASS settings frame controller opens surfaces and validates close messages");
