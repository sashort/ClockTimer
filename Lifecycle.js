/* Small lifecycle coordinator used by dispatcher-managed entry points. */
(function (root) {
    "use strict";
    const instances = new Map();

    function start(name, initializer, context) {
        if (instances.has(name)) return instances.get(name).promise;
        const record = { context, cleanup: null, promise: null };
        record.promise = Promise.resolve().then(() => initializer(context)).then(result => {
            record.cleanup = typeof result === "function" ? result : result?.dispose || null;
            return result;
        }).catch(error => {
            instances.delete(name);
            throw error;
        });
        instances.set(name, record);
        return record.promise;
    }

    async function stop(name) {
        const record = instances.get(name);
        if (!record) return;
        instances.delete(name);
        await record.promise.catch(() => {});
        if (typeof record.cleanup === "function") await record.cleanup();
    }

    async function stopAll() {
        for (const name of [...instances.keys()].reverse()) await stop(name);
    }

    root.ClockTimerLifecycle = Object.freeze({ start, stop, stopAll });
})(globalThis);
