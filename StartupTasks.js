/* Context-aware startup task runner for independent app startup responsibilities. */
(function (root) {
    "use strict";
    const tasks = new Map();

    function runWhenEnabled(name, context, task) {
        if (!name || typeof task !== "function") {
            return Promise.reject(new TypeError("Startup tasks require a name and callback."));
        }
        const effectiveContext = context || root.ClockTimerPageContext || {};
        if (effectiveContext.capabilities?.[name] === false) {
            return Promise.resolve({ skipped: true, reason: "capability-disabled", name });
        }
        if (tasks.has(name)) return tasks.get(name);

        const promise = Promise.resolve()
            .then(() => task(effectiveContext))
            .then(value => ({ skipped: false, name, value }))
            .catch(error => {
                tasks.delete(name);
                throw error;
            });
        tasks.set(name, promise);
        return promise;
    }

    function reset(name) {
        if (name === undefined) tasks.clear();
        else tasks.delete(name);
    }

    root.ClockTimerStartup = Object.freeze({ runWhenEnabled, reset });
})(globalThis);
