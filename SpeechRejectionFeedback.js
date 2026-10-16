(() => {
    "use strict";

    // Converts confirmed recognition outcomes into one cue per logical root.
    // It deliberately does not subscribe to transport, persistence or UI errors.
    class SpeechRejectionFeedback {
        #events; #play; #enabled; #onError; #seen = new Set(); #limit;
        #listener = event => {
            const result = event.detail;
            if (!result || result.source !== "recognition" || result.confirmed !== true ||
                result.ignored || !["malformed", "incomplete", "invalid-value", "unrecognized"].includes(result.outcome) ||
                result.rootId === undefined || this.#seen.has(result.rootId)) return;
            this.#seen.add(result.rootId);
            while (this.#seen.size > this.#limit) this.#seen.delete(this.#seen.values().next().value);
            if (!this.#enabled()) return;
            try { Promise.resolve(this.#play(result)).catch(this.#onError); }
            catch (error) { this.#onError(error); }
        };

        constructor({events, play, enabled = () => true, onError = () => {}, rememberedRoots = 256}) {
            if (!events?.addEventListener || typeof play !== "function") throw new TypeError("Recognition feedback requires events and a playback callback.");
            this.#events = events; this.#play = play; this.#enabled = enabled; this.#onError = onError;
            this.#limit = Math.max(1, Number(rememberedRoots) || 256);
            events.addEventListener("speechAttemptRejected", this.#listener);
        }

        dispose() {
            this.#events.removeEventListener("speechAttemptRejected", this.#listener);
            this.#seen.clear();
        }
    }

    globalThis.SpeechRejectionFeedback = SpeechRejectionFeedback;
})();
