class SpeechMenu {
    static #wakePhrase = /^listen$/i;
    static #sleepPhrase = /^mute$/i;
    static #stopped = true;
    static #sleeping = false;
    static #events = new EventTarget();
    static #separator = ",";
    static #language = "en-US";
    static #silenceTimeout = 5000;
    static #commitSilenceTimeout = 350;
    static #speechThreshold = 0.025;
    static #preRollMilliseconds = 350;
    static #stream;
    static #micTrack;
    static #audioContext;
    static #sourceNode;
    static #captureNode;
    static #recognizer;
    static #vad;
    static #pipeline = "raw";
    static #finishedUtterances = new Map();
    static #silentGain;
    static #utterance;
    static #utteranceSequence = 0;
    static #preRollFrames = [];
    static #preRollSamples = 0;
    static #startPromise;
    static #sessionGeneration = 0;
    static #lastLevelEventAt = 0;
    static #debug = false;
    static #debugFunction = data => console.log(data);
    static #executionEnabled = true;
    static #phrases = Object.freeze([]);
    static #phraseGroups = Object.freeze([]);
    static #phraseRefreshQueued = false;

    static {
        document.addEventListener("visibilitychange", () => {
            if (
                document.visibilityState === "visible" &&
                SpeechMenu.#audioContext?.state === "suspended"
            ) {
                void SpeechMenu.#audioContext.resume().catch(() => {});
            }
        });

        const refreshPhrases =
            () => SpeechMenu.#schedulePhraseRefresh();

        for (const type of ["toggle", "close", "cancel"]) {
            document.addEventListener(
                type,
                refreshPhrases,
                true
            );
        }

        if (typeof MutationObserver === "function") {
            new MutationObserver(refreshPhrases)
                .observe(
                    document.documentElement,
                    {
                        subtree: true,
                        childList: true,
                        attributes: true,
                        attributeFilter: [
                            "speech-pattern",
                            "speech-modal",
                            "speech-index",
                            "open",
                            "hidden",
                            "disabled"
                        ]
                    }
                );
        }

        queueMicrotask(refreshPhrases);
    }

    static get events() { return SpeechMenu.#events; }
    static get wakePhrase() { return SpeechMenu.#wakePhrase; }
    static get sleepPhrase() { return SpeechMenu.#sleepPhrase; }
    static get debug() { return SpeechMenu.#debug; }
    static get debugFunction() { return SpeechMenu.#debugFunction; }
    static get executionEnabled() { return SpeechMenu.#executionEnabled; }
    static get pipeline() { return SpeechMenu.#pipeline; }
    static get silenceTimeout() { return SpeechMenu.#silenceTimeout; }
    static get commitSilenceTimeout() { return SpeechMenu.#commitSilenceTimeout; }
    static get started() { return Boolean(SpeechMenu.#stream) && !SpeechMenu.#stopped; }
    static get muted() { return SpeechMenu.#sleeping; }
    static get phrases() { return SpeechMenu.#phrases; }
    static get phraseGroups() { return SpeechMenu.#phraseGroups; }

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

    static set executionEnabled(value) {
        const next =
            Boolean(value);

        if (
            next ===
            SpeechMenu.#executionEnabled
        ) {
            return;
        }

        SpeechMenu.#executionEnabled =
            next;

        SpeechMenu.#emit(
            "speechExecutionChanged",
            {
                enabled:
                    next
            }
        );
    }

    static set pipeline(value) {
        const next =
            String(value || "raw")
                .toLocaleLowerCase();

        if (
            next !== "raw" &&
            next !== "silero"
        ) {
            throw new RangeError(
                'SpeechMenu.pipeline must be "raw" or "silero".'
            );
        }

        if (
            SpeechMenu.started ||
            SpeechMenu.#startPromise
        ) {
            throw new Error(
                "SpeechMenu.pipeline cannot change while speech recognition is running."
            );
        }

        SpeechMenu.#pipeline =
            next;

        SpeechMenu.#emit(
            "speechPipelineChanged",
            {
                pipeline:
                    next
            }
        );
    }

    static async start(language = "en-US", listSeparator = ",") {
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
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
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

                const AudioWorkletNodeCtor =
                    window.AudioWorkletNode ||
                    globalThis.AudioWorkletNode;

                if (
                    !context.audioWorklet ||
                    typeof AudioWorkletNodeCtor !== "function" ||
                    typeof globalThis.SherpaRecognizer !== "function" ||
                    (
                        SpeechMenu.#pipeline === "silero" &&
                        typeof globalThis.SileroVad !== "function"
                    )
                ) {
                    try { await context.close(); } catch {}
                    throw new Error(
                        "This browser does not support the WMOF client speech runtime."
                    );
                }

                await context.audioWorklet.addModule(
                    globalThis.SherpaRecognizer.assetUrl(
                        "speech/SpeechAudioWorklet.js"
                    )
                );

                const recognizer =
                    new globalThis.SherpaRecognizer({
                        hotwords:
                            SpeechMenu.#hotwords()
                    });

                SpeechMenu.#recognizer =
                    recognizer;

                recognizer.addEventListener(
                    "transcript",
                    SpeechMenu.#onSherpaTranscript
                );

                recognizer.addEventListener(
                    "error",
                    SpeechMenu.#onSherpaError
                );

                recognizer.addEventListener(
                    "status",
                    SpeechMenu.#onSherpaStatus
                );

                recognizer.addEventListener(
                    "utteranceEnded",
                    SpeechMenu.#onSherpaUtteranceEnded
                );

                await recognizer.ready;

                if (
                    SpeechMenu.#pipeline === "silero"
                ) {
                    const vad =
                        new globalThis.SileroVad({
                            threshold: 0.5,
                            minSilenceDuration:
                                SpeechMenu
                                    .#commitSilenceTimeout /
                                1000,
                            minSpeechDuration: 0.15,
                            maxSpeechDuration: 20
                        });

                    SpeechMenu.#vad =
                        vad;

                    vad.addEventListener(
                        "speechStart",
                        SpeechMenu.#onVadSpeechStart
                    );

                    vad.addEventListener(
                        "speechEnd",
                        SpeechMenu.#onVadSpeechEnd
                    );

                    vad.addEventListener(
                        "error",
                        SpeechMenu.#onVadError
                    );

                    vad.addEventListener(
                        "status",
                        SpeechMenu.#onVadStatus
                    );

                    await vad.ready;
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

                SpeechMenu.#sourceNode =
                    context.createMediaStreamSource(
                        stream
                    );

                SpeechMenu.#captureNode =
                    new AudioWorkletNodeCtor(
                        context,
                        "wmof-speech-capture",
                        {
                            numberOfInputs: 1,
                            numberOfOutputs: 1,
                            outputChannelCount: [1]
                        }
                    );

                SpeechMenu.#silentGain =
                    context.createGain();

                SpeechMenu.#silentGain.gain.value =
                    0;

                SpeechMenu.#captureNode.port
                    .addEventListener(
                        "message",
                        SpeechMenu.#onAudioWorkletMessage
                    );

                SpeechMenu.#captureNode.port
                    .start?.();

                SpeechMenu.#sourceNode.connect(
                    SpeechMenu.#captureNode
                );

                SpeechMenu.#captureNode.connect(
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
                    recognizer:
                        "sherpa",
                    pipeline:
                        SpeechMenu.#pipeline,
                    sampleRate:
                        globalThis.SherpaRecognizer
                            .sampleRate,
                    captureSettings:
                        SpeechMenu.#micTrack
                            .getSettings?.() ||
                        {},
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

        return SpeechMenu.extrapolatePhrases();
    }

    static extrapolatePattern(pattern) {
        return Object.freeze(
            SpeechMenu
                .#expandRegexSource(
                    pattern
                )
                .slice()
        );
    }

    static withoutPhrase(
        pattern,
        phrase
    ) {
        if (
            typeof pattern !== "string" ||
            typeof phrase !== "string" ||
            !phrase.trim()
        ) {
            return pattern;
        }

        const parts =
            SpeechMenu
                .#splitPhraseExclusions(
                    pattern
                );

        const exclusion =
            SpeechMenu
                .#phraseExclusionSource(
                    phrase
                );

        if (!exclusion) {
            return pattern;
        }

        const exclusions =
            [
                ...new Set([
                    ...parts.exclusions,
                    exclusion
                ])
            ];

        return (
            "^(?!(?:" +
            exclusions.join("|") +
            ")$)(?:" +
            parts.base +
            ")$"
        );
    }

    static extrapolatePhrases() {
        const groups = [];
        const phrases = [];
        const seen = new Set();

        for (
            const element of
            SpeechMenu.#availableCandidates()
        ) {
            const pattern =
                element.getAttribute(
                    "speech-pattern"
                );

            if (!pattern) continue;

            const extrapolated =
                SpeechMenu
                    .#expandRegexSource(
                        pattern
                    );

            if (!extrapolated.length) {
                continue;
            }

            const menu =
                element.closest(
                    "speech-menu"
                );

            groups.push(
                Object.freeze({
                    element,
                    menu: menu || undefined,
                    modal:
                        SpeechMenu
                            .#effectiveModal(
                                element
                            ),
                    pattern,
                    phrases:
                        Object.freeze(
                            extrapolated.slice()
                        )
                })
            );

            for (const phrase of extrapolated) {
                if (seen.has(phrase)) continue;
                seen.add(phrase);
                phrases.push(phrase);
            }
        }

        const previous =
            SpeechMenu.#phrases;

        SpeechMenu.#phraseGroups =
            Object.freeze(groups);

        SpeechMenu.#phrases =
            Object.freeze(phrases);

        if (
            previous.length !== phrases.length ||
            previous.some(
                (phrase, index) =>
                    phrase !==
                    phrases[index]
            )
        ) {
            SpeechMenu.#emit(
                "phrasesChanged",
                {
                    phrases:
                        SpeechMenu.#phrases,
                    phraseGroups:
                        SpeechMenu.#phraseGroups
                }
            );

            SpeechMenu
                .#refreshRecognizerHotwords();
        }

        return SpeechMenu.#phrases;
    }

    static #hotwords() {
        const values = [
            ...SpeechMenu.#phrases
        ];

        for (
            const regex of
            [
                SpeechMenu.#wakePhrase,
                SpeechMenu.#sleepPhrase
            ]
        ) {
            const source =
                regex?.source
                    ?.replace(/^\^/, "")
                    .replace(/\$$/, "");

            if (
                source &&
                /^[\p{L}\p{N}' ]+$/u
                    .test(source)
            ) {
                values.push(source);
            }
        }

        return values;
    }

    static #refreshRecognizerHotwords() {
        SpeechMenu.#recognizer
            ?.setHotwords(
                SpeechMenu.#hotwords()
            );
    }

    static #schedulePhraseRefresh() {
        if (SpeechMenu.#phraseRefreshQueued) {
            return;
        }

        SpeechMenu.#phraseRefreshQueued =
            true;

        queueMicrotask(
            () => {
                SpeechMenu.#phraseRefreshQueued =
                    false;
                SpeechMenu.extrapolatePhrases();
            }
        );
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

            SpeechMenu
                .#refreshRecognizerHotwords();
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

    static #onAudioWorkletMessage = event => {
        if (
            SpeechMenu.#stopped ||
            !SpeechMenu.#audioContext
        ) {
            return;
        }

        const data =
            event.data;

        if (
            data?.type !== "audio" ||
            !(data.samples instanceof Float32Array) ||
            data.samples.length === 0
        ) {
            return;
        }

        const samples =
            data.samples;

        const level =
            Number.isFinite(
                Number(data.level)
            )
                ? Number(data.level)
                : 0;

        const sampleRate =
            Number(data.sampleRate) ||
            globalThis.SherpaRecognizer
                ?.sampleRate ||
            16000;

        const frame = {
            samples,
            length:
                samples.length
        };

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

        if (
            SpeechMenu.#pipeline ===
                "silero"
        ) {
            SpeechMenu.#vad
                ?.accept(
                    samples
                );

            if (!SpeechMenu.#utterance) {
                SpeechMenu.#appendPreRollFrame(
                    frame,
                    sampleRate
                );
            }
            else {
                SpeechMenu.#appendUtteranceFrame(
                    frame
                );
            }

            return;
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

            if (
                SpeechMenu.#utterance &&
                SpeechMenu.#utterance
                    .silenceMilliseconds >=
                    SpeechMenu.#silenceTimeout
            ) {
                SpeechMenu.#finishUtterance(
                    "silence",
                    true
                );
            }
        }
    };

    static #onVadSpeechStart = event => {
        if (
            SpeechMenu.#stopped ||
            SpeechMenu.#pipeline !==
                "silero" ||
            SpeechMenu.#utterance
        ) {
            return;
        }

        const now =
            performance.now();

        SpeechMenu.#emit(
            "speechVadChanged",
            {
                pipeline: "silero",
                detected: true,
                processMilliseconds:
                    Number(
                        event.detail
                            ?.processMilliseconds
                    ) || 0,
                maxProcessMilliseconds:
                    Number(
                        event.detail
                            ?.maxProcessingMilliseconds
                    ) || 0
            }
        );

        SpeechMenu.#beginUtterance(
            now
        );
    };

    static #onVadSpeechEnd = event => {
        if (
            SpeechMenu.#pipeline !==
                "silero"
        ) {
            return;
        }

        SpeechMenu.#emit(
            "speechVadChanged",
            {
                pipeline: "silero",
                detected: false,
                processMilliseconds:
                    Number(
                        event.detail
                            ?.processMilliseconds
                    ) || 0,
                maxProcessMilliseconds:
                    Number(
                        event.detail
                            ?.maxProcessingMilliseconds
                    ) || 0
            }
        );

        if (
            SpeechMenu.#utterance
        ) {
            SpeechMenu.#finishUtterance(
                "vad-silence",
                true
            );
        }
    };

    static #onVadError = event => {
        const detail =
            event.detail || {};

        SpeechMenu.#emit(
            "speechRecognitionFailed",
            {
                error:
                    detail.error ||
                    "SileroVadError",
                message:
                    detail.message ||
                    "Silero VAD failed."
            }
        );
    };

    static #onVadStatus = event => {
        const status =
            event.detail?.status ||
            "";

        if (!status) {
            return;
        }

        SpeechMenu.#emit(
            "speechRecognitionStatusChanged",
            {
                status:
                    `VAD: ${status}`
            }
        );
    };

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

        const preRollFrames =
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
            sampleCount,
            transcript: "",
            transcriptRevision: 0,
            firstTranscriptAt:
                undefined,
            candidate: undefined,
            committed: false,
            committing: false,
            recognitionStopped: false
        };

        SpeechMenu.#emit(
            "utteranceStarted",
            {
                id,
                startedAt: now
            }
        );

        SpeechMenu.#recognizer
            ?.beginUtterance(id);

        for (
            const frame of
            preRollFrames
        ) {
            SpeechMenu.#recognizer
                ?.accept(
                    id,
                    frame.samples
                );
        }
    }

    static #appendUtteranceFrame(
        frame
    ) {
        const utterance =
            SpeechMenu.#utterance;

        if (!utterance) {
            return;
        }

        utterance.sampleCount +=
            frame.length;

        SpeechMenu.#recognizer
            ?.accept(
                utterance.id,
                frame.samples
            );
    }

    static #finishUtterance(
        reason,
        recognize
    ) {
        const utterance =
            SpeechMenu.#utterance;

        if (!utterance) return;

        if (
            recognize &&
            !utterance.committed
        ) {
            SpeechMenu.#finishedUtterances
                .set(
                    utterance.id,
                    utterance
                );
        }

        SpeechMenu.#stopLiveRecognition(
            utterance,
            recognize
        );

        SpeechMenu.#utterance =
            undefined;

        const sampleRate =
            globalThis.SherpaRecognizer
                ?.sampleRate ||
            16000;

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
            !utterance.committing &&
            !(
                SpeechMenu.#pipeline ===
                    "silero" &&
                reason ===
                    "vad-silence"
            )
        ) {
            void SpeechMenu.#commitUtterance(
                utterance
            );
        }
    }

    static #onSherpaTranscript = event => {
        const detail =
            event.detail || {};
        const id =
            detail.utteranceId;
        const active =
            SpeechMenu.#utterance;
        const utterance =
            active?.id === id
                ? active
                : SpeechMenu
                    .#finishedUtterances
                    .get(id);

        if (!utterance) {
            return;
        }

        const transcript =
            SpeechMenu
                .#normalizeTranscript(
                    detail.transcript
                );

        if (!transcript) {
            return;
        }

        const receivedAt =
            performance.now();
        const isFirstTranscript =
            utterance.firstTranscriptAt ===
                undefined;

        if (isFirstTranscript) {
            utterance.firstTranscriptAt =
                receivedAt;
        }

        SpeechMenu.#emit(
            "speechRecognitionTiming",
            {
                backend:
                    "sherpa",
                utteranceId:
                    id,
                isFinal:
                    Boolean(
                        detail.isFinal
                    ),
                isFirstTranscript,
                firstTranscriptMilliseconds:
                    utterance.firstTranscriptAt -
                    utterance.startedAt,
                transcriptMilliseconds:
                    receivedAt -
                    utterance.startedAt,
                decodeMilliseconds:
                    Number(
                        detail.decodeMilliseconds
                    ) || 0
            }
        );

        if (
            active === utterance
        ) {
            void SpeechMenu
                .#handleLiveTranscript(
                    utterance,
                    transcript,
                    Boolean(
                        detail.isFinal
                    )
                );
            return;
        }

        if (!detail.isFinal) {
            return;
        }

        SpeechMenu.#finishedUtterances
            .delete(id);

        void SpeechMenu
            .#handleCompletedTranscript(
                utterance,
                transcript
            );
    };

    static #onSherpaError = event => {
        const detail =
            event.detail || {};

        SpeechMenu.#emit(
            detail.fatal
                ? "speechRecognitionFailed"
                : "speechRecognitionStreamingFailed",
            {
                utteranceId:
                    detail.utteranceId,
                error:
                    detail.error ||
                    "SherpaError",
                message:
                    detail.message ||
                    "Sherpa recognition failed."
            }
        );
    };

    static #onSherpaStatus = event => {
        SpeechMenu.#emit(
            "speechRecognitionStatusChanged",
            {
                status:
                    event.detail?.status ||
                    ""
            }
        );
    };

    static #onSherpaUtteranceEnded = event => {
        const id =
            event.detail?.utteranceId;

        if (
            SpeechMenu.#utterance?.id === id
        ) {
            return;
        }

        const utterance =
            SpeechMenu.#finishedUtterances
                .get(id);

        if (!utterance) {
            return;
        }

        SpeechMenu.#finishedUtterances
            .delete(id);

        if (
            !utterance.transcript &&
            !String(
                event.detail?.transcript ||
                ""
            ).trim()
        ) {
            SpeechMenu.#emit(
                "utteranceUnrecognized",
                {
                    id
                }
            );
        }
    };

    static #stopLiveRecognition(
        utterance,
        finalize = true
    ) {
        if (
            !utterance ||
            utterance.recognitionStopped
        ) {
            return;
        }

        utterance.recognitionStopped =
            true;

        if (finalize) {
            SpeechMenu.#recognizer
                ?.finishUtterance(
                    utterance.id
                );
        }
        else {
            SpeechMenu.#recognizer
                ?.abortUtterance(
                    utterance.id
                );
        }
    }

    static async #handleLiveTranscript(
        utterance,
        transcript,
        isFinal
    ) {
        if (
            !utterance ||
            utterance.committed ||
            SpeechMenu.#stopped ||
            SpeechMenu.#utterance !==
                utterance ||
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

        const revision =
            ++utterance.transcriptRevision;

        SpeechMenu.#emit(
            "utteranceTranscriptChanged",
            {
                id: utterance.id,
                transcript,
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
            SpeechMenu.#utterance !==
                utterance ||
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
                                SpeechMenu
                                    .#executionEnabled
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

    static async #handleCompletedTranscript(
        utterance,
        transcript
    ) {
        utterance.transcript =
            transcript;

        SpeechMenu.#emit(
            "utteranceTranscriptChanged",
            {
                id:
                    utterance.id,
                transcript,
                isFinal: true
            }
        );

        SpeechMenu.#emit(
            "utteranceTranscribed",
            {
                id:
                    utterance.id,
                transcript,
                live: false
            }
        );

        if (SpeechMenu.#sleeping) {
            if (
                SpeechMenu.#test(
                    SpeechMenu.#wakePhrase,
                    transcript
                )
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
            }

            return;
        }

        if (
            SpeechMenu.#test(
                SpeechMenu.#sleepPhrase,
                transcript
            )
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

            return;
        }

        await SpeechMenu.#processTranscript(
            transcript,
            utterance.id,
            SpeechMenu.#executionEnabled
        );
    }

    static #normalizeTranscript(value) {
        return String(value || "")
            .toLocaleLowerCase()
            .trim()
            .replace(
                /(\d)\.(?=\d)/g,
                "$1\uFFFF"
            )
            .replace(
                /[^\p{L}\p{N}\s:\uFFFF]/gu,
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
        SpeechMenu.extrapolatePhrases();

        for (
            const element of
            SpeechMenu.#availableCandidates()
        ) {
            const result =
                await SpeechMenu
                    .#processElement(
                        element,
                        text,
                        utteranceId,
                        SpeechMenu
                            .#candidateMenu(
                                element
                            ),
                        execute
                    );

            if (result) {
                return result;
            }
        }

        return false;
    }

    static #candidateMenu(element) {
        return (
            element.closest(
                "speech-menu"
            ) ||
            element.closest(
                "dialog, details, [popover]"
            ) ||
            undefined
        );
    }

    static #normalizeModal(value) {
        if (value === "top-level") {
            return "top-level";
        }

        if (
            value === "default" ||
            value === ""
        ) {
            return "default";
        }

        return undefined;
    }

    static #effectiveModal(element) {
        if (
            element.hasAttribute(
                "speech-modal"
            )
        ) {
            return SpeechMenu
                .#normalizeModal(
                    element.getAttribute(
                        "speech-modal"
                    )
                );
        }

        const menu =
            element.closest(
                "speech-menu"
            );

        if (
            menu?.hasAttribute(
                "speech-modal"
            )
        ) {
            return SpeechMenu
                .#normalizeModal(
                    menu.getAttribute(
                        "speech-modal"
                    )
                );
        }

        return undefined;
    }

    static #openPopover(element) {
        try {
            return element.matches(
                ":popover-open"
            );
        }
        catch {
            return false;
        }
    }

    static #speechIndex(
        element
    ) {
        if (!element) return 0;

        const value =
            Number(
                element.getAttribute(
                    "speech-index"
                )
            );

        return Number.isFinite(value)
            ? value
            : 0;
    }

    static #candidatePriority(
        element
    ) {
        return {
            menu:
                SpeechMenu
                    .#speechIndex(
                        element.closest(
                            "speech-menu"
                        )
                    ),
            command:
                SpeechMenu
                    .#speechIndex(
                        element
                    )
        };
    }

    static #sortCandidates(
        elements
    ) {
        return elements
            .map(
                (element, order) => ({
                    element,
                    order,
                    priority:
                        SpeechMenu
                            .#candidatePriority(
                                element
                            )
                })
            )
            .sort(
                (left, right) =>
                    right.priority.menu -
                        left.priority.menu ||
                    right.priority.command -
                        left.priority.command ||
                    left.order -
                        right.order
            )
            .map(
                item =>
                    item.element
            );
    }

    static #availableCandidates() {
        const all =
            [
                ...document
                    .querySelectorAll(
                        "[speech-pattern]"
                    )
            ];

        const topLevel = [];
        const defaults = [];
        const contextual = [];

        for (const element of all) {
            const modal =
                SpeechMenu
                    .#effectiveModal(
                        element
                    );

            if (modal === "top-level") {
                topLevel.push(element);
            }
            else if (modal === "default") {
                defaults.push(element);
            }
            else {
                contextual.push(element);
            }
        }

        const result = [];
        const seen = new Set();
        const append =
            elements => {
                for (
                    const element of
                    SpeechMenu
                        .#sortCandidates(
                            elements
                        )
                ) {
                    if (seen.has(element)) {
                        continue;
                    }

                    seen.add(element);
                    result.push(element);
                }
            };

        append(topLevel);

        const dialog =
            [
                ...document
                    .querySelectorAll(
                        "dialog[open]"
                    )
            ].at(-1);

        if (dialog) {
            append(
                contextual.filter(
                    element =>
                        dialog.contains(
                            element
                        )
                )
            );

            append(defaults);
            return result;
        }

        append(defaults);

        const openContainers =
            [
                ...document
                    .querySelectorAll(
                        "details[open]"
                    ),
                ...[
                    ...document
                        .querySelectorAll(
                            "[popover]"
                        )
                ]
                    .filter(
                        SpeechMenu
                            .#openPopover
                    )
            ];

        for (const container of openContainers) {
            append(
                contextual.filter(
                    element =>
                        container.contains(
                            element
                        )
                )
            );
        }

        append(
            contextual.filter(
                element => {
                    if (
                        element.closest(
                            "dialog"
                        )
                    ) {
                        return false;
                    }

                    if (
                        element.closest(
                            "details"
                        )
                    ) {
                        return false;
                    }

                    if (
                        element.closest(
                            "[popover]"
                        )
                    ) {
                        return false;
                    }

                    return true;
                }
            )
        );

        return result;
    }

    static #stripRegexAnchors(
        source
    ) {
        let text =
            String(source || "")
                .trim();

        if (text.startsWith("^")) {
            text = text.slice(1);
        }

        if (
            text.endsWith("$") &&
            !text.endsWith("\\$")
        ) {
            text = text.slice(0, -1);
        }

        return text;
    }

    static #splitPhraseExclusions(
        source
    ) {
        const text =
            String(source || "")
                .trim();

        const prefix =
            "^(?!(?:";
        const marker =
            ")$)(?:";
        const suffix =
            ")$";

        if (
            text.startsWith(prefix) &&
            text.endsWith(suffix)
        ) {
            const markerIndex =
                text.indexOf(
                    marker,
                    prefix.length
                );

            if (markerIndex >= 0) {
                const raw =
                    text.slice(
                        prefix.length,
                        markerIndex
                    );

                const exclusions = [];
                let current = "";

                for (
                    let index = 0;
                    index < raw.length;
                    index++
                ) {
                    const character =
                        raw[index];

                    if (
                        character === "\\" &&
                        index + 1 <
                            raw.length
                    ) {
                        current +=
                            character +
                            raw[++index];
                        continue;
                    }

                    if (character === "|") {
                        exclusions.push(
                            current
                        );
                        current = "";
                        continue;
                    }

                    current +=
                        character;
                }

                if (current) {
                    exclusions.push(
                        current
                    );
                }

                return {
                    base:
                        text.slice(
                            markerIndex +
                                marker.length,
                            -suffix.length
                        ),
                    exclusions:
                        exclusions.filter(
                            Boolean
                        )
                };
            }
        }

        return {
            base:
                SpeechMenu
                    .#stripRegexAnchors(
                        text
                    ),
            exclusions: []
        };
    }

    static #phraseExclusionSource(
        phrase
    ) {
        const text =
            String(phrase || "")
                .trim();

        if (!text) return "";

        const escape =
            value =>
                value.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                );

        let result = "";
        let offset = 0;
        const slots =
            /<([A-Za-z_$][\w$]*)>/g;

        for (
            let match;
            (
                match =
                    slots.exec(text)
            );
        ) {
            result +=
                escape(
                    text.slice(
                        offset,
                        match.index
                    )
                );

            result += ".+";
            offset =
                match.index +
                match[0].length;
        }

        result +=
            escape(
                text.slice(
                    offset
                )
            );

        return result;
    }

    static #expandRegexSource(
        source,
        limit = 128
    ) {
        if (typeof source !== "string") {
            return [];
        }

        const exclusionParts =
            SpeechMenu
                .#splitPhraseExclusions(
                    source
                );

        let text =
            exclusionParts.base;

        let exclusionRegex;

        if (
            exclusionParts
                .exclusions
                .length
        ) {
            try {
                exclusionRegex =
                    new RegExp(
                        "^(?:" +
                        exclusionParts
                            .exclusions
                            .join("|") +
                        ")$",
                        "i"
                    );
            }
            catch {}
        }

        let index = 0;

        const combine =
            (left, right) => {
                const output = [];

                for (const a of left) {
                    for (const b of right) {
                        output.push(a + b);

                        if (
                            output.length >=
                            limit
                        ) {
                            return output;
                        }
                    }
                }

                return output;
            };

        const placeholder =
            slotName =>
                "<" +
                (slotName || "value") +
                ">";

        const parseExpression =
            (
                stopCharacter,
                slotName
            ) => {
                const alternatives = [];
                let sequence = [""];

                while (index < text.length) {
                    const character =
                        text[index];

                    if (
                        stopCharacter &&
                        character ===
                            stopCharacter
                    ) {
                        break;
                    }

                    if (character === "|") {
                        alternatives.push(
                            ...sequence
                        );
                        sequence = [""];
                        index++;
                        continue;
                    }

                    let atom;

                    if (character === "(") {
                        index++;

                        let name;

                        if (
                            text.slice(
                                index,
                                index + 2
                            ) === "?:"
                        ) {
                            index += 2;
                        }
                        else if (
                            text.slice(
                                index,
                                index + 2
                            ) === "?<"
                        ) {
                            const close =
                                text.indexOf(
                                    ">",
                                    index + 2
                                );

                            if (close > index) {
                                name =
                                    text.slice(
                                        index + 2,
                                        close
                                    );
                                index =
                                    close + 1;
                            }
                        }

                        atom =
                            parseExpression(
                                ")",
                                name ||
                                    slotName
                            );

                        if (
                            text[index] ===
                            ")"
                        ) {
                            index++;
                        }
                    }
                    else if (
                        character === "["
                    ) {
                        const close =
                            text.indexOf(
                                "]",
                                index + 1
                            );

                        if (close < 0) {
                            atom = [
                                placeholder(
                                    slotName
                                )
                            ];
                            index++;
                        }
                        else {
                            const body =
                                text.slice(
                                    index + 1,
                                    close
                                );

                            atom =
                                /^[A-Za-z0-9]+$/
                                    .test(body)
                                    ? [...body]
                                    : [
                                        placeholder(
                                            slotName
                                        )
                                    ];

                            index =
                                close + 1;
                        }
                    }
                    else if (
                        character === "\\"
                    ) {
                        const escaped =
                            text[index + 1];

                        if (!escaped) {
                            atom = ["\\"];
                            index++;
                        }
                        else {
                            atom = [
                                escaped === "s"
                                    ? " "
                                    : escaped
                            ];
                            index += 2;
                        }
                    }
                    else if (
                        character === "."
                    ) {
                        atom = [
                            placeholder(
                                slotName
                            )
                        ];
                        index++;
                    }
                    else {
                        atom = [character];
                        index++;
                    }

                    const quantifier =
                        text[index];

                    if (quantifier === "?") {
                        atom = [
                            "",
                            ...atom
                        ];
                        index++;
                    }
                    else if (
                        quantifier === "+" ||
                        quantifier === "*"
                    ) {
                        index++;
                    }
                    else if (
                        quantifier === "{"
                    ) {
                        const close =
                            text.indexOf(
                                "}",
                                index + 1
                            );

                        if (close >= 0) {
                            index =
                                close + 1;
                        }
                    }

                    sequence =
                        combine(
                            sequence,
                            atom
                        );

                    if (
                        sequence.length >=
                        limit
                    ) {
                        break;
                    }
                }

                alternatives.push(
                    ...sequence
                );

                return [
                    ...new Set(
                        alternatives
                    )
                ].slice(0, limit);
            };

        return parseExpression()
            .map(
                phrase =>
                    phrase
                        .replace(
                            /\s+/g,
                            " "
                        )
                        .trim()
            )
            .filter(Boolean)
            .filter(
                phrase =>
                    !exclusionRegex ||
                    !exclusionRegex
                        .test(
                            phrase
                        )
            )
            .filter(
                (
                    phrase,
                    phraseIndex,
                    phrases
                ) =>
                    phrases.indexOf(
                        phrase
                    ) ===
                    phraseIndex
            )
            .slice(0, limit);
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
        const captureNode =
            SpeechMenu.#captureNode;

        SpeechMenu.#captureNode =
            undefined;

        if (captureNode) {
            try {
                captureNode.port
                    .removeEventListener(
                        "message",
                        SpeechMenu.#onAudioWorkletMessage
                    );
            }
            catch {}

            try {
                captureNode.disconnect();
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

        const recognizer =
            SpeechMenu.#recognizer;

        SpeechMenu.#recognizer =
            undefined;

        if (recognizer) {
            try {
                recognizer.removeEventListener(
                    "transcript",
                    SpeechMenu.#onSherpaTranscript
                );
                recognizer.removeEventListener(
                    "error",
                    SpeechMenu.#onSherpaError
                );
                recognizer.removeEventListener(
                    "status",
                    SpeechMenu.#onSherpaStatus
                );
                recognizer.removeEventListener(
                    "utteranceEnded",
                    SpeechMenu.#onSherpaUtteranceEnded
                );
                recognizer.close();
            }
            catch {}
        }

        const vad =
            SpeechMenu.#vad;

        SpeechMenu.#vad =
            undefined;

        if (vad) {
            try {
                vad.removeEventListener(
                    "speechStart",
                    SpeechMenu.#onVadSpeechStart
                );
                vad.removeEventListener(
                    "speechEnd",
                    SpeechMenu.#onVadSpeechEnd
                );
                vad.removeEventListener(
                    "error",
                    SpeechMenu.#onVadError
                );
                vad.removeEventListener(
                    "status",
                    SpeechMenu.#onVadStatus
                );
                vad.close();
            }
            catch {}
        }

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

        SpeechMenu.#finishedUtterances
            .clear();

        SpeechMenu.#utterance =
            undefined;
    }
}

globalThis.SpeechMenu = SpeechMenu;
