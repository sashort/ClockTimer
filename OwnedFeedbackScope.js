(() => {
    "use strict";

    // Owns deferred feedback and playback leases for one workflow. It does not
    // know about speech recognition, audio formats, dialogs, or persistence.
    class OwnedFeedbackScope {
        #pending = new Map();
        #playing = new Map();
        #closed = false;
        #onError;

        constructor({onError = () => {}} = {}) { this.#onError = onError; }

        get closed() { return this.#closed; }
        get pendingCount() { return this.#pending.size; }
        get playingCount() { return this.#playing.size; }

        defer(key, start) {
            if (typeof start !== "function") throw new TypeError("Feedback requires a playback callback.");
            if (this.#closed) return () => {};
            this.#pending.delete(key);
            this.#stop(key, "replaced");
            const entry = {start};
            this.#pending.set(key, entry);
            // An old cancellation handle must never cancel its replacement.
            return () => {
                if (this.#pending.get(key) === entry) this.#pending.delete(key);
                if (this.#playing.get(key)?.entry === entry) this.#stop(key, "cancelled");
            };
        }

        release() {
            if (this.#closed) return;
            // Keep entries in the map until dispatch, so a callback can cancel
            // or replace another queued entry while this batch is releasing.
            for (const [key, entry] of [...this.#pending]) {
                if (this.#closed || this.#pending.get(key) !== entry) continue;
                this.#pending.delete(key);
                const controller = new AbortController();
                const playback = {entry, controller, stopped: false};
                this.#playing.set(key, playback);
                try {
                    const handle = entry.start(controller.signal);
                    playback.stop = typeof handle === "function" ? handle :
                        typeof handle?.stop === "function" ? () => handle.stop() : undefined;
                    if (controller.signal.aborted) this.#stopHandle(playback);
                    else if (!playback.stop && !handle?.finished) this.#playing.delete(key);
                    if (handle?.finished) Promise.resolve(handle.finished).then(
                        () => this.#finish(key, playback),
                        error => { this.#onError(error); if (this.#playing.get(key) === playback) this.#stop(key, "failed"); });
                } catch (error) {
                    this.#onError(error);
                    if (this.#playing.get(key) === playback) this.#stop(key, "failed");
                }
            }
        }

        #finish(key, playback) {
            if (this.#playing.get(key) === playback) this.#playing.delete(key);
        }

        #stopHandle(playback) {
            if (playback.stopped || !playback.stop) return;
            playback.stopped = true;
            try { playback.stop(); } catch (error) { this.#onError(error); }
        }

        #stop(key, reason) {
            const playback = this.#playing.get(key);
            if (!playback) return;
            this.#playing.delete(key);
            playback.controller.abort(reason);
            this.#stopHandle(playback);
        }

        interrupt(reason = "interrupted", {discardPending = true} = {}) {
            if (discardPending) this.#pending.clear();
            for (const key of [...this.#playing.keys()]) this.#stop(key, reason);
        }

        cancel(reason = "cancelled") {
            this.#closed = true;
            this.interrupt(reason);
        }
    }

    globalThis.OwnedFeedbackScope = OwnedFeedbackScope;
})();
