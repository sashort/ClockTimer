import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function makeRuntime({ classes = [], search = "" } = {}) {
    const events = [];
    const body = {
        classList: { contains: name => classes.includes(name) },
        querySelector: () => null
    };
    const document = {
        body,
        currentScript: null,
        baseURI: "https://example.test/app/",
        documentElement: { lang: "en-US" },
        head: { append() {} },
        createElement: () => ({ dataset: {}, addEventListener() {}, setAttribute() {} }),
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: event => { events.push(event); return true; }
    };
    class CustomEvent {
        constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
    }
    const sandbox = {
        document,
        location: { search },
        URL,
        URLSearchParams,
        CustomEvent,
        console,
        fetch: async () => { throw new Error("unexpected fetch"); },
        Promise,
        Map,
        Set,
        Object,
        JSON,
        Error,
        TypeError
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    for (const file of ["Context.js", "SettingsSurfaces.js", "Lifecycle.js", "dispatcher.js"]) {
        vm.runInContext(readFileSync(new URL("../" + file, import.meta.url), "utf8"), sandbox, { filename: file });
    }
    return { sandbox, document, events };
}

{
    const { sandbox } = makeRuntime({ classes: ["settings-page"], search: "?surface=audioSettingsDialog" });
    const ctx = sandbox.ClockTimerContext.forCurrentScript();
    assert.equal(ctx.host, "settings-frame");
    assert.equal(ctx.surface, "audioSettingsDialog");
    assert.equal(ctx.capabilities.speechMenu, false);
    assert.equal(ctx.capabilities.calendarStartup, false);

    const hostContext = sandbox.ClockTimerContext.normalize({
        host: "order-filler",
        surface: "application",
        presentation: "application",
        features: ["application", "settings"],
        capabilities: {}
    });
    const settingsSurface = sandbox.ClockTimerSettingsSurfaces.contextFor(hostContext, "tripSettingsDialog");
    assert.equal(settingsSurface.surface, "tripSettingsDialog");
    assert.equal(settingsSurface.presentation, "graphical-settings");
    assert.deepEqual(Array.from(settingsSurface.features), ["settings"]);
    assert.equal(settingsSurface.capabilities.speechMenu, false);

    const child = sandbox.ClockTimerContext.child(ctx, {
        features: ["settings", "application"],
        capabilities: { speechMenu: true, calendarStartup: true }
    });
    assert.deepEqual(Array.from(child.features), ["settings"]);
    assert.equal(child.capabilities.speechMenu, false);
    assert.equal(child.capabilities.calendarStartup, false);

    sandbox.document.currentScript = {
        dataset: {
            clocktimerContextData: JSON.stringify({
                host: "settings-frame",
                surface: "tripSettingsDialog",
                presentation: "graphical-settings",
                features: ["settings"],
                capabilities: { speechMenu: false },
                options: { source: "nested-template" }
            })
        }
    };
    assert.equal(sandbox.ClockTimerContext.forCurrentScript().surface, "tripSettingsDialog");
    assert.equal(sandbox.ClockTimerContext.forCurrentScript().capabilities.speechMenu, false);
}

{
    const { sandbox, events } = makeRuntime();
    const started = [];
    let disposed = 0;
    sandbox.ClockTimerDispatcher.register("settings", async context => {
        started.push(context.surface);
        return () => { disposed++; };
    }, context => context.presentation === "graphical-settings");
    sandbox.ClockTimerDispatcher.register("application", async () => {
        throw new Error("application feature must not start");
    });

    const result = await sandbox.ClockTimerDispatcher.bootstrap({
        host: "settings-frame",
        surface: "graphicalSettingsDialog",
        presentation: "graphical-settings",
        features: ["settings"],
        capabilities: { speechMenu: false }
    });
    assert.deepEqual(Array.from(result.features, item => item.name), ["settings"]);
    assert.deepEqual(started, ["graphicalSettingsDialog"]);
    assert.equal(events.at(-1).type, "clocktimer-dispatcher-ready");
    await sandbox.ClockTimerLifecycle.stopAll();
    assert.equal(disposed, 1);
}
console.log("PASS context restrictions, nested script context, dispatcher selection, and lifecycle cleanup");
