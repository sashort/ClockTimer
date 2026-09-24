(() => {
    "use strict";

    class WMOFAudioEngine {
        #catalogPromise;
        #context;
        #active = new Map();
        #sequence = 0;

        constructor() {
            const unlock = () => {
                void this.unlock();
            };

            document.addEventListener(
                "pointerdown",
                unlock,
                {
                    once: true,
                    capture: true
                }
            );

            document.addEventListener(
                "keydown",
                unlock,
                {
                    once: true,
                    capture: true
                }
            );
        }

        get activeSongs() {
            return Array.from(this.#active.values()).map(entry => entry.name);
        }

        async unlock() {
            try {
                await this.#audioContext();
                return true;
            }
            catch (error) {
                console.warn(
                    "Audio could not be unlocked:",
                    error
                );
                return false;
            }
        }

        async load() {
            if (!this.#catalogPromise) {
                this.#catalogPromise = fetch("api/audio/", {cache: "no-store"})
                    .then(async response => {
                        if (!response.ok) {
                            throw new Error("Audio catalog could not be loaded.");
                        }
                        return response.json();
                    });
            }

            return this.#catalogPromise;
        }

        async #audioContext() {
            if (!this.#context) {
                const AudioContextCtor =
                    globalThis.AudioContext ||
                    globalThis.webkitAudioContext;

                if (!AudioContextCtor) {
                    throw new Error("Web Audio is not supported by this browser.");
                }

                this.#context = new AudioContextCtor();
            }

            if (this.#context.state === "suspended") {
                await this.#context.resume();
            }

            return this.#context;
        }

        #beats(value) {
            const text = String(value ?? "0").trim();

            if (!text) return 0;

            const mixed = text.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
            if (mixed) {
                const whole = Number(mixed[1]);
                const numerator = Number(mixed[2]);
                const denominator = Number(mixed[3]);
                if (!denominator) throw new Error("Invalid musical duration: " + text);
                return whole + Math.sign(whole || 1) * numerator / denominator;
            }

            const fraction = text.match(/^(-?\d+)\/(\d+)$/);
            if (fraction) {
                const denominator = Number(fraction[2]);
                if (!denominator) throw new Error("Invalid musical duration: " + text);
                return Number(fraction[1]) / denominator;
            }

            const number = Number(text);
            if (!Number.isFinite(number)) {
                throw new Error("Invalid musical duration: " + text);
            }

            return number;
        }

        #frequency(note) {
            const match = String(note || "").trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);

            if (!match) {
                throw new Error("Invalid musical tone: " + note);
            }

            const semitones = {
                C: 0,
                D: 2,
                E: 4,
                F: 5,
                G: 7,
                A: 9,
                B: 11
            };

            let pitch = semitones[match[1].toUpperCase()];
            if (match[2] === "#") pitch++;
            if (match[2] === "b") pitch--;

            const midi =
                (Number(match[3]) + 1) * 12 +
                pitch;

            return 440 * Math.pow(2, (midi - 69) / 12);
        }

        #dynamicValue(value) {
            const levels = {
                ppp: 0.08,
                pp: 0.14,
                p: 0.25,
                mp: 0.4,
                mf: 0.6,
                f: 0.8,
                ff: 1,
                fff: 1
            };

            return levels[String(value || "mf").trim().toLowerCase()] ?? 0.6;
        }

        #dynamic(dynamic) {
            const text = String(dynamic || "mf").trim();
            const ramp = text.match(/^(ppp|pp|p|mp|mf|f|ff|fff)\s*<\s*(ppp|pp|p|mp|mf|f|ff|fff)$/i);

            if (ramp) {
                return {
                    start: this.#dynamicValue(ramp[1]),
                    end: this.#dynamicValue(ramp[2])
                };
            }

            const value = this.#dynamicValue(text);
            return {start: value, end: value};
        }

        #parseTone(value) {
            let text = String(value || "").trim();
            const sustain = text.endsWith("...");

            if (sustain) {
                text = text.slice(0, -3).trim();
            }

            for (const operator of ["~", "/", "\\"]) {
                const index = text.indexOf(operator);

                if (index > 0) {
                    const from = text.slice(0, index).trim();
                    const to = text.slice(index + 1).trim();

                    if (!from || !to) {
                        throw new Error("Invalid effect tone: " + value);
                    }

                    return {
                        kind:
                            operator === "~"
                                ? "trill"
                                : "bend",
                        direction:
                            operator === "/"
                                ? "up"
                                : operator === "\\"
                                    ? "down"
                                    : undefined,
                        from,
                        to,
                        sustain
                    };
                }
            }

            return {
                kind: "note",
                note: text,
                sustain
            };
        }

        #scheduleTone(context, entry, event, instrument, bpm, songGain) {
            const beatSeconds = 60 / bpm;
            const offsetBeats = this.#beats(event.offset);
            const lengthParts = String(event.length ?? "1")
                .split(",")
                .map(part => part.trim());

            if (lengthParts.length > 2) {
                throw new Error("A tone length may contain at most two values.");
            }

            const effectBeats = this.#beats(lengthParts[0]);
            const sustainBeats =
                lengthParts.length === 2
                    ? this.#beats(lengthParts[1])
                    : 0;

            const tone = this.#parseTone(event.tone);

            if (sustainBeats && !tone.sustain) {
                throw new Error("A second tone length requires ... sustain notation.");
            }

            const startAt =
                entry.startedAt +
                offsetBeats * beatSeconds;
            const effectEnd =
                startAt +
                Math.max(0, effectBeats * beatSeconds);
            const endAt =
                effectEnd +
                Math.max(0, sustainBeats * beatSeconds);

            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const dynamic = this.#dynamic(event.dynamic);
            const volume =
                Number.isFinite(Number(instrument.volume))
                    ? Number(instrument.volume)
                    : 1;

            oscillator.type =
                typeof instrument.waveform === "string"
                    ? instrument.waveform
                    : "sine";

            gain.gain.setValueAtTime(
                Math.max(0.0001, dynamic.start * volume * songGain),
                startAt
            );

            if (dynamic.end !== dynamic.start) {
                gain.gain.linearRampToValueAtTime(
                    Math.max(0.0001, dynamic.end * volume * songGain),
                    effectEnd
                );
            }

            if (tone.kind === "note") {
                oscillator.frequency.setValueAtTime(
                    this.#frequency(tone.note),
                    startAt
                );
            }
            else if (tone.kind === "bend") {
                const fromFrequency = this.#frequency(tone.from);
                const toFrequency = this.#frequency(tone.to);

                if (
                    (tone.direction === "up" && toFrequency <= fromFrequency) ||
                    (tone.direction === "down" && toFrequency >= fromFrequency)
                ) {
                    throw new Error("Bend direction does not match its note order: " + event.tone);
                }

                oscillator.frequency.setValueAtTime(
                    fromFrequency,
                    startAt
                );
                oscillator.frequency.exponentialRampToValueAtTime(
                    toFrequency,
                    effectEnd
                );
            }
            else {
                const fromFrequency = this.#frequency(tone.from);
                const toFrequency = this.#frequency(tone.to);
                const semitoneDistance =
                    Math.abs(
                        12 *
                        Math.log2(toFrequency / fromFrequency)
                    );

                if (Math.abs(semitoneDistance - 1) > 0.01) {
                    throw new Error("Trill notes must be exactly one semitone apart.");
                }

                const subdivision =
                    Math.max(
                        1 / 64,
                        this.#beats(instrument.trillStep ?? "1/8")
                    );
                const stepSeconds =
                    subdivision * beatSeconds;
                let cursor = startAt;
                let alternate = false;

                oscillator.frequency.setValueAtTime(
                    fromFrequency,
                    startAt
                );

                while (cursor + stepSeconds < effectEnd) {
                    cursor += stepSeconds;
                    alternate = !alternate;
                    oscillator.frequency.setValueAtTime(
                        alternate ? toFrequency : fromFrequency,
                        cursor
                    );
                }

                oscillator.frequency.setValueAtTime(
                    toFrequency,
                    effectEnd
                );
            }

            oscillator.connect(gain);
            gain.connect(context.destination);

            oscillator.start(startAt);
            oscillator.stop(Math.max(startAt + 0.001, endAt));

            entry.nodes.add(oscillator);
            entry.nodes.add(gain);

            oscillator.addEventListener(
                "ended",
                () => {
                    entry.nodes.delete(oscillator);
                    entry.nodes.delete(gain);
                    try { oscillator.disconnect(); } catch {}
                    try { gain.disconnect(); } catch {}
                },
                {once: true}
            );

            return endAt;
        }

        #maybeComplete(entry) {
            if (
                !entry ||
                entry.released ||
                !entry.timelineComplete ||
                entry.pendingSpeech > 0
            ) {
                return;
            }

            if (entry.loop) {
                const {
                    name,
                    bpm,
                    volume
                } = entry;

                this.#release(
                    entry,
                    "loop"
                );

                void this.startSong(
                    name,
                    {
                        bpm,
                        volume,
                        loop: true,
                        suspendListening:
                            entry
                                .suspendsListening
                    }
                ).catch(
                    error =>
                        console.error(
                            error
                        )
                );

                return;
            }

            this.#release(
                entry,
                "ended"
            );
        }

        #scheduleSpeech(
            context,
            entry,
            event,
            bpm
        ) {
            const text =
                String(
                    event.speech ||
                    ""
                ).trim();

            if (!text) {
                return entry.startedAt;
            }

            const synthesis =
                globalThis.speechSynthesis;
            const Utterance =
                globalThis.SpeechSynthesisUtterance;

            if (
                !synthesis ||
                typeof Utterance !==
                    "function"
            ) {
                console.warn(
                    "Speech synthesis is unavailable:",
                    text
                );
                return entry.startedAt;
            }

            const beatSeconds =
                60 / bpm;
            const offsetBeats =
                this.#beats(
                    event.offset
                );
            const startAt =
                entry.startedAt +
                offsetBeats *
                    beatSeconds;
            const delay =
                Math.max(
                    0,
                    (
                        startAt -
                        context.currentTime
                    ) *
                        1000
                );

            entry.pendingSpeech++;

            const timer =
                setTimeout(
                    () => {
                        entry.timers.delete(
                            timer
                        );

                        if (entry.released) {
                            entry.pendingSpeech =
                                Math.max(
                                    0,
                                    entry.pendingSpeech -
                                        1
                                );
                            return;
                        }

                        const utterance =
                            new Utterance(
                                text
                            );

                        utterance.lang =
                            typeof event.lang === "string" &&
                            event.lang.trim()
                                ? event.lang.trim()
                                : "en-US";

                        if (
                            Number.isFinite(
                                Number(
                                    event.rate
                                )
                            )
                        ) {
                            utterance.rate =
                                Number(
                                    event.rate
                                );
                        }

                        if (
                            Number.isFinite(
                                Number(
                                    event.pitch
                                )
                            )
                        ) {
                            utterance.pitch =
                                Number(
                                    event.pitch
                                );
                        }

                        if (
                            Number.isFinite(
                                Number(
                                    event.volume
                                )
                            )
                        ) {
                            utterance.volume =
                                Math.max(
                                    0,
                                    Math.min(
                                        1,
                                        Number(
                                            event.volume
                                        )
                                    )
                                );
                        }

                        entry.utterances.add(
                            utterance
                        );

                        let synthesizedSpeechToken;

                        const finish =
                            () => {
                                if (
                                    synthesizedSpeechToken !==
                                    undefined
                                ) {
                                    globalThis
                                        .SpeechMenu
                                        ?.unregisterSynthesizedSpeech?.(
                                            synthesizedSpeechToken
                                        );

                                    synthesizedSpeechToken =
                                        undefined;
                                }
                                if (
                                    !entry.utterances
                                        .delete(
                                            utterance
                                        )
                                ) {
                                    return;
                                }

                                entry.pendingSpeech =
                                    Math.max(
                                        0,
                                        entry.pendingSpeech -
                                            1
                                    );

                                this.#maybeComplete(
                                    entry
                                );
                            };

                        utterance.addEventListener(
                            "start",
                            () => {
                                synthesizedSpeechToken =
                                    globalThis
                                        .SpeechMenu
                                        ?.registerSynthesizedSpeech?.(
                                            text
                                        );

                                console.debug(
                                    "Audio speech started:",
                                    text
                                );
                            },
                            {
                                once: true
                            }
                        );

                        utterance.addEventListener(
                            "end",
                            finish,
                            {
                                once: true
                            }
                        );

                        utterance.addEventListener(
                            "error",
                            error => {
                                console.warn(
                                    "Audio speech failed:",
                                    text,
                                    error?.error ||
                                        error
                                );
                                finish();
                            },
                            {
                                once: true
                            }
                        );

                        try {
                            synthesis.resume();
                        }
                        catch {}

                        synthesis.speak(
                            utterance
                        );
                    },
                    delay
                );

            entry.timers.add(
                timer
            );

            return startAt;
        }

        #release(entry, reason) {
            if (!entry || entry.released) return;

            entry.released = true;
            clearTimeout(entry.endTimer);

            for (const timer of entry.timers) {
                clearTimeout(timer);
            }
            entry.timers.clear();

            for (const node of entry.nodes) {
                try { node.stop?.(); } catch {}
                try { node.disconnect?.(); } catch {}
            }
            entry.nodes.clear();

            this.#active.delete(entry.id);

            if (
                entry.suspendsListening !==
                    false
            ) {
                globalThis.SpeechMenu
                    ?.resumeListening?.(
                        "audio:" + entry.name + ":" + reason
                    );
            }
        }

        async startSong(
            name,
            {
                bpm,
                volume = 1,
                loop,
                suspendListening =
                    false
            } = {}
        ) {
            const catalog = await this.load();
            const song = catalog?.songs?.[name];

            if (!song) {
                throw new Error("Unknown song: " + name);
            }

            const context = await this.#audioContext();
            const tempo = Number(bpm ?? song.bpm ?? 120);

            if (!Number.isFinite(tempo) || tempo <= 0) {
                throw new RangeError("Song BPM must be greater than zero.");
            }

            const songGain =
                Number.isFinite(Number(volume))
                    ? Math.max(0, Number(volume))
                    : 1;
            const shouldLoop =
                loop === undefined
                    ? Boolean(song.loop)
                    : Boolean(loop);
            const instrument =
                catalog?.instruments?.[
                    song.instrument
                ];

            if (!instrument) {
                throw new Error(
                    "Unknown instrument: " +
                    song.instrument
                );
            }

            const entry = {
                id: ++this.#sequence,
                name,
                nodes: new Set(),
                timers: new Set(),
                utterances: new Set(),
                pendingSpeech: 0,
                timelineComplete: false,
                loop:
                    shouldLoop,
                bpm:
                    tempo,
                volume:
                    songGain,
                startedAt:
                    context.currentTime +
                    0.015,
                released: false,
                endTimer: undefined,
                suspendsListening:
                    Boolean(
                        suspendListening
                    )
            };

            if (suspendListening) {
                globalThis.SpeechMenu
                    ?.suspendListening?.(
                        "audio:" + name
                    );
            }

            this.#active.set(
                entry.id,
                entry
            );

            try {
                let endAt =
                    entry.startedAt;

                for (const event of song.events || []) {
                    if (event?.tone) {
                        endAt =
                            Math.max(
                                endAt,
                                this.#scheduleTone(
                                    context,
                                    entry,
                                    event,
                                    instrument,
                                    tempo,
                                    songGain
                                )
                            );
                    }

                    if (event?.speech) {
                        endAt =
                            Math.max(
                                endAt,
                                this.#scheduleSpeech(
                                    context,
                                    entry,
                                    event,
                                    tempo
                                )
                            );
                    }
                }

                const durationMilliseconds =
                    Math.max(
                        0,
                        (endAt - context.currentTime) *
                            1000
                    );

                entry.endTimer =
                    setTimeout(
                        () => {
                            entry.timelineComplete =
                                true;

                            this.#maybeComplete(
                                entry
                            );
                        },
                        durationMilliseconds
                    );

                return Object.freeze({
                    id: entry.id,
                    name,
                    stop: () =>
                        this.stopSong(
                            entry.id
                        )
                });
            }
            catch (error) {
                this.#release(
                    entry,
                    "error"
                );
                throw error;
            }
        }

        async startFrequencies(
            frequencies,
            {
                waveform = "square",
                volume = 1,
                reason = "direct-tone",
                suspendListening = true
            } = {}
        ) {
            const values =
                Array.from(
                    frequencies || []
                )
                    .map(Number)
                    .filter(
                        value =>
                            Number.isFinite(value) &&
                            value > 0
                    );

            if (!values.length) {
                throw new RangeError(
                    "At least one positive frequency is required."
                );
            }

            const context =
                await this.#audioContext();

            const entry = {
                id: ++this.#sequence,
                name: reason,
                nodes: new Set(),
                timers: new Set(),
                utterances: new Set(),
                pendingSpeech: 0,
                timelineComplete: false,
                loop: false,
                bpm: undefined,
                volume,
                startedAt: context.currentTime,
                released: false,
                endTimer: undefined
            };

            if (suspendListening) {
                globalThis.SpeechMenu
                    ?.suspendListening?.(
                        "audio:" + reason
                    );
            }

            entry.suspendsListening =
                Boolean(
                    suspendListening
                );

            this.#active.set(
                entry.id,
                entry
            );

            try {
                for (const frequency of values) {
                    const oscillator =
                        context.createOscillator();
                    const gain =
                        context.createGain();

                    oscillator.type =
                        waveform;
                    oscillator.frequency
                        .setValueAtTime(
                            frequency,
                            context.currentTime
                        );

                    gain.gain
                        .setValueAtTime(
                            Math.max(
                                0,
                                Math.min(
                                    1,
                                    Number(volume) ||
                                    0
                                )
                            ),
                            context.currentTime
                        );

                    oscillator.connect(
                        gain
                    );
                    gain.connect(
                        context.destination
                    );

                    oscillator.start();

                    entry.nodes.add(
                        oscillator
                    );
                    entry.nodes.add(
                        gain
                    );
                }

                return Object.freeze({
                    id: entry.id,
                    stop: () =>
                        this.#release(
                            entry,
                            "stopped"
                        )
                });
            }
            catch (error) {
                this.#release(
                    entry,
                    "error"
                );
                throw error;
            }
        }

        stopSong(song) {
            const matches =
                typeof song === "number"
                    ? [
                        this.#active.get(
                            song
                        )
                    ]
                    : Array.from(
                        this.#active.values()
                    ).filter(
                        entry =>
                            entry.name === song
                    );

            let stopped = false;

            for (const entry of matches) {
                if (!entry) continue;
                this.#release(
                    entry,
                    "stopped"
                );
                stopped = true;
            }

            return stopped;
        }

        stopAll() {
            for (
                const entry of
                Array.from(
                    this.#active.values()
                )
            ) {
                this.#release(
                    entry,
                    "stopped"
                );
            }
        }
    }

    globalThis.WMOFAudio =
        new WMOFAudioEngine();
})();
