import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function makeRuntime({ classes = [], search = "", bodyPresent = true, hasLiveStreamDialog = false, hasDropInMarker = false } = {}) {
    const events = [];
    const appendedResources = [];
    const body = {
        classList: { contains: name => classes.includes(name) },
        querySelector: selector => (hasLiveStreamDialog && selector === "#liveStreamDialog") || (hasDropInMarker && selector === "#dropInPageStatus") ? {} : null
    };
    const document = {
        body: bodyPresent ? body : null,
        currentScript: null,
        baseURI: "https://example.test/app/",
        documentElement: { lang: "en-US" },
        head: { append(resource) {
            appendedResources.push(resource);
            // Resolve dispatcher-manifest resources automatically; focused resource
            // loader assertions below still control their own load/error events.
            if (String(resource.src || resource.href || "").includes("?build=")) {
                queueMicrotask(() => resource.onload?.());
            }
        } },
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
    for (const file of ["PageManifest.js", "Context.js", "SettingsSurfaces.js", "ResourceLoader.js", "Lifecycle.js", "StartupTasks.js", "CalendarStartup.js", "dispatcher.js"]) {
        vm.runInContext(readFileSync(new URL("../" + file, import.meta.url), "utf8"), sandbox, { filename: file });
    }
    return { sandbox, document, events, appendedResources };
}

{
    const { sandbox } = makeRuntime({ bodyPresent: false });
    assert.equal(sandbox.ClockTimerPageContext.host, "order-filler");
    assert.equal(sandbox.ClockTimerPageContext.features.includes("drop-in"), false);
    assert.deepEqual(Array.from(sandbox.ClockTimerPageManifest.resolve("order-filler").features), ["application", "settings", "calendarStartup"]);
    assert.deepEqual(Array.from(sandbox.ClockTimerPageManifest.resolve("drop-in").features), ["drop-in", "settings"]);
    assert.equal(sandbox.ClockTimerPageManifest.permitsFeature(sandbox.ClockTimerPageManifest.resolve("settings-frame"), "calendarStartup"), false);
    assert.equal(sandbox.ClockTimerPageManifest.permitsCapability(sandbox.ClockTimerPageManifest.resolve("settings-frame"), "speechMenu"), false);

    const requestedSettings = sandbox.ClockTimerContext.normalize({
        host: "settings-frame",
        features: ["application", "settings", "calendarStartup"],
        capabilities: { speechMenu: true, calendarStartup: true }
    });
    assert.equal(requestedSettings.presentation, "graphical-settings");
    assert.deepEqual(Array.from(requestedSettings.features), ["settings"]);
    assert.equal(requestedSettings.capabilities.speechMenu, false);
    assert.equal(requestedSettings.capabilities.calendarStartup, false);
}

{
    const { sandbox } = makeRuntime({ hasLiveStreamDialog: true });
    assert.equal(sandbox.ClockTimerPageContext.host, "order-filler", "shared live-stream dialog does not identify the page as Drop-In");
}
{
    const { sandbox } = makeRuntime({ hasDropInMarker: true });
    assert.equal(sandbox.ClockTimerPageContext.host, "drop-in");
    assert.deepEqual(Array.from(sandbox.ClockTimerPageContext.features), ["drop-in", "settings"]);
}
{
    const { sandbox } = makeRuntime({ classes: ["settings-page"], search: "?surface=audioSettingsDialog&parentHost=drop-in", hasLiveStreamDialog: true });
    const ctx = sandbox.ClockTimerContext.forCurrentScript();
    assert.equal(ctx.host, "settings-frame", "settings page identity wins over shared live-stream markup");
    assert.deepEqual(Array.from(ctx.features), ["settings"]);
    assert.equal(ctx.presentation, "graphical-settings");
    assert.equal(ctx.surface, "audioSettingsDialog");
    assert.equal(ctx.options.parentHost, "drop-in");
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
    const nestedHostContext = sandbox.ClockTimerContext.child(hostContext, {
        host: "settings-frame",
        features: ["settings", "application"],
        capabilities: { speechMenu: true }
    });
    assert.equal(nestedHostContext.presentation, "graphical-settings");
    assert.deepEqual(Array.from(nestedHostContext.features), ["settings"]);
    assert.equal(nestedHostContext.capabilities.speechMenu, false);

    const restrictedParent = sandbox.ClockTimerContext.normalize({
        host: "order-filler",
        features: ["application", "settings"],
        capabilities: { speechRecognition: false, audioAnnouncements: false }
    });
    const nestedOverrideAttempt = sandbox.ClockTimerContext.child(restrictedParent, {
        surface: "nestedSettingsTemplate",
        capabilities: { speechRecognition: true, audioAnnouncements: true }
    });
    assert.equal(nestedOverrideAttempt.capabilities.speechRecognition, false,
        "nested resources cannot re-enable a capability disabled by their parent");
    assert.equal(nestedOverrideAttempt.capabilities.audioAnnouncements, false,
        "all restrictive capabilities inherit through nested resources");

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
    const { sandbox, events, appendedResources } = makeRuntime();
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
    assert.ok(appendedResources.some(resource => resource.src === "AudioSettingsStartup.js?build=audio-settings-startup-4"),
        "dispatcher manifest uses the cache-busted audio startup module");
    for (const forbidden of ["SpeechStartup.js", "CalendarStartup.js", "DropInViewModel.js",
        "LiveStreamViewModel.js", "LiveStreamPublisher.js", "SessionStartup.js"]) {
        assert.equal(appendedResources.some(resource => String(resource.src).includes(forbidden)), false,
            forbidden + " must not load in the settings frame");
    }
    assert.deepEqual(started, ["graphicalSettingsDialog"]);
    assert.ok(appendedResources.some(resource => resource.src === "TripLogModel.js?build=trip-log-model-5"),
        "dispatcher uses the current trip-log model cache version");
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
    const { sandbox, appendedResources } = makeRuntime({ classes: ["settings-page"] });
    assert.throws(() => sandbox.ClockTimerDispatcher.registerResource("invalid-resource", {
        type: "unknown",
        url: "/invalid"
    }), /resource needs a name, type, and URL/);
    sandbox.ClockTimerDispatcher.registerResource("settings-style", {
        type: "style",
        url: "/settings-surface.css",
        hosts: ["settings-frame"],
        features: ["settings"]
    });
    sandbox.ClockTimerDispatcher.registerResource("application-speech", {
        type: "script",
        url: "/speech-runtime.js",
        hosts: ["order-filler"],
        features: ["application"],
        capability: "speechMenu"
    });
    const bootstrap = sandbox.ClockTimerDispatcher.bootstrap(sandbox.ClockTimerPageContext);
    // The dispatcher now has built-in startup resources as well as this test's
    // custom stylesheet. Wait for the custom resource without assuming it is first.
    while (!appendedResources.some(resource => resource.href === "/settings-surface.css")) {
        await new Promise(resolve => setImmediate(resolve));
    }
    const style = appendedResources.find(resource => resource.href === "/settings-surface.css");
    assert.equal(style.dataset.clocktimerContext, "settings-frame");
    style.onload();
    const result = await bootstrap;
    assert.ok(Array.from(result.resources).includes("settings-style"));
    assert.ok(Array.from(result.resources).includes("trip-log-model"),
        "settings-frame loads shared trip-log policy used by app.js");
    assert.ok(Array.from(result.resources).includes("trip-preferences-model"),
        "settings-frame shares the app preference model");
    assert.ok(Array.from(result.resources).includes("trip-preferences-store"),
        "settings-frame loads the app preference storage adapter");
    assert.equal(appendedResources.some(resource => resource.src === "/speech-runtime.js"), false,
        "settings context must not load application speech resources");
    assert.deepEqual(Array.from(result.features), []);
}
{
    const { sandbox, appendedResources } = makeRuntime({ classes: ["drop-in-page"] });
    const result = await sandbox.ClockTimerDispatcher.bootstrap(sandbox.ClockTimerPageContext);
    assert.equal(result.context.host, "drop-in");
    assert.equal(Array.from(result.resources).includes("trip-preferences-model"), false,
        "Drop-In uses its own preferences module rather than the Order-Filler trip-preferences model");
    assert.equal(Array.from(result.resources).includes("trip-preferences-store"), false,
        "Drop-In must not load the Order-Filler preference storage adapter");
    assert.equal(appendedResources.some(resource =>
        String(resource.src || "").startsWith("TripPreferencesModel.js?build=")), false);
    assert.equal(result.resources.includes("speech-startup"), false,
        "Drop-In must not load the Order-Filler speech startup resource");
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
{
    const { sandbox } = makeRuntime();
    let registeredName = "";
    let initializer;
    let bootstrapPromise;
    let savedRecords;
    let refreshed = 0;
    const context = sandbox.ClockTimerContext.normalize({
        host: "order-filler",
        features: ["calendarStartup"],
        capabilities: { calendarStartup: true }
    });
    const dispatcher = {
        register(name, callback, predicate) {
            registeredName = name;
            initializer = callback;
            assert.equal(predicate(context), true);
        },
        bootstrap(receivedContext) {
            bootstrapPromise = Promise.resolve().then(() => initializer(receivedContext));
            return bootstrapPromise;
        }
    };
    const startup = {
        runWhenEnabled: async (name, receivedContext, task) => {
            assert.equal(name, "calendarStartup");
            assert.equal(receivedContext, context);
            return task();
        }
    };
    const registered = sandbox.ClockTimerCalendarStartup.register({
        dispatcher,
        startup,
        context,
        apiBase: "https://example.test/",
        calendarRanges: { setDatabaseRecords(records) { savedRecords = records; } },
        refreshTripLogSelection() { refreshed++; },
        showTripRangeError(error) { throw new Error(error); },
        fetchImpl: async url => {
            assert.equal(String(url), "https://example.test/api/calendar/?result=records");
            return { ok: true, json: async () => ({ calendars: [{ id: "calendar-1" }] }) };
        }
    });
    assert.equal(registered, true);
    assert.equal(registeredName, "calendarStartup");
    await bootstrapPromise;
    assert.deepEqual(Array.from(savedRecords, record => record.id), ["calendar-1"]);
    assert.equal(refreshed, 1);

    let forbiddenStarts = 0;
    const disabledDispatcher = {
        register(_name, _initializer, predicate) {
            assert.equal(predicate({ capabilities: { calendarStartup: false } }), false);
        },
        bootstrap() { forbiddenStarts++; }
    };
    assert.equal(sandbox.ClockTimerCalendarStartup.register({
        dispatcher: disabledDispatcher,
        startup,
        context: { capabilities: { calendarStartup: false } },
        settingsOnlyPage: true,
        apiBase: "https://example.test/",
        calendarRanges: { setDatabaseRecords() {} },
        refreshTripLogSelection() {},
        showTripRangeError() {}
    }), false);
    assert.equal(forbiddenStarts, 0, "settings-only page must not register calendar startup");
}
console.log("PASS context restrictions, dispatcher resource manifests, nested resources, extracted calendar startup, dispatcher gating, and lifecycle cleanup");

{
    const { sandbox, appendedResources } = makeRuntime();
    const context = sandbox.ClockTimerContext.normalize({
        host: "order-filler",
        surface: "application",
        features: ["application", "settings", "calendarStartup"],
        capabilities: {}
    });
    await sandbox.ClockTimerDispatcher.bootstrap(context);
    for (const required of ["LiveStreamViewModel.js", "LiveStreamPublisher.js", "SessionStartup.js",
        "SpeechRuntimeOptions.js", "SpeechTransactionTime.js", "ActionSignalContext.js",
        "ConnectionStatusModel.js", "ButtonPressFeedback.js", "TripRuntimeModel.js", "TripLogModel.js", "AnnouncementCatalogModel.js", "AccessPolicyModel.js"]) {
        assert.ok(appendedResources.some(resource => String(resource.src).includes(required)),
            required + " must be available to the Order-Filler app");
    }
}


// Public dispatcher API contract: registration order, unregister callbacks,
// result/event shapes, context-scoped lifecycle deduplication, and rollback.
{
    const { sandbox, events, appendedResources } = makeRuntime();
    const order = [];
    let cleanupCount = 0;
    const unregisterResource = sandbox.ClockTimerDispatcher.registerResource("contract-resource", {
        type: "script",
        url: "ContractResource.js?build=api-contract-1",
        hosts: ["order-filler"]
    });
    const unregisterFirst = sandbox.ClockTimerDispatcher.register("contract-first", async context => {
        order.push("feature:first:" + context.host);
        return () => { cleanupCount++; };
    });
    sandbox.ClockTimerDispatcher.register("contract-second", async () => {
        order.push("feature:second");
        return { dispose() { cleanupCount++; } };
    });
    const context = sandbox.ClockTimerContext.normalize({
        host: "order-filler",
        surface: "api-contract-test",
        features: ["contract-first", "contract-second"],
        capabilities: {}
    });
    const result = await sandbox.ClockTimerDispatcher.bootstrap(context);
    assert.ok(appendedResources.some(resource => resource.src === "ContractResource.js?build=api-contract-1"),
        "registered resource is loaded");
    assert.deepEqual(order, ["feature:first:order-filler", "feature:second"],
        "resources load before feature initializers and feature order follows registration order");
    assert.deepEqual(Array.from(result.resources), ["contract-resource"]);
    assert.deepEqual(Array.from(result.features, feature => feature.name), ["contract-first", "contract-second"]);
    assert.equal(result.context.host, "order-filler");
    const ready = events.findLast(event => event.type === "clocktimer-dispatcher-ready");
    assert.ok(ready, "successful bootstrap emits the ready event");
    assert.equal(ready.detail.context, context);
    assert.deepEqual(Array.from(ready.detail.resources), ["contract-resource"]);
    assert.deepEqual(Array.from(ready.detail.features), ["contract-first", "contract-second"]);

    await sandbox.ClockTimerLifecycle.stopAll();
    assert.equal(cleanupCount, 2, "function and dispose cleanups are both supported");
    unregisterResource();
    unregisterFirst();
    assert.throws(() => sandbox.ClockTimerDispatcher.registerResource("invalid", { type: "font", url: "x" }),
        /resource needs a name, type, and URL/,
        "invalid descriptors are rejected at registration time");
}
{
    const { sandbox, events } = makeRuntime();
    const started = [];
    let cleanupCount = 0;
    sandbox.ClockTimerDispatcher.register("contract-rollback-first", async () => {
        started.push("first");
        return () => { cleanupCount++; };
    });
    sandbox.ClockTimerDispatcher.register("contract-rollback-fails", async () => {
        throw new Error("contract failure");
    });
    await assert.rejects(
        sandbox.ClockTimerDispatcher.bootstrap({
            host: "order-filler",
            features: ["contract-rollback-first", "contract-rollback-fails"]
        }),
        /contract failure/
    );
    assert.deepEqual(started, ["first"]);
    assert.equal(cleanupCount, 1, "a failed bootstrap disposes earlier feature starts");
    const failure = events.findLast(event => event.type === "clocktimer-dispatcher-error");
    assert.ok(failure, "failed bootstrap emits the error event");
    assert.match(failure.detail.error.message, /contract failure/);
}
console.log("PASS dispatcher public API contract");
