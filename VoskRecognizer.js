/* Single-decoder Vosk adapter. Capture belongs to SpeechMenu's worklet;
 * decoder endpoints are source spans, never application command boundaries. */
(() => {
    "use strict";
    class VoskRecognizer extends EventTarget {
        static #runtimeLoads = new Map();
        #model; #ownsModel = false; #decoder; #collector;
        #id; #generation = 0; #slot = 0; #queue = Promise.resolve();
        #closed = false; #finishRequested = false; #finishing = false;
        #pendingAudio = 0; #finalResolve; #lastPartial;
        get transcriptMode() { return "cumulative"; }
        constructor({model, modelUrl, runtimeUrl, sampleRate = 16000,
            modelLoadTimeoutMilliseconds = 120000, finalTimeoutMilliseconds = 5000,
            getCollectionSession} = {}) {
            super();
            if (sampleRate !== 16000) throw Error("Vosk requires the 16 kHz SpeechAudioWorklet pipeline.");
            if (!Number.isFinite(finalTimeoutMilliseconds) || finalTimeoutMilliseconds <= 0)
                throw RangeError("Vosk final result timeout must be positive.");
            this.sampleRate = sampleRate;
            this.finalTimeoutMilliseconds = finalTimeoutMilliseconds;
            this.getCollectionSession = getCollectionSession;
            this.ready = (async () => {
                if (model) this.#model = model;
                else {
                    if (runtimeUrl && typeof globalThis.Vosk?.createModel !== "function") {
                        this.dispatchEvent(new CustomEvent("status", {detail:{status:"loading-runtime"}}));
                        await VoskRecognizer.#loadRuntime(runtimeUrl);
                    }
                    if (!modelUrl || typeof globalThis.Vosk?.createModel !== "function")
                        throw Error("Configure WMOF_VOSK_CONFIG.modelUrl and load vosk-browser before starting speech.");
                    this.dispatchEvent(new CustomEvent("status", {detail:{status:"loading-model"}}));
                    this.#model = await VoskRecognizer.#loadModel(modelUrl, modelLoadTimeoutMilliseconds);
                    this.#ownsModel = true;
                }
                if (this.#closed && this.#ownsModel) this.#model.terminate();
                return this;
            })();
        }
        static #loadRuntime(url) {
            if (!this.#runtimeLoads.has(url)) {
                const loading = new Promise((resolve, reject) => {
                    const script = document.createElement("script");
                    const timer = setTimeout(() => failed(), 60000);
                    const failed = () => {
                        clearTimeout(timer); script.remove();
                        reject(new Error("Failed to load the configured Vosk runtime."));
                    };
                    script.src = url;
                    script.async = true;
                    script.onerror = failed;
                    script.onload = () => {
                        clearTimeout(timer);
                        if (typeof globalThis.Vosk?.createModel !== "function") failed();
                        else resolve();
                    };
                    document.head.append(script);
                }).catch(error => { this.#runtimeLoads.delete(url); throw error; });
                this.#runtimeLoads.set(url, loading);
            }
            return this.#runtimeLoads.get(url);
        }

        static #loadModel(url, timeout) {
            // Upstream createModel waits for "load" but does not reject on
            // worker "error". Listen directly so a bad model cannot hang start.
            if (typeof globalThis.Vosk.Model !== "function") return globalThis.Vosk.createModel(url);
            return new Promise((resolve, reject) => {
                const model = new globalThis.Vosk.Model(url);
                const failed = error => {
                    clearTimeout(timer);
                    model.terminate();
                    reject(new Error(String(error.error || error.message || JSON.stringify(error))));
                };
                const timer = setTimeout(() => failed(new Error("Vosk model load timed out")), timeout);
                model.on("error", failed);
                model.on("load", message => {
                    clearTimeout(timer);
                    if (message.result) resolve(model);
                    else failed(new Error("Vosk model did not initialize"));
                });
            });
        }


        #enqueue(task) {
            const result = this.#queue.then(task);
            this.#queue = result.catch(error => this.dispatchEvent(new CustomEvent("error", {
                detail:{error, message:error.message, fatal:true, utteranceId:this.#id}
            })));
            return result;
        }
        beginUtterance(id) {
            return this.#enqueue(async () => {
                await this.ready;
                if (this.#closed) return;
                this.#collector?.cancel();
                this.#dispose();
                this.#id = id;
                this.#slot = this.#pendingAudio = 0;
                this.#finishRequested = this.#finishing = false;
                this.#lastPartial = undefined;
                this.#collector = this.getCollectionSession?.(id)?.valueCollector('vosk-segments', {id})
                    || new globalThis.SpeechValueCollector({id});
                // Omitting the grammar argument uses the model's full vocabulary.
                // There is exactly one decoder; PCM is never replayed or merged.
                const decoder = this.#decoder = new this.#model.KaldiRecognizer(this.sampleRate);
                const generation = this.#generation;
                const collector = this.#collector;
                decoder.setWords(true);
                for (const event of ['partialresult', 'result']) decoder.on(event, message => {
                    if (this.#closed || generation !== this.#generation) return;
                    const audioResponse = this.#pendingAudio > 0;
                    if (audioResponse) this.#pendingAudio--;
                    const final = this.#finishing && !audioResponse && event === 'result';
                    void this.#enqueue(() => {
                        if (this.#closed || generation !== this.#generation) return;
                        const text = message.result?.partial ?? message.result?.text ?? '';
                        if (event === 'partialresult' && text === this.#lastPartial) return;
                        this.#lastPartial = event === 'partialresult' ? text : undefined;
                        collector.update([{id:`${generation}:${this.#slot}`, text, final:event === 'result'}]);
                        if (event === 'result') this.#slot++;
                        if (final) collector.complete();
                        this.dispatchEvent(new CustomEvent('transcript', {detail:{
                            utteranceId:id, transcript:collector.transcript, isFinal:final,
                            segmentFinal:event === 'result', segments:collector.segments
                        }}));
                        if (final) this.#finalResolve?.();
                    }).catch(() => {});
                });
                decoder.on('error', message => {
                    if (!this.#closed && generation === this.#generation)
                        this.dispatchEvent(new CustomEvent('error', {detail:{fatal:true,
                            utteranceId:id, message:String(message.error || 'Vosk decoder failed')}}));
                });
            });
        }
        accept(id, samples) {
            const pcm = new Float32Array(samples);
            return this.#enqueue(() => {
                if (this.#closed || id !== this.#id || !this.#decoder || this.#finishRequested) return false;
                this.#pendingAudio++;
                this.#decoder.acceptWaveformFloat(pcm, this.sampleRate);
                return true;
            });
        }
        async finishUtterance(id) {
            let finished, timer, resolveFinal;
            await this.#enqueue(() => {
                if (this.#closed || id !== this.#id || !this.#decoder || this.#finishRequested) return;
                this.#finishRequested = true;
                finished = new Promise((resolve, reject) => {
                    resolveFinal = resolve;
                    timer = setTimeout(() => reject(Error(`Vosk final result timed out (${this.#pendingAudio} audio responses pending)`)), this.finalTimeoutMilliseconds);
                });
            });
            if (!finished) return;
            const drain = async () => {
                while (!this.#closed && id === this.#id && this.#decoder) {
                    const ready = await this.#enqueue(() => {
                        if (this.#closed || id !== this.#id || !this.#decoder) {resolveFinal(); return true;}
                        if (this.#pendingAudio) return false;
                        this.#finishing = true;
                        this.#finalResolve = resolveFinal;
                        this.#decoder.retrieveFinalResult();
                        return true;
                    });
                    if (ready) return;
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                resolveFinal();
            };
            try {await Promise.race([finished, drain().then(() => finished)]);}
            catch (error) {
                this.dispatchEvent(new CustomEvent('error', {detail:{error, message:error.message, fatal:true, utteranceId:id}}));
            } finally {
                clearTimeout(timer);
                await this.#enqueue(() => {
                    if (id !== this.#id) return;
                    this.#dispose();
                    this.dispatchEvent(new CustomEvent('utteranceEnded', {detail:{utteranceId:id}}));
                });
            }
        }
        abortUtterance(id) {
            return this.#enqueue(() => {
                if (id !== this.#id) return;
                this.#collector?.cancel(); this.#dispose();
            });
        }
        #dispose() {
            this.#generation++;
            this.#decoder?.remove(); this.#decoder = undefined;
            this.#finalResolve?.(); this.#finalResolve = undefined;
        }
        close() {
            this.#closed = true; this.#collector?.cancel(); this.#dispose();
            if (this.#ownsModel) this.#model?.terminate();
        }
    }
    globalThis.VoskRecognizer = VoskRecognizer;
})();
