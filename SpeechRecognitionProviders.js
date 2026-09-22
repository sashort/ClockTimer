(() => {
    "use strict";

    class BrowserSpeechProvider {
        #Recognition;
        #language = "en-US";
        #micTrack;
        #utterances = new Map();

        constructor({
            Recognition =
                globalThis.SpeechRecognition ||
                globalThis.webkitSpeechRecognition
        } = {}) {
            this.#Recognition = Recognition;
        }

        get kind() { return "browser"; }
        get supported() { return typeof this.#Recognition === "function"; }

        async start({language = "en-US", micTrack} = {}) {
            if (!this.supported) {
                throw new DOMException(
                    "Speech recognition is not supported by this browser.",
                    "NotSupportedError"
                );
            }

            if (!micTrack) {
                throw new DOMException(
                    "A persistent microphone track is required.",
                    "NotSupportedError"
                );
            }

            this.#language = language;
            this.#micTrack = micTrack;
            return true;
        }

        async stop() {
            for (const id of [...this.#utterances.keys()]) {
                this.cancelUtterance(id);
            }
            this.#micTrack = undefined;
        }

        startUtterance({
            id,
            onTranscript,
            onError
        } = {}) {
            if (!this.supported || !this.#micTrack) return false;

            const state = {
                id,
                stopped: false,
                recognition: undefined,
                prefix: "",
                lastTranscript: "",
                onTranscript,
                onError
            };

            this.#utterances.set(id, state);

            const startRecognition = () => {
                if (
                    state.stopped ||
                    this.#utterances.get(id) !== state
                ) {
                    return;
                }

                const recognition = new this.#Recognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = this.#language;
                state.recognition = recognition;

                recognition.onresult = event => {
                    let sessionText = "";
                    let allFinal = true;

                    for (
                        let index = 0;
                        index < event.results.length;
                        index++
                    ) {
                        const result = event.results[index];
                        const value = result?.[0]?.transcript;

                        if (value) {
                            sessionText +=
                                `${sessionText ? " " : ""}${value}`;
                        }

                        if (!result?.isFinal) {
                            allFinal = false;
                        }
                    }

                    const text =
                        `${state.prefix || ""} ${sessionText}`
                            .trim();

                    if (text) {
                        state.lastTranscript =
                            text;

                        state.onTranscript?.({
                            id,
                            text,
                            isFinal: allFinal
                        });
                    }
                };

                recognition.onerror = event => {
                    if (
                        event.error === "aborted" ||
                        event.error === "no-speech"
                    ) {
                        return;
                    }

                    state.onError?.({
                        id,
                        error: event.error,
                        message: event.message
                    });
                };

                recognition.onend = () => {
                    if (state.recognition !== recognition) return;
                    state.recognition = undefined;

                    if (
                        state.stopped ||
                        this.#utterances.get(id) !== state
                    ) {
                        return;
                    }

                    state.prefix =
                        state.lastTranscript ||
                        state.prefix;

                    queueMicrotask(startRecognition);
                };

                try {
                    recognition.start(this.#micTrack);
                }
                catch (error) {
                    state.recognition = undefined;
                    state.stopped = true;
                    this.#utterances.delete(id);
                    state.onError?.({
                        id,
                        error:
                            error?.name ||
                            "TrackInputUnsupported",
                        message:
                            error?.message ||
                            "Live speech recognition could not start from the persistent microphone track."
                    });
                }
            };

            startRecognition();
            return state;
        }

        setUtterancePrefix() {
            // Prefixes advance only when a browser recognition session ends.
        }

        endUtterance(id) {
            const state = this.#utterances.get(id);
            if (!state) return;

            state.stopped = true;
            this.#utterances.delete(id);

            const recognition = state.recognition;
            state.recognition = undefined;

            try { recognition?.abort(); } catch {}
        }

        cancelUtterance(id) {
            this.endUtterance(id);
        }

        pushAudio() {
            // Browser SpeechRecognition consumes the persistent mic track directly.
        }

        async recognizeBuffer({
            id,
            audioBuffer,
            audioContext,
            onError
        } = {}) {
            if (!this.supported || !audioBuffer || !audioContext) {
                return "";
            }

            const destination =
                audioContext.createMediaStreamDestination();

            const bufferSource =
                audioContext.createBufferSource();

            bufferSource.buffer = audioBuffer;
            bufferSource.connect(destination);

            const replayTrack =
                destination.stream.getAudioTracks()[0];

            if (!replayTrack) {
                onError?.({
                    id,
                    error: "AudioTrackError",
                    message:
                        "Unable to create an in-memory recognition audio track."
                });
                return "";
            }

            const recognition = new this.#Recognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = this.#language;

            let finalText = "";

            await new Promise(resolve => {
                let settled = false;
                let safetyTimer;

                const finish = () => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(safetyTimer);

                    try { replayTrack.stop(); } catch {}
                    try { bufferSource.disconnect(); } catch {}
                    resolve();
                };

                recognition.onresult = event => {
                    for (
                        let index = event.resultIndex;
                        index < event.results.length;
                        index++
                    ) {
                        const result = event.results[index];
                        if (!result.isFinal) continue;

                        const text =
                            String(result[0]?.transcript || "").trim();

                        if (text) {
                            finalText +=
                                `${finalText ? " " : ""}${text}`;
                        }
                    }
                };

                recognition.onerror = event => {
                    if (event.error !== "aborted") {
                        onError?.({
                            id,
                            error: event.error,
                            message: event.message
                        });
                    }
                };

                recognition.onend = finish;

                try {
                    recognition.start(replayTrack);
                }
                catch (error) {
                    onError?.({
                        id,
                        error:
                            error?.name ||
                            "TrackInputUnsupported",
                        message:
                            error?.message ||
                            "This browser does not accept a supplied audio track for speech recognition."
                    });
                    finish();
                    return;
                }

                bufferSource.addEventListener(
                    "ended",
                    () => {
                        setTimeout(() => {
                            try { recognition.stop(); } catch {}
                        }, 250);
                    },
                    {once: true}
                );

                bufferSource.start();

                safetyTimer = setTimeout(
                    () => {
                        try { recognition.abort(); } catch {}
                        finish();
                    },
                    Math.max(
                        3500,
                        audioBuffer.duration * 1000 + 3000
                    )
                );
            });

            return finalText;
        }
    }

    class StreamingSpeechProvider {
        #url;
        #socket;
        #language = "en-US";
        #sessionId;
        #openPromise;
        #utterances = new Map();
        #sequence = new Map();

        constructor({
            url = (() => {
                const protocol =
                    location.protocol === "https:"
                        ? "wss:"
                        : "ws:";
                return `${protocol}//${location.host}/api/speech/stream`;
            })()
        } = {}) {
            this.#url = url;
        }

        get kind() { return "streaming"; }
        get supported() { return typeof WebSocket === "function"; }

        async start({language = "en-US", sessionId} = {}) {
            if (!this.supported) {
                throw new DOMException(
                    "WebSocket speech streaming is not supported.",
                    "NotSupportedError"
                );
            }

            this.#language = language;
            this.#sessionId =
                sessionId ||
                `${Date.now()}-${Math.random().toString(36).slice(2)}`;

            await this.#connect();
            this.#sendControl({
                type: "session-start",
                sessionId: this.#sessionId,
                language: this.#language,
                audio: {
                    encoding: "pcm_s16le",
                    sampleRate: 16000,
                    channels: 1
                }
            });

            return true;
        }

        async stop() {
            for (const id of [...this.#utterances.keys()]) {
                this.cancelUtterance(id);
            }

            if (
                this.#socket &&
                this.#socket.readyState === WebSocket.OPEN
            ) {
                this.#sendControl({
                    type: "session-end",
                    sessionId: this.#sessionId
                });
                this.#socket.close(1000, "session ended");
            }

            this.#socket = undefined;
            this.#openPromise = undefined;
            this.#sessionId = undefined;
        }

        startUtterance({
            id,
            onTranscript,
            onError
        } = {}) {
            if (
                !this.#socket ||
                this.#socket.readyState !== WebSocket.OPEN
            ) {
                return false;
            }

            this.#utterances.set(id, {
                onTranscript,
                onError
            });
            this.#sequence.set(id, 0);

            this.#sendControl({
                type: "utterance-start",
                sessionId: this.#sessionId,
                utteranceId: id
            });

            return true;
        }

        pushAudio({id, pcm} = {}) {
            if (
                !this.#utterances.has(id) ||
                !this.#socket ||
                this.#socket.readyState !== WebSocket.OPEN
            ) {
                return false;
            }

            const samples =
                pcm instanceof Int16Array
                    ? pcm
                    : new Int16Array(pcm || 0);

            if (!samples.length) return false;

            const sequence =
                this.#sequence.get(id) || 0;

            this.#sequence.set(id, sequence + 1);

            const packet =
                new ArrayBuffer(
                    8 + samples.byteLength
                );

            const header = new DataView(packet);
            header.setUint32(0, id >>> 0, true);
            header.setUint32(4, sequence >>> 0, true);

            new Int16Array(packet, 8)
                .set(samples);

            this.#socket.send(packet);
            return true;
        }

        endUtterance(id, reason = "silence") {
            if (!this.#utterances.has(id)) return;

            this.#sendControl({
                type: "utterance-end",
                sessionId: this.#sessionId,
                utteranceId: id,
                reason
            });
        }

        cancelUtterance(id) {
            if (!this.#utterances.has(id)) return;

            this.#sendControl({
                type: "utterance-cancel",
                sessionId: this.#sessionId,
                utteranceId: id
            });

            this.#utterances.delete(id);
            this.#sequence.delete(id);
        }

        setUtterancePrefix() {
            // Server transcripts are cumulative per utterance.
        }

        async recognizeBuffer() {
            // Streaming provider already receives a server-side final transcript.
            return "";
        }

        async #connect() {
            if (
                this.#socket?.readyState === WebSocket.OPEN
            ) {
                return;
            }

            if (this.#openPromise) {
                return this.#openPromise;
            }

            this.#openPromise =
                new Promise((resolve, reject) => {
                    const socket =
                        new WebSocket(this.#url);

                    socket.binaryType = "arraybuffer";

                    socket.addEventListener(
                        "open",
                        () => resolve(),
                        {once: true}
                    );

                    socket.addEventListener(
                        "error",
                        () => reject(
                            new Error(
                                "Unable to connect to the speech streaming service."
                            )
                        ),
                        {once: true}
                    );

                    socket.addEventListener(
                        "message",
                        event => this.#onMessage(event)
                    );

                    socket.addEventListener(
                        "close",
                        event => {
                            for (const [id, utterance] of this.#utterances) {
                                utterance.onError?.({
                                    id,
                                    error: "SpeechSocketClosed",
                                    message:
                                        event.reason ||
                                        "Speech streaming connection closed."
                                });
                            }
                            this.#utterances.clear();
                            this.#sequence.clear();
                            if (this.#socket === socket) {
                                this.#socket = undefined;
                                this.#openPromise = undefined;
                            }
                        }
                    );

                    this.#socket = socket;
                });

            try {
                await this.#openPromise;
            }
            catch (error) {
                try { this.#socket?.close(); } catch {}
                this.#socket = undefined;
                this.#openPromise = undefined;
                throw error;
            }
        }

        #sendControl(message) {
            if (
                this.#socket?.readyState !== WebSocket.OPEN
            ) {
                return false;
            }

            this.#socket.send(JSON.stringify(message));
            return true;
        }

        #onMessage(event) {
            if (typeof event.data !== "string") return;

            let message;
            try {
                message = JSON.parse(event.data);
            }
            catch {
                return;
            }

            if (message.type === "ping") {
                this.#sendControl({
                    type: "pong",
                    at: message.at
                });
                return;
            }

            const id =
                Number(message.utteranceId);

            if (!Number.isInteger(id)) return;

            const utterance =
                this.#utterances.get(id);

            if (!utterance) return;

            if (
                message.type === "partial" ||
                message.type === "final"
            ) {
                utterance.onTranscript?.({
                    id,
                    text: String(message.text || ""),
                    isFinal: message.type === "final"
                });

                if (message.type === "final") {
                    this.#utterances.delete(id);
                    this.#sequence.delete(id);
                }

                return;
            }

            if (message.type === "error") {
                utterance.onError?.({
                    id,
                    error:
                        message.error ||
                        "SpeechStreamingError",
                    message:
                        message.message ||
                        "Speech streaming failed."
                });
            }
        }
    }

    globalThis.BrowserSpeechProvider =
        BrowserSpeechProvider;

    globalThis.StreamingSpeechProvider =
        StreamingSpeechProvider;
})();
