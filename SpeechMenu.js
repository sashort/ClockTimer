class SpeechMenu {
    static #wakePhrase = /^listen$/i;
    static #sleepPhrase = /^mute$/i;
    static #stopped = true;
    static #sleeping = false;
    static #recognitionProviderMode = "browser";
    static #recognitionProvider;
    static #recognitionContext = Object.freeze({
        vocabulary: Object.freeze([]),
        options: Object.freeze({}),
        phrases: Object.freeze([]),
        numbers: Object.freeze({output: "digits"})
    });
    static #events = new EventTarget();
    static #separator = ",";
    static #language = "en-US";
    static #silenceTimeout = 5000;
    static #commitSilenceTimeout = 350;
    static #streamingSilenceTimeout = 650;
    static #speechThreshold = 0.01;
    static #preRollMilliseconds = 350;
    static #stream;
    static #micTrack;
    static #audioContext;
    static #sourceNode;
    static #processorNode;
    static #silentGain;
    static #utterance;
    static #utteranceSequence = 0;
    static #preRollFrames = [];
    static #preRollSamples = 0;
    static #recognitionQueue = Promise.resolve();
    static #startPromise;
    static #sessionGeneration = 0;
    static #lastLevelEventAt = 0;
    static #debug = false;
    static #debugFunction = data => console.log(data);

    static {
        document.addEventListener("visibilitychange", () => {
            if (
                document.visibilityState === "visible" &&
                SpeechMenu.#audioContext?.state === "suspended"
            ) {
                void SpeechMenu.#audioContext.resume().catch(() => {});
            }
        });
    }

    static get events() { return SpeechMenu.#events; }
    static get wakePhrase() { return SpeechMenu.#wakePhrase; }
    static get sleepPhrase() { return SpeechMenu.#sleepPhrase; }
    static get debug() { return SpeechMenu.#debug; }
    static get debugFunction() { return SpeechMenu.#debugFunction; }
    static get silenceTimeout() { return SpeechMenu.#silenceTimeout; }
    static get commitSilenceTimeout() { return SpeechMenu.#commitSilenceTimeout; }
    static get started() { return Boolean(SpeechMenu.#stream) && !SpeechMenu.#stopped; }
    static get muted() { return SpeechMenu.#sleeping; }
    static get recognitionProvider() { return SpeechMenu.#recognitionProviderMode; }
    static get recognitionContext() {
        return SpeechMenu.#copyRecognitionContext();
    }

    static set recognitionContext(value) {
        SpeechMenu.setRecognitionContext(value);
    }

    static setRecognitionContext(value = {}) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new TypeError("SpeechMenu recognition context must be an object.");
        }

        const list = input =>
            [...new Set(
                (Array.isArray(input) ? input : [])
                    .map(item => String(item ?? "").trim())
                    .filter(Boolean)
            )];

        const options = Object.create(null);
        if (value.options && typeof value.options === "object" && !Array.isArray(value.options)) {
            for (const [name, entries] of Object.entries(value.options)) {
                const normalized = list(entries);
                if (normalized.length) options[String(name)] = Object.freeze(normalized);
            }
        }

        const output =
            String(value.numbers?.output || "digits")
                .trim()
                .toLowerCase();

        if (output !== "digits" && output !== "words") {
            throw new TypeError('SpeechMenu recognitionContext.numbers.output must be "digits" or "words".');
        }

        SpeechMenu.#recognitionContext = Object.freeze({
            vocabulary: Object.freeze(list(value.vocabulary)),
            options: Object.freeze(options),
            phrases: Object.freeze(list(value.phrases)),
            numbers: Object.freeze({output})
        });

        SpeechMenu.#recognitionProvider
            ?.setRecognitionContext?.(
                SpeechMenu.#copyRecognitionContext()
            );

        const context =
            SpeechMenu.#copyRecognitionContext();

        SpeechMenu.#emit(
            "recognitionContextChanged",
            {context}
        );

        return context;
    }

    static clearRecognitionContext() {
        return SpeechMenu.setRecognitionContext();
    }

    static set recognitionProvider(value) {
        const mode =
            String(value || "")
                .trim()
                .toLowerCase();

        if (
            mode !== "browser" &&
            mode !== "streaming"
        ) {
            throw new TypeError(
                "SpeechMenu.recognitionProvider must be \"browser\" or \"streaming\"."
            );
        }

        if (SpeechMenu.started || SpeechMenu.#startPromise) {
            throw new Error(
                "SpeechMenu.recognitionProvider cannot change while speech recognition is running."
            );
        }

        if (mode === SpeechMenu.#recognitionProviderMode) return;

        SpeechMenu.#recognitionProviderMode = mode;
        SpeechMenu.#emit(
            "recognitionProviderChanged",
            {provider: mode}
        );
    }

    static set wakePhrase(value) { SpeechMenu.#setPhrase("wake", value); }
    static set sleepPhrase(value) { SpeechMenu.#setPhrase("sleep", value); }
    static set silenceTimeout(value) {
        const milliseconds = Number(value);
        if (!Number.isFinite(milliseconds) || milliseconds < 100) {
            throw new RangeError("SpeechMenu.silenceTimeout must be at least 100 milliseconds.");
        }
        SpeechMenu.#silenceTimeout = Math.round(milliseconds);
        SpeechMenu.#emit("silenceTimeoutChanged", {
            silenceTimeout: SpeechMenu.#silenceTimeout
        });
    }
    static set commitSilenceTimeout(value) {
        const milliseconds = Number(value);
        if (!Number.isFinite(milliseconds) || milliseconds < 100) {
            throw new RangeError("SpeechMenu.commitSilenceTimeout must be at least 100 milliseconds.");
        }
        SpeechMenu.#commitSilenceTimeout = Math.round(milliseconds);
        SpeechMenu.#emit("commitSilenceTimeoutChanged", {
            commitSilenceTimeout: SpeechMenu.#commitSilenceTimeout
        });
    }
    static set debug(value) {
        const next = Boolean(value);
        if (next === SpeechMenu.#debug) return;
        SpeechMenu.#debug = next;
        SpeechMenu.#emit("debugToggled", {debug: next});
    }
    static set debugFunction(value) {
        SpeechMenu.#debugFunction =
            typeof value === "function"
                ? value
                : data => console.log(data);
        SpeechMenu.#emit("debugFunctionChanged", {
            debugFunction: SpeechMenu.#debugFunction
        });
    }

    static async start(language = "en-US", listSeparator = ",") {
        let provider;

        try {
            provider =
                SpeechMenu.#createRecognitionProvider();

            if (provider.supported === false) {
                throw new DOMException(
                    `The ${SpeechMenu.#recognitionProviderMode} speech provider is not supported by this browser.`,
                    "NotSupportedError"
                );
            }
        }
        catch (error) {
            SpeechMenu.#emit("speechRecognitionFailed", {
                error:
                    error?.name ||
                    "NotSupportedError",
                message:
                    error?.message ||
                    "Speech recognition is not supported by this browser."
            });
            return false;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            SpeechMenu.#emit("speechRecognitionFailed", {
                error: "NotSupportedError",
                message: "Microphone capture is not supported by this browser."
            });
            return false;
        }

        if (SpeechMenu.started) return true;
        if (SpeechMenu.#startPromise) return SpeechMenu.#startPromise;

        SpeechMenu.#language =
            typeof language === "string" && language.trim()
                ? language
                : "en-US";

        SpeechMenu.#separator =
            typeof listSeparator === "string" && listSeparator
                ? listSeparator
                : ",";

        SpeechMenu.#sleeping = false;
        SpeechMenu.#stopped = false;

        const generation = ++SpeechMenu.#sessionGeneration;

        SpeechMenu.#startPromise = (async () => {
            let stream;

            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });

                if (
                    SpeechMenu.#stopped ||
                    generation !== SpeechMenu.#sessionGeneration
                ) {
                    for (const track of stream.getTracks()) {
                        try { track.stop(); } catch {}
                    }
                    return false;
                }

                const AudioContextCtor =
                    window.AudioContext ||
                    window.webkitAudioContext;

                if (!AudioContextCtor) {
                    throw new Error(
                        "Web Audio is not supported by this browser."
                    );
                }

                const context =
                    new AudioContextCtor();

                if (context.state === "suspended") {
                    await context.resume();
                }

                const useAudioWorklet =
                    provider.kind ===
                    "streaming";

                if (
                    useAudioWorklet &&
                    (
                        !context.audioWorklet ||
                        typeof window.AudioWorkletNode !==
                            "function"
                    )
                ) {
                    try { await context.close(); } catch {}
                    throw new Error(
                        "Streaming speech recognition requires AudioWorklet support."
                    );
                }

                if (
                    !useAudioWorklet &&
                    typeof context.createScriptProcessor !==
                        "function"
                ) {
                    try { await context.close(); } catch {}
                    throw new Error(
                        "This browser cannot segment microphone audio without restarting capture."
                    );
                }

                SpeechMenu.#stream =
                    stream;

                SpeechMenu.#micTrack =
                    stream.getAudioTracks()[0];

                if (!SpeechMenu.#micTrack) {
                    throw new Error(
                        "No microphone audio track was available."
                    );
                }

                SpeechMenu.#audioContext =
                    context;

                SpeechMenu.#recognitionProvider =
                    provider;

                await provider.start({
                    language:
                        SpeechMenu.#language,
                    micTrack:
                        SpeechMenu.#micTrack,
                    sessionId:
                        generation,
                    recognitionContext:
                        SpeechMenu.#copyRecognitionContext()
                });

                SpeechMenu.#sourceNode =
                    context.createMediaStreamSource(
                        stream
                    );

                if (useAudioWorklet) {
                    const runtimeScript =
                        [...document.scripts]
                            .find(
                                script =>
                                    /(?:^|\/)SpeechMenu\.js(?:\?|$)/
                                        .test(script.src)
                            );

                    const version =
                        runtimeScript
                            ? new URL(
                                runtimeScript.src
                            ).search
                            : "";

                    const workletUrl =
                        new URL(
                            `SpeechAudioWorklet.js${version}`,
                            document.baseURI
                        );

                    await context.audioWorklet
                        .addModule(
                            workletUrl.href
                        );

                    SpeechMenu.#processorNode =
                        new window.AudioWorkletNode(
                            context,
                            "speech-audio-worklet"
                        );

                    SpeechMenu.#processorNode
                        .port.addEventListener(
                            "message",
                            SpeechMenu.#onWorkletMessage
                        );

                    SpeechMenu.#processorNode
                        .port.start?.();
                }
                else {
                    SpeechMenu.#processorNode =
                        context.createScriptProcessor(
                            2048,
                            Math.max(
                                1,
                                SpeechMenu.#sourceNode
                                    .channelCount || 1
                            ),
                            1
                        );

                    SpeechMenu.#processorNode
                        .addEventListener(
                            "audioprocess",
                            SpeechMenu.#onAudioProcess
                        );
                }

                SpeechMenu.#silentGain =
                    context.createGain();

                SpeechMenu.#silentGain.gain.value =
                    0;

                SpeechMenu.#sourceNode.connect(
                    SpeechMenu.#processorNode
                );

                SpeechMenu.#processorNode.connect(
                    SpeechMenu.#silentGain
                );

                SpeechMenu.#silentGain.connect(
                    context.destination
                );

                SpeechMenu.#micTrack.addEventListener(
                    "ended",
                    SpeechMenu.#onTrackEnded,
                    {once: true}
                );

                SpeechMenu.#emit("started", {
                    language:
                        SpeechMenu.#language,
                    silenceTimeout:
                        SpeechMenu.#silenceTimeout,
                    commitSilenceTimeout:
                        SpeechMenu.#commitSilenceTimeout,
                    deliberate: true
                });

                return true;
            }
            catch (error) {
                SpeechMenu.#stopped = true;

                if (
                    stream &&
                    stream !== SpeechMenu.#stream
                ) {
                    for (const track of stream.getTracks()) {
                        try { track.stop(); } catch {}
                    }
                }

                await SpeechMenu.#releaseCapture();

                SpeechMenu.#emit(
                    "speechRecognitionFailed",
                    {
                        error:
                            error?.name ||
                            "MicrophoneError",
                        message:
                            error?.message ||
                            String(error)
                    }
                );

                return false;
            }
            finally {
                SpeechMenu.#startPromise =
                    undefined;
            }
        })();

        return SpeechMenu.#startPromise;
    }

    static async stop() {
        const wasActive =
            !SpeechMenu.#stopped ||
            Boolean(SpeechMenu.#stream) ||
            Boolean(SpeechMenu.#startPromise);

        if (!wasActive) return false;

        SpeechMenu.#stopped = true;
        SpeechMenu.#sleeping = false;
        SpeechMenu.#sessionGeneration++;

        if (SpeechMenu.#utterance) {
            SpeechMenu.#finishUtterance(
                "stopped",
                false
            );
        }

        await SpeechMenu.#releaseCapture();

        SpeechMenu.#emit("stopped", {
            deliberate: true
        });

        return true;
    }

    static refresh() {
        for (
            const element of
            document.querySelectorAll(
                "[speech-pattern]"
            )
        ) {
            SpeechMenu.#prepare(
                element,
                true
            );
        }
    }

    static #createRecognitionProvider() {
        const Provider =
            SpeechMenu.#recognitionProviderMode ===
                "streaming"
                ? globalThis.StreamingSpeechProvider
                : globalThis.BrowserSpeechProvider;

        if (typeof Provider !== "function") {
            throw new DOMException(
                `The ${SpeechMenu.#recognitionProviderMode} speech provider is unavailable.`,
                "NotSupportedError"
            );
        }

        return new Provider();
    }

    static #emit(type, detail) {
        SpeechMenu.#events.dispatchEvent(
            new CustomEvent(
                type,
                detail === undefined
                    ? undefined
                    : {detail}
            )
        );
    }

    static #setPhrase(kind, value) {
        try {
            const regex =
                value instanceof RegExp
                    ? value
                    : new RegExp(value, "i");

            if (kind === "wake") {
                SpeechMenu.#wakePhrase =
                    regex;
            }
            else {
                SpeechMenu.#sleepPhrase =
                    regex;
            }

            SpeechMenu.#emit(
                `${kind}PhraseChanged`,
                {
                    [`${kind}PhraseRegex`]:
                        regex
                }
            );
        }
        catch {
            SpeechMenu.#emit(
                `${kind}PhraseChangeFailed`,
                {
                    message:
                        `${kind}Phrase must be a valid regular expression.`
                }
            );
        }
    }

    static #onTrackEnded = () => {
        if (SpeechMenu.#stopped) return;

        SpeechMenu.#stopped =
            true;

        SpeechMenu.#emit(
            "speechCaptureEnded",
            {
                deliberate: false
            }
        );

        void SpeechMenu.#releaseCapture();
    };

    static #onAudioProcess = event => {
        if (
            SpeechMenu.#stopped ||
            !SpeechMenu.#audioContext
        ) {
            return;
        }

        const input =
            event.inputBuffer;

        if (!input?.length) return;

        const channels = [];

        for (
            let index = 0;
            index < input.numberOfChannels;
            index++
        ) {
            channels.push(
                new Float32Array(
                    input.getChannelData(
                        index
                    )
                )
            );
        }

        if (channels.length === 0) return;

        let squareTotal = 0;
        let sampleTotal = 0;

        for (const channel of channels) {
            for (const sample of channel) {
                squareTotal +=
                    sample * sample;
            }
            sampleTotal +=
                channel.length;
        }

        const level =
            sampleTotal > 0
                ? Math.sqrt(
                    squareTotal /
                    sampleTotal
                )
                : 0;

        SpeechMenu.#processAudioFrame(
            {
                channels,
                length:
                    channels[0].length
            },
            level,
            input.sampleRate
        );
    };

    static #onWorkletMessage = event => {
        if (
            SpeechMenu.#stopped ||
            !SpeechMenu.#audioContext ||
            event.data?.type !== "audio" ||
            !(event.data.pcm instanceof ArrayBuffer)
        ) {
            return;
        }

        const pcm =
            new Int16Array(
                event.data.pcm
            );

        if (!pcm.length) return;

        SpeechMenu.#processAudioFrame(
            {
                pcm,
                length:
                    pcm.length
            },
            Number(event.data.level) || 0,
            Number(event.data.sampleRate) ||
                16000
        );
    };

    static #processAudioFrame(
        frame,
        level,
        sampleRate
    ) {
        const frameMilliseconds =
            frame.length /
            sampleRate *
            1000;

        const now =
            performance.now();

        if (
            now -
                SpeechMenu.#lastLevelEventAt >=
                    45
        ) {
            SpeechMenu.#lastLevelEventAt =
                now;

            SpeechMenu.#emit(
                "audioLevelChanged",
                {level}
            );
        }

        if (!SpeechMenu.#utterance) {
            if (
                level >=
                SpeechMenu.#speechThreshold
            ) {
                SpeechMenu.#beginUtterance(
                    now
                );

                SpeechMenu.#appendUtteranceFrame(
                    frame
                );
            }
            else {
                SpeechMenu.#appendPreRollFrame(
                    frame,
                    sampleRate
                );
            }

            return;
        }

        if (
            SpeechMenu.#utterance.committed &&
            level >= SpeechMenu.#speechThreshold
        ) {
            SpeechMenu.#finishUtterance(
                "committed",
                false
            );
            SpeechMenu.#beginUtterance(now);
            SpeechMenu.#appendUtteranceFrame(frame);
            return;
        }

        // Once speech starts, stream the contiguous utterance.
        // Dropping low-energy frames clips quiet phonemes and removes
        // natural pauses before Whisper sees the audio.
        SpeechMenu.#appendUtteranceFrame(
            frame
        );

        if (
            level >=
            SpeechMenu.#speechThreshold
        ) {
            SpeechMenu.#utterance.silenceMilliseconds =
                0;
        }
        else {
            SpeechMenu.#utterance.silenceMilliseconds +=
                frameMilliseconds;

            if (
                !SpeechMenu.#utterance.committed &&
                !SpeechMenu.#utterance.committing &&
                SpeechMenu.#utterance.candidate &&
                SpeechMenu.#utterance.silenceMilliseconds >=
                    SpeechMenu.#commitSilenceTimeout
            ) {
                void SpeechMenu.#commitUtterance(
                    SpeechMenu.#utterance
                );
            }

            const endpointSilence =
                SpeechMenu.#recognitionProvider
                    ?.kind === "streaming"
                    ? SpeechMenu.#streamingSilenceTimeout
                    : SpeechMenu.#silenceTimeout;

            if (
                SpeechMenu.#utterance &&
                SpeechMenu.#utterance
                    .silenceMilliseconds >=
                    endpointSilence
            ) {
                SpeechMenu.#finishUtterance(
                    "silence",
                    true
                );
            }
        }
    }

    static #appendPreRollFrame(
        frame,
        sampleRate
    ) {
        SpeechMenu.#preRollFrames.push(
            frame
        );

        SpeechMenu.#preRollSamples +=
            frame.length;

        const maximumSamples =
            sampleRate *
            (
                SpeechMenu.#preRollMilliseconds /
                1000
            );

        while (
            SpeechMenu.#preRollSamples >
                maximumSamples &&
            SpeechMenu.#preRollFrames
                .length > 0
        ) {
            const removed =
                SpeechMenu.#preRollFrames.shift();

            SpeechMenu.#preRollSamples -=
                removed.length;
        }
    }

    static #beginUtterance(now) {
        const id =
            ++SpeechMenu.#utteranceSequence;

        const frames =
            SpeechMenu.#preRollFrames
                .splice(0);

        const sampleCount =
            SpeechMenu.#preRollSamples;

        SpeechMenu.#preRollSamples =
            0;

        SpeechMenu.#utterance = {
            id,
            sessionGeneration:
                SpeechMenu.#sessionGeneration,
            startedAt: now,
            silenceMilliseconds: 0,
            frames,
            sampleCount,
            transcript: "",
            rawTranscript: "",
            transcriptRevision: 0,
            candidate: undefined,
            committed: false,
            committing: false,
            liveRecognition: undefined,
            liveRecognitionStopped: false,
            recognitionPrefix: ""
        };

        SpeechMenu.#emit(
            "utteranceStarted",
            {
                id,
                startedAt: now
            }
        );

        SpeechMenu.#startLiveRecognition(
            SpeechMenu.#utterance
        );

        if (
            SpeechMenu.#recognitionProvider
                ?.kind === "streaming"
        ) {
            for (const frame of frames) {
                if (!frame.pcm) continue;

                SpeechMenu.#recognitionProvider
                    .pushAudio?.({
                        id,
                        pcm:
                            frame.pcm
                    });
            }
        }
    }

    static #appendUtteranceFrame(
        frame,
        streamAudio = true
    ) {
        if (!SpeechMenu.#utterance) {
            return;
        }

        SpeechMenu.#utterance.frames.push(
            frame
        );

        SpeechMenu.#utterance.sampleCount +=
            frame.length;

        if (
            streamAudio &&
            frame.pcm &&
            SpeechMenu.#recognitionProvider
                ?.kind === "streaming"
        ) {
            SpeechMenu.#recognitionProvider
                .pushAudio?.({
                    id:
                        SpeechMenu.#utterance.id,
                    pcm:
                        frame.pcm
                });
        }
    }

    static #finishUtterance(
        reason,
        recognize
    ) {
        const utterance =
            SpeechMenu.#utterance;

        if (!utterance) return;

        utterance.finished =
            true;

        if (
            SpeechMenu.#recognitionProvider
                ?.kind === "streaming"
        ) {
            SpeechMenu.#recognitionProvider
                .endUtterance?.(
                    utterance.id,
                    reason
                );
        }
        else {
            SpeechMenu.#stopLiveRecognition(
                utterance
            );
        }

        SpeechMenu.#utterance =
            undefined;

        const context =
            SpeechMenu.#audioContext;

        const sampleRate =
            context?.sampleRate || 48000;

        const durationMilliseconds =
            utterance.sampleCount /
            sampleRate *
            1000;

        SpeechMenu.#emit(
            "utteranceFinished",
            {
                id: utterance.id,
                reason,
                startedAt:
                    utterance.startedAt,
                finishedAt:
                    performance.now(),
                durationMilliseconds,
                committed:
                    Boolean(utterance.committed),
                transcript:
                    utterance.transcript || ""
            }
        );

        if (
            utterance.candidate &&
            !utterance.committed &&
            !utterance.committing
        ) {
            void SpeechMenu.#commitUtterance(
                utterance
            );
            return;
        }

        if (
            SpeechMenu.#recognitionProvider
                ?.kind === "streaming"
        ) {
            return;
        }

        if (
            !recognize ||
            utterance.committed ||
            !context ||
            utterance.sampleCount <= 0
        ) {
            return;
        }

        const channelCount =
            Math.max(
                1,
                utterance.frames[0]
                    ?.channels.length || 1
            );

        const audioBuffer =
            context.createBuffer(
                channelCount,
                utterance.sampleCount,
                sampleRate
            );

        let offset = 0;

        for (
            const frame of
                utterance.frames
        ) {
            for (
                let channelIndex = 0;
                channelIndex < channelCount;
                channelIndex++
            ) {
                const samples =
                    frame.channels[
                        Math.min(
                            channelIndex,
                            frame.channels
                                .length - 1
                        )
                    ];

                if (!samples) continue;

                audioBuffer.copyToChannel(
                    samples,
                    channelIndex,
                    offset
                );
            }

            offset +=
                frame.length;
        }

        const recognitionInput = {
            id: utterance.id,
            sessionGeneration:
                utterance.sessionGeneration,
            audioBuffer
        };

        SpeechMenu.#recognitionQueue =
            SpeechMenu.#recognitionQueue
                .catch(() => {})
                .then(
                    () =>
                        SpeechMenu
                            .#recognizeUtterance(
                                recognitionInput
                            )
                );
    }

    static #startLiveRecognition(
        utterance
    ) {
        if (
            !utterance ||
            utterance.liveRecognitionStopped ||
            utterance.committed ||
            SpeechMenu.#stopped ||
            utterance.sessionGeneration !==
                SpeechMenu.#sessionGeneration ||
            !SpeechMenu.#recognitionProvider
        ) {
            return false;
        }

        const provider =
            SpeechMenu.#recognitionProvider;

        const handle =
            provider.startUtterance({
                id: utterance.id,
                onTranscript: ({
                    text,
                    isFinal
                }) => {
                    const rawTranscript =
                        String(text ?? "").trim();

                    const transcript =
                        SpeechMenu.#normalizeTranscript(
                            rawTranscript
                        );

                    if (!transcript) return;

                    void SpeechMenu.#handleLiveTranscript(
                        utterance,
                        transcript,
                        isFinal,
                        rawTranscript
                    );
                },
                onError: ({
                    error,
                    message
                }) => {
                    SpeechMenu.#emit(
                        "speechRecognitionStreamingFailed",
                        {
                            utteranceId:
                                utterance.id,
                            error:
                                error ||
                                "SpeechStreamingError",
                            message
                        }
                    );
                }
            });

        if (!handle) {
            utterance.liveRecognitionStopped =
                true;
            return false;
        }

        utterance.liveRecognition =
            handle;

        return true;
    }

    static #stopLiveRecognition(
        utterance
    ) {
        if (!utterance) return;

        utterance.liveRecognitionStopped =
            true;

        SpeechMenu.#recognitionProvider
            ?.cancelUtterance?.(
                utterance.id
            );

        utterance.liveRecognition =
            undefined;
    }

    static async #handleLiveTranscript(
        utterance,
        transcript,
        isFinal,
        rawTranscript = transcript
    ) {
        if (
            !utterance ||
            utterance.committed ||
            SpeechMenu.#stopped ||
            (
                !utterance.finished &&
                SpeechMenu.#utterance !==
                    utterance
            ) ||
            utterance.sessionGeneration !==
                SpeechMenu.#sessionGeneration
        ) {
            return;
        }

        if (
            transcript ===
            utterance.transcript
        ) {
            return;
        }

        utterance.transcript =
            transcript;
        utterance.rawTranscript =
            String(rawTranscript ?? transcript);

        const revision =
            ++utterance.transcriptRevision;

        SpeechMenu.#emit(
            "utteranceTranscriptChanged",
            {
                id: utterance.id,
                transcript,
                normalizedTranscript:
                    transcript,
                rawTranscript:
                    utterance.rawTranscript,
                isFinal:
                    Boolean(isFinal)
            }
        );

        if (isFinal) {
            SpeechMenu.#emit(
                "utteranceTranscribed",
                {
                    id: utterance.id,
                    transcript,
                    normalizedTranscript:
                        transcript,
                    rawTranscript:
                        utterance.rawTranscript,
                    live: true
                }
            );
        }

        let candidate;

        if (
            SpeechMenu.#sleeping
        ) {
            if (
                SpeechMenu.#test(
                    SpeechMenu.#wakePhrase,
                    transcript
                )
            ) {
                candidate = {
                    kind: "wake",
                    transcript
                };
            }
        }
        else if (
            SpeechMenu.#test(
                SpeechMenu.#sleepPhrase,
                transcript
            )
        ) {
            candidate = {
                kind: "mute",
                transcript
            };
        }
        else {
            candidate =
                await SpeechMenu.#processTranscript(
                    transcript,
                    utterance.id,
                    false
                );
        }

        if (
            (
                !utterance.finished &&
                SpeechMenu.#utterance !==
                    utterance
            ) ||
            utterance.committed ||
            revision !==
                utterance.transcriptRevision
        ) {
            return;
        }

        utterance.candidate =
            candidate || undefined;

        if (
            utterance.candidate &&
            utterance.silenceMilliseconds >=
                SpeechMenu.#commitSilenceTimeout
        ) {
            await SpeechMenu.#commitUtterance(
                utterance
            );
        }
    }

    static async #commitUtterance(
        utterance
    ) {
        if (
            !utterance ||
            utterance.committed ||
            utterance.committing ||
            !utterance.candidate
        ) {
            return false;
        }

        utterance.committing =
            true;

        const transcript =
            utterance.transcript;

        let committed =
            false;

        try {
            if (
                utterance.candidate.kind ===
                    "wake"
            ) {
                SpeechMenu.#sleeping =
                    false;

                SpeechMenu.#emit(
                    "unmuted",
                    {
                        utteranceId:
                            utterance.id,
                        transcript
                    }
                );

                committed = true;
            }
            else if (
                utterance.candidate.kind ===
                    "mute"
            ) {
                SpeechMenu.#sleeping =
                    true;

                SpeechMenu.#emit(
                    "muted",
                    {
                        utteranceId:
                            utterance.id,
                        transcript
                    }
                );

                committed = true;
            }
            else {
                committed =
                    Boolean(
                        await SpeechMenu
                            .#processTranscript(
                                transcript,
                                utterance.id,
                                true
                            )
                    );
            }

            if (committed) {
                utterance.committed =
                    true;

                SpeechMenu.#stopLiveRecognition(
                    utterance
                );

                SpeechMenu.#emit(
                    "utteranceCommitted",
                    {
                        id:
                            utterance.id,
                        transcript
                    }
                );
            }

            return committed;
        }
        finally {
            utterance.committing =
                false;
        }
    }

    static async #recognizeUtterance(
        utterance
    ) {
        if (
            utterance.sessionGeneration !==
                SpeechMenu.#sessionGeneration ||
            SpeechMenu.#stopped ||
            !SpeechMenu.#audioContext ||
            !SpeechMenu.#recognitionProvider
        ) {
            return;
        }

        const rawFinalText =
            await SpeechMenu
                .#recognitionProvider
                .recognizeBuffer?.({
                    id:
                        utterance.id,
                    audioBuffer:
                        utterance.audioBuffer,
                    audioContext:
                        SpeechMenu.#audioContext,
                    onError: ({
                        error,
                        message
                    }) => {
                        SpeechMenu.#emit(
                            "speechRecognitionFailed",
                            {
                                utteranceId:
                                    utterance.id,
                                error:
                                    error ||
                                    "SpeechRecognitionError",
                                message
                            }
                        );
                    }
                }) || "";

        const finalText =
            SpeechMenu.#normalizeTranscript(
                rawFinalText
            );

        if (!finalText) {
            SpeechMenu.#emit(
                "utteranceUnrecognized",
                {
                    id: utterance.id
                }
            );
            return;
        }

        SpeechMenu.#emit(
            "utteranceTranscribed",
            {
                id: utterance.id,
                transcript: finalText,
                normalizedTranscript: finalText,
                rawTranscript:
                    String(rawFinalText).trim()
            }
        );

        if (
            SpeechMenu.#debug &&
            finalText
        ) {
            const words =
                finalText.split(/\s+/);

            SpeechMenu.#debugFunction({
                state:
                    SpeechMenu.#sleeping
                        ? "muted"
                        : "listening",
                isFinal: true,
                fullText: finalText,
                lastWord:
                    words.at(-1)
            });
        }

        if (SpeechMenu.#sleeping) {
            if (
                SpeechMenu.#test(
                    SpeechMenu.#wakePhrase,
                    finalText
                )
            ) {
                SpeechMenu.#sleeping =
                    false;

                SpeechMenu.#emit(
                    "unmuted",
                    {
                        utteranceId:
                            utterance.id,
                        transcript:
                            finalText
                    }
                );
            }

            return;
        }

        if (
            SpeechMenu.#test(
                SpeechMenu.#sleepPhrase,
                finalText
            )
        ) {
            SpeechMenu.#sleeping =
                true;

            SpeechMenu.#emit(
                "muted",
                {
                    utteranceId:
                        utterance.id,
                    transcript:
                        finalText
                }
            );

            return;
        }

        await SpeechMenu.#processTranscript(
            finalText,
            utterance.id
        );
    }

    static #normalizeTranscript(value) {
        let text =
            String(value || "")
                .toLocaleLowerCase()
                .trim()
                .replace(
                    /(\d)\.(?=\d)/g,
                    "$1\uFFFF"
                )
                .replace(
                    /[^\p{L}\p{N}\s:\uFFFF-]/gu,
                    " "
                )
                .replace(
                    /\uFFFF/g,
                    "."
                )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();

        if (
            SpeechMenu.#recognitionContext
                .numbers.output === "digits" &&
            /^en(?:-|$)/i.test(
                SpeechMenu.#language
            ) &&
            globalThis
                .EnglishSpokenNumberParser
                ?.normalizeText
        ) {
            text =
                globalThis
                    .EnglishSpokenNumberParser
                    .normalizeText(text);
        }

        return text;
    }

    static #copyRecognitionContext() {
        return {
            vocabulary:
                [...SpeechMenu.#recognitionContext.vocabulary],
            options:
                Object.fromEntries(
                    Object.entries(
                        SpeechMenu.#recognitionContext.options
                    ).map(
                        ([name, values]) =>
                            [name, [...values]]
                    )
                ),
            phrases:
                [...SpeechMenu.#recognitionContext.phrases],
            numbers: {
                ...SpeechMenu.#recognitionContext.numbers
            }
        };
    }

    static #test(regex, text) {
        regex.lastIndex = 0;
        return regex.test(text);
    }

    static async #processTranscript(
        text,
        utteranceId,
        execute = true
    ) {
        const first =
            async elements => {
                for (
                    const element of
                        elements
                ) {
                    const result =
                        await SpeechMenu
                            .#processElement(
                                element,
                                text,
                                utteranceId,
                                undefined,
                                execute
                            );

                    if (result) {
                        return result;
                    }
                }

                return false;
            };

        const firstMenu =
            async elements => {
                for (
                    const element of
                        elements
                ) {
                    const result =
                        await SpeechMenu
                            .#processMenu(
                                element,
                                text,
                                utteranceId,
                                execute
                            );

                    if (result) {
                        return result;
                    }
                }

                return false;
            };

        let result =
            await firstMenu(
                document.querySelectorAll(
                    'speech-modal[speech-modal="top-level"]'
                )
            );

        if (result) return result;

        result =
            await first(
                document.querySelectorAll(
                    'speech-command[speech-modal="top-level"]'
                )
            );

        if (result) return result;

        const modal =
            [
                ...document
                    .querySelectorAll(
                        "dialog:modal, dialog[open]"
                    )
            ].at(-1);

        if (modal) {
            result =
                await SpeechMenu.#processMenu(
                    modal,
                    text,
                    utteranceId,
                    execute
                );

            if (result) return result;
        }

        result =
            await firstMenu(
                document.querySelectorAll(
                    'speech-modal:not([speech-modal="top-level"])'
                )
            );

        if (result) return result;

        result =
            await first(
                document.querySelectorAll(
                    'speech-command[speech-modal=""]'
                )
            );

        if (result) return result;

        if (modal) return false;

        result =
            await first(
                document.querySelectorAll(
                    "details[open], [popover]:popover-open"
                )
            );

        if (result) return result;

        return await first(
            document.querySelectorAll(
                ":not(details):not(dialog):not(speech-modal)[speech-pattern]"
            )
        );
    }

    static async #processMenu(
        menu,
        text,
        utteranceId,
        execute = true
    ) {
        for (
            const element of
                menu.querySelectorAll(
                    "[speech-pattern]:not([speech-modal])"
                )
        ) {
            const result =
                await SpeechMenu
                    .#processElement(
                        element,
                        text,
                        utteranceId,
                        menu,
                        execute
                    );

            if (result) {
                return result;
            }
        }

        return false;
    }

    static #prepare(
        element,
        force = false
    ) {
        const source =
            element.getAttribute(
                "speech-pattern"
            );

        if (!source) return false;

        if (
            force ||
            element.speechPatternSource !==
                source
        ) {
            try {
                element.speechPattern =
                    new RegExp(
                        source,
                        "gi"
                    );

                element.speechPatternSource =
                    source;
            }
            catch {
                SpeechMenu.#emit(
                    "speechMenuPatternInvalid",
                    {
                        speechMenuElement:
                            element,
                        component:
                            "speech-pattern",
                        message:
                            "Invalid speech-pattern regular expression."
                    }
                );

                return false;
            }
        }

        const target =
            SpeechMenu.#resolve(
                element.getAttribute(
                    "speech-function"
                )
            );

        if (!target) {
            SpeechMenu.#emit(
                "speechMenuFunctionNotFound",
                {
                    speechMenuElement:
                        element,
                    component:
                        "speech-function",
                    functionName:
                        element.getAttribute(
                            "speech-function"
                        ),
                    message:
                        "The speech function was not found."
                }
            );

            return false;
        }

        element.speechFunc =
            target.fn;

        element.speechFuncThis =
            target.owner;

        const preprocName =
            element.getAttribute(
                "speech-preproc"
            );

        if (!preprocName) {
            delete element.speechPreprocFunc;
            return true;
        }

        const preproc =
            SpeechMenu.#resolve(
                preprocName
            );

        if (!preproc) {
            SpeechMenu.#emit(
                "speechMenuFunctionNotFound",
                {
                    speechMenuElement:
                        element,
                    component:
                        "speech-preproc",
                    functionName:
                        preprocName,
                    message:
                        "The speech preprocessor was not found."
                }
            );

            return false;
        }

        element.speechPreprocFunc =
            preproc.fn.bind(
                preproc.owner
            );

        return true;
    }

    static #resolve(source) {
        if (
            typeof source !== "string" ||
            !source.trim()
        ) {
            return undefined;
        }

        const path =
            source
                .trim()
                .replace(
                    /\[['"]([A-Za-z_$][\w$]*)['"]\]/g,
                    ".$1"
                )
                .replace(
                    /\[([A-Za-z_$][\w$]*)\]/g,
                    ".$1"
                )
                .split(".");

        if (
            !path.every(
                part =>
                    /^[A-Za-z_$][\w$]*$/
                        .test(part)
            )
        ) {
            return undefined;
        }

        let owner =
            window;

        for (
            let index = 0;
            index < path.length - 1;
            index++
        ) {
            owner =
                owner?.[
                    path[index]
                ];

            if (owner == null) {
                return undefined;
            }
        }

        const fn =
            owner?.[
                path.at(-1)
            ];

        return typeof fn === "function"
            ? {fn, owner}
            : undefined;
    }

    static #resolveSpeechTarget(
        element
    ) {
        const selector =
            element.getAttribute(
                "data-speech-target"
            );

        if (!selector) {
            return {
                selector:
                    undefined,
                element:
                    undefined
            };
        }

        try {
            return {
                selector,
                element:
                    document
                        .querySelector(
                            selector
                        ) ||
                    undefined
            };
        }
        catch {
            return {
                selector,
                element:
                    undefined
            };
        }
    }

    static async #processElement(
        element,
        transcript,
        utteranceId,
        speechMenuElement,
        execute = true
    ) {
        if (
            !SpeechMenu.#prepare(
                element
            )
        ) {
            return false;
        }

        let text =
            transcript;

        let preprocessing;

        try {
            if (
                element.speechPreprocFunc
            ) {
                const processed =
                    element.speechPreprocFunc(
                        text,
                        {
                            kind:
                                element.getAttribute(
                                    "speech-preproc-context"
                                ),
                            field:
                                element.getAttribute(
                                    "speech-preproc-field"
                                ),
                            pattern:
                                element.getAttribute(
                                    "speech-pattern"
                                )
                        }
                    );

                if (
                    typeof processed !==
                    "string"
                ) {
                    return false;
                }

                if (
                    processed !== text
                ) {
                    preprocessing = {
                        utteranceId,
                        commandElement:
                            element,
                        speechMenuElement,
                        originalText:
                            text,
                        processedText:
                            processed
                    };
                }

                text =
                    processed;
            }
        }
        catch (error) {
            SpeechMenu.#emit(
                "speechMenuCommandError",
                {
                    speechMenuElement:
                        element,
                    error,
                    utteranceId
                }
            );

            return false;
        }

        const regex =
            element.speechPattern;

        regex.lastIndex = 0;

        const args =
            new ParameterParser(
                element.speechFunc
            );

        let matched =
            false;

        let result;

        while (
            (
                result =
                    regex.exec(text)
            ) !== null
        ) {
            matched = true;

            const values =
                result.groups ||
                {};

            const named =
                new Set(
                    Object
                        .values(
                            result.groups ||
                            {}
                        )
                        .filter(
                            value =>
                                value !==
                                undefined
                        )
                );

            for (
                const [name, value] of
                    Object.entries(
                        values
                    )
            ) {
                if (!value) continue;

                if (name === "_") {
                    args.restArguments
                        ?.push(
                            ...SpeechMenu
                                .#list(
                                    value
                                )
                        );
                }
                else if (
                    name.startsWith(
                        "_"
                    )
                ) {
                    args.setArgument(
                        name.slice(1),
                        SpeechMenu.#list(
                            value
                        )
                    );
                }
                else {
                    args.setArgument(
                        name,
                        value
                    );
                }
            }

            if (
                args.restArguments
            ) {
                for (
                    let index = 1;
                    index <
                        result.length;
                    index++
                ) {
                    const value =
                        result[
                            index
                        ];

                    if (
                        value &&
                        !named.has(
                            value
                        )
                    ) {
                        args.restArguments
                            .push(
                                SpeechMenu
                                    .#scalar(
                                        value
                                    )
                            );
                    }
                }
            }

            if (
                !result[0].length
            ) {
                regex.lastIndex++;
            }
        }

        if (!matched) {
            return false;
        }

        const matchDetail = {
            utteranceId,
            commandElement:
                element,
            speechMenuElement,
            originalTranscript:
                transcript,
            transcript:
                text
        };

        SpeechMenu.#emit(
            "speechCommandMatched",
            matchDetail
        );

        if (speechMenuElement) {
            SpeechMenu.#emit(
                "speechMenuMatched",
                matchDetail
            );
        }

        if (preprocessing) {
            SpeechMenu.#emit(
                "speechPreprocessed",
                preprocessing
            );
        }

        const argumentValues =
            args.argumentArray();

        const target =
            SpeechMenu
                .#resolveSpeechTarget(
                    element
                );

        SpeechMenu.#emit(
            "speechArgumentsPrepared",
            {
                utteranceId,
                commandElement:
                    element,
                speechMenuElement,
                transcript:
                    text,
                arguments:
                    argumentValues.slice(),
                targetSelector:
                    target.selector,
                targetElement:
                    target.element,
                provisional:
                    !execute
            }
        );

        if (!execute) {
            return {
                kind: "command",
                utteranceId,
                commandElement:
                    element,
                speechMenuElement,
                transcript:
                    text,
                arguments:
                    argumentValues.slice(),
                targetSelector:
                    target.selector,
                targetElement:
                    target.element
            };
        }

        if (
            target.element &&
            typeof requestAnimationFrame ===
                "function"
        ) {
            await new Promise(
                resolve =>
                    requestAnimationFrame(
                        () =>
                            resolve()
                    )
            );
        }

        try {
            const outcome =
                await element
                    .speechFunc
                    .apply(
                        element.speechFuncThis,
                        argumentValues
                    );

            if (outcome === false) {
                return false;
            }

            await Promise.resolve();

            if (
                target.element &&
                typeof requestAnimationFrame ===
                    "function"
            ) {
                await new Promise(
                    resolve =>
                        requestAnimationFrame(
                            () =>
                                resolve()
                        )
                );
            }

            SpeechMenu.#emit(
                "speechCommandExecuted",
                {
                    utteranceId,
                    commandElement:
                        element,
                    speechMenuElement,
                    transcript:
                        text,
                    arguments:
                        argumentValues.slice(),
                    targetSelector:
                        target.selector,
                    targetElement:
                        target.element
                }
            );

            SpeechMenu.#emit(
                "command",
                {
                    speechMenuElement:
                        element,
                    transcript:
                        text,
                    utteranceId
                }
            );

            return true;
        }
        catch (error) {
            SpeechMenu.#emit(
                "speechMenuCommandError",
                {
                    speechMenuElement:
                        element,
                    error,
                    utteranceId
                }
            );

            return false;
        }
    }

    static #list(value) {
        return value
            .split(
                SpeechMenu.#separator
            )
            .map(
                part =>
                    part.trim()
            )
            .filter(Boolean)
            .map(
                SpeechMenu.#scalar
            );
    }

    static #scalar(value) {
        const number =
            Number(value);

        return value.trim() &&
            Number.isFinite(number)
                ? number
                : value;
    }

    static async #releaseCapture() {
        const provider =
            SpeechMenu.#recognitionProvider;

        SpeechMenu.#recognitionProvider =
            undefined;

        if (provider) {
            try {
                await provider.stop?.();
            }
            catch {}
        }

        const processor =
            SpeechMenu.#processorNode;

        SpeechMenu.#processorNode =
            undefined;

        if (processor) {
            try {
                processor.removeEventListener(
                    "audioprocess",
                    SpeechMenu.#onAudioProcess
                );
            }
            catch {}

            try {
                processor.port
                    ?.removeEventListener(
                        "message",
                        SpeechMenu.#onWorkletMessage
                    );
            }
            catch {}

            try {
                processor.disconnect();
            }
            catch {}
        }

        try {
            SpeechMenu.#sourceNode
                ?.disconnect();
        }
        catch {}

        SpeechMenu.#sourceNode =
            undefined;

        try {
            SpeechMenu.#silentGain
                ?.disconnect();
        }
        catch {}

        SpeechMenu.#silentGain =
            undefined;

        const stream =
            SpeechMenu.#stream;

        SpeechMenu.#stream =
            undefined;

        SpeechMenu.#micTrack =
            undefined;

        if (stream) {
            for (
                const track of
                    stream.getTracks()
            ) {
                try {
                    track.stop();
                }
                catch {}
            }
        }

        const context =
            SpeechMenu.#audioContext;

        SpeechMenu.#audioContext =
            undefined;

        if (
            context &&
            context.state !== "closed"
        ) {
            try {
                await context.close();
            }
            catch {}
        }

        SpeechMenu.#preRollFrames =
            [];

        SpeechMenu.#preRollSamples =
            0;

        SpeechMenu.#utterance =
            undefined;
    }
}

globalThis.SpeechMenu = SpeechMenu;
