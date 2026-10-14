(() => {
    "use strict";
    class CommandOperation extends EventTarget {
        #manager; #controller = new AbortController(); #waits = new Map();
        #phase = "collecting"; #finish; #completion; #closing; #cancelling; #links = [];
        constructor(manager, {group = Symbol("command"), source = "pointer", signal, parentId} = {}) {
            super(); this.#manager = manager; this.group = group; this.source = source;
            this.event = manager.beginEvent("operation", {source, parentId, group: String(group)});
            this.#completion = new Promise(resolve => this.#finish = resolve);
            if (signal) {
                const cancel = () => {void this.cancel(new DOMException("The command was cancelled.", "AbortError"));};
                signal.addEventListener("abort", cancel, {once:true});
                this.#links.push(() => signal.removeEventListener("abort", cancel));
                if (signal.aborted) cancel();
            }
        }
        get signal() {return this.#controller.signal;}
        get phase() {return this.#phase;}
        get settled() {return ["confirmed", "reverted"].includes(this.#phase);}
        get completion() {return this.#completion;}
        get waits() {return Object.freeze([...this.#waits.keys()]);}
        setPhase(phase) {
            if (this.settled || this.signal.aborted) return;
            this.#phase = phase;
            this.#manager.recordPhase(this.event, phase);
            this.dispatchEvent(new CustomEvent("phase", {detail:{phase, group:this.group, waits:this.waits}}));
        }
        expect(name, {timeoutMilliseconds = 10000} = {}) {
            if (this.settled || this.signal.aborted) return () => {};
            if (this.#waits.has(name)) return this.#waits.get(name).release;
            const release = () => {
                const wait = this.#waits.get(name); if (!wait) return;
                clearTimeout(wait.timer); this.#waits.delete(name);
            };
            const timer = setTimeout(() => {
                void this.cancel(new Error(`The command did not receive ${name}.`));
            }, timeoutMilliseconds);
            this.#waits.set(name, {timer, release}); this.setPhase("awaiting-result");
            return release;
        }
        settleFromTransaction(phase) {
            if (this.settled) return;
            for (const wait of this.#waits.values()) clearTimeout(wait.timer);
            this.#waits.clear(); for (const unlink of this.#links) unlink(); this.#links.length = 0;
            this.#phase = phase; this.#finish(phase === "confirmed");
            this.#manager.endEvent(this.event, phase);
            this.dispatchEvent(new CustomEvent("phase", {detail:{phase, group:this.group, waits:this.waits}}));
        }
        complete() {
            if (this.#closing) return this.#closing;
            if (this.settled) return this.#completion;
            if (this.#waits.size) throw new Error("A command cannot complete while owned results are outstanding.");
            this.setPhase("committing");
            return this.#closing = this.#manager.complete(this.group).then(accepted => {
                this.settleFromTransaction(accepted && !this.signal.aborted ? "confirmed" : "reverted");
                return this.#completion;
            }, async error => {await this.cancel(error);return false;});
        }
        cancel(error = new DOMException("The command was cancelled.", "AbortError")) {
            if (this.settled) return this.#completion;
            return this.#cancelling ??= Promise.resolve().then(async () => {
                if (!this.signal.aborted) this.#controller.abort(error);
                try {await this.#manager.rollback(this.group, error);}
                finally {this.settleFromTransaction("reverted");}
                return false;
            });
        }
    }

    // One coordinator owns operation ordering, persistence receipts and deferred
    // effects. The old StateTransactions export below is an alias, not another queue.
    class ApplicationCoordinator extends EventTarget {
        #adapters = new Map(); #groups = new Map(); #current; #nextId = 0; #last; #active;
        #eventId = 0; #events = []; #effects = new Map(); #revision = 0;
        #independentDepth = 0;
        #inputEvent;
        observeInputs(root) {
            const contacts = new Map();
            const start = event => {
                const key = event.type.startsWith("pointer") ? "pointer:" + event.pointerId : "keyboard:" + event.code;
                if (!contacts.has(key)) contacts.set(key, this.beginEvent("gesture", {source: event.type.startsWith("pointer") ? "pointer" : "keyboard",
                    target: event.target?.id || event.target?.tagName}));
                const receipt = this.#inputEvent = contacts.get(key);
                queueMicrotask(() => {if (this.#inputEvent === receipt) this.#inputEvent = undefined;});
            };
            const end = event => {
                const key = event.type.startsWith("pointer") ? "pointer:" + event.pointerId : "keyboard:" + event.code;
                const receipt = this.#inputEvent = contacts.get(key);
                this.endEvent(receipt, event.type === "pointercancel" ? "cancelled" : "completed"); contacts.delete(key);
                queueMicrotask(() => {if (this.#inputEvent === receipt) this.#inputEvent = undefined;});
            };
            for (const name of ["pointerdown", "keydown"]) root.addEventListener(name, start, true);
            for (const name of ["pointerup", "pointercancel", "keyup"]) root.addEventListener(name, end, true);
            root.defaultView?.addEventListener("blur", () => {
                for (const receipt of contacts.values()) this.endEvent(receipt, "cancelled");
                contacts.clear();
            });
            root.addEventListener("click", event => {
                const receipt = this.#inputEvent = this.beginEvent("activation", {source: "gesture", target: event.target?.id || event.target?.tagName});
                queueMicrotask(() => {this.endEvent(receipt); if (this.#inputEvent === receipt) this.#inputEvent = undefined;});
            }, true);
        }
        get revision() {return this.#revision;}
        get trace() {return Object.freeze(this.#events.map(event => Object.freeze({...event,
            phases: Object.freeze(event.phases.map(phase => Object.freeze({...phase})))})));}
        beginEvent(kind, {source = "system", parentId, ...detail} = {}) {
            const event = {id: ++this.#eventId, kind, source, parentId,
                startedAt: performance.now(), wallStartedAt: new Date().toISOString(),
                endedAt: null, phase: "started", revision: this.#revision, ...detail};
            event.phases = [{phase: "started", at: event.startedAt}];
            this.#events.push(event);
            // Keep a bounded diagnostic history; live receipts retain their own object.
            if (this.#events.length > 500) this.#events.splice(0, this.#events.length - 500);
            this.dispatchEvent(new CustomEvent("event", {detail: Object.freeze({...event})}));
            return event;
        }
        recordPhase(event, phase) {
            if (!event || event.endedAt !== null) return;
            event.phase = phase;
            event.phases.push({phase, at: performance.now()});
            this.dispatchEvent(new CustomEvent("event", {detail: Object.freeze({...event})}));
        }
        endEvent(event, phase = "completed", error) {
            if (!event || event.endedAt !== null) return;
            event.phase = phase; event.endedAt = performance.now();
            event.phases.push({phase, at: event.endedAt});
            event.durationMilliseconds = event.endedAt - event.startedAt;
            if (error) event.error = String(error.message || error);
            this.dispatchEvent(new CustomEvent("event", {detail: Object.freeze({...event})}));
        }
        effect(kind, work, {transaction = this.#current || this.#active, source = "system", signal} = {}) {
            const event = this.beginEvent(kind, {source, parentId: transaction?.owner?.event.id});
            try {
                if (signal?.aborted) throw new DOMException("The operation was cancelled.", "AbortError");
                const previous = this.#current;
                let result;
                try {
                    this.#current = transaction || undefined;
                    if (!transaction) this.#independentDepth++;
                    result = work();
                } finally {
                    if (!transaction) this.#independentDepth--;
                    this.#current = previous;
                }
                if (result?.then) return Promise.resolve(result).then(value => {
                    this.endEvent(event, "completed"); return value;
                }, error => {this.endEvent(event, error.name === "AbortError" ? "cancelled" : "failed", error); throw error;});
                this.endEvent(event, "completed"); return result;
            } catch (error) {this.endEvent(event, error.name === "AbortError" ? "cancelled" : "failed", error); throw error;}
        }
        cancelEffect(key) {
            const effect = this.#effects.get(key);
            if (!effect) return;
            clearTimeout(effect.timer); this.#effects.delete(key);
            effect.owner?.signal.removeEventListener("abort", effect.cancel);
            this.endEvent(effect.event, "cancelled");
        }
        defer(key, callback, {delay = 0, owner = this.#independentDepth ? undefined : this.#current?.owner || this.#active?.owner,
            valid = () => true, afterCompletion = false, stateAware = true} = {}) {
            this.cancelEffect(key);
            const event = this.beginEvent("deferred-ui", {source: "timer", key: typeof key === "string" ? key : key.id || key.tagName || "effect", parentId: owner?.event.id});
            const effect = {owner, event, cancel: () => this.cancelEffect(key)};
            effect.timer = setTimeout(async () => {
                if (afterCompletion && owner && !owner.settled) await owner.completion;
                if (this.#effects.get(key) !== effect) return;
                this.#effects.delete(key); owner?.signal.removeEventListener("abort", effect.cancel);
                const expectedRevision = owner?.event.settledRevision ?? owner?.event.executionRevision ?? event.revision;
                if (owner?.signal.aborted || owner?.phase === "reverted" ||
                    (stateAware && this.#revision !== expectedRevision) || !valid()) {this.endEvent(event, "cancelled");return;}
                // A callback runs under its own explicit receipt. It cannot inherit
                // whichever unrelated transaction happens to be active later.
                try {
                    const previous = this.#current; this.#current = undefined; this.#independentDepth++;
                    let result;
                    try {result = callback();} finally {this.#current = previous; this.#independentDepth--;}
                    Promise.resolve(result).then(() => this.endEvent(event), error => this.endEvent(event, "failed", error));
                } catch (error) {this.endEvent(event, "failed", error);}
            }, delay);
            this.#effects.set(key, effect);
            owner?.signal.addEventListener("abort", effect.cancel, {once: true});
            if (owner?.signal.aborted) this.cancelEffect(key);
            return effect.timer;
        }
        acknowledge(transaction, detail) {
            if (!transaction) return;
            (transaction.acknowledgements ||= []).push(Object.freeze({...detail, at: performance.now()}));
            const event = this.beginEvent("persistence-acknowledged", {parentId: transaction.owner?.event.id, ...detail});
            this.endEvent(event);
        }
        beginWrite(transaction, detail) {
            if (!transaction) return;
            const write = {outcome: "unknown", ...detail};
            (transaction.remoteWrites ||= []).push(write);
            return write;
        }
        finishWrite(write, outcome) {if (write) write.outcome = outcome;}
        createOperation(options = {}) {return new CommandOperation(this, {parentId: this.#inputEvent?.id, ...options});}
        register(name, adapter) {this.#adapters.set(name, adapter); return () => this.#adapters.delete(name);}
        get current() {return this.#current;}
        get active() {return this.#active;}
        get pending() {return Object.freeze([...this.#groups.values()].filter(t=>t.status === "pending" || t.rollingBack)
            .map(t=>Object.freeze({id:t.id, action:t.action, retrying:Boolean(t.retrying), attempt:t.retryAttempt || 0,
                phase:t.rollingBack ? "reconciling" : t.owner?.phase || "executing", waits:t.owner?.waits || []})));}
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
            if (transaction && (transaction.signal.aborted || transaction.status !== "pending")) throw new DOMException("The command is no longer active.", "AbortError");
            const previous = this.#current;
            this.#current = transaction;
            try {return operation();} finally {this.#current = previous;}
        }
        #emit(state, transaction, error) {
            this.dispatchEvent(new CustomEvent("state", {detail: {state, id: transaction.id,
                group: transaction.group, action: transaction.action, reconciled: Boolean(transaction.reconciled),
                recoveryRequired: Boolean(transaction.reconciliationError), revision: this.#revision, error}}));
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
        run(action, operation, {group, chain = false, persist, signal, owner, source = "pointer"} = {}) {
            // Nested actions are part of the caller's attempt, not a queue behind themselves.
            if (this.#current) return operation(this.#current);
            owner ??= !chain ? this.createOperation({group, signal, source}) : undefined;
            group = owner?.group ?? group ?? Symbol(action);
            if (owner?.settled || owner?.signal.aborted) return Promise.resolve(false);
            const transaction = this.#begin(group, action);
            transaction.owner ??= owner;
            if (owner) {owner.event.dependencyId = transaction.predecessor?.owner?.event.id; this.recordPhase(owner.event, "queued");}
            const cancellationSignals = new Set([signal, owner?.signal].filter(Boolean));
            for (const signal of cancellationSignals) {
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
                            transaction.active = Promise.resolve(adapter.capture());
                            transaction.snapshots.set(name, await transaction.active);
                            transaction.active = undefined;
                            if (transaction.signal.aborted) return false;
                            adapter.begin?.(transaction);
                        }
                    }
                    owner?.setPhase("executing");
                    if (owner) owner.event.executionRevision = this.#revision;
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
            return work.then(async result => {
                if (result === false) {await owner?.cancel(new Error("The command failed."));return false;}
                return (await (owner ? owner.complete() : this.complete(group))) ? result : false;
            });
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
                        await this.effect("persistence", () => store.commit([...writes], transaction.signal), {transaction, signal: transaction.signal});
                    }
                    if (transaction.signal.aborted) return false;
                    transaction.status = "confirmed";
                    this.#revision++;
                    this.#end(transaction); this.#emit("confirmed", transaction); return true;
                } catch (error) {await this.rollback(group, error); return false;}
            })();
        }
        #end(transaction) {
            if (this.#active === transaction) this.#active = undefined;
            for (const adapter of this.#adapters.values()) adapter.end?.(transaction);
            for (const unlink of transaction.signalLinks || []) unlink();
            this.#groups.delete(transaction.group); transaction.settle(transaction.status);
            if (transaction.owner) transaction.owner.event.settledRevision = this.#revision;
            if (transaction.owner) transaction.owner.event.reconciled = Boolean(transaction.reconciled);
            transaction.owner?.settleFromTransaction(transaction.status);
            transaction.snapshots.clear(); transaction.writes.clear(); transaction.undo.length = 0;
            if (this.#last === transaction) this.#last = undefined;
        }
        rollback(group, error) {
            const transaction = this.#groups.get(group);
            if (!transaction) return Promise.resolve();
            return transaction.rollback ??= this.#rollback(transaction, error);
        }
        async #rollback(transaction, error) {
            if (transaction.status !== "pending") return;
            transaction.rollingBack = true;
            transaction.status = "reverted"; transaction.controller.abort();
            const dependents = [...this.#groups.values()].filter(item => item.id > transaction.id && item.status === "pending");
            for (const dependent of dependents) {dependent.status = "reverted"; dependent.controller.abort();}
            const cancelledOwners = new Set([transaction.owner, ...dependents.map(item => item.owner)]);
            for (const [key, effect] of this.#effects) if (effect.owner && cancelledOwners.has(effect.owner)) this.cancelEffect(key);
            // Cooperating async operations receive the aborted signal. If a third-party
            // callback ignores it, restore only after it settles, before a new attempt starts.
            if (transaction.active) await transaction.active.catch(() => {});
            const committedRemotely = Boolean(transaction.acknowledgements?.length ||
                transaction.remoteWrites?.some(write => write.outcome !== "rejected"));
            if (!committedRemotely) for (const item of [...dependents.reverse(), transaction]) {
                for (const undo of item.undo.reverse()) undo();
            }
            try {
                if (committedRemotely) {
                    // A remote acknowledgement cannot be undone by restoring a
                    // browser snapshot. Reconcile from the acknowledged authority.
                    if (this.#active === transaction) this.#active = undefined;
                    this.recordPhase(transaction.owner?.event, "reconciling");
                    const recovery = this.beginEvent("reconciliation", {parentId: transaction.owner?.event.id});
                    try {
                        let failure;
                        for (const [store, writes] of transaction.writes) {
                            try {await store.commit([...writes]);} catch (error) {failure ||= error;}
                        }
                        for (const adapter of this.#adapters.values()) {
                            try {await adapter.reconcile?.(transaction);} catch (error) {failure ||= error;}
                        }
                        if (failure) throw failure;
                        transaction.reconciled = true;
                        this.endEvent(recovery);
                    } catch (failure) {this.endEvent(recovery, "failed", failure); throw failure;}
                } else for (const [name, snapshot] of transaction.snapshots) {
                    await this.#adapters.get(name)?.restore(snapshot);
                }
            } catch (failure) {
                transaction.reconciliationError = failure;
            } finally {
                this.#revision++;
                for (const dependent of dependents) {this.#end(dependent); this.#emit("reverted", dependent, error);}
                this.#end(transaction); this.#emit("reverted", transaction, transaction.reconciliationError || error);
            }
        }
        track(transaction, work) {
            if (!transaction || transaction.signal.aborted) return;
            transaction.pending.push(work); work.catch(() => {});
        }
        stage(store, key, value, undo) {
            if (this.#independentDepth) return false;
            const transaction = this.#current || this.#active;
            if (!transaction) return false;
            if (transaction.signal.aborted) throw new DOMException("The command was cancelled.", "AbortError");
            if (!transaction.writes.has(store)) transaction.writes.set(store, new Map());
            transaction.writes.get(store).set(key, value); transaction.undo.push(undo); return true;
        }
    }
    globalThis.ApplicationCoordinator = ApplicationCoordinator;
    globalThis.StateTransactions = ApplicationCoordinator;
    globalThis.WMOFCoordinator = new ApplicationCoordinator();
    globalThis.WMOFStateTransactions = globalThis.WMOFCoordinator;
    if (typeof document !== "undefined") globalThis.WMOFCoordinator.observeInputs(document);
})();
