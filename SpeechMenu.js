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
    static #terminalCommitSilenceTimeout = 120;
    static #maximumCandidateHoldTimeout = 1000;
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
    static #corrections = Object.freeze([]);
    static #correctionsRevision = "empty";

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
                            "disabled",
                            "inert",
                            "aria-hidden",
                            "speech-available"
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
    static get corrections() { return SpeechMenu.#corrections; }
    static get correctionsRevision() { return SpeechMenu.#correctionsRevision; }

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

    static async loadCorrections(
        url = "api/speech-corrections/?language=en-US"
    ) {
        try {
            const response =
                await fetch(
                    url,
                    {
                        credentials:
                            "same-origin",
                        cache:
                            "no-store",
                        headers: {
                            "Accept":
                                "application/json"
                        }
                    }
                );

            const data =
                await response.json();

            if (
                !response.ok ||
                !Array.isArray(
                    data.corrections
                )
            ) {
                throw new Error(
                    data.message ||
                    "Speech corrections could not be loaded."
                );
            }

            SpeechMenu.#corrections =
                Object.freeze(
                    data.corrections
                        .filter(
                            correction =>
                                correction &&
                                correction.enabled !== false &&
                                typeof correction.observed ===
                                    "string" &&
                                typeof correction.canonical ===
                                    "string"
                        )
                        .map(
                            correction =>
                                Object.freeze({
                                    id:
                                        Number(
                                            correction.id
                                        ) || 0,
                                    observed:
                                        SpeechMenu
                                            .#normalizeTranscript(
                                                correction.observed
                                            ),
                                    observedCompact:
                                        String(
                                            correction.observedCompact ||
                                            SpeechMenu
                                                .#compactTranscript(
                                                    correction.observed
                                                )
                                        ),
                                    canonical:
                                        SpeechMenu
                                            .#normalizeTranscript(
                                                correction.canonical
                                            ),
                                    canonicalCompact:
                                        String(
                                            correction.canonicalCompact ||
                                            SpeechMenu
                                                .#compactTranscript(
                                                    correction.canonical
                                                )
                                        ),
                                    matchType:
                                        correction.matchType ===
                                            "prefix"
                                            ? "prefix"
                                            : "exact",
                                    occurrences:
                                        Number(
                                            correction.occurrences
                                        ) || 1
                                })
                        )
                );

            SpeechMenu.#correctionsRevision =
                String(
                    data.revision ||
                    "unknown"
                );

            SpeechMenu.#emit(
                "speechCorrectionsChanged",
                {
                    corrections:
                        SpeechMenu.#corrections,
                    revision:
                        SpeechMenu.#correctionsRevision
                }
            );

            return true;
        }
        catch (error) {
            globalThis
                .WMOFPresentationSetters
                ?.cancelSpeechResponse?.(
                    responseSession
                );

            SpeechMenu.#emit(
                "speechCorrectionsFailed",
                {
                    error,
                    message:
                        error?.message ||
                        "Speech corrections could not be loaded."
                }
            );

            return false;
        }
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

        const previousPhrases =
            SpeechMenu.#phrases;
        const previousGroups =
            SpeechMenu.#phraseGroups;

        SpeechMenu.#phraseGroups =
            Object.freeze(groups);

        SpeechMenu.#phrases =
            Object.freeze(phrases);

        const phrasesChanged =
            previousPhrases.length !==
                phrases.length ||
            previousPhrases.some(
                (phrase, index) =>
                    phrase !==
                    phrases[index]
            );

        const groupsChanged =
            previousGroups.length !==
                groups.length ||
            previousGroups.some(
                (group, index) => {
                    const next =
                        groups[index];

                    return (
                        !next ||
                        group.element !==
                            next.element ||
                        group.pattern !==
                            next.pattern ||
                        group.phrases.length !==
                            next.phrases.length ||
                        group.phrases.some(
                            (
                                phrase,
                                phraseIndex
                            ) =>
                                phrase !==
                                next.phrases[
                                    phraseIndex
                                ]
                        )
                    );
                }
            );

        if (
            phrasesChanged ||
            groupsChanged
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

            if (phrasesChanged) {
                SpeechMenu
                    .#refreshRecognizerHotwords();
            }
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
            SpeechMenu.#utterance &&
            SpeechMenu.#utterance
                .candidateHardCommitAt !==
                undefined &&
            now >=
                SpeechMenu.#utterance
                    .candidateHardCommitAt &&
            !SpeechMenu.#utterance
                .committed &&
            !SpeechMenu.#utterance
                .committing
        ) {
            SpeechMenu
                .#commitHeldCandidate(
                    SpeechMenu.#utterance
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
            (
                SpeechMenu.#utterance.committed ||
                SpeechMenu.#utterance
                    .recognitionStopped
            ) &&
            level >= SpeechMenu.#speechThreshold
        ) {
            SpeechMenu
                .#clearCandidatePool(
                    SpeechMenu.#utterance
                );

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
                !SpeechMenu.#utterance
                    .committed &&
                !SpeechMenu.#utterance
                    .committing &&
                SpeechMenu
                    .#exactCandidate(
                        SpeechMenu.#utterance
                    ) &&
                SpeechMenu.#utterance
                    .silenceMilliseconds >=
                    SpeechMenu
                        .#commitSilenceTimeout
            ) {
                /*
                 * Silence means the speaker stopped. At that point a
                 * shorter exact phrase may commit even if it had longer
                 * continuations (for example "ready" vs "ready at …").
                 */
                void SpeechMenu
                    .#commitUtterance(
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
                "silero"
        ) {
            return;
        }

        if (
            SpeechMenu.#utterance
                ?.recognitionStopped
        ) {
            SpeechMenu.#finishUtterance(
                "recognition-committed",
                false
            );
        }

        if (SpeechMenu.#utterance) {
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
            const utterance =
                SpeechMenu.#utterance;

            if (
                !utterance.committed &&
                !utterance.committing &&
                SpeechMenu
                    .#exactCandidate(
                        utterance
                    )
            ) {
                void SpeechMenu
                    .#commitUtterance(
                        utterance
                    );
            }
            else {
                SpeechMenu.#finishUtterance(
                    "vad-silence",
                    true
                );
            }
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
        SpeechMenu
            .#cancelPendingRecognitionForBargeIn();

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
            candidatePool: [],
            candidatePoolController:
                undefined,
            candidateCommitTimer:
                undefined,
            candidateHardCommitTimer:
                undefined,
            candidateHardCommitAt:
                undefined,
            lastExactCandidate:
                undefined,
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

    static #cancelPendingRecognitionForBargeIn() {
        for (
            const [
                id,
                utterance
            ] of SpeechMenu
                .#finishedUtterances
        ) {
            SpeechMenu
                .#clearCandidatePool(
                    utterance
                );

            SpeechMenu
                .#stopLiveRecognition(
                    utterance,
                    false
                );

            SpeechMenu
                .#finishedUtterances
                .delete(id);
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

        const exactCandidate =
            SpeechMenu
                .#exactCandidate(
                    utterance
                );

        if (
            recognize &&
            exactCandidate &&
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
        else {
            SpeechMenu
                .#clearCandidatePool(
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
            utterance.committing ||
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

        SpeechMenu
            .#cancelCandidateWork(
                utterance
            );

        const controller =
            new AbortController();

        utterance.candidatePoolController =
            controller;

        let pool;

        if (SpeechMenu.#sleeping) {
            pool =
                SpeechMenu.#test(
                    SpeechMenu.#wakePhrase,
                    transcript
                )
                    ? [{
                        kind: "wake",
                        transcript,
                        exact: true,
                        continuation: false,
                        order: 0
                    }]
                    : [];
        }
        else if (
            SpeechMenu.#test(
                SpeechMenu.#sleepPhrase,
                transcript
            )
        ) {
            pool = [{
                kind: "mute",
                transcript,
                exact: true,
                continuation: false,
                order: 0
            }];
        }
        else {
            pool =
                await SpeechMenu
                    .#refreshCandidatePool(
                        utterance,
                        transcript,
                        controller.signal
                    );
        }

        if (
            controller.signal.aborted ||
            SpeechMenu.#utterance !==
                utterance ||
            utterance.committed ||
            revision !==
                utterance.transcriptRevision ||
            utterance.candidatePoolController !==
                controller
        ) {
            return;
        }

        utterance.candidatePool =
            pool;

        if (
            !pool.length &&
            !utterance.committing &&
            !utterance.lastExactCandidate &&
            !SpeechMenu.#sleeping
        ) {
            const id =
                utterance.id;
            const failedTranscript =
                utterance.transcript;

            SpeechMenu.#finishUtterance(
                "no-candidates",
                false
            );

            SpeechMenu.#emit(
                "utteranceUnrecognized",
                {
                    id,
                    transcript:
                        failedTranscript,
                    reason:
                        "no-candidates",
                    fast: true
                }
            );

            return;
        }

        SpeechMenu
            .#scheduleCandidateCommit(
                utterance,
                revision
            );
    }

    static async #commitUtterance(
        utterance
    ) {
        const candidate =
            SpeechMenu
                .#exactCandidate(
                    utterance
                );

        if (
            !utterance ||
            utterance.committed ||
            utterance.committing ||
            !candidate
        ) {
            return false;
        }

        utterance.committing =
            true;

        const transcript =
            utterance.transcript;

        SpeechMenu
            .#cancelCandidateWork(
                utterance
            );

        /*
         * The recognition decision is complete before the action is.
         * Cut the Sherpa stream now so a slow UI/API action cannot let
         * later speech grow onto this already-accepted utterance.
         */
        SpeechMenu.#stopLiveRecognition(
            utterance,
            false
        );

        let committed =
            false;

        try {
            if (
                candidate.kind ===
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
                candidate.kind ===
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
                            .#processElement(
                                candidate
                                    .commandElement,
                                transcript,
                                utterance.id,
                                candidate
                                    .speechMenuElement,
                                SpeechMenu
                                    .#executionEnabled
                            )
                    );
            }

            if (committed) {
                utterance.committed =
                    true;

                SpeechMenu
                    .#clearCandidatePool(
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
        SpeechMenu
            .#clearCandidatePool(
                utterance
            );

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

        const matched =
            await SpeechMenu.#processTranscript(
                transcript,
                utterance.id,
                SpeechMenu.#executionEnabled
            );

        if (!matched) {
            SpeechMenu.#emit(
                "utteranceUnrecognized",
                {
                    id:
                        utterance.id,
                    transcript
                }
            );
        }
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

    static #compactTranscript(value) {
        return SpeechMenu
            .#normalizeTranscript(
                value
            )
            .replace(
                /\s+/g,
                ""
            );
    }

    static #whitespaceTolerantSource(
        source
    ) {
        const text =
            String(source || "");

        let result = "";
        let escaped = false;
        let characterClass = false;

        for (
            let index = 0;
            index < text.length;
            index++
        ) {
            const character =
                text[index];

            if (escaped) {
                result +=
                    character;
                escaped = false;
                continue;
            }

            if (character === "\\") {
                result +=
                    character;
                escaped = true;
                continue;
            }

            if (character === "[") {
                characterClass =
                    true;
                result +=
                    character;
                continue;
            }

            if (
                character === "]" &&
                characterClass
            ) {
                characterClass =
                    false;
                result +=
                    character;
                continue;
            }

            if (
                !characterClass &&
                /\s/.test(
                    character
                )
            ) {
                result +=
                    "\\s*";

                while (
                    index + 1 <
                        text.length &&
                    /\s/.test(
                        text[
                            index + 1
                        ]
                    )
                ) {
                    index++;
                }

                continue;
            }

            result +=
                character;
        }

        return result;
    }

    static #compactPrefixRemainder(
        text,
        compactPrefix
    ) {
        const normalized =
            SpeechMenu
                .#normalizeTranscript(
                    text
                );

        const target =
            String(
                compactPrefix ||
                ""
            );

        if (!target) {
            return undefined;
        }

        let compactIndex = 0;

        for (
            let index = 0;
            index < normalized.length;
            index++
        ) {
            const character =
                normalized[index];

            if (/\s/.test(character)) {
                continue;
            }

            if (
                character !==
                target[
                    compactIndex
                ]
            ) {
                return undefined;
            }

            compactIndex++;

            if (
                compactIndex ===
                target.length
            ) {
                return normalized
                    .slice(
                        index + 1
                    )
                    .trim();
            }
        }

        return undefined;
    }

    static #candidateAllowsCorrection(
        element,
        correction
    ) {
        const normal =
            element.speechPattern;

        const compact =
            element.speechCompactPattern;

        const test =
            value => {
                for (
                    const regex of
                    [normal, compact]
                ) {
                    if (!regex) continue;
                    regex.lastIndex = 0;

                    if (
                        regex.test(
                            value
                        )
                    ) {
                        return true;
                    }
                }

                return false;
            };

        if (
            correction.matchType ===
                "exact"
        ) {
            return test(
                correction.canonical
            );
        }

        return (
            test(
                correction.canonical +
                " value"
            ) ||
            SpeechMenu
                .#expandRegexSource(
                    element.getAttribute(
                        "speech-pattern"
                    ) ||
                    ""
                )
                .some(
                    phrase =>
                        SpeechMenu
                            .#compactTranscript(
                                phrase.replace(
                                    /<[^>]+>/g,
                                    ""
                                )
                            )
                            .startsWith(
                                correction
                                    .canonicalCompact
                            )
                )
        );
    }

    static #applyCorrection(
        element,
        text
    ) {
        const transcript =
            SpeechMenu
                .#normalizeTranscript(
                    text
                );

        const compact =
            SpeechMenu
                .#compactTranscript(
                    transcript
                );

        for (
            const correction of
            SpeechMenu.#corrections
        ) {
            if (
                !SpeechMenu
                    .#candidateAllowsCorrection(
                        element,
                        correction
                    )
            ) {
                continue;
            }

            if (
                correction.matchType ===
                    "exact"
            ) {
                if (
                    compact !==
                    correction
                        .observedCompact
                ) {
                    continue;
                }

                return {
                    correction,
                    original:
                        transcript,
                    corrected:
                        correction
                            .canonical
                };
            }

            const remainder =
                SpeechMenu
                    .#compactPrefixRemainder(
                        transcript,
                        correction
                            .observedCompact
                    );

            if (
                remainder ===
                    undefined
            ) {
                continue;
            }

            return {
                correction,
                original:
                    transcript,
                corrected:
                    SpeechMenu
                        .#normalizeTranscript(
                            correction
                                .canonical +
                            (
                                remainder
                                    ? " " +
                                        remainder
                                    : ""
                            )
                        )
            };
        }

        return undefined;
    }

    static #test(regex, text) {
        regex.lastIndex = 0;
        return regex.test(text);
    }

    static #cancelCandidateWork(
        utterance
    ) {
        if (
            utterance
                ?.candidateCommitTimer !==
            undefined
        ) {
            clearTimeout(
                utterance
                    .candidateCommitTimer
            );

            utterance.candidateCommitTimer =
                undefined;
        }

        const controller =
            utterance
                ?.candidatePoolController;

        if (
            controller &&
            !controller.signal.aborted
        ) {
            controller.abort();
        }

        if (utterance) {
            utterance.candidatePoolController =
                undefined;
        }
    }

    static #clearCandidatePool(
        utterance
    ) {
        if (!utterance) return;

        SpeechMenu
            .#cancelCandidateWork(
                utterance
            );

        if (
            utterance
                .candidateHardCommitTimer !==
            undefined
        ) {
            clearTimeout(
                utterance
                    .candidateHardCommitTimer
            );

            utterance.candidateHardCommitTimer =
                undefined;
        }

        utterance.candidateHardCommitAt =
            undefined;
        utterance.lastExactCandidate =
            undefined;
        utterance.candidatePool = [];
    }

    static #exactCandidate(
        utterance
    ) {
        return utterance
            ?.candidatePool
            ?.find(
                candidate =>
                    candidate.exact
            );
    }

    static #hasCompetingContinuation(
        utterance,
        exactCandidate
    ) {
        return Boolean(
            utterance
                ?.candidatePool
                ?.some(
                    candidate =>
                        candidate !==
                            exactCandidate &&
                        candidate
                            .continuation
                )
        );
    }

    static #commitHeldCandidate(
        utterance
    ) {
        if (
            !utterance ||
            utterance.committed ||
            utterance.committing
        ) {
            return false;
        }

        const candidate =
            SpeechMenu
                .#exactCandidate(
                    utterance
                ) ||
            utterance.lastExactCandidate;

        if (!candidate) {
            return false;
        }

        utterance.candidatePool = [
            candidate
        ];

        if (candidate.transcript) {
            utterance.transcript =
                candidate.transcript;
        }

        void SpeechMenu
            .#commitUtterance(
                utterance
            );

        return true;
    }

    static #candidateCommitTimeout(
        utterance
    ) {
        return utterance
            ?.candidatePool
            ?.some(
                candidate =>
                    candidate.continuation
            )
                ? SpeechMenu
                    .#commitSilenceTimeout
                : Math.min(
                    SpeechMenu
                        .#commitSilenceTimeout,
                    SpeechMenu
                        .#terminalCommitSilenceTimeout
                );
    }

    static #scheduleCandidateCommit(
        utterance,
        revision
    ) {
        const exactCandidate =
            SpeechMenu
                .#exactCandidate(
                    utterance
                );

        if (
            !utterance ||
            utterance.committed ||
            utterance.committing ||
            !exactCandidate ||
            exactCandidate.kind ===
                "wake"
        ) {
            return false;
        }

        if (
            SpeechMenu
                .#hasCompetingContinuation(
                    utterance,
                    exactCandidate
                )
        ) {
            return false;
        }

        utterance.lastExactCandidate = {
            ...exactCandidate,
            transcript:
                utterance.transcript
        };

        if (
            utterance
                .candidateHardCommitTimer ===
            undefined
        ) {
            utterance.candidateHardCommitAt =
                performance.now() +
                SpeechMenu
                    .#maximumCandidateHoldTimeout;

            utterance.candidateHardCommitTimer =
                setTimeout(
                    () => {
                        utterance
                            .candidateHardCommitTimer =
                            undefined;

                        if (
                            SpeechMenu.#stopped ||
                            SpeechMenu.#utterance !==
                                utterance ||
                            utterance.committed ||
                            utterance.committing
                        ) {
                            return;
                        }

                        SpeechMenu
                            .#commitHeldCandidate(
                                utterance
                            );
                    },
                    SpeechMenu
                        .#maximumCandidateHoldTimeout
                );
        }

        if (
            utterance
                .candidateCommitTimer !==
            undefined
        ) {
            clearTimeout(
                utterance
                    .candidateCommitTimer
            );
        }

        const delay =
            SpeechMenu
                .#candidateCommitTimeout(
                    utterance
                );

        utterance.candidateCommitTimer =
            setTimeout(
                () => {
                    utterance
                        .candidateCommitTimer =
                        undefined;

                    if (
                        SpeechMenu.#stopped ||
                        SpeechMenu.#utterance !==
                            utterance ||
                        utterance.committed ||
                        utterance.committing ||
                        utterance.transcriptRevision !==
                            revision ||
                        !SpeechMenu
                            .#exactCandidate(
                                utterance
                            )
                    ) {
                        return;
                    }

                    void SpeechMenu
                        .#commitUtterance(
                            utterance
                        );
                },
                delay
            );

        return true;
    }

    static #phraseCanContinue(
        transcript,
        phrase
    ) {
        const spoken =
            SpeechMenu
                .#normalizeTranscript(
                    transcript
                )
                .split(" ")
                .filter(Boolean);

        const template =
            String(
                phrase ||
                ""
            )
                .toLocaleLowerCase()
                .trim()
                .replace(
                    /\s+/g,
                    " "
                )
                .split(" ")
                .filter(Boolean);

        if (
            !spoken.length ||
            !template.length
        ) {
            return false;
        }

        const placeholder =
            token =>
                /^<[A-Za-z_$][\w$]*>$/
                    .test(token);

        const visit =
            (
                templateIndex,
                spokenIndex
            ) => {
                if (
                    spokenIndex >=
                    spoken.length
                ) {
                    return (
                        templateIndex <
                        template.length
                    );
                }

                if (
                    templateIndex >=
                    template.length
                ) {
                    return false;
                }

                const token =
                    template[
                        templateIndex
                    ];

                if (
                    !placeholder(token)
                ) {
                    if (
                        token !==
                        spoken[
                            spokenIndex
                        ]
                    ) {
                        return false;
                    }

                    return visit(
                        templateIndex + 1,
                        spokenIndex + 1
                    );
                }

                for (
                    let next =
                        spokenIndex + 1;
                    next <=
                        spoken.length;
                    next++
                ) {
                    if (
                        next ===
                        spoken.length
                    ) {
                        return true;
                    }

                    if (
                        visit(
                            templateIndex + 1,
                            next
                        )
                    ) {
                        return true;
                    }
                }

                return false;
            };

        return visit(
            0,
            0
        );
    }


    static #elementContinuationDepth(
        element,
        transcript
    ) {
        const group =
            SpeechMenu.#phraseGroups
                .find(
                    item =>
                        item.element ===
                        element
                );

        if (!group) {
            return undefined;
        }

        let depth;

        for (
            const phrase of
            group.phrases
        ) {
            if (
                !SpeechMenu
                    .#phraseCanContinue(
                        transcript,
                        phrase
                    )
            ) {
                continue;
            }

            const words =
                String(phrase)
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .length;

            depth =
                depth === undefined
                    ? words
                    : Math.min(
                        depth,
                        words
                    );
        }

        return depth;
    }

    static async #refreshCandidatePool(
        utterance,
        transcript,
        signal
    ) {
        SpeechMenu.extrapolatePhrases();

        const previous =
            utterance.candidatePool ||
            [];

        const previousElements =
            new Set(
                previous
                    .map(
                        candidate =>
                            candidate
                                .commandElement
                    )
                    .filter(Boolean)
            );

        const all =
            SpeechMenu
                .#availableCandidates();

        const source =
            previousElements.size
                ? all.filter(
                    element =>
                        previousElements
                            .has(element)
                )
                : all;

        const evaluated =
            await Promise.all(
                source.map(
                    async (
                        element,
                        order
                    ) => {
                        if (signal?.aborted) {
                            return false;
                        }

                        const continuationDepth =
                            SpeechMenu
                                .#elementContinuationDepth(
                                    element,
                                    transcript
                                );

                        const speechMenuElement =
                            SpeechMenu
                                .#candidateMenu(
                                    element
                                );

                        const exact =
                            await SpeechMenu
                                .#processElement(
                                    element,
                                    transcript,
                                    utterance.id,
                                    speechMenuElement,
                                    false,
                                    signal
                                );

                        if (signal?.aborted) {
                            return false;
                        }

                        if (
                            !exact &&
                            continuationDepth ===
                                undefined
                        ) {
                            return false;
                        }

                        return {
                            kind: "command",
                            utteranceId:
                                utterance.id,
                            commandElement:
                                element,
                            speechMenuElement,
                            transcript,
                            exact:
                                Boolean(exact),
                            continuation:
                                continuationDepth !==
                                undefined,
                            depth:
                                continuationDepth ??
                                Number.MAX_SAFE_INTEGER,
                            order
                        };
                    }
                )
            );

        if (signal?.aborted) {
            return [];
        }

        let next =
            evaluated
                .filter(Boolean)
                .sort(
                    (left, right) =>
                        left.depth -
                            right.depth ||
                        left.order -
                            right.order
                );

        /*
         * The candidate pool behaves like a queue.  Newer words
         * make shorter/front candidates ineligible, so discard
         * those first before considering the longer continuations.
         */
        while (
            next.length > 1 &&
            !next[0].exact &&
            !next[0].continuation
        ) {
            next.shift();
        }

        /*
         * Recognition engines can revise earlier words.  If pruning
         * an existing queue leaves nothing, reseed from every
         * currently available speech candidate for the new revision.
         */
        if (
            !next.length &&
            previousElements.size &&
            !signal?.aborted
        ) {
            utterance.candidatePool = [];

            return SpeechMenu
                .#refreshCandidatePool(
                    utterance,
                    transcript,
                    signal
                );
        }

        return next;
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

    static #targetIsAvailable(
        target
    ) {
        if (!(target instanceof Element)) {
            return false;
        }

        if (
            target.matches?.(
                "[hidden], [inert], [aria-hidden='true'], :disabled"
            )
        ) {
            return false;
        }

        if (
            target.closest?.(
                "[hidden], [inert], [aria-hidden='true']"
            )
        ) {
            return false;
        }

        const details =
            target.closest?.(
                "details"
            );

        if (
            details &&
            !details.open
        ) {
            return false;
        }

        const popover =
            target.closest?.(
                "[popover]"
            );

        if (
            popover &&
            !SpeechMenu
                .#openPopover(
                    popover
                )
        ) {
            return false;
        }

        for (
            let current = target;
            current &&
                current !==
                    document.documentElement;
            current =
                current.parentElement
        ) {
            const dialog =
                current.matches?.("dialog")
                    ? current
                    : undefined;

            if (
                dialog &&
                !dialog.open
            ) {
                return false;
            }

            try {
                const style =
                    getComputedStyle(
                        current
                    );

                if (
                    style.display ===
                        "none" ||
                    style.visibility ===
                        "hidden" ||
                    style.visibility ===
                        "collapse"
                ) {
                    return false;
                }
            }
            catch {}
        }

        return true;
    }

    static #candidateStateAvailable(
        element
    ) {
        if (
            !element ||
            element.hasAttribute(
                "hidden"
            ) ||
            element.hasAttribute(
                "disabled"
            ) ||
            element.hasAttribute(
                "inert"
            ) ||
            element.getAttribute(
                "aria-hidden"
            ) === "true"
        ) {
            return false;
        }

        const availability =
            element.getAttribute(
                "speech-available"
            );

        if (availability) {
            const resolved =
                SpeechMenu.#resolve(
                    availability
                );

            if (!resolved) {
                return false;
            }

            try {
                if (
                    resolved.fn.call(
                        resolved.owner,
                        element
                    ) !== true
                ) {
                    return false;
                }
            }
            catch {
                return false;
            }
        }

        const target =
            SpeechMenu
                .#resolveSpeechTarget(
                    element
                );

        if (!target.selector) {
            return true;
        }

        return target.elements
            .some(
                SpeechMenu
                    .#targetIsAvailable
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
            if (
                !SpeechMenu
                    .#candidateStateAvailable(
                        element
                    )
            ) {
                continue;
            }

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

                element.speechCompactPattern =
                    new RegExp(
                        SpeechMenu
                            .#whitespaceTolerantSource(
                                source
                            ),
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

        element.speechParameterFunc =
            target.fn;

        const actionName =
            source
                .match(
                    /^WMOFActions\.([A-Za-z_$][\w$]*)$/
                )
                ?.[1];

        if (actionName) {
            const implementation =
                globalThis
                    .WMOFActionFunctions
                    ?.getImplementation?.(
                        actionName
                    );

            if (
                typeof implementation ===
                    "function"
            ) {
                element.speechParameterFunc =
                    implementation;
            }
        }

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
                    undefined,
                elements: []
            };
        }

        try {
            const elements =
                [
                    ...document
                        .querySelectorAll(
                            selector
                        )
                ];

            return {
                selector,
                element:
                    elements[0] ||
                    undefined,
                elements
            };
        }
        catch {
            return {
                selector,
                element:
                    undefined,
                elements: []
            };
        }
    }

    static async #processElement(
        element,
        transcript,
        utteranceId,
        speechMenuElement,
        execute = true,
        signal
    ) {
        if (signal?.aborted) {
            return false;
        }

        if (
            !SpeechMenu.#prepare(
                element
            )
        ) {
            return false;
        }

        let text =
            transcript;

        const correction =
            SpeechMenu
                .#applyCorrection(
                    element,
                    text
                );

        if (correction) {
            text =
                correction.corrected;
        }

        let preprocessing;

        try {
            if (
                element.speechPreprocFunc
            ) {
                const processed =
                    await Promise.resolve(
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
                                    ),
                                provisional:
                                    !execute,
                                signal
                            }
                        )
                    );

                if (signal?.aborted) {
                    return false;
                }

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
                            processed,
                        provisional:
                            !execute
                    };
                }

                text =
                    processed;
            }
        }
        catch (error) {
            if (
                signal?.aborted ||
                error?.name ===
                    "AbortError"
            ) {
                return false;
            }

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

        const args =
            new ParameterParser(
                element.speechParameterFunc ||
                element.speechFunc
            );

        let matched =
            false;

        let matchingMode =
            "normal";

        for (
            const candidate of
            [
                {
                    regex:
                        element.speechPattern,
                    mode:
                        "normal"
                },
                {
                    regex:
                        element
                            .speechCompactPattern,
                    mode:
                        "compact"
                }
            ]
        ) {
            const regex =
                candidate.regex;

            if (!regex) continue;

            regex.lastIndex = 0;

            let result;

            while (
                (
                    result =
                        regex.exec(text)
                ) !== null
            ) {
                matched = true;
                matchingMode =
                    candidate.mode;

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

            if (matched) {
                break;
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
                text,
            matchingMode,
            correctionId:
                correction?.correction
                    ?.id ||
                null,
            provisional:
                !execute
        };

        if (correction) {
            SpeechMenu.#emit(
                "speechCorrectionApplied",
                {
                    utteranceId,
                    commandElement:
                        element,
                    speechMenuElement,
                    correctionId:
                        correction
                            .correction
                            .id,
                    matchType:
                        correction
                            .correction
                            .matchType,
                    observed:
                        correction.original,
                    canonical:
                        correction.corrected
                }
            );
        }

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
                targetElements:
                    target.elements.slice(),
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
                    target.element,
                targetElements:
                    target.elements.slice()
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

        const responseSession =
            globalThis
                .WMOFPresentationSetters
                ?.beginSpeechResponse?.({
                    commandElement:
                        element,
                    targetSelector:
                        target.selector,
                    targetElements:
                        target.elements
                });

        try {
            const outcome =
                await element
                    .speechFunc
                    .apply(
                        element.speechFuncThis,
                        argumentValues
                    );

            if (outcome === false) {
                globalThis
                    .WMOFPresentationSetters
                    ?.cancelSpeechResponse?.(
                        responseSession
                    );

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

            globalThis
                .WMOFPresentationSetters
                ?.finishSpeechResponse?.(
                    responseSession,
                    {
                        commandElement:
                            element,
                        targetSelector:
                            target.selector,
                        targetElements:
                            target.elements,
                        utteranceId
                    }
                );

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
                        target.element,
                    targetElements:
                        target.elements.slice()
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
