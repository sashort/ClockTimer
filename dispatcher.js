/* Context-aware entry point for feature modules and context-scoped resources. */
(function (root) {
    "use strict";
    const featureModules = new Map();
    const resourceModules = new Map();

    function register(name, initializer, predicate = () => true) {
        if (!name || typeof initializer !== "function") throw new TypeError("A feature needs a name and initializer.");
        featureModules.set(name, { initializer, predicate });
        return () => featureModules.delete(name);
    }

    function registerResource(name, descriptor, predicate = () => true) {
        if (!name || !descriptor || !["script", "style", "template"].includes(descriptor.type)
            || typeof descriptor.url !== "string" || !descriptor.url) {
            throw new TypeError("A resource needs a name, type, and URL.");
        }
        resourceModules.set(name, { descriptor: { ...descriptor }, predicate });
        return () => resourceModules.delete(name);
    }

    function resourceMatches(resource, context) {
        const descriptor = resource.descriptor;
        if (descriptor.hosts && !descriptor.hosts.includes(context.host)) return false;
        if (descriptor.features && !descriptor.features.every(feature => context.features.includes(feature))) return false;
        if (descriptor.capability && context.capabilities?.[descriptor.capability] === false) return false;
        return resource.predicate(context);
    }

    async function loadResource(name, resource, context) {
        const loader = root.ClockTimerResources;
        if (!loader) throw new Error("ClockTimerResources is required to load dispatcher resources.");
        const descriptor = resource.descriptor;
        if (descriptor.type === "script") return loader.loadScript(descriptor.url, context, descriptor.options || {});
        if (descriptor.type === "style") return loader.loadStyle(descriptor.url, context);
        const target = typeof descriptor.target === "string"
            ? document.querySelector(descriptor.target)
            : descriptor.target;
        if (descriptor.target && !target) throw new Error("Template target not found for resource: " + name);
        return loader.loadTemplate(descriptor.url, context, target, descriptor.options || {});
    }

    async function bootstrap(input = {}) {
        const context = root.ClockTimerContext.normalize(input);
        const selectedResources = [...resourceModules.entries()].filter(([, resource]) =>
            resourceMatches(resource, context));
        const selectedFeatures = context.features.length
            ? [...featureModules.entries()].filter(([name, feature]) =>
                context.features.includes(name) && feature.predicate(context))
            : [...featureModules.entries()].filter(([, feature]) => feature.predicate(context));
        const loadedResources = [];
        const started = [];
        try {
            // Keep manifest order deterministic so dependent scripts can register
            // before their feature initializers run.
            for (const [name, resource] of selectedResources) {
                await loadResource(name, resource, context);
                loadedResources.push(name);
            }
            for (const [name, feature] of selectedFeatures) {
                const result = await root.ClockTimerLifecycle.start(name, feature.initializer, context);
                started.push({ name, result });
            }
            const detail = { context, resources: loadedResources, features: started.map(item => item.name) };
            document.dispatchEvent(new CustomEvent("clocktimer-dispatcher-ready", { detail }));
            return { context, resources: loadedResources, features: started };
        } catch (error) {
            for (const item of started.reverse()) await root.ClockTimerLifecycle.stop(item.name, context);
            document.dispatchEvent(new CustomEvent("clocktimer-dispatcher-error", {
                detail: { context, resources: loadedResources, error }
            }));
            throw error;
        }
    }

    root.ClockTimerDispatcher = Object.freeze({ bootstrap, register, registerResource });

    // Core startup resources are selected by host policy rather than duplicated
    // in every HTML entry point. Keep order deterministic for dependent modules.
    [
        ["startup-announcement", {
            type: "script",
            url: "StartupAnnouncement.js?build=dispatcher-2",
            hosts: ["order-filler", "settings-frame"]
        }],
        ["persistence-startup", {
            type: "script",
            url: "PersistenceStartup.js?build=persistence-startup-2",
            hosts: ["order-filler", "settings-frame"]
        }],
        ["application-startup", {
            type: "script",
            url: "ApplicationStartup.js?build=application-startup-3",
            hosts: ["order-filler", "settings-frame"]
        }],
        ["audio-unlock", {
            type: "script",
            url: "AudioUnlock.js?build=audio-unlock-2",
            hosts: ["order-filler", "settings-frame"]
        }],
        ["audio-announcement-draft", {
            type: "script",
            url: "AudioAnnouncementDraft.js?build=audio-announcement-draft-1",
            hosts: ["order-filler", "settings-frame"]
        }],
        ["audio-settings-startup", {
            type: "script",
            url: "AudioSettingsStartup.js?build=audio-settings-startup-4",
            hosts: ["order-filler", "settings-frame"]
        }],
        ["speech-startup", {
            type: "script",
            url: "SpeechStartup.js?build=speech-startup-2",
            hosts: ["order-filler"],
            capability: "speechRecognition"
        }],
        ["calendar-startup", {
            type: "script",
            url: "CalendarStartup.js?build=calendar-startup-3",
            hosts: ["order-filler"],
            features: ["calendarStartup"],
            capability: "calendarStartup"
        }],
        ["drop-in-view-model", {
            type: "script",
            url: "DropInViewModel.js?build=drop-in-view-model-2",
            hosts: ["order-filler"]
        }],
        ["timer-display-model", {
            type: "script",
            url: "TimerDisplayModel.js?build=timer-display-model-1",
            hosts: ["order-filler", "settings-frame"]
        }],
        ["trip-log-model", {
            type: "script",
            url: "TripLogModel.js?build=trip-log-model-5",
            hosts: ["order-filler", "settings-frame"]
        }],
        ["trip-goal-model", {
            type: "script",
            url: "TripGoalModel.js?build=trip-goal-model-13",
            hosts: ["order-filler", "settings-frame"]
        }],
        ["trip-draft-model", {
            type: "script",
            url: "TripDraftModel.js?build=trip-draft-model-1",
            hosts: ["order-filler", "settings-frame"]
        }],
        ["trip-preferences-model", {
            type: "script",
            url: "TripPreferencesModel.js?build=trip-preferences-model-2",
            hosts: ["order-filler", "settings-frame"]
        }],
        ["trip-preferences-store", {
            type: "script",
            url: "TripPreferencesStore.js?build=trip-preferences-store-1",
            hosts: ["order-filler", "settings-frame"]
        }],
        ["access-policy-model", {
            type: "script",
            url: "AccessPolicyModel.js?build=access-policy-model-2",
            hosts: ["order-filler", "settings-frame"]
        }],
        ["live-stream-view-model", {
            type: "script",
            url: "LiveStreamViewModel.js?build=live-stream-view-model-2",
            hosts: ["order-filler"]
        }],
        ["live-stream-publisher", {
            type: "script",
            url: "LiveStreamPublisher.js?build=live-stream-publisher-1",
            hosts: ["order-filler"]
        }],
        ["session-startup", {
            type: "script",
            url: "SessionStartup.js?build=session-startup-1",
            hosts: ["order-filler"]
        }],
        ["announcement-catalog-model", {
            type: "script",
            url: "AnnouncementCatalogModel.js?build=announcement-catalog-model-1",
            hosts: ["order-filler", "settings-frame"]
        }],
        ["speech-runtime-options", {
            type: "script",
            url: "SpeechRuntimeOptions.js?build=speech-runtime-options-1",
            hosts: ["order-filler", "settings-frame"]
        }],
        ["speech-transaction-time", {
            type: "script",
            url: "SpeechTransactionTime.js?build=speech-transaction-time-1",
            hosts: ["order-filler", "settings-frame"]
        }],
        ["action-signal-context", {
            type: "script",
            url: "ActionSignalContext.js?build=action-signal-context-1",
            hosts: ["order-filler", "settings-frame"]
        }],
        ["connection-status-model", {
            type: "script",
            url: "ConnectionStatusModel.js?build=connection-status-model-1",
            hosts: ["order-filler", "settings-frame"]
        }],
        ["button-press-feedback", {
            type: "script",
            url: "ButtonPressFeedback.js?build=button-press-feedback-1",
            hosts: ["order-filler", "settings-frame"]
        }],
        ["trip-runtime-model", {
            type: "script",
            url: "TripRuntimeModel.js?build=trip-runtime-model-2",
            hosts: ["order-filler", "settings-frame"]
        }]
    ].forEach(([name, descriptor]) => registerResource(name, descriptor));
})(globalThis);
