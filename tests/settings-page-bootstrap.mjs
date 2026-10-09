import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function runtime({ readyState = "complete", appReady = false, embedded = true } = {}) {
    const handlers = new Map();
    const classes = [];
    const events = [];
    let postedMessage = null;
    const trigger = {
        dispatchEvent(event) { events.push({ target: "trigger", event }); return true; }
    };
    const surface = {
        attributes: {},
        listeners: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(name, callback) { this.listeners[name] = callback; },
        dispatchEvent(event) { events.push({ target: "surface", event }); return true; },
        showModal() { this.shown = true; }
    };
    const rootElement = { dataset: appReady ? { clocktimerAppReady: "true" } : {}, classList: { add: value => classes.push(value) } };
    const document = {
        readyState,
        body: { classList: { add: value => classes.push(value) } },
        documentElement: rootElement,
        getElementById(id) {
            if (id === "settingsPageHeader") return { hidden: false };
            if (id === "audioSettingsDialog") return surface;
            return null;
        },
        querySelector(selector) {
            return selector === '[data-dialog="audioSettingsDialog"]' ? trigger : null;
        },
        addEventListener(name, callback, options) {
            const entries = handlers.get(name) || [];
            entries.push({ callback, once: options?.once });
            handlers.set(name, entries);
        },
        dispatchEvent(event) {
            const entries = handlers.get(event.type) || [];
            for (const entry of [...entries]) {
                entry.callback(event);
                if (entry.once) handlers.set(event.type, (handlers.get(event.type) || []).filter(x => x !== entry));
            }
        }
    };
    class Event {
        constructor(type, options = {}) { this.type = type; Object.assign(this, options); }
    }
    class CustomEvent extends Event {
        constructor(type, options = {}) { super(type, options); this.detail = options.detail; }
    }
    const sandbox = {
        document, Event, CustomEvent, URLSearchParams,
        location: { search: "?surface=audioSettingsDialog", origin: "https://example.test" },
        self: embedded ? {} : null,
        top: embedded ? {} : null,
        parent: { postMessage: value => { postedMessage = value; } },
        console
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    sandbox.ClockTimerSettingsSurfaces = { normalize: value => value || "graphicalSettingsDialog" };
    vm.runInContext(readFileSync(new URL("../SettingsPageBootstrap.js", import.meta.url), "utf8"), sandbox);
    return { sandbox, document, classes, events, surface, trigger, get postedMessage() { return postedMessage; } };
}

{
    const r = runtime({ readyState: "complete", appReady: false });
    assert.equal(r.events.length, 0, "bootstrap must not open the surface before app handlers are ready");
    assert.equal(r.document.documentElement.dataset.clocktimerSettingsBootstrapPending, "true");
    r.document.dispatchEvent(new r.sandbox.Event("clocktimer-app-ready"));
    assert.equal(r.events.length, 1);
    assert.equal(r.events[0].target, "trigger");
    assert.equal(r.surface.attributes["data-primary-settings-surface"], "");
    assert.deepEqual(r.classes, ["settings-embedded", "settings-embedded-document"]);
    r.surface.listeners.close();
    assert.equal(r.postedMessage.type, "clocktimer-settings-closed");
}

{
    const r = runtime({ readyState: "complete", appReady: true, embedded: false });
    assert.equal(r.events.length, 1, "already-ready app starts the requested surface immediately");
    assert.equal(r.events[0].target, "trigger");
    assert.equal(r.classes.length, 0, "standalone settings page does not get embedded styling");
}
console.log("PASS settings bootstrap waits for app readiness and preserves surface behavior");
