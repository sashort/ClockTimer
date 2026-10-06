(() => {
    "use strict";
    const scriptURL = document.currentScript?.src || new URL("AsyncPersistence.js", location.href).href;
    const workerURL = new URL("PersistenceWorker.js", scriptURL);
    workerURL.search = new URL(scriptURL).search;
    class AsyncPersistence extends EventTarget {
        #worker; #requests = new Map(); #nextId = 0; #cache = new Map(); #queue = Promise.resolve();
        #ready; #legacyReady; #failure;
        constructor({worker = new Worker(workerURL)} = {}) {
            super(); this.#worker = worker;
            worker.addEventListener("message", ({data}) => {
                const request = this.#requests.get(data.id); if (!request) return;
                this.#requests.delete(data.id);
                data.error ? request.reject(new Error(data.error)) : request.resolve(data.result);
            });
            worker.addEventListener("error", event => {
                this.#failure = new Error(event.message || "Browser storage is unavailable.");
                for (const request of this.#requests.values()) request.reject(this.#failure);
                this.#requests.clear();
            });
            this.#ready = this.#request("entries").then(entries => {
                for (const [key, value] of entries) this.#cache.set(key, value);
            });
            this.#ready.catch(() => {});
        }
        #request(operation, key, value) {
            if (this.#failure) return Promise.reject(this.#failure);
            const id = ++this.#nextId;
            return new Promise((resolve, reject) => {
                this.#requests.set(id, {resolve, reject});
                try {this.#worker.postMessage({id, operation, key, value});}
                catch (error) {this.#requests.delete(id); reject(error);}
            });
        }
        get ready() {return this.#legacyReady || this.#ready;}
        // This is an in-memory view; it never reads persistent storage.
        peek(key) {return this.#cache.get(key) ?? null;}
        async getItem(key) {await this.ready; return this.peek(key);}
        setItem(key, value) {
            const previous = this.peek(key);
            const undo = () => previous === null ? this.#cache.delete(key) : this.#cache.set(key, previous);
            if (globalThis.WMOFStateTransactions?.stage(this, key, value, undo)) {
                this.#cache.set(key, value); return Promise.resolve(true);
            }
            return this.commit([[key, value]]);
        }
        commit(entries, signal) {

            const work = this.#queue.then(async () => {
                await this.#ready;
                if (signal?.aborted) throw new DOMException("The state change was cancelled.", "AbortError");
                await this.#request("batch", undefined, entries);
                if (!signal?.aborted) for (const [key, value] of entries) this.#cache.set(key, value);
                return true;
            });
            this.#queue = work.catch(() => {});
            return work;
        }
        async removeItem(key) {
            const work = this.#queue.then(async () => {
                await this.#ready; await this.#request("delete", key); this.#cache.delete(key);
            });
            this.#queue = work.catch(() => {}); return work;
        }
        initializeLegacy(storage) {
            return this.#legacyReady ??= this.#importLegacy(storage);
        }
        async #importLegacy(storage) {
            await this.#ready;
            const pause = () => new Promise(resolve => setTimeout(resolve, 0));
            // Legacy Web Storage can only be read on the window thread. Import it
            // once, between tasks, before interactive command handling starts.
            let length; try {length = storage.length;} catch {return;}
            for (let index = 0; index < length; index++) {
                await pause();
                const key = storage.key(index);
                if (!key || !key.startsWith("wmof.") || this.#cache.has(key)) continue;
                const value = storage.getItem(key);
                if (value !== null) await this.commit([[key, value]]);
            }
        }
        async flush() {await this.#queue;}
    }
    globalThis.AsyncPersistence = AsyncPersistence;
    globalThis.WMOFPersistence = new AsyncPersistence();
    try {globalThis.WMOFPersistence.initializeLegacy(localStorage).catch(() => {});} catch {}
})();
