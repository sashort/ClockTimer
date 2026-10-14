export function installAsyncStorage(window) {
    const values = new Map(), cache = new Map();
    const store = {
        fail: false, ready: Promise.resolve(),
        async initializeLegacy() {},
        peek(key) {return cache.get(key) ?? null;},
        async getItem(key) {await new Promise(setImmediate); return structuredClone(this.peek(key));},
        setItem(key, value) {
            const previous = this.peek(key);
            const undo = () => previous === null ? cache.delete(key) : cache.set(key, previous);
            if (window.WMOFStateTransactions?.stage(this, key, value, undo)) {
                cache.set(key, value); return Promise.resolve(true);
            }
            return this.commit([[key, value]]);
        },
        async commit(entries, signal) {
            await new Promise(setImmediate);
            if (this.fail) throw new Error('Disk write failed');
            if (signal?.aborted) throw new Error('Cancelled');
            for (const [key, value] of entries) {values.set(key, structuredClone(value));cache.set(key, structuredClone(value));}
            return true;
        },
        async flush() {await new Promise(setImmediate);}
    };
    window.structuredClone ??= structuredClone;
    window.WMOFPersistence = store;
    return store;
}
