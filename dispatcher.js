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
})(globalThis);
