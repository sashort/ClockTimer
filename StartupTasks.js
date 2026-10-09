/* Context-aware startup task runner for independent app startup responsibilities. */
(function (root) {
    "use strict";
    const tasks = new Map();

    function taskKey(name, context) {
        return name + ":" + JSON.stringify({
            host: context?.host || "default",
            surface: context?.surface || "application",
            presentation: context?.presentation || "application",
            features: context?.features || [],
            capabilities: context?.capabilities || {},
            options: context?.options || {}
        });
    }

    function runWhenEnabled(name, context, task) {
        if (!name || typeof task !== "function") {
            return Promise.reject(new TypeError("Startup tasks require a name and callback."));
        }
        const effectiveContext = context || root.ClockTimerPageContext || {};
        if (effectiveContext.capabilities?.[name] === false) {
            return Promise.resolve({ skipped: true, reason: "capability-disabled", name });
        }
        const key = taskKey(name, effectiveContext);
        if (tasks.has(key)) return tasks.get(key);

        const promise = Promise.resolve()
            .then(() => task(effectiveContext))
            .then(value => ({ skipped: false, name, value }))
            .catch(error => {
                tasks.delete(key);
                throw error;
            });
        tasks.set(key, promise);
        return promise;
    }

    function reset(name) {
        if (name === undefined) {
            tasks.clear();
            return;
        }
        const prefix = name + ":";
        for (const key of tasks.keys()) {
            if (key.startsWith(prefix)) tasks.delete(key);
        }
    }

    root.ClockTimerStartup = Object.freeze({ runWhenEnabled, reset });
})(globalThis);
