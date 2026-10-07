(() => {
    "use strict";
    class StateTransactions extends EventTarget {
        #adapters = new Map(); #groups = new Map(); #current; #nextId = 0; #last; #active;
        register(name, adapter) {this.#adapters.set(name, adapter); return () => this.#adapters.delete(name);}
        get current() {return this.#current;}
        get active() {return this.#active;}
        get pending() {return Object.freeze([...this.#groups.values()].filter(t=>t.status === "pending")
            .map(t=>Object.freeze({id:t.id, action:t.action, retrying:Boolean(t.retrying), attempt:t.retryAttempt || 0})));}
        async retry(operation, {signal, transaction = this.#current || this.#active, valid = () => true,
            delay = attempt => Math.min(150 * 2 ** Math.min(attempt - 1, 4), 2000)} = {}) {
            signal ??= transaction?.signal;
            let attempt = 0;
            for (;;) {
                if (signal?.aborted) throw new DOMException("The command was cancelled.", "AbortError");
                try {
                    const result = await operation();
                    if (transaction?.retrying) {transaction.retrying = false;this.#emit("pending", transaction);}
                    return result;
                } catch (error) {
                    if (signal?.aborted || error.retryable !== true || !valid()) throw error;
                    if (transaction && transaction.status !== "pending") throw new DOMException("The command was cancelled.", "AbortError");
                    attempt++;
                    if (transaction) {transaction.retrying = true;transaction.retryAttempt = attempt;this.#emit("retrying", transaction, error);}
                    await new Promise((resolve, reject) => {
                        const finish = () => {signal?.removeEventListener("abort", cancel);resolve();};
                        const timer = setTimeout(finish, delay(attempt));
                        const cancel = () => {clearTimeout(timer);signal?.removeEventListener("abort", cancel);
                            reject(new DOMException("The command was cancelled.", "AbortError"));};
                        signal?.addEventListener("abort", cancel, {once:true});
                        if (signal?.aborted) cancel();
                    });
                }
            }
        }
        withTransaction(transaction, operation) {
            if (transaction?.signal.aborted) throw new DOMException("The command was cancelled.", "AbortError");
            const previous = this.#current;
            this.#current = transaction;
            try {return operation();} finally {this.#current = previous;}
        }
        #emit(state, transaction, error) {
            this.dispatchEvent(new CustomEvent("state", {detail: {state, id: transaction.id,
                group: transaction.group, action: transaction.action, error}}));
        }
        #begin(group, action) {
            let transaction = this.#groups.get(group);
            if (!transaction) {
                let settle;
                transaction = {id: ++this.#nextId, group, action, controller: new AbortController(),
                    snapshots: new Map(), writes: new Map(), undo: [], pending: [], status: "pending",
                    predecessor: this.#last, queue: Promise.resolve(), settled: new Promise(resolve => settle = resolve)};
                transaction.settle = settle; transaction.signal = transaction.controller.signal;
                this.#last = transaction; this.#groups.set(group, transaction); this.#emit("pending", transaction);
            }
            return transaction;
        }
        run(action, operation, {group, chain = false, persist, signal} = {}) {
            // Nested actions are part of the caller's attempt, not a queue behind themselves.
            if (this.#current) return operation(this.#current);
            group ??= Symbol(action);
            const transaction = this.#begin(group, action);
            if (signal) {
                const cancel = () => {void this.rollback(group, new DOMException("The command was cancelled.", "AbortError"));};
                (transaction.signalLinks ||= []).push(() => signal.removeEventListener("abort", cancel));
                signal.addEventListener("abort", cancel, {once:true});
                if (signal.aborted) cancel();
            }
            const work = transaction.queue.then(async () => {
                if (transaction.predecessor) await transaction.predecessor.settled;
                transaction.predecessor = undefined;
                if (transaction.signal.aborted) return false;
                try {
                    if (!transaction.captured) {
                        transaction.captured = true;
                        for (const [name, adapter] of this.#adapters) {
                            transaction.snapshots.set(name, await adapter.capture());
                            adapter.begin?.(transaction);
                        }
                    }
                    transaction.remotePermission = persist;
                    this.#active = transaction;
                    const previous = this.#current;
                    let result;
                    try {this.#current = transaction; result = operation(transaction);}
                    finally {this.#current = previous;}
                    transaction.active = Promise.resolve(result);
                    result = await transaction.active;
                    while (transaction.pending.length) {
                        transaction.active = Promise.all(transaction.pending.splice(0));
                        await transaction.active;
                    }
                    transaction.active = undefined;
                    if (transaction.signal.aborted) return false;
                    if (result === false) throw new Error("The command was rejected in the current state.");
                    return result;
                } catch (error) {
                    transaction.active = undefined;
                    await this.rollback(group, error); return false;
                }
            });
            transaction.queue = work.catch(() => {});
            if (chain) return work;
            return work.then(async result => result === false ? false :
                (await this.complete(group)) ? result : false);
        }
        complete(group) {
            const transaction = this.#groups.get(group);
            if (!transaction) return Promise.resolve(true);
            if (transaction.signal.aborted) return Promise.resolve(false);
            return transaction.completion ??= (async () => {
                await transaction.queue;
                try {
                    if (transaction.signal.aborted) return false;
                    for (const [store, writes] of transaction.writes) {
                        await store.commit([...writes], transaction.signal);
                    }
                    if (transaction.signal.aborted) return false;
                    transaction.status = "confirmed";
                    this.#end(transaction); this.#emit("confirmed", transaction); return true;
                } catch (error) {await this.rollback(group, error); return false;}
            })();
        }
        #end(transaction) {
            if (this.#active === transaction) this.#active = undefined;
            for (const adapter of this.#adapters.values()) adapter.end?.(transaction);
            for (const unlink of transaction.signalLinks || []) unlink();
            this.#groups.delete(transaction.group); transaction.settle(transaction.status);
            transaction.snapshots.clear(); transaction.writes.clear(); transaction.undo.length = 0;
            if (this.#last === transaction) this.#last = undefined;
        }
        async rollback(group, error) {
            const transaction = this.#groups.get(group);
            if (!transaction || transaction.status !== "pending") return;
            transaction.status = "reverted"; transaction.controller.abort();
            const dependents = [...this.#groups.values()].filter(item => item.id > transaction.id && item.status === "pending");
            for (const dependent of dependents) {dependent.status = "reverted"; dependent.controller.abort();}
            // Cooperating async operations receive the aborted signal. If a third-party
            // callback ignores it, restore only after it settles, before a new attempt starts.
            if (transaction.active) await transaction.active.catch(() => {});
            for (const item of [...dependents.reverse(), transaction]) {
                for (const undo of item.undo.reverse()) undo();
            }
            try {
                for (const [name, snapshot] of transaction.snapshots) {
                    await this.#adapters.get(name)?.restore(snapshot);
                }
            } finally {
                for (const dependent of dependents) {this.#end(dependent); this.#emit("reverted", dependent, error);}
                this.#end(transaction); this.#emit("reverted", transaction, error);
            }
        }
        track(transaction, work) {
            if (!transaction || transaction.signal.aborted) return;
            transaction.pending.push(work); work.catch(() => {});
        }
        stage(store, key, value, undo) {
            const transaction = this.#current || this.#active;
            if (!transaction) return false;
            if (transaction.signal.aborted) throw new DOMException("The command was cancelled.", "AbortError");
            if (!transaction.writes.has(store)) transaction.writes.set(store, new Map());
            transaction.writes.get(store).set(key, value); transaction.undo.push(undo); return true;
        }
    }
    globalThis.StateTransactions = StateTransactions;
    globalThis.WMOFStateTransactions = new StateTransactions();
})();
