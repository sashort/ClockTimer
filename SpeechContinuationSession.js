(() => {
    "use strict";

    // One logical continuation, independent of a decoder, DOM, or audio engine.
    class SpeechContinuationSession {
        #now; #schedule; #unschedule; #timer; #deadline; #silenceGeneration = 0;
        #feedback;
        #phase = "collecting"; #transcript = "";

        constructor({id, surfaces = [], now = () => performance.now(),
            schedule = (callback, delay) => globalThis.setTimeout(callback, delay),
            unschedule = timer => globalThis.clearTimeout(timer), onError = () => {}, feedback} = {}) {
            this.id = id;
            this.collectors = new Map();
            this.expectedSurfaces = new Set(surfaces);
            this.acceptedSpans = [];
            this.context = undefined;
            this.#now = now; this.#schedule = schedule; this.#unschedule = unschedule;
            this.#feedback = feedback || new globalThis.OwnedFeedbackScope({onError});
        }

        get phase() { return this.#phase; }
        get deadline() { return this.#deadline; }

        valueCollector(key, options = {}) {
            if (this.#phase === 'cancelled') throw Error('A cancelled continuation cannot acquire a value collector.');
            let collector = this.collectors.get(key);
            if (!(collector instanceof globalThis.SpeechValueCollector)) {
                // Value and command planning have distinct deadlines. Cancelling
                // a speculative command probe must not erase the value's timer.
                const continuation = new SpeechContinuationSession({id: `${this.id}:${String(key)}`,
                    now: this.#now, schedule: this.#schedule, unschedule: this.#unschedule});
                collector = new globalThis.SpeechValueCollector({...options, continuation});
                this.collectors.set(key, collector);
            }
            return collector;
        }

        observe(transcript) {
            if (this.#phase === "cancelled") return false;
            if (transcript !== this.#transcript) this.cancelFeedback("input-changed", false);
            this.#transcript = transcript;
            this.#phase = "collecting";
            return true;
        }

        transfer(context, surface) {
            if (this.#phase === "cancelled" || (surface && !this.expectedSurfaces.has(surface))) return false;
            this.context = context;
            // The collector and deadline deliberately survive this handoff.
            return true;
        }

        armSilence(delay, expire) {
            this.cancelSilence();
            if (this.#phase === "cancelled") return undefined;
            if (!Number.isFinite(delay) || delay < 0) throw new RangeError("Silence delay must be a nonnegative number.");
            const generation = this.#silenceGeneration;
            this.#deadline = this.#now() + delay;
            this.#timer = this.#schedule(() => {
                if (generation !== this.#silenceGeneration) return;
                this.#timer = this.#deadline = undefined;
                if (this.#phase === "cancelled") return;
                this.#phase = "settling";
                expire();
            }, delay);
            return this.#timer;
        }

        cancelSilence() {
            this.#silenceGeneration++;
            if (this.#timer !== undefined) this.#unschedule(this.#timer);
            this.#timer = this.#deadline = undefined;
        }

        deferFeedback(key, start) {
            if (this.#phase === "cancelled") return () => {};
            return this.#feedback.defer(key, start);
        }

        cancelFeedback(reason = "cancelled", discard = true) {
            this.#feedback.interrupt(reason, {discardPending: discard});
        }

        settle(accepted) {
            this.cancelSilence();
            if (!accepted || this.#phase === "cancelled") { this.cancel(); return; }
            this.#phase = "accepted";
            this.#feedback.release();
        }

        cancel(reason = "cancelled") {
            this.#phase = "cancelled";
            this.cancelSilence(); this.#feedback.cancel(reason);
            for (const collector of this.collectors.values()) collector.cancel?.(reason);
            this.collectors.clear();
        }
    }

    globalThis.SpeechContinuationSession = SpeechContinuationSession;
})();
