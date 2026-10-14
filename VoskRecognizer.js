/* vosk-browser adapter for SpeechMenu's existing 16 kHz worklet/VAD pipeline.
 * Runtime/model URLs are configured by the deployment, never silently replaced
 * by an unconstrained recognizer. Decoder replacement is an internal boundary. */
(() => {
    "use strict";
    class VoskRecognizer extends EventTarget {
        #model;
        #ownsModel = false;
        #decoder;
        #router;
        #id;
        #generation = 0;
        #queue = Promise.resolve();
        #overlap = new Float32Array();
        #signature = "";
        #closed = false;
        #finishing = false;
        #finalResolve;
        #segment = "";
        #lastText = "";
        #pendingAudio = 0;
        #seed = "";
        #reportedOmissions = 0;

        constructor({ model, modelUrl, sampleRate = 16000, overlapMilliseconds = 320,
            finalTimeoutMilliseconds = 5000, contextProvider, ...routerOptions } = {}) {
            super();
            if (sampleRate !== 16000) throw new Error("Vosk requires the 16 kHz SpeechAudioWorklet pipeline.");
            if (typeof contextProvider !== "function") throw new Error("Vosk requires a SpeechMenu context provider.");
            this.sampleRate = sampleRate;
            this.overlapSamples = Math.round(sampleRate * Math.max(0, Math.min(1000, overlapMilliseconds)) / 1000);
            this.finalTimeoutMilliseconds = finalTimeoutMilliseconds;
            this.contextProvider = contextProvider;
            this.routerOptions = routerOptions;
            this.ready = (async () => {
                if (model) this.#model = model;
                else {
                    if (!modelUrl || typeof globalThis.Vosk?.createModel !== "function")
                        throw new Error("Configure WMOF_VOSK_CONFIG.modelUrl and load vosk-browser before starting speech.");
                    this.#model = await globalThis.Vosk.createModel(modelUrl);
                    this.#ownsModel = true;
                }
                if (this.#closed && this.#ownsModel) this.#model.terminate();
                return this;
            })();
        }

        #enqueue(task) {
            const result = this.#queue.then(task);
            this.#queue = result.catch(error => {
                this.dispatchEvent(new CustomEvent("error", {detail: {error, message: error.message, fatal: true, utteranceId: this.#id}}));
            });
            return result;
        }

        beginUtterance(id) {
            return this.#enqueue(async () => {
                await this.ready;
                if (this.#closed) return;
                this.#dispose();
                this.#id = id;
                this.#overlap = new Float32Array();
                this.#segment = this.#lastText = "";
                this.#finishing = false;
                this.#reportedOmissions = 0;
                const context = await this.contextProvider(id);
                this.#router = new globalThis.VoskGrammarRouter({
                    valuePhrases: globalThis.VoskGrammarRouter.valuePhrases(),
                    ...this.routerOptions, ...context,
                    nextRecords: async text => (await this.contextProvider(id, text)).records
                });
                this.#replace(false);
            });
        }

        #replace(replay) {
            const phrases = this.#router.phrases;
            if (!phrases.length) throw new Error("No supported active Vosk command grammar.");
            if (this.#router.unsupported.length > this.#reportedOmissions) {
                this.dispatchEvent(new CustomEvent("status", {detail: {
                    status: "grammar-omissions", utteranceId: this.#id,
                    unsupported: this.#router.unsupported.slice(this.#reportedOmissions)
                }}));
                this.#reportedOmissions = this.#router.unsupported.length;
            }
            this.#dispose();
            // Preserve any next-stage words already recognized by the old
            // decoder. They may lie before the short replay window.
            this.#seed = replay ? this.#router.text : "";
            this.#signature = JSON.stringify([this.#router.prefix, phrases]);
            const generation = this.#generation;
            const decoder = this.#decoder = new this.#model.KaldiRecognizer(this.sampleRate, JSON.stringify(phrases));
            this.#segment = "";
            this.#pendingAudio = 0;
            decoder.setWords(true);
            for (const event of ["partialresult", "result"]) decoder.on(event, message => {
                if (generation !== this.#generation || this.#closed) return;
                // vosk-browser uses "result" for both audio endpoints and
                // retrieveFinalResult. Each submitted audio chunk produces one
                // response; drain those before treating a result as final.
                const audioResponse = this.#pendingAudio > 0;
                if (audioResponse) this.#pendingAudio--;
                const final = this.#finishing && !audioResponse && event === "result";
                void this.#enqueue(async () => {
                    if (generation !== this.#generation || this.#closed) return;
                    const text = message.result?.partial ?? message.result?.text ?? "";
                    const stageText = this.#mergeSeed([this.#segment, text].filter(Boolean).join(" "));
                    const prefix = this.#router.prefix;
                    const routed = await this.#router.update(stageText);
                    if (generation !== this.#generation || this.#closed) return;
                    this.#lastText = routed.transcript;
                    this.dispatchEvent(new CustomEvent("transcript", {detail: {
                        utteranceId: this.#id, transcript: this.#lastText, isFinal: final
                    }}));
                    if (final) { this.#finalResolve?.(); return; }
                    if (!this.#finishing && JSON.stringify([this.#router.prefix, routed.phrases]) !== this.#signature) {
                        // Replacement caused by a projected vocabulary update
                        // also replays audio; the old decoder is fenced out.
                        this.#replace(true);
                        this.dispatchEvent(new CustomEvent("status", {detail: {
                            status: "grammar-switch", grammar: routed.grammar, utteranceId: this.#id,
                            replaySamples: this.#overlap.length, prefix: this.#router.prefix
                        }}));
                    } else if (event === "result" && this.#router.prefix === prefix) {
                        this.#segment = stageText;
                        this.#seed = "";
                    }
                }).catch(() => {});
            });
            decoder.on("error", message => {
                if (generation === this.#generation) this.dispatchEvent(new CustomEvent("error", {
                    detail: {fatal: true, message: String(message.error || "Vosk decoder failed"), utteranceId: this.#id}
                }));
            });
            if (replay && this.#overlap.length) {
                this.#pendingAudio++;
                decoder.acceptWaveformFloat(this.#overlap.slice(), this.sampleRate);
            }
        }

        #mergeSeed(text) {
            if (!this.#seed) return text;
            const seed = this.#seed.split(" ").filter(Boolean);
            const words = text.split(" ").filter(Boolean);
            // This overlap is only the carried, uncommitted next-stage text,
            // never the committed prefix (which can contain repeated digits).
            for (let count = Math.min(seed.length, words.length); count > 0; count--) {
                if (seed.slice(-count).join(" ") === words.slice(0, count).join(" "))
                    return [...seed, ...words.slice(count)].join(" ");
            }
            return [...seed, ...words].join(" ");
        }

        accept(id, samples) {
            // Copy before queuing: worklet buffers may be reused/transferred.
            const pcm = new Float32Array(samples);
            return this.#enqueue(() => {
                if (this.#closed || id !== this.#id || this.#finishing || !this.#decoder) return false;
                const combined = new Float32Array(this.#overlap.length + pcm.length);
                combined.set(this.#overlap); combined.set(pcm, this.#overlap.length);
                this.#overlap = combined.slice(Math.max(0, combined.length - this.overlapSamples));
                this.#pendingAudio++;
                this.#decoder.acceptWaveformFloat(pcm, this.sampleRate);
                return true;
            });
        }

        async finishUtterance(id) {
            let finished, timer;
            await this.#enqueue(() => {
                if (id !== this.#id || !this.#decoder || this.#finishing) return;
                this.#finishing = true;
                finished = new Promise((resolve, reject) => {
                    this.#finalResolve = resolve;
                    timer = setTimeout(() => reject(new Error("Vosk final result timed out")), this.finalTimeoutMilliseconds);
                });
                this.#decoder.retrieveFinalResult();
            });
            if (!finished) return;
            try { await finished; }
            catch (error) {
                this.dispatchEvent(new CustomEvent("error", {detail: {error, message: error.message, fatal: true, utteranceId: id}}));
            } finally {
                clearTimeout(timer);
                await this.#enqueue(() => {
                    if (id !== this.#id) return;
                    this.#dispose();
                    this.dispatchEvent(new CustomEvent("utteranceEnded", {detail: {utteranceId: id}}));
                });
            }
        }

        abortUtterance(id) {
            return this.#enqueue(() => { if (id === this.#id) { this.#dispose(); this.#overlap = new Float32Array(); } });
        }
        #dispose() { this.#generation++; this.#decoder?.remove(); this.#decoder = undefined; this.#finalResolve?.(); this.#finalResolve = undefined; }
        close() { this.#closed = true; this.#dispose(); if (this.#ownsModel) this.#model?.terminate(); }
    }
    globalThis.VoskRecognizer = VoskRecognizer;
})();
