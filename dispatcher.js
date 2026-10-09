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

    root.ClockTimerDispatcher = Object.freeze({ bootstrap, register });

})(globalThis);
