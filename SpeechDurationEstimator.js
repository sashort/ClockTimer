(() => {
    "use strict";
    // In-memory playback measurements only. No text is persisted or uploaded.
    class SpeechDurationEstimator {
        #profiles = new Map();
        static rate(options = {}) {
            const velocity = Number.isFinite(Number(options.speechVelocity))
                ? Math.max(.5, Math.min(4, Number(options.speechVelocity))) : 1;
            return Math.max(.1, Math.min(10, (Number.isFinite(Number(options.rate)) ? Number(options.rate) : 1) * velocity));
        }
        static #units(text) {
            return Math.max(1, (String(text).toLowerCase().match(/[a-z]+|\d+/g) || [])
                .reduce((sum, word) => sum + 1 + .5 * Math.max(1, (word.match(/[aeiouy]+/g) || []).length), 0));
        }
        static #key(options) {
            return JSON.stringify([options.lang || "en-US", options.voiceProvider || "system",
                options.voice || "", this.rate(options), Number(options.pitch) || 1]);
        }
        estimate(text, options = {}) {
            const rate = SpeechDurationEstimator.rate(options);
            const profile = this.#profiles.get(SpeechDurationEstimator.#key(options));
            const measured = profile?.phrases.get(String(text));
            if (measured) return measured * 1.15 + 100;
            const units = SpeechDurationEstimator.#units(text);
            return Math.max(350, (profile?.msPerUnit || 280 / rate) * units + 250);
        }
        observe(text, elapsedMs, options = {}) {
            if (!Number.isFinite(elapsedMs) || elapsedMs < 50 || elapsedMs > 60000) return;
            const key = SpeechDurationEstimator.#key(options);
            let profile = this.#profiles.get(key);
            if (!profile) {
                profile = {phrases:new Map(), msPerUnit:undefined};
                this.#profiles.set(key, profile);
                if (this.#profiles.size > 32) this.#profiles.delete(this.#profiles.keys().next().value);
            }
            const units = SpeechDurationEstimator.#units(text);
            const sample = Math.max(1, elapsedMs - 250) / units;
            profile.msPerUnit = profile.msPerUnit === undefined ? sample : .7 * profile.msPerUnit + .3 * sample;
            profile.phrases.set(String(text), elapsedMs);
            if (profile.phrases.size > 128) profile.phrases.delete(profile.phrases.keys().next().value);
        }
    }
    globalThis.SpeechDurationEstimator = SpeechDurationEstimator;
})();
