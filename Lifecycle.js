/* Context-aware lifecycle coordinator for dispatcher-managed modules. */
(function (root) {
    "use strict";
    const instances = new Map();

    function contextKey(context) {
        return JSON.stringify({
            host: context?.host || "default",
            surface: context?.surface || "application",
            presentation: context?.presentation || "application",
            features: context?.features || [],
            capabilities: context?.capabilities || {},
            options: context?.options || {}
        });
    }

    function keyFor(name, context) {
        return name + ":" + contextKey(context);
    }

    function start(name, initializer, context) {
        const key = keyFor(name, context);
        if (instances.has(key)) return instances.get(key).promise;
        const record = { name, context, cleanup: null, promise: null };
        record.promise = Promise.resolve().then(() => initializer(context)).then(result => {
            record.cleanup = typeof result === "function" ? result : result?.dispose || null;
            return result;
        }).catch(error => {
            instances.delete(key);
            throw error;
        });
        instances.set(key, record);
        return record.promise;
    }

    async function stop(name, context) {
        const records = context
            ? [[keyFor(name, context), instances.get(keyFor(name, context))]]
            : [...instances.entries()].filter(([, record]) => record.name === name);
        for (const [key, record] of records) {
            if (!record) continue;
            instances.delete(key);
            await record.promise.catch(() => {});
            if (typeof record.cleanup === "function") await record.cleanup();
        }
    }

    async function stopAll() {
        for (const [key, record] of [...instances.entries()].reverse()) {
            instances.delete(key);
            await record.promise.catch(() => {});
            if (typeof record.cleanup === "function") await record.cleanup();
        }
    }

    root.ClockTimerLifecycle = Object.freeze({ start, stop, stopAll });
})(globalThis);
