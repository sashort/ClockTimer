/*
 * Browser adapter for the upstream PocketSphinx.js worker protocol.
 *
 * Runtime assets are intentionally configured by URL instead of copied into
 * this repository: recognizer.js, pocketsphinx.js, pocketsphinx.wasm (if used),
 * acoustic model files, and a pronunciation dictionary must be deployed as a
 * matched set. This adapter does not pretend an absent model is available.
 */
(() => {
    "use strict";

    class PocketSphinxRecognizer extends EventTarget {
        #worker;
        #workerUrl;
        #runtimeUrls;
        #config;
        #runtimeFiles;
        #runtimeFolders;
        #workerReady = false;
        #initialized = false;
        #readyResolve;
        #readyReject;
        #readyPromise;
        #pending = new Map();
        #nextId = 1;
        #grammarIds = new Map();
        #activeGrammar = null;
        #activeUtteranceId = null;
        #activeStarted = false;
        #speechQueue = Promise.resolve();
        #closed = false;
        #audioContext;
        #mediaStream;
        #source;
        #processor;
        #sink;
        #sampleRate = 16000;
        #sampleBuffer = [];
        #maxBatchSamples = 2048;
        #lastHypothesis = "";

        constructor({
            workerUrl,
            runtimeUrls = {},
            config = [],
            runtimeFiles = [],
            runtimeFolders = [],
            sampleRate = 16000,
            maxBatchSamples = 2048
        } = {}) {
            super();
            if (!workerUrl) {
                throw new TypeError("PocketSphinxRecognizer requires workerUrl.");
            }
            if (typeof Worker !== "function") {
                throw new Error("Web Workers are not supported in this browser.");
            }

            this.#workerUrl = workerUrl;
            this.#runtimeUrls = runtimeUrls;
            this.#config = config;
            // PocketSphinx.js loads external dictionary/model files into its
            // virtual filesystem before initialize() can reference them.
            this.#runtimeFiles = runtimeFiles;
            this.#runtimeFolders = runtimeFolders;
            this.#sampleRate = sampleRate;
            this.#maxBatchSamples = maxBatchSamples;
            this.#readyPromise = new Promise((resolve, reject) => {
                this.#readyResolve = resolve;
                this.#readyReject = reject;
            });
            this.#worker = new Worker(workerUrl);
            this.#worker.addEventListener("message", this.#onWorkerMessage);
            this.#worker.addEventListener("error", this.#onWorkerError);

            this.#worker.postMessage({
                "pocketsphinx.js": runtimeUrls.pocketsphinxJs,
                "pocketsphinx.wasm": runtimeUrls.pocketsphinxWasm
            });
        }

        get ready() {
            return this.#readyPromise;
        }

        get activeGrammar() {
            return this.#activeGrammar;
        }

        #onWorkerError = event => {
            const error = new Error(event.message || "PocketSphinx worker failed.");
            this.dispatchEvent(new CustomEvent("error", { detail: { error, fatal: true } }));
            this.#readyReject?.(error);
            this.#rejectPending(error);
        };

        #onWorkerMessage = event => {
            const message = event.data || {};
            if (!this.#workerReady && !("command" in message) && !("status" in message)) {
                this.#workerReady = true;
                this.dispatchEvent(new Event("runtimeReady"));
                void this.#loadRuntimeAssetsAndInitialize();
                return;
            }

            if (message.status === "error") {
                const error = new Error(
                    "PocketSphinx " + (message.command || "runtime") +
                    " failed: " + (message.code || "unknown error")
                );
                const pending = this.#pending.get(message.id);
                if (pending) {
                    this.#pending.delete(message.id);
                    pending.reject(error);
                }
                this.dispatchEvent(new CustomEvent("error", {
                    detail: {
                        error,
                        fatal: ["initialize", "load"].includes(message.command),
                        command: message.command,
                        code: message.code
                    }
                }));
                if (!this.#initialized) this.#readyReject?.(error);
                return;
            }

            if (message.status === "done" && message.command === "initialize") {
                this.#initialized = true;
                this.dispatchEvent(new Event("ready"));
                this.#readyResolve?.(this);
                this.#readyResolve = null;
                this.#readyReject = null;
            }

            if (message.id !== undefined && this.#pending.has(message.id)) {
                const pending = this.#pending.get(message.id);
                this.#pending.delete(message.id);
                pending.resolve(message.data);
            }

            if (typeof message.hyp === "string") {
                const transcript = message.hyp.trim().toLocaleLowerCase();
                const isFinal = Boolean(message.final);
                // A final message must be delivered even when its text is
                // identical to the last streaming hypothesis; consumers use
                // the final boundary to commit the utterance.
                if (transcript !== this.#lastHypothesis || isFinal) {
                    this.#lastHypothesis = transcript;
                    this.dispatchEvent(new CustomEvent("transcript", {
                        detail: {
                            transcript,
                            utteranceId: this.#activeUtteranceId,
                            isFinal,
                            segments: Array.isArray(message.hypseg) ? message.hypseg : []
                        }
                    }));
                }
            }
        };

        async #loadRuntimeAssetsAndInitialize() {
            try {
                if (this.#runtimeFiles.length || this.#runtimeFolders.length) {
                    await this.#request("lazyLoad", {
                        folders: this.#runtimeFolders.map(item => [...item]),
                        files: this.#runtimeFiles.map(item => [...item])
                    });
                }
                if (this.#closed) return;
                await this.#request("initialize", this.#config);
            } catch (error) {
                this.#readyReject?.(error);
                this.dispatchEvent(new CustomEvent("error", {
                    detail: { error, fatal: true, command: "initialize" }
                }));
            }
        }

        #rejectPending(error) {
            for (const pending of this.#pending.values()) pending.reject(error);
            this.#pending.clear();
        }

        #request(command, data) {
            if (this.#closed) return Promise.reject(new Error("Recognizer is closed."));
            const callbackId = this.#nextId++;
            return new Promise((resolve, reject) => {
                this.#pending.set(callbackId, { resolve, reject });
                this.#worker.postMessage({ command, data, callbackId });
            });
        }

        async registerWords(pronunciations) {
            await this.ready;
            const words = Object.entries(pronunciations || {}).map(([word, pronunciation]) => [
                String(word).toLocaleUpperCase(),
                String(pronunciation)
            ]);
            if (!words.length) return;
            await this.#request("addWords", words);
        }

        async addGrammar(name, grammar) {
            await this.ready;
            const id = await this.#request("addGrammar", {
                start: grammar.start,
                end: grammar.end,
                numStates: grammar.numStates,
                transitions: grammar.transitions.map(transition => ({ ...transition }))
            });
            this.#grammarIds.set(name, id);
            return id;
        }

        async start(grammarName = "commands", utteranceId = null) {
            await this.ready;
            const id = this.#grammarIds.get(grammarName);
            if (!Number.isInteger(id)) {
                throw new Error("Unknown PocketSphinx grammar: " + grammarName);
            }
            this.#activeGrammar = grammarName;
            this.#activeUtteranceId = utteranceId;
            this.#sampleBuffer.length = 0;
            this.#lastHypothesis = "";
            this.#worker.postMessage({ command: "start", data: id });
            this.#activeStarted = true;
        }

        switchGrammar(grammarName) {
            if (!this.#grammarIds.has(grammarName)) {
                throw new Error("Unknown PocketSphinx grammar: " + grammarName);
            }
            // The upstream protocol switches on the next start(), so stop and
            // restart at a caller-controlled utterance boundary.
            this.#activeGrammar = grammarName;
        }

        async stop() {
            if (!this.#workerReady || this.#closed || !this.#activeStarted) return;
            this.#flushSamples();
            this.#worker.postMessage({ command: "stop" });
            this.#activeStarted = false;
        }

        /*
         * SpeechMenu compatibility. Audio frames are serialized with utterance
         * starts/stops so the worker never receives process() before start().
         */
        accept(utteranceId, samples, sourceSampleRate = this.#sampleRate, grammarName = "commands") {
            if (this.#closed) return false;
            this.#speechQueue = this.#speechQueue.then(async () => {
                if (this.#activeUtteranceId !== utteranceId || !this.#activeStarted) {
                    if (this.#activeStarted) await this.stop();
                    await this.start(grammarName, utteranceId);
                }
                this.acceptAudioFrame(samples, sourceSampleRate);
            }).catch(error => {
                this.dispatchEvent(new CustomEvent("error", {
                    detail: { error, message: error?.message, fatal: true, utteranceId }
                }));
            });
            return this.#speechQueue;
        }

        async finishUtterance(utteranceId) {
            this.#speechQueue = this.#speechQueue.then(async () => {
                if (this.#activeUtteranceId === utteranceId) await this.stop();
            });
            return this.#speechQueue;
        }

        async abortUtterance(utteranceId) {
            this.#speechQueue = this.#speechQueue.then(async () => {
                if (this.#activeUtteranceId === utteranceId) await this.stop();
            });
            return this.#speechQueue;
        }

        async endUtterance() {
            return this.finishUtterance(this.#activeUtteranceId);
        }

        /*
         * Accept frames from an existing capture pipeline (such as
         * SpeechAudioWorklet) instead of opening a second microphone graph.
         * Samples are Float32 in [-1, 1], at the supplied source rate.
         */
        acceptAudioFrame(samples, sourceSampleRate) {
            if (this.#closed) return false;
            if (!this.#workerReady || !this.#initialized) {
                throw new Error("PocketSphinx runtime is not ready.");
            }
            if (!(samples instanceof Float32Array) || samples.length === 0) {
                return false;
            }
            const inputRate = Number(sourceSampleRate);
            if (!Number.isFinite(inputRate) || inputRate <= 0) {
                throw new TypeError("A valid source sample rate is required.");
            }

            const pcm = this.#resampleToInt16(samples, inputRate, this.#sampleRate);
            for (const sample of pcm) this.#sampleBuffer.push(sample);
            while (this.#sampleBuffer.length >= this.#maxBatchSamples) {
                const batch = this.#sampleBuffer.splice(0, this.#maxBatchSamples);
                this.#worker.postMessage({ command: "process", data: batch });
            }
            return true;
        }

        async attachMicrophone(stream, { audioContext } = {}) {
            if (!stream || typeof stream.getAudioTracks !== "function") {
                throw new TypeError("attachMicrophone requires a MediaStream.");
            }
            if (this.#processor) throw new Error("A microphone is already attached.");
            const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
            if (!AudioContextCtor) throw new Error("Web Audio is not supported.");

            this.#mediaStream = stream;
            this.#audioContext = audioContext || new AudioContextCtor();
            if (this.#audioContext.state === "suspended") await this.#audioContext.resume();

            this.#source = this.#audioContext.createMediaStreamSource(stream);
            const size = 4096;
            this.#processor = this.#audioContext.createScriptProcessor(size, 1, 1);
            this.#sink = this.#audioContext.createGain();
            this.#sink.gain.value = 0;
            this.#processor.addEventListener("audioprocess", event => {
                const input = event.inputBuffer.getChannelData(0);
                const pcm = this.#resampleToInt16(input, this.#audioContext.sampleRate, this.#sampleRate);
                for (const sample of pcm) this.#sampleBuffer.push(sample);
                while (this.#sampleBuffer.length >= this.#maxBatchSamples) {
                    const batch = this.#sampleBuffer.splice(0, this.#maxBatchSamples);
                    this.#worker.postMessage({ command: "process", data: batch });
                }
            });
            this.#source.connect(this.#processor);
            this.#processor.connect(this.#sink);
            this.#sink.connect(this.#audioContext.destination);
            return this;
        }

        #resampleToInt16(input, inputRate, outputRate) {
            if (inputRate === outputRate) {
                return Array.from(input, sample => this.#toInt16(sample));
            }
            const ratio = inputRate / outputRate;
            const outputLength = Math.floor(input.length / ratio);
            const output = new Array(outputLength);
            for (let i = 0; i < outputLength; i++) {
                const position = i * ratio;
                const left = Math.floor(position);
                const right = Math.min(left + 1, input.length - 1);
                const fraction = position - left;
                output[i] = this.#toInt16(input[left] * (1 - fraction) + input[right] * fraction);
            }
            return output;
        }

        #toInt16(sample) {
            const clipped = Math.max(-1, Math.min(1, sample));
            return clipped < 0 ? Math.round(clipped * 32768) : Math.round(clipped * 32767);
        }

        #flushSamples() {
            if (!this.#sampleBuffer.length || this.#closed) return;
            this.#worker.postMessage({ command: "process", data: this.#sampleBuffer.splice(0) });
        }

        async detachMicrophone() {
            try { this.#source?.disconnect(); } catch {}
            try { this.#processor?.disconnect(); } catch {}
            try { this.#sink?.disconnect(); } catch {}
            this.#source = null;
            this.#processor = null;
            this.#sink = null;
            if (this.#audioContext && !this.#audioContext.close) {
                this.#audioContext = null;
            } else if (this.#audioContext) {
                try { await this.#audioContext.close(); } catch {}
                this.#audioContext = null;
            }
            this.#mediaStream = null;
            this.#sampleBuffer.length = 0;
        }

        async close() {
            if (this.#closed) return;
            this.#closed = true;
            await this.detachMicrophone();
            this.#worker.removeEventListener("message", this.#onWorkerMessage);
            this.#worker.removeEventListener("error", this.#onWorkerError);
            this.#worker.terminate();
            this.#rejectPending(new Error("Recognizer closed."));
        }
    }

    globalThis.PocketSphinxRecognizer = PocketSphinxRecognizer;
})();
