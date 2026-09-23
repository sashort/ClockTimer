class SpeechMenu {
    static #wakePhrase = /^listen$/i;
    static #sleepPhrase = /^mute$/i;
    static #stopped = true;
    static #sleeping = false;
    static #Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
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

    static async start(language = "en-US", listSeparator = ",") {
        if (!SpeechMenu.#Recognition) {
            SpeechMenu.#emit("speechRecognitionFailed", {
                error: "NotSupportedError",
                message: "Speech recognition is not supported by this browser."
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

                if (
                    typeof context.createScriptProcessor !== "function"
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

                SpeechMenu.#sourceNode =
                    context.createMediaStreamSource(
                        stream
                    );

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

                SpeechMenu.#silentGain =
                    context.createGain();

                SpeechMenu.#silentGain.gain.value =
                    0;

                SpeechMenu.#processorNode
                    .addEventListener(
                        "audioprocess",
                        SpeechMenu.#onAudioProcess
                    );

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
        }

        return SpeechMenu.#phrases;
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

        const frame = {
            channels,
            length:
                channels[0].length
        };

        const frameMilliseconds =
            frame.length /
            input.sampleRate *
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
                    input.sampleRate
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
    }

    static #appendUtteranceFrame(
        frame
    ) {
        if (!SpeechMenu.#utterance) {
            return;
        }

        SpeechMenu.#utterance.frames.push(
            frame
        );

        SpeechMenu.#utterance.sampleCount +=
            frame.length;
    }

    static #finishUtterance(
        reason,
        recognize
    ) {
        const utterance =
            SpeechMenu.#utterance;

        if (!utterance) return;

        SpeechMenu.#stopLiveRecognition(
            utterance
        );

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
            !SpeechMenu.#micTrack
        ) {
            return false;
        }

        const recognition =
            new SpeechMenu.#Recognition();

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang =
            SpeechMenu.#language;

        utterance.liveRecognition =
            recognition;

        recognition.onresult =
            event => {
                let sessionText = "";
                let allFinal = true;

                for (
                    let index = 0;
                    index < event.results.length;
                    index++
                ) {
                    const result =
                        event.results[index];

                    const value =
                        result?.[0]?.transcript;

                    if (value) {
                        sessionText +=
                            `${sessionText ? " " : ""}${value}`;
                    }

                    if (!result?.isFinal) {
                        allFinal = false;
                    }
                }

                const transcript =
                    SpeechMenu.#normalizeTranscript(
                        `${utterance.recognitionPrefix || ""} ${sessionText}`
                    );

                if (transcript) {
                    void SpeechMenu.#handleLiveTranscript(
                        utterance,
                        transcript,
                        allFinal
                    );
                }
            };

        recognition.onerror =
            event => {
                if (
                    event.error === "aborted" ||
                    event.error === "no-speech"
                ) {
                    return;
                }

                SpeechMenu.#emit(
                    "speechRecognitionStreamingFailed",
                    {
                        utteranceId:
                            utterance.id,
                        error:
                            event.error,
                        message:
                            event.message
                    }
                );
            };

        recognition.onend =
            () => {
                if (
                    utterance.liveRecognition !==
                        recognition
                ) {
                    return;
                }

                utterance.liveRecognition =
                    undefined;

                if (
                    utterance.liveRecognitionStopped ||
                    utterance.committed ||
                    SpeechMenu.#stopped ||
                    SpeechMenu.#utterance !==
                        utterance
                ) {
                    return;
                }

                utterance.recognitionPrefix =
                    utterance.transcript || "";

                queueMicrotask(
                    () =>
                        SpeechMenu.#startLiveRecognition(
                            utterance
                        )
                );
            };

        try {
            recognition.start(
                SpeechMenu.#micTrack
            );
            return true;
        }
        catch (error) {
            utterance.liveRecognition =
                undefined;
            utterance.liveRecognitionStopped =
                true;

            SpeechMenu.#emit(
                "speechRecognitionStreamingFailed",
                {
                    utteranceId:
                        utterance.id,
                    error:
                        error?.name ||
                        "TrackInputUnsupported",
                    message:
                        error?.message ||
                        "Live speech recognition could not start from the persistent microphone track."
                }
            );
            return false;
        }
    }

    static #stopLiveRecognition(
        utterance
    ) {
        if (!utterance) return;

        utterance.liveRecognitionStopped =
            true;

        const recognition =
            utterance.liveRecognition;

        utterance.liveRecognition =
            undefined;

        if (!recognition) return;

        try {
            recognition.abort();
        }
        catch {}
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
            !SpeechMenu.#audioContext
        ) {
            return;
        }

        const context =
            SpeechMenu.#audioContext;

        const destination =
            context.createMediaStreamDestination();

        const bufferSource =
            context.createBufferSource();

        bufferSource.buffer =
            utterance.audioBuffer;

        bufferSource.connect(
            destination
        );

        const replayTrack =
            destination.stream
                .getAudioTracks()[0];

        if (!replayTrack) {
            SpeechMenu.#emit(
                "speechRecognitionFailed",
                {
                    utteranceId:
                        utterance.id,
                    error:
                        "AudioTrackError",
                    message:
                        "Unable to create an in-memory recognition audio track."
                }
            );
            return;
        }

        const recognition =
            new SpeechMenu.#Recognition();

        recognition.continuous =
            false;

        recognition.interimResults =
            false;

        recognition.lang =
            SpeechMenu.#language;

        let finalText = "";

        await new Promise(resolve => {
            let settled = false;
            let safetyTimer;

            const finish = () => {
                if (settled) return;
                settled = true;

                clearTimeout(
                    safetyTimer
                );

                try {
                    replayTrack.stop();
                }
                catch {}

                try {
                    bufferSource.disconnect();
                }
                catch {}

                resolve();
            };

            recognition.onresult =
                event => {
                    for (
                        let index =
                            event.resultIndex;
                        index <
                            event.results.length;
                        index++
                    ) {
                        const result =
                            event.results[
                                index
                            ];

                        if (!result.isFinal) {
                            continue;
                        }

                        const text =
                            SpeechMenu
                                .#normalizeTranscript(
                                    result[0]
                                        ?.transcript
                                );

                        if (text) {
                            finalText +=
                                `${finalText ? " " : ""}${text}`;
                        }
                    }
                };

            recognition.onerror =
                event => {
                    if (
                        event.error !==
                        "aborted"
                    ) {
                        SpeechMenu.#emit(
                            "speechRecognitionFailed",
                            {
                                utteranceId:
                                    utterance.id,
                                error:
                                    event.error,
                                message:
                                    event.message
                            }
                        );
                    }
                };

            recognition.onend =
                finish;

            try {
                recognition.start(
                    replayTrack
                );
            }
            catch (error) {
                SpeechMenu.#emit(
                    "speechRecognitionFailed",
                    {
                        utteranceId:
                            utterance.id,
                        error:
                            error?.name ||
                            "TrackInputUnsupported",
                        message:
                            error?.message ||
                            "This browser does not accept a supplied audio track for speech recognition."
                    }
                );

                finish();
                return;
            }

            bufferSource.addEventListener(
                "ended",
                () => {
                    setTimeout(
                        () => {
                            try {
                                recognition.stop();
                            }
                            catch {}
                        },
                        250
                    );
                },
                {once: true}
            );

            bufferSource.start();

            safetyTimer =
                setTimeout(
                    () => {
                        try {
                            recognition.abort();
                        }
                        catch {}

                        finish();
                    },
                    Math.max(
                        3500,
                        utterance.audioBuffer
                            .duration *
                            1000 +
                            3000
                    )
                );
        });

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
                transcript: finalText
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
