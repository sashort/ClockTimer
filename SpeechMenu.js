class SpeechMenu {
    static #wakePhrase = /^listen$/i;
    static #sleepPhrase = /^mute$/i;
    static #stopped = true;
    static #sleeping = false;
    static #Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    static #events = new EventTarget();
    static #separator = ",";
    static #language = "en-US";
    static #silenceTimeout = 1500;
    static #stream;
    static #micTrack;
    static #audioContext;
    static #sourceNode;
    static #analyser;
    static #mediaRecorder;
    static #meterFrame;
    static #utterance;
    static #utteranceSequence = 0;
    static #preRoll = [];
    static #preRollLimit = 4;
    static #recognitionQueue = Promise.resolve();
    static #debug = false;
    static #debugFunction = data => console.log(data);
    static #speechThreshold = 0.025;

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
    static get started() { return !SpeechMenu.#stopped; }
    static get muted() { return SpeechMenu.#sleeping; }

    static set wakePhrase(value) { SpeechMenu.#setPhrase("wake", value); }
    static set sleepPhrase(value) { SpeechMenu.#setPhrase("sleep", value); }
    static set silenceTimeout(value) {
        const milliseconds = Number(value);
        if (!Number.isFinite(milliseconds) || milliseconds < 100) {
            throw new RangeError("SpeechMenu.silenceTimeout must be at least 100 milliseconds.");
        }
        SpeechMenu.#silenceTimeout = Math.round(milliseconds);
        SpeechMenu.#emit("silenceTimeoutChanged", {silenceTimeout: SpeechMenu.#silenceTimeout});
    }
    static set debug(value) {
        const next = Boolean(value);
        if (next === SpeechMenu.#debug) return;
        SpeechMenu.#debug = next;
        SpeechMenu.#emit("debugToggled", {debug: next});
    }
    static set debugFunction(value) {
        SpeechMenu.#debugFunction = typeof value === "function" ? value : data => console.log(data);
        SpeechMenu.#emit("debugFunctionChanged", {debugFunction: SpeechMenu.#debugFunction});
    }

    static async start(language = "en-US", listSeparator = ",") {
        if (!SpeechMenu.#Recognition) {
            SpeechMenu.#emit("speechRecognitionUnsupported", {message: "Speech recognition is not supported by this browser."});
            return false;
        }
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
            SpeechMenu.#emit("speechCaptureUnsupported", {message: "Persistent microphone capture is not supported by this browser."});
            return false;
        }
        if (!SpeechMenu.#stopped) return true;

        SpeechMenu.#language = typeof language === "string" && language.trim() ? language : "en-US";
        SpeechMenu.#separator = typeof listSeparator === "string" && listSeparator ? listSeparator : ",";
        SpeechMenu.#sleeping = false;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            if (!SpeechMenu.#stopped && SpeechMenu.#stream) {
                for (const track of stream.getTracks()) track.stop();
                return true;
            }

            SpeechMenu.#stream = stream;
            SpeechMenu.#micTrack = stream.getAudioTracks()[0];
            if (!SpeechMenu.#micTrack) throw new Error("No microphone audio track was available.");

            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextCtor) throw new Error("Web Audio is not supported by this browser.");

            SpeechMenu.#audioContext = new AudioContextCtor();
            await SpeechMenu.#audioContext.resume?.();

            SpeechMenu.#sourceNode = SpeechMenu.#audioContext.createMediaStreamSource(stream);
            SpeechMenu.#analyser = SpeechMenu.#audioContext.createAnalyser();
            SpeechMenu.#analyser.fftSize = 1024;
            SpeechMenu.#analyser.smoothingTimeConstant = 0.15;
            SpeechMenu.#sourceNode.connect(SpeechMenu.#analyser);

            const recorder = new MediaRecorder(stream);
            SpeechMenu.#mediaRecorder = recorder;
            recorder.addEventListener("dataavailable", SpeechMenu.#onRecorderData);
            recorder.start(100);

            SpeechMenu.#stopped = false;
            SpeechMenu.#micTrack.addEventListener("ended", SpeechMenu.#onTrackEnded, {once: true});
            SpeechMenu.#startMeter();
            SpeechMenu.#emit("started", {
                language: SpeechMenu.#language,
                silenceTimeout: SpeechMenu.#silenceTimeout,
                deliberate: true
            });
            return true;
        }
        catch (error) {
            await SpeechMenu.#releaseCapture();
            SpeechMenu.#emit("speechRecognitionError", {
                error: error?.name || "MicrophoneError",
                message: error?.message || String(error)
            });
            return false;
        }
    }

    static async stop() {
        if (SpeechMenu.#stopped && !SpeechMenu.#stream) return false;
        SpeechMenu.#stopped = true;
        SpeechMenu.#sleeping = false;

        if (SpeechMenu.#utterance) {
            SpeechMenu.#finishUtterance("stopped");
        }

        await SpeechMenu.#releaseCapture();
        SpeechMenu.#emit("stopped", {deliberate: true});
        return true;
    }

    static refresh() {
        for (const element of document.querySelectorAll("[speech-pattern]")) {
            SpeechMenu.#prepare(element, true);
        }
    }

    static #emit(type, detail) {
        SpeechMenu.#events.dispatchEvent(
            new CustomEvent(
                type,
                detail === undefined ? undefined : {detail}
            )
        );
    }

    static #setPhrase(kind, value) {
        try {
            const regex = value instanceof RegExp ? value : new RegExp(value, "i");
            if (kind === "wake") SpeechMenu.#wakePhrase = regex;
            else SpeechMenu.#sleepPhrase = regex;
            SpeechMenu.#emit(`${kind}PhraseChanged`, {[`${kind}PhraseRegex`]: regex});
        }
        catch {
            SpeechMenu.#emit(`${kind}PhraseChangeFailed`, {
                message: `${kind}Phrase must be a valid regular expression.`
            });
        }
    }

    static #onTrackEnded = () => {
        if (SpeechMenu.#stopped) return;
        SpeechMenu.#stopped = true;
        SpeechMenu.#emit("speechCaptureEnded", {deliberate: false});
        void SpeechMenu.#releaseCapture();
    };

    static #onRecorderData = event => {
        if (!event.data || event.data.size === 0) return;

        if (SpeechMenu.#utterance) {
            SpeechMenu.#utterance.chunks.push(event.data);
        }
        else {
            SpeechMenu.#preRoll.push(event.data);
            if (SpeechMenu.#preRoll.length > SpeechMenu.#preRollLimit) {
                SpeechMenu.#preRoll.shift();
            }
        }
    };

    static #startMeter() {
        cancelAnimationFrame(SpeechMenu.#meterFrame);
        const samples = new Float32Array(SpeechMenu.#analyser.fftSize);

        const tick = now => {
            if (SpeechMenu.#stopped || !SpeechMenu.#analyser) return;

            SpeechMenu.#analyser.getFloatTimeDomainData(samples);
            let squareTotal = 0;
            for (const sample of samples) squareTotal += sample * sample;
            const level = Math.sqrt(squareTotal / samples.length);

            SpeechMenu.#emit("audioLevelChanged", {level});

            if (level >= SpeechMenu.#speechThreshold) {
                if (!SpeechMenu.#utterance) SpeechMenu.#beginUtterance(now);
                else SpeechMenu.#utterance.lastVoiceAt = now;
            }
            else if (
                SpeechMenu.#utterance &&
                now - SpeechMenu.#utterance.lastVoiceAt >= SpeechMenu.#silenceTimeout
            ) {
                SpeechMenu.#finishUtterance("silence");
            }

            SpeechMenu.#meterFrame = requestAnimationFrame(tick);
        };

        SpeechMenu.#meterFrame = requestAnimationFrame(tick);
    }

    static #beginUtterance(now) {
        const id = ++SpeechMenu.#utteranceSequence;
        SpeechMenu.#utterance = {
            id,
            startedAt: now,
            lastVoiceAt: now,
            chunks: SpeechMenu.#preRoll.splice(0)
        };
        SpeechMenu.#emit("utteranceStarted", {id, startedAt: now});
    }

    static #finishUtterance(reason) {
        const utterance = SpeechMenu.#utterance;
        if (!utterance) return;
        SpeechMenu.#utterance = undefined;

        const blob = new Blob(
            utterance.chunks,
            {type: SpeechMenu.#mediaRecorder?.mimeType || "audio/webm"}
        );

        const detail = {
            id: utterance.id,
            reason,
            startedAt: utterance.startedAt,
            finishedAt: performance.now(),
            audio: blob
        };
        SpeechMenu.#emit("utteranceFinished", detail);

        if (blob.size > 0 && reason !== "stopped") {
            SpeechMenu.#recognitionQueue = SpeechMenu.#recognitionQueue
                .catch(() => {})
                .then(() => SpeechMenu.#recognizeUtterance(detail));
        }
    }

    static async #recognizeUtterance(utterance) {
        if (SpeechMenu.#stopped && !SpeechMenu.#stream) return;

        let audioBuffer;
        try {
            audioBuffer = await SpeechMenu.#audioContext.decodeAudioData(
                await utterance.audio.arrayBuffer()
            );
        }
        catch (error) {
            SpeechMenu.#emit("speechRecognitionError", {
                error: error?.name || "DecodeError",
                message: error?.message || String(error),
                utteranceId: utterance.id
            });
            return;
        }

        const destination = SpeechMenu.#audioContext.createMediaStreamDestination();
        const bufferSource = SpeechMenu.#audioContext.createBufferSource();
        bufferSource.buffer = audioBuffer;
        bufferSource.connect(destination);
        const replayTrack = destination.stream.getAudioTracks()[0];

        const recognition = new SpeechMenu.#Recognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = SpeechMenu.#language;

        let finalText = "";
        let fallbackUsed = false;

        await new Promise(resolve => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                try { replayTrack?.stop(); } catch {}
                try { bufferSource.disconnect(); } catch {}
                resolve();
            };

            recognition.onresult = event => {
                for (let index = event.resultIndex; index < event.results.length; index++) {
                    const result = event.results[index];
                    if (!result.isFinal) continue;
                    const text = SpeechMenu.#normalizeTranscript(result[0]?.transcript);
                    if (text) finalText += `${finalText ? " " : ""}${text}`;
                }
            };
            recognition.onerror = event => {
                if (event.error !== "aborted") {
                    SpeechMenu.#emit("speechRecognitionError", {
                        error: event.error,
                        message: event.message,
                        utteranceId: utterance.id
                    });
                }
            };
            recognition.onend = finish;

            try {
                recognition.start(replayTrack);
            }
            catch (error) {
                fallbackUsed = true;
                SpeechMenu.#emit("speechRecognitionTrackUnsupported", {
                    error: error?.name || "TrackInputUnsupported",
                    message: error?.message || String(error),
                    utteranceId: utterance.id
                });
                try {
                    recognition.start();
                }
                catch (fallbackError) {
                    SpeechMenu.#emit("speechRecognitionError", {
                        error: fallbackError?.name || "RecognitionStartError",
                        message: fallbackError?.message || String(fallbackError),
                        utteranceId: utterance.id
                    });
                    finish();
                    return;
                }
            }

            if (!fallbackUsed) {
                bufferSource.start();
                bufferSource.addEventListener("ended", () => {
                    setTimeout(() => {
                        try { recognition.stop(); } catch {}
                    }, 250);
                }, {once: true});
            }
        });

        if (!finalText) return;

        const detail = {
            id: utterance.id,
            transcript: finalText
        };
        SpeechMenu.#emit("utteranceTranscribed", detail);

        if (SpeechMenu.#debug) {
            const words = finalText.split(/\s+/);
            SpeechMenu.#debugFunction({
                state: SpeechMenu.#sleeping ? "muted" : "listening",
                isFinal: true,
                fullText: finalText,
                lastWord: words.at(-1)
            });
        }

        if (SpeechMenu.#sleeping) {
            if (SpeechMenu.#test(SpeechMenu.#wakePhrase, finalText)) {
                SpeechMenu.#sleeping = false;
                SpeechMenu.#emit("unmuted", {utteranceId: utterance.id, transcript: finalText});
            }
            return;
        }

        if (SpeechMenu.#test(SpeechMenu.#sleepPhrase, finalText)) {
            SpeechMenu.#sleeping = true;
            SpeechMenu.#emit("muted", {utteranceId: utterance.id, transcript: finalText});
            return;
        }

        await SpeechMenu.#processTranscript(finalText, utterance.id);
    }

    static #normalizeTranscript(value) {
        return String(value || "")
            .toLocaleLowerCase()
            .trim()
            .replace(/(\d)\.(?=\d)/g, "$1\uFFFF")
            .replace(/[^\p{L}\p{N}\s:\uFFFF]/gu, " ")
            .replace(/\uFFFF/g, ".")
            .replace(/\s+/g, " ")
            .trim();
    }

    static #test(regex, text) {
        regex.lastIndex = 0;
        return regex.test(text);
    }

    static async #processTranscript(text, utteranceId) {
        const first = async elements => {
            for (const element of elements) {
                if (await SpeechMenu.#processElement(element, text, utteranceId)) return true;
            }
            return false;
        };
        const firstMenu = async elements => {
            for (const element of elements) {
                if (await SpeechMenu.#processMenu(element, text, utteranceId)) return true;
            }
            return false;
        };

        if (await firstMenu(document.querySelectorAll('speech-modal[speech-modal="top-level"]'))) return;
        if (await first(document.querySelectorAll('speech-command[speech-modal="top-level"]'))) return;

        const modal = [...document.querySelectorAll("dialog:modal, dialog[open]")].at(-1);
        if (modal && await SpeechMenu.#processMenu(modal, text, utteranceId)) return;
        if (await firstMenu(document.querySelectorAll('speech-modal:not([speech-modal="top-level"])'))) return;
        if (await first(document.querySelectorAll('speech-command[speech-modal=""]'))) return;
        if (modal) return;
        if (await first(document.querySelectorAll("details[open], [popover]:popover-open"))) return;
        await first(document.querySelectorAll(":not(details):not(dialog):not(speech-modal)[speech-pattern]"));
    }

    static async #processMenu(menu, text, utteranceId) {
        for (const element of menu.querySelectorAll("[speech-pattern]:not([speech-modal])")) {
            if (await SpeechMenu.#processElement(element, text, utteranceId, menu)) return true;
        }
        return false;
    }

    static #prepare(element, force = false) {
        const source = element.getAttribute("speech-pattern");
        if (!source) return false;
        if (force || element.speechPatternSource !== source) {
            try {
                element.speechPattern = new RegExp(source, "gi");
                element.speechPatternSource = source;
            }
            catch {
                SpeechMenu.#emit("speechMenuPatternInvalid", {
                    speechMenuElement: element,
                    component: "speech-pattern",
                    message: "Invalid speech-pattern regular expression."
                });
                return false;
            }
        }

        const target = SpeechMenu.#resolve(element.getAttribute("speech-function"));
        if (!target) {
            SpeechMenu.#emit("speechMenuFunctionNotFound", {
                speechMenuElement: element,
                component: "speech-function",
                functionName: element.getAttribute("speech-function"),
                message: "The speech function was not found."
            });
            return false;
        }

        element.speechFunc = target.fn;
        element.speechFuncThis = target.owner;

        const preprocName = element.getAttribute("speech-preproc");
        if (!preprocName) {
            delete element.speechPreprocFunc;
            return true;
        }

        const preproc = SpeechMenu.#resolve(preprocName);
        if (!preproc) {
            SpeechMenu.#emit("speechMenuFunctionNotFound", {
                speechMenuElement: element,
                component: "speech-preproc",
                functionName: preprocName,
                message: "The speech preprocessor was not found."
            });
            return false;
        }

        element.speechPreprocFunc = preproc.fn.bind(preproc.owner);
        return true;
    }

    static #resolve(source) {
        if (typeof source !== "string" || !source.trim()) return undefined;
        const path = source
            .trim()
            .replace(/\[['"]([A-Za-z_$][\w$]*)['"]\]/g, ".$1")
            .replace(/\[([A-Za-z_$][\w$]*)\]/g, ".$1")
            .split(".");
        if (!path.every(part => /^[A-Za-z_$][\w$]*$/.test(part))) return undefined;

        let owner = window;
        for (let index = 0; index < path.length - 1; index++) {
            owner = owner?.[path[index]];
            if (owner == null) return undefined;
        }
        const fn = owner?.[path.at(-1)];
        return typeof fn === "function" ? {fn, owner} : undefined;
    }

    static #snapshotTarget(element) {
        const selector = element.getAttribute("data-speech-target");
        if (!selector) return {selector: undefined, node: undefined};
        let target;
        try { target = document.querySelector(selector); }
        catch { return {selector, node: undefined}; }
        return {
            selector,
            node: target?.cloneNode(true)
        };
    }

    static async #processElement(element, transcript, utteranceId, speechMenuElement) {
        if (!SpeechMenu.#prepare(element)) return false;

        let text = transcript;
        try {
            if (element.speechPreprocFunc) {
                const processed = element.speechPreprocFunc(text, {
                    kind: element.getAttribute("speech-preproc-context"),
                    field: element.getAttribute("speech-preproc-field"),
                    pattern: element.getAttribute("speech-pattern")
                });
                if (typeof processed !== "string") return false;
                if (processed !== text) {
                    SpeechMenu.#emit("speechPreprocessed", {
                        utteranceId,
                        speechMenuElement: element,
                        originalText: text,
                        processedText: processed
                    });
                }
                text = processed;
            }
        }
        catch (error) {
            SpeechMenu.#emit("speechMenuCommandError", {speechMenuElement: element, error, utteranceId});
            return false;
        }

        const regex = element.speechPattern;
        regex.lastIndex = 0;
        const args = new ParameterParser(element.speechFunc);
        let matched = false;
        let result;

        while ((result = regex.exec(text)) !== null) {
            matched = true;
            const values = result.groups || {};
            const named = new Set(
                Object.values(result.groups || {}).filter(value => value !== undefined)
            );

            for (const [name, value] of Object.entries(values)) {
                if (!value) continue;
                if (name === "_") args.restArguments?.push(...SpeechMenu.#list(value));
                else if (name.startsWith("_")) args.setArgument(name.slice(1), SpeechMenu.#list(value));
                else args.setArgument(name, value);
            }

            if (args.restArguments) {
                for (let index = 1; index < result.length; index++) {
                    const value = result[index];
                    if (value && !named.has(value)) {
                        args.restArguments.push(SpeechMenu.#scalar(value));
                    }
                }
            }

            if (!result[0].length) regex.lastIndex++;
        }

        if (!matched) return false;

        const scope = speechMenuElement || element.closest("speech-modal, dialog, [popover]");
        SpeechMenu.#emit("speechMenuMatched", {
            utteranceId,
            speechMenuElement: element,
            scope,
            transcript: text
        });

        const argumentValues = args.argumentArray();
        const before = SpeechMenu.#snapshotTarget(element);

        SpeechMenu.#emit("speechArgumentsPrepared", {
            utteranceId,
            speechMenuElement: element,
            transcript: text,
            arguments: argumentValues.slice(),
            targetSelector: before.selector,
            targetBefore: before.node
        });

        try {
            const outcome = await element.speechFunc.apply(
                element.speechFuncThis,
                argumentValues
            );

            if (outcome === false) return false;

            await Promise.resolve();

            const after = SpeechMenu.#snapshotTarget(element);
            SpeechMenu.#emit("speechCommandExecuted", {
                utteranceId,
                speechMenuElement: element,
                transcript: text,
                arguments: argumentValues.slice(),
                targetSelector: after.selector || before.selector,
                targetBefore: before.node,
                targetAfter: after.node
            });
            SpeechMenu.#emit("command", {
                speechMenuElement: element,
                transcript: text,
                utteranceId
            });
            return true;
        }
        catch (error) {
            SpeechMenu.#emit("speechMenuCommandError", {
                speechMenuElement: element,
                error,
                utteranceId
            });
            return false;
        }
    }

    static #list(value) {
        return value
            .split(SpeechMenu.#separator)
            .map(part => part.trim())
            .filter(Boolean)
            .map(SpeechMenu.#scalar);
    }

    static #scalar(value) {
        const number = Number(value);
        return value.trim() && Number.isFinite(number) ? number : value;
    }

    static async #releaseCapture() {
        cancelAnimationFrame(SpeechMenu.#meterFrame);
        SpeechMenu.#meterFrame = undefined;

        const recorder = SpeechMenu.#mediaRecorder;
        SpeechMenu.#mediaRecorder = undefined;
        if (recorder) {
            try {
                recorder.removeEventListener("dataavailable", SpeechMenu.#onRecorderData);
                if (recorder.state !== "inactive") recorder.stop();
            }
            catch {}
        }

        try { SpeechMenu.#sourceNode?.disconnect(); } catch {}
        SpeechMenu.#sourceNode = undefined;
        SpeechMenu.#analyser = undefined;

        const stream = SpeechMenu.#stream;
        SpeechMenu.#stream = undefined;
        SpeechMenu.#micTrack = undefined;
        if (stream) {
            for (const track of stream.getTracks()) {
                try { track.stop(); } catch {}
            }
        }

        const context = SpeechMenu.#audioContext;
        SpeechMenu.#audioContext = undefined;
        if (context && context.state !== "closed") {
            try { await context.close(); } catch {}
        }

        SpeechMenu.#preRoll = [];
        SpeechMenu.#utterance = undefined;
    }
}

globalThis.SpeechMenu = SpeechMenu;
