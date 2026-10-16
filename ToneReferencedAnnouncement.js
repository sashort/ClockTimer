(() => {
    "use strict";
    // One atomic announcement: predict a future value, speak, then schedule its cue.
    // Adapters own formatting, clock projections, speech and Web Audio playback.
    class ToneReferencedAnnouncement {
        #estimator; #now; #wait;
        constructor({estimator = new globalThis.SpeechDurationEstimator(), now = () => performance.now(),
            wait = ms => new Promise(resolve => setTimeout(resolve, ms))} = {}) {
            this.#estimator = estimator; this.#now = now; this.#wait = wait;
        }
        #align(at, valueAt) {
            const value = valueAt(at), slope = (valueAt(at + 1000) - value) / 1000;
            // Align moving countdowns/overtime with a whole remaining second.
            if (!Number.isFinite(value) || !Number.isFinite(slope) || Math.abs(Math.abs(slope) - 1) > .001) return at;
            const target = slope < 0 ? Math.floor(value / 1000) * 1000 : Math.ceil(value / 1000) * 1000;
            return at + Math.max(0, (target - value) / slope);
        }
        async run({valueAt, format, speak, play, profile = {}, guard = () => true,
            onPlan = () => {}, gapMs = 180, marginMs = 400, maxAttempts = 3}) {
            const valid = () => guard() !== false;
            for (let attempt=0; attempt<maxAttempts && valid(); attempt++) {
                const started = this.#now();
                let at = started + gapMs + marginMs;
                let value, text;
                // Only extend the deadline: boundary-dependent wording cannot oscillate.
                for (let iteration=0; iteration<12; iteration++) {
                    at = this.#align(at, valueAt);
                    value = valueAt(at);
                    if (!Number.isFinite(value)) return {performed:false, reason:"unavailable"};
                    text = format(value);
                    const earliest = started + this.#estimator.estimate(text, profile) + gapMs + marginMs;
                    if (at >= earliest) break;
                    at = earliest;
                }
                // Re-evaluate after the last extension, including a changed minute/hour.
                at = this.#align(at, valueAt); value = valueAt(at); text = format(value);
                if (!text || !valid()) return {performed:false, reason:"cancelled"};
                onPlan({at, value, text, attempt});
                const speechStarted = this.#now();
                const completed = await speak(text);
                if (completed !== true || !valid()) return {performed:false, reason:"speech-cancelled"};
                this.#estimator.observe(text, this.#now()-speechStarted, profile);
                // Never allow a late speech completion to produce a false time cue.
                if (this.#now()+gapMs > at || Math.abs(valueAt(at)-value) > 2) continue;
                const song = await play({at, value, text});
                if (!song) continue; // Audio setup missed the scheduling deadline.
                // Guard remains live through the scheduled attack and audible tail.
                let finished = false;
                const completion = Promise.resolve(song.finished).then(result => {finished=true; return result;});
                while (!finished) {
                    if (!valid() || (this.#now()<at && Math.abs(valueAt(at)-value)>2)) {
                        song.stop?.();
                        return {performed:false, reason:"cancelled"};
                    }
                    await Promise.race([completion, this.#wait(40)]);
                }
                const result = await completion;
                return {performed:result?.reason !== "stopped" && result?.reason !== "error", at, value, text};
            }
            return {performed:false, reason:valid()?"deadline-missed":"cancelled"};
        }
    }
    globalThis.ToneReferencedAnnouncement = ToneReferencedAnnouncement;
})();
