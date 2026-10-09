import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function makeRuntime({ classes = [], search = "", bodyPresent = true } = {}) {
    const events = [];
    const appendedResources = [];
    const body = {
        classList: { contains: name => classes.includes(name) },
        querySelector: () => null
    };
    const document = {
        body: bodyPresent ? body : null,
        currentScript: null,
        baseURI: "https://example.test/app/",
        documentElement: { lang: "en-US" },
        head: { append(resource) { appendedResources.push(resource); } },
        createElement: () => ({
            dataset: {},
            handlers: {},
            addEventListener(name, callback) { this.handlers[name] = callback; },
            dispatchEvent(event) { events.push(event); return true; },
            setAttribute() {}
        }),
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
    for (const file of ["Context.js", "SettingsSurfaces.js", "ResourceLoader.js", "Lifecycle.js", "StartupTasks.js", "CalendarStartup.js", "dispatcher.js"]) {
        vm.runInContext(readFileSync(new URL("../" + file, import.meta.url), "utf8"), sandbox, { filename: file });
    }
    return { sandbox, document, events, appendedResources };
}

{
    const { sandbox } = makeRuntime({ bodyPresent: false });
    assert.equal(sandbox.ClockTimerPageContext.host, "order-filler");
    assert.equal(sandbox.ClockTimerPageContext.features.includes("drop-in"), false);
}

{
    const { sandbox } = makeRuntime({ classes: ["settings-page"], search: "?surface=audioSettingsDialog" });
    const ctx = sandbox.ClockTimerContext.forCurrentScript();
    assert.equal(ctx.host, "settings-frame");
    assert.equal(ctx.surface, "audioSettingsDialog");
    assert.equal(ctx.capabilities.speechMenu, false);
    assert.equal(ctx.capabilities.calendarStartup, false);
    const settingsPolicy = sandbox.ClockTimerContext.startupPolicy();
    assert.equal(settingsPolicy.settingsOnlyPage, true);
    assert.equal(settingsPolicy.capabilityEnabled("speechMenu"), false);
    assert.equal(settingsPolicy.capabilityEnabled("calendarStartup"), false);

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
{
    const { sandbox } = makeRuntime();
    const base = sandbox.ClockTimerContext.normalize({
        host: "order-filler",
        surface: "graphicalSettingsDialog",
        features: ["settings"]
    });
    const other = sandbox.ClockTimerContext.child(base, { surface: "audioSettingsDialog" });
    const initialized = [];
    const cleaned = [];
    await sandbox.ClockTimerLifecycle.start("settings-module", context => {
        initialized.push(context.surface);
        return () => cleaned.push(context.surface);
    }, base);
    await sandbox.ClockTimerLifecycle.start("settings-module", context => {
        initialized.push(context.surface);
        return () => cleaned.push(context.surface);
    }, other);
    assert.deepEqual(initialized, ["graphicalSettingsDialog", "audioSettingsDialog"]);
    await sandbox.ClockTimerLifecycle.stop("settings-module", base);
    assert.deepEqual(cleaned, ["graphicalSettingsDialog"]);
    await sandbox.ClockTimerLifecycle.stopAll();
    assert.deepEqual(cleaned, ["graphicalSettingsDialog", "audioSettingsDialog"]);
}
{
    const { sandbox, appendedResources } = makeRuntime();
    const context = sandbox.ClockTimerContext.normalize({
        host: "order-filler",
        surface: "tripSettingsDialog",
        presentation: "graphical-settings",
        features: ["application", "settings"],
        capabilities: { speechMenu: false }
    });
    const first = sandbox.ClockTimerResources.loadScript("/feature.js", context);
    const duplicate = sandbox.ClockTimerResources.loadScript("/feature.js", context);
    assert.equal(first, duplicate, "same URL and context share a single in-flight script load");
    assert.equal(appendedResources.length, 1);
    const script = appendedResources[0];
    const embeddedContext = JSON.parse(script.dataset.clocktimerContextData);
    assert.equal(embeddedContext.host, "order-filler");
    assert.equal(embeddedContext.surface, "tripSettingsDialog");
    assert.equal(embeddedContext.capabilities.speechMenu, false);
    script.handlers.load();
    script.onload();
    await first;

    const differentContext = sandbox.ClockTimerContext.child(context, {
        surface: "audioSettingsDialog"
    });
    const second = sandbox.ClockTimerResources.loadScript("/feature.js", differentContext);
    assert.equal(appendedResources.length, 2, "different contexts must not reuse a script tagged for another context");
    appendedResources[1].handlers.load();
    appendedResources[1].onload();
    await second;

    const styleOne = sandbox.ClockTimerResources.loadStyle("/feature.css", context);
    const styleTwo = sandbox.ClockTimerResources.loadStyle("/feature.css", differentContext);
    assert.equal(appendedResources.length, 4, "stylesheets requested in different contexts keep their own metadata");
    assert.equal(JSON.parse(appendedResources[2].dataset.clocktimerContextData).surface, "tripSettingsDialog");
    assert.equal(JSON.parse(appendedResources[3].dataset.clocktimerContextData).surface, "audioSettingsDialog");
    appendedResources[2].onload();
    appendedResources[3].onload();
    await Promise.all([styleOne, styleTwo]);

    const nestedScriptNode = {
        nodeType: 1,
        dataset: { clocktimerResourceUrl: "/nested.js", clocktimerResource: "script" },
        childNodes: []
    };
    const nestedSettingsNode = {
        nodeType: 1,
        dataset: {
            clocktimerContext: JSON.stringify({
                surface: "audioSettingsDialog",
                presentation: "graphical-settings",
                features: ["settings"],
                capabilities: { speechMenu: false }
            })
        },
        childNodes: [nestedScriptNode]
    };
    const fragment = { nodeType: 11, childNodes: [nestedSettingsNode] };
    const hydration = sandbox.ClockTimerResources.hydrate(fragment, context);
    const nestedResource = appendedResources[4];
    const nestedContext = JSON.parse(nestedResource.dataset.clocktimerContextData);
    assert.equal(nestedContext.surface, "audioSettingsDialog");
    assert.deepEqual(Array.from(nestedContext.features), ["settings"]);
    assert.equal(nestedContext.capabilities.speechMenu, false);
    nestedResource.handlers.load();
    nestedResource.onload();
    await hydration;
}
{
    const { sandbox } = makeRuntime();
    let requestUrl = "";
    let installedRecords = null;
    let refreshes = 0;
    const errors = [];
    const result = await sandbox.ClockTimerCalendarStartup.start({
        apiBase: "https://example.test/",
        calendarRanges: { setDatabaseRecords: value => { installedRecords = value; } },
        refreshTripLogSelection: () => { refreshes++; },
        showTripRangeError: message => errors.push(message),
        fetchImpl: async url => {
            requestUrl = String(url);
            return { ok: true, json: async () => ({ calendars: [{ id: "weekday" }] }) };
        }
    });
    assert.equal(requestUrl, "https://example.test/api/calendar/?result=records");
    assert.deepEqual(Array.from(installedRecords, item => item.id), ["weekday"]);
    assert.equal(refreshes, 1);
    assert.equal(result.ok, true);
    assert.equal(errors.length, 0);

    const failed = await sandbox.ClockTimerCalendarStartup.start({
        apiBase: "https://example.test/",
        calendarRanges: { setDatabaseRecords() {} },
        refreshTripLogSelection() {},
        showTripRangeError: message => errors.push(message),
        fetchImpl: async () => ({ ok: false, json: async () => ({ message: "Calendar offline" }) })
    });
    assert.equal(failed.ok, false);
    assert.deepEqual(errors, ["Calendar offline"]);
}
{
    const { sandbox } = makeRuntime();
    let calendarStarts = 0;
    sandbox.ClockTimerDispatcher.register("calendarStartup", async context => {
        calendarStarts++;
        return context.host;
    }, context => context.capabilities?.calendarStartup !== false);
    const appContext = sandbox.ClockTimerContext.normalize();
    assert.ok(Array.from(appContext.features).includes("calendarStartup"));
    await sandbox.ClockTimerDispatcher.bootstrap(appContext);
    assert.equal(calendarStarts, 1, "application context dispatches calendar startup");

    const settingsRuntime = makeRuntime({ classes: ["settings-page"] });
    let settingsCalendarStarts = 0;
    settingsRuntime.sandbox.ClockTimerDispatcher.register("calendarStartup", async () => {
        settingsCalendarStarts++;
    }, context => context.capabilities?.calendarStartup !== false);
    await settingsRuntime.sandbox.ClockTimerDispatcher.bootstrap(settingsRuntime.sandbox.ClockTimerPageContext);
    assert.equal(settingsCalendarStarts, 0, "settings context never dispatches calendar startup");
}
{
    const { sandbox } = makeRuntime();
    let calls = 0;
    const appContext = sandbox.ClockTimerContext.normalize({
        host: "order-filler",
        features: ["application", "settings"],
        capabilities: { calendarStartup: true }
    });
    const first = sandbox.ClockTimerStartup.runWhenEnabled("calendarStartup", appContext, async () => {
        calls++;
        return "loaded";
    });
    const second = sandbox.ClockTimerStartup.runWhenEnabled("calendarStartup", appContext, async () => {
        calls++;
        return "duplicate";
    });
    assert.equal(await first.then(value => value.value), "loaded");
    assert.equal(await second.then(value => value.value), "loaded");
    assert.equal(calls, 1);

    const otherSurface = sandbox.ClockTimerContext.child(appContext, {
        surface: "audioSettingsDialog"
    });
    const otherResult = await sandbox.ClockTimerStartup.runWhenEnabled("calendarStartup", otherSurface, async () => {
        calls++;
        return "other surface";
    });
    assert.equal(otherResult.value, "other surface");
    assert.equal(calls, 2, "different inherited contexts do not share startup task results");

    const disabledContext = sandbox.ClockTimerContext.child(appContext, {
        capabilities: { calendarStartup: false }
    });
    const skipped = await sandbox.ClockTimerStartup.runWhenEnabled("calendarStartup", disabledContext, async () => {
        throw new Error("disabled startup task must not execute");
    });
    assert.equal(skipped.skipped, true);
    sandbox.ClockTimerStartup.reset();
}
console.log("PASS context restrictions, nested resources, extracted calendar startup, dispatcher gating, and lifecycle cleanup");
