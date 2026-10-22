/* Single-decoder Vosk adapter. Capture belongs to SpeechMenu's worklet;
 * decoder endpoints are source spans, never application command boundaries. */
(() => {
    "use strict";
    class VoskRecognizer extends EventTarget {
        static #runtimeLoads = new Map();
        #model; #ownsModel = false; #decoder; #collector;
        #id; #generation = 0; #slot = 0; #queue = Promise.resolve();
        #closed = false; #finishRequested = false; #finishing = false;
        #pendingAudio = 0; #finalResolve; #drainResolve; #lastPartial;
        #queuedSamples = 0; #submittedSamples = 0; #receivedSamples = 0; #audioSizes = [];
        get audioDelivery() { return Object.freeze({receivedSamples:this.#receivedSamples,
            submittedSamples:this.#submittedSamples, queuedSamples:this.#queuedSamples}); }
        get continuousInput() { return true; }
        get transcriptMode() { return "cumulative"; }
        constructor({model, modelUrl, runtimeUrl, sampleRate = 16000,
            modelLoadTimeoutMilliseconds = 120000, finalTimeoutMilliseconds = 5000,
            getCollectionSession, maxQueuedAudioSeconds = 30} = {}) {
            super();
            if (sampleRate !== 16000) throw Error("Vosk requires the 16 kHz SpeechAudioWorklet pipeline.");
            if (!Number.isFinite(finalTimeoutMilliseconds) || finalTimeoutMilliseconds <= 0)
                throw RangeError("Vosk final result timeout must be positive.");
            if (!Number.isFinite(maxQueuedAudioSeconds) || maxQueuedAudioSeconds <= 0)
                throw RangeError("Vosk audio backlog limit must be positive.");
            this.maxQueuedSamples = Math.ceil(maxQueuedAudioSeconds * sampleRate);
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
        #ensureDecoder() {
            if (this.#decoder || this.#closed) return;
            // One full-vocabulary decoder for the whole listening session.
            const decoder = this.#decoder = new this.#model.KaldiRecognizer(this.sampleRate);
            decoder.setWords(true);
            const generation = this.#generation;
            for (const event of ['partialresult', 'result']) decoder.on(event, message => {
                if (this.#closed || generation !== this.#generation) return;
                const audioResponse = this.#pendingAudio > 0;
                if (audioResponse) {
                    this.#pendingAudio--;
                    this.#queuedSamples -= this.#audioSizes.shift() || 0;
                }
                const final = this.#finishing && !audioResponse && event === 'result';
                // Worker replies must not wait behind the boundary fence that
                // is waiting for those very replies.
                if (this.#collector) {
                    const text = message.result?.partial ?? message.result?.text ?? '';
                    if (event !== 'partialresult' || text !== this.#lastPartial) {
                        this.#lastPartial = event === 'partialresult' ? text : undefined;
                        this.#collector.update([{id:`${this.#id}:${this.#slot}`, text, final:event === 'result'}]);
                        if (event === 'result') this.#slot++;
                        if (final) this.#collector.complete();
                        this.dispatchEvent(new CustomEvent('transcript', {detail:{
                            utteranceId:this.#id, transcript:this.#collector.transcript, isFinal:final,
                            segmentFinal:event === 'result', segments:this.#collector.segments
                        }}));
                    }
                }
                if (!this.#pendingAudio) this.#drainResolve?.();
                if (final) this.#finalResolve?.();
            });
            decoder.on('error', message => {
                if (!this.#closed && generation === this.#generation)
                    this.dispatchEvent(new CustomEvent('error', {detail:{fatal:true,
                        utteranceId:this.#id, message:String(message.error || 'Vosk decoder failed')}}));
            });
        }
        beginUtterance(id) {
            return this.#enqueue(async () => {
                await this.ready;
                if (this.#closed) return;
                this.#ensureDecoder();
                // Idle audio precedes this binding. Drain it first so replies
                // cannot be mislabeled as belonging to the next utterance.
                await this.#drain();
                this.#collector?.cancel();
                this.#id = id; this.#slot = 0;
                this.#finishRequested = this.#finishing = false;
                this.#lastPartial = undefined;
                this.#collector = this.getCollectionSession?.(id)?.valueCollector('vosk-segments', {id})
                    || new globalThis.SpeechValueCollector({id});
            });
        }
        acceptAudio(samples) { return this.#accept(undefined, samples); }
        accept(id, samples) { return this.#accept(id, samples); }
        #accept(id, samples) {
            if (this.#closed) return Promise.resolve(false);
            if (this.#queuedSamples + samples.length > this.maxQueuedSamples) {
                const error = Error('Vosk decoding cannot keep up with live audio.');
                this.close();
                this.dispatchEvent(new CustomEvent('error', {detail:{error, message:error.message, fatal:true}}));
                return Promise.resolve(false);
            }
            this.#receivedSamples += samples.length;
            this.#queuedSamples += samples.length;
            const pcm = new Float32Array(samples);
            return this.#enqueue(async () => {
                await this.ready;
                if (this.#closed) return false;
                if (id !== undefined && id !== this.#id) {
                    this.#queuedSamples -= pcm.length;
                    return false;
                }
                this.#ensureDecoder();
                this.#pendingAudio++;
                this.#audioSizes.push(pcm.length);
                this.#submittedSamples += pcm.length;
                this.#decoder.acceptWaveformFloat(pcm, this.sampleRate);
                return true;
            });
        }
        #waitForResponse(register) {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(Error('Vosk worker response timed out')),
                    this.finalTimeoutMilliseconds);
                register(() => {clearTimeout(timer);resolve();});
            });
        }
        async #drain() {
            if (this.#pendingAudio)
                await this.#waitForResponse(resolve => {this.#drainResolve = resolve;});
            this.#drainResolve = undefined;
        }
        #boundary(id, publish) {
            return this.#enqueue(async () => {
                if (this.#closed || id !== this.#id || !this.#decoder) return;
                this.#finishRequested = true;
                await this.#drain();
                if (this.#closed) return;
                if (!publish) {this.#collector?.cancel();this.#collector = undefined;}
                this.#finishing = true;
                await this.#waitForResponse(resolve => {
                    this.#finalResolve = resolve;
                    this.#decoder.retrieveFinalResult();
                });
                this.#finalResolve = undefined;
                this.#finishing = this.#finishRequested = false;
                this.#collector = undefined; this.#id = undefined;
                if (publish) this.dispatchEvent(new CustomEvent('utteranceEnded', {detail:{utteranceId:id}}));
                // Silence closes only the logical continuation. The decoder,
                // worklet and microphone remain open; queued PCM follows once.
            });
        }
        finishUtterance(id) { return this.#boundary(id, true); }
        abortUtterance(id) { return this.#boundary(id, false); }
        #dispose() {
            this.#generation++;
            this.#decoder?.remove(); this.#decoder = undefined;
            this.#queuedSamples = 0; this.#audioSizes = [];
            this.#drainResolve?.(); this.#drainResolve = undefined;
            this.#finalResolve?.(); this.#finalResolve = undefined;
        }
        close() {
            this.#closed = true; this.#collector?.cancel(); this.#dispose();
            if (this.#ownsModel) this.#model?.terminate();
        }
    }
    globalThis.VoskRecognizer = VoskRecognizer;
})();
