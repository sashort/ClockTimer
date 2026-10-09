/* Context-aware entry point. Legacy pages remain compatible while features migrate. */
(function (root) {
    "use strict";
    const featureModules = new Map();

    function register(name, initializer, predicate = () => true) {
        if (!name || typeof initializer !== "function") throw new TypeError("A feature needs a name and initializer.");
        featureModules.set(name, { initializer, predicate });
        return () => featureModules.delete(name);
    }

    async function bootstrap(input = {}) {
        const context = root.ClockTimerContext.normalize(input);
        const selected = context.features.length
            ? [...featureModules.entries()].filter(([name, feature]) =>
                context.features.includes(name) && feature.predicate(context))
            : [...featureModules.entries()].filter(([, feature]) => feature.predicate(context));
        const started = [];
        try {
            for (const [name, feature] of selected) {
                const result = await root.ClockTimerLifecycle.start(name, feature.initializer, context);
                started.push({ name, result });
            }
            const detail = { context, features: started.map(item => item.name) };
            document.dispatchEvent(new CustomEvent("clocktimer-dispatcher-ready", { detail }));
            return { context, features: started };
        } catch (error) {
            for (const item of started.reverse()) await root.ClockTimerLifecycle.stop(item.name);
            document.dispatchEvent(new CustomEvent("clocktimer-dispatcher-error", { detail: { context, error } }));
            throw error;
        }
    }

    async function startLegacyEntry(context) {
        const entry = context.host === "drop-in" ? "drop-in.js?build=E4GUFA" : "app.js?v=language-pack-20261001&build=E4GUFA";
        const script = await root.ClockTimerResources.loadScript(entry, context, { async: false });
        script.dataset.clocktimerLegacyEntry = context.host === "drop-in" ? "drop-in" : "app";
        document.dispatchEvent(new CustomEvent("clocktimer-legacy-entry-loaded", {
            detail: { context, entry: script.src }
        }));
        return script;
    }

    async function startPage(input) {
        const context = root.ClockTimerContext.normalize(input || root.ClockTimerPageContext || {});
        const result = await startLegacyEntry(context);
        document.dispatchEvent(new CustomEvent("clocktimer-dispatcher-ready", {
            detail: { context, entry: result.src }
        }));
        return { context, entry: result };
    }

    root.ClockTimerDispatcher = Object.freeze({ bootstrap, register, startPage });

    // The dispatcher is the page entry point. Existing feature code is loaded as
    // a compatibility module until each responsibility has been extracted.
    if (document.currentScript?.dataset.clocktimerNoAutostart !== "true") {
        const run = () => startPage().catch(error => {
            console.error("ClockTimer dispatcher startup failed:", error);
            document.dispatchEvent(new CustomEvent("clocktimer-dispatcher-error", {
                detail: { error }
            }));
        });
        if (document.readyState === "loading") {
            // This script is near the end of the document; wait for parsing so
            // context inference and page-specific inline bootstrap can finish.
            document.addEventListener("DOMContentLoaded", run, { once: true });
        } else run();
    }
})(globalThis);
