(() => {
    "use strict";


    // Legacy definitions remain untouched; custom sound controls opt into a separate model.
    class OscillatorInstrument {
        constructor(definition) { this.definition = definition; }
        static from(definition) {
            const custom = definition.class === "expressive" ||
                ["excitation", "velocityTone", "variation", "repeatDamping", "samples", "strikeStrength", "chorus"].some(key => key in definition) ||
                definition.partials?.some(partial => partial.envelope);
            if (definition.class && !["oscillator", "expressive"].includes(definition.class))
                throw new TypeError("Unknown instrument class: " + definition.class);
            return custom ? new ExpressiveInstrument(definition) : new OscillatorInstrument(definition);
        }
        forEvent() { return this.definition; }
        async prepare() {}
    }

    class ExpressiveInstrument extends OscillatorInstrument {
        #buffers = new Map();
        static number(value, fallback, min = 0, max = Infinity) {
            if (value === undefined) return fallback;
            const n = Number(value);
            if (!Number.isFinite(n) || n < min || n > max) throw new RangeError("Invalid expressive instrument value");
            return n;
        }
        constructor(definition) {
            super(definition);
            const n = ExpressiveInstrument.number;
            for (const partial of definition.partials || []) {
                n(partial.ratio, 1, 0.0001); n(partial.gain, 1);
                for (const key of ["attack", "decay", "release"]) n(partial.envelope?.[key], 0);
                n(partial.envelope?.sustain, 1, 0, 1);
            }
            n(definition.strikeStrength, undefined, 0, 1);
            n(definition.variation?.gain, 0, 0, 1);
            n(definition.variation?.detuneCents, 0, 0, 100);
            n(definition.repeatDamping?.release, 0.02, 0.001, 5);
            n(definition.excitation?.amount, 0, 0, 1);
            n(definition.excitation?.decay, 0.04, 0.001, 5);
            if (definition.chorus) {
                n(definition.chorus.rate, 0.6, 0.01, 10);
                n(definition.chorus.delay, 0.016, 0.001, 0.1);
                n(definition.chorus.depth, 0.0025, 0, 0.02);
                n(definition.chorus.wet, 0.3, 0, 1);
                if ((definition.chorus.depth ?? 0.0025) >= (definition.chorus.delay ?? 0.016))
                    throw new RangeError("Chorus depth must be less than its delay");
            }
            n(definition.velocityTone?.brightness, 0, -1, 4);
            n(definition.velocityTone?.filterOctaves, 0, -4, 4);
            if (definition.samples && (!Array.isArray(definition.samples) || !definition.samples.length))
                throw new TypeError("Instrument samples must be a nonempty array");
            for (const sample of definition.samples || []) {
                if (!sample.url || !Number.isFinite(Number(sample.rootFrequency)) || sample.rootFrequency <= 0)
                    throw new TypeError("Sample requires URL and positive rootFrequency");
                if (sample.loopStart !== undefined || sample.loopEnd !== undefined) {
                    n(sample.loopStart, 0); n(sample.loopEnd, 0, 0.001);
                    if (sample.loopEnd === undefined || sample.loopEnd <= (sample.loopStart ?? 0) || sample.naturalDecay)
                        throw new RangeError("Invalid sample sustain loop");
                }
                n(sample.minVelocity, 0, 0, 1); n(sample.maxVelocity, 1, 0, 1); n(sample.gain, 1);
                if ((sample.minVelocity ?? 0) > (sample.maxVelocity ?? 1)) throw new RangeError("Invalid sample velocity range");
            }
        }
        async prepare(context) {
            await Promise.all((this.definition.samples || []).map(async sample => {
                if (!this.#buffers.has(sample.url)) {
                    const response = await fetch(sample.url);
                    if (!response.ok) throw new Error("Instrument sample could not be loaded: " + sample.url);
                    const buffer = await context.decodeAudioData(await response.arrayBuffer());
                    if (sample.loopEnd > buffer.duration) throw new RangeError("Sample sustain loop exceeds recording duration");
                    this.#buffers.set(sample.url, buffer);
                }
            }));
        }
        forEvent(event, velocity = 1) {
            const d = this.definition, n = ExpressiveInstrument.number;
            const strikeStrength = n(event.strikeStrength ?? d.strikeStrength, velocity, 0, 1);
            // Stable event-derived variation makes offline renders and tests reproducible.
            let seed = Number(d.variation?.seed ?? 1) >>> 0;
            for (const character of `${event.offset}:${event.tone}`) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
            const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
            const gain = 1 + random() * n(d.variation?.gain, 0);
            const cents = random() * n(d.variation?.detuneCents, 0);
            const partials = (d.partials || [{ratio:1,gain:1}]).map(partial => ({...partial,
                gain: (partial.gain ?? 1) * gain * Math.max(0, 1 + n(d.velocityTone?.brightness, 0, -1, 4) * strikeStrength * Math.min(1, ((partial.ratio ?? 1) - 1) / 4)),
                detune: (partial.detune ?? 0) + cents}));
            const release = Math.max(d.envelope?.release ?? 0, ...partials.map(partial => partial.envelope?.release ?? 0));
            const result = {...d, partials, envelope:{...d.envelope, release}, __expressive:this, __gainVariation:gain, __detuneVariation:cents, __strikeStrength:strikeStrength};
            if (d.filter) result.filter = {...d.filter, frequency:(d.filter.frequency ?? 5000) * 2 ** (n(d.velocityTone?.filterOctaves, 0, -4, 4) * strikeStrength)};
            if (d.excitation) result.noise = {amount:d.excitation.amount ?? 0, decay:d.excitation.decay ?? 0.04};
            return result;
        }
        sampleFor(frequency, velocity, event) {
            const candidates = (this.definition.samples || []).filter(sample => velocity >= (sample.minVelocity ?? 0) && velocity <= (sample.maxVelocity ?? 1));
            if (!candidates.length) throw new RangeError("No sample layer covers this velocity");
            const nearest = Math.min(...candidates.map(sample => Math.abs(Math.log2(frequency / sample.rootFrequency))));
            const variants = candidates.filter(sample => Math.abs(Math.abs(Math.log2(frequency / sample.rootFrequency)) - nearest) < 1e-8);
            let strike = 0;
            for (const character of `${event.offset}:${event.tone}`) strike = (Math.imul(strike, 31) + character.charCodeAt(0)) >>> 0;
            const index = strike % variants.length;
            const sample = variants[index];
            return {...sample, buffer:this.#buffers.get(sample.url)};
        }
        static envelope(param, source, start, end, gain) {
            const attack = Math.min(end, start + (source.attack ?? 0));
            const decay = Math.min(end, attack + (source.decay ?? 0));
            const sustain = gain * (source.sustain ?? 1);
            param.setValueAtTime(source.attack > 0 ? 0 : gain, start);
            if (attack > start) param.linearRampToValueAtTime(gain, attack);
            if (decay > attack) param.exponentialRampToValueAtTime(Math.max(0.000001, sustain), decay);
            else param.setValueAtTime(sustain, attack);
            param.setValueAtTime(sustain, Math.max(decay, end));
            param.linearRampToValueAtTime(0, end + (source.release ?? 0));
        }
    }
    globalThis.WMOFInstrumentClasses = Object.freeze({OscillatorInstrument, ExpressiveInstrument});

    class WMOFAudioEngine {
        #instrumentModels = new WeakMap();
        #catalogPromise;
        #preparePromise;
        #context;
        #programOutput;
        #programStreamDestination;
        #catalogReady = false;
        #audioResourcesReady = false;
        #prepareError;
        #active = new Map();
        #sequence = 0;
        #reverbImpulses = new Map();
        #noiseBuffers = new Map();
        #distortionCurves = new Map();
        #instrumentResources = new Map();
        #outputSettings = {
            speechVolume: 1,
            toneVolume: 1,
            speechVelocity: 1,
            toneVelocity: 1,
            instrument: "",
            speechLanguage:
                "en-US",
            voiceProvider:
                "system",
            voice:
                ""
        };

        constructor() {
            void this.prepare()
                .catch(
                    error => {
                        console.warn(
                            "Audio preload failed:",
                            error
                        );
                    }
                );

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

        get outputSettings() {
            return {...this.#outputSettings};
        }

        get readiness() {
            return Object.freeze({
                catalog:
                    this.#catalogReady,
                audio:
                    this.#audioResourcesReady,
                ready:
                    this.#catalogReady &&
                    this.#audioResourcesReady &&
                    !this.#prepareError,
                error:
                    this.#prepareError
                        ? String(
                            this.#prepareError
                                ?.message ||
                            this.#prepareError
                        )
                        : undefined
            });
        }

        configureOutput(settings = {}) {
            const clamp = (value, minimum, maximum, fallback) => {
                const numeric = Number(value);
                return Number.isFinite(numeric)
                    ? Math.max(minimum, Math.min(maximum, numeric))
                    : fallback;
            };

            const current = this.#outputSettings;

            this.#outputSettings = {
                speechVolume: clamp(
                    settings.speechVolume,
                    0,
                    1,
                    current.speechVolume
                ),
                toneVolume: clamp(
                    settings.toneVolume,
                    0,
                    1,
                    current.toneVolume
                ),
                speechVelocity: clamp(
                    settings.speechVelocity,
                    0.5,
                    4,
                    current.speechVelocity
                ),
                toneVelocity: clamp(
                    settings.toneVelocity,
                    0.5,
                    1.5,
                    current.toneVelocity
                ),
                instrument:
                    typeof settings.instrument ===
                        "string"
                        ? settings.instrument.trim()
                        : current.instrument,
                speechLanguage:
                    typeof settings.speechLanguage ===
                        "string" &&
                    settings.speechLanguage.trim()
                        ? settings.speechLanguage.trim()
                        : current.speechLanguage,
                voiceProvider:
                    typeof settings.voiceProvider ===
                        "string" &&
                    settings.voiceProvider.trim()
                        ? settings.voiceProvider.trim()
                        : current.voiceProvider,
                voice:
                    typeof settings.voice ===
                        "string"
                        ? settings.voice.trim()
                        : current.voice
            };

            return this.outputSettings;
        }

        async unlock() {
            try {
                const context =
                    await this.#audioContext();
                const catalog =
                    await this.prepare();

                this.#prepareAudioResources(
                    context
                );

                return true;
            }
            catch (error) {
                this.#prepareError =
                    error;

                console.warn(
                    "Audio could not be unlocked:",
                    error
                );
                return false;
            }
        }

        async prepare() {
            if (!this.#preparePromise) {
                this.#preparePromise =
                    this.load()
                        .then(
                            catalog => {
                                this.#validateCatalog(
                                    catalog
                                );
                                this.#prepareStaticResources(
                                    catalog
                                );
                                this.#catalogReady =
                                    true;
                                this.#prepareError =
                                    undefined;

                                return catalog;
                            }
                        )
                        .catch(
                            error => {
                                this.#prepareError =
                                    error;
                                this.#preparePromise =
                                    undefined;
                                throw error;
                            }
                        );
            }

            return this.#preparePromise;
        }

        #validateCatalog(catalog) {
            const instruments =
                catalog?.instruments;

            if (
                !instruments ||
                typeof instruments !==
                    "object"
            ) {
                throw new Error(
                    "Audio catalog has no instruments."
                );
            }

            for (
                const [
                    name,
                    instrument
                ] of Object.entries(
                    instruments
                )
            ) {
                OscillatorInstrument.from(instrument);
                const fallback =
                    instrument
                        ?.phoneFallback;

                if (
                    fallback &&
                    !instruments[
                        fallback
                    ]
                ) {
                    throw new Error(
                        "Unknown phone fallback: " +
                        name +
                        " -> " +
                        fallback
                    );
                }
            }

            for (
                const [
                    songName,
                    song
                ] of Object.entries(
                    catalog?.songs ||
                    {}
                )
            ) {
                const names =
                    [
                        song?.instrument,
                        ...(song?.events || [])
                            .map(
                                event =>
                                    event
                                        ?.instrument
                            )
                    ]
                        .filter(
                            Boolean
                        );

                for (const name of names) {
                    if (
                        !instruments[
                            name
                        ]
                    ) {
                        throw new Error(
                            "Unknown song instrument: " +
                            songName +
                            " -> " +
                            name
                        );
                    }
                }
            }
        }

        #prepareStaticResources(catalog) {
            for (
                const instrument of
                Object.values(
                    catalog?.instruments ||
                    {}
                )
            ) {
                const distortionSource =
                    instrument
                        ?.distortion;
                const amount =
                    Number(
                        typeof distortionSource ===
                            "object"
                            ? distortionSource
                                ?.amount
                            : distortionSource
                    );

                if (
                    Number.isFinite(
                        amount
                    ) &&
                    amount >
                        0
                ) {
                    this.#distortionCurve(
                        amount
                    );
                }
            }
        }

        #prepareAudioResources(
            context
        ) {
            if (
                this.#audioResourcesReady
            ) {
                return;
            }

            this.#noiseBuffer(
                context,
                0.25
            );

            this.#audioResourcesReady =
                true;
            this.#prepareError =
                undefined;

            globalThis.dispatchEvent?.(
                new CustomEvent(
                    "wmof-audio-ready",
                    {
                        detail:
                            this.readiness
                    }
                )
            );
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

        #programOutputNode(
            context
        ) {
            if (!this.#programOutput) {
                this.#programOutput =
                    context.createGain();

                this.#programOutput.connect(
                    context.destination
                );

                if (
                    typeof context
                        .createMediaStreamDestination ===
                        "function"
                ) {
                    this.#programStreamDestination =
                        context
                            .createMediaStreamDestination();

                    this.#programOutput.connect(
                        this.#programStreamDestination
                    );
                }
            }

            return this.#programOutput;
        }

        async createProgramStream() {
            const context =
                await this.#audioContext();

            this.#programOutputNode(
                context
            );

            const source =
                this.#programStreamDestination
                    ?.stream;

            if (
                !source ||
                typeof globalThis.MediaStream !==
                    "function"
            ) {
                return undefined;
            }

            const tracks =
                source
                    .getAudioTracks()
                    .map(
                        track =>
                            typeof track.clone ===
                                "function"
                                ? track.clone()
                                : undefined
                    )
                    .filter(Boolean);

            return tracks.length
                ? new globalThis.MediaStream(
                    tracks
                )
                : undefined;
        }

        #isPhone() {
            const userAgentData =
                globalThis.navigator
                    ?.userAgentData;

            if (
                typeof userAgentData
                    ?.mobile ===
                    "boolean"
            ) {
                return userAgentData.mobile;
            }

            const userAgent =
                String(
                    globalThis.navigator
                        ?.userAgent ||
                    ""
                );

            if (
                /iPhone|iPod|Windows Phone|Android.*Mobile|Mobile Safari/i
                    .test(
                        userAgent
                    )
            ) {
                return true;
            }

            const matches =
                query => {
                    try {
                        return Boolean(
                            globalThis
                                .matchMedia
                                ?.(query)
                                ?.matches
                        );
                    }
                    catch {
                        return false;
                    }
                };

            return (
                matches(
                    "(pointer: coarse)"
                ) &&
                matches(
                    "(max-width: 600px)"
                )
            );
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

            if (text.startsWith("[")) {
                const match = text.match(/^\[([^\]]+)\]\s*~\s*\[([^\]]+)\]$/);
                if (!match || sustain) throw new Error("Roll notation requires [notes] ~ [notes], without a sustain suffix.");
                const groups = match.slice(1).map(group => group.trim().split(/\s+/).filter(Boolean));
                if (groups.some(group => !group.length)) throw new Error("Roll chords cannot be empty.");
                groups.flat().forEach(note => this.#frequency(note));
                return { kind: "roll", groups };
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

        #instrumentEnvelope(instrument) {
            const source =
                instrument?.envelope &&
                typeof instrument.envelope === "object"
                    ? instrument.envelope
                    : {};

            const number = (
                value,
                fallback,
                minimum = 0,
                maximum = Infinity
            ) => {
                const numeric = Number(value);
                return Number.isFinite(numeric)
                    ? Math.max(
                        minimum,
                        Math.min(
                            maximum,
                            numeric
                        )
                    )
                    : fallback;
            };

            return {
                attack:
                    number(
                        source.attack,
                        0
                    ),
                decay:
                    number(
                        source.decay,
                        0
                    ),
                sustain:
                    number(
                        source.sustain,
                        1,
                        0,
                        1
                    ),
                release:
                    number(
                        instrument.class === "expressive" || instrument.partials?.some(partial => partial.envelope)
                            ? Math.max(source.release ?? 0, ...(instrument.partials || []).map(partial => partial.envelope?.release ?? 0))
                            : source.release,
                        0
                    )
            };
        }

        #instrumentPartials(instrument) {
            if (
                !Array.isArray(
                    instrument?.partials
                ) ||
                instrument.partials.length === 0
            ) {
                return [
                    {
                        ratio: 1,
                        gain: 1,
                        detune: 0
                    }
                ];
            }

            const partials =
                instrument.partials
                    .map(
                        partial => {
                            if (
                                !partial ||
                                typeof partial !==
                                    "object"
                            ) {
                                return undefined;
                            }

                            const ratio =
                                Number(
                                    partial.ratio
                                );
                            const gain =
                                Number(
                                    partial.gain
                                );
                            const detune =
                                Number(
                                    partial.detune
                                );

                            if (
                                !Number.isFinite(
                                    ratio
                                ) ||
                                ratio <= 0
                            ) {
                                return undefined;
                            }

                            return {
                                ...(partial.envelope ? {envelope: partial.envelope} : {}),
                                ratio,
                                gain:
                                    Number.isFinite(
                                        gain
                                    )
                                        ? Math.max(
                                            0,
                                            gain
                                        )
                                        : 1,
                                detune:
                                    Number.isFinite(
                                        detune
                                    )
                                        ? detune
                                        : 0,
                                waveform:
                                    typeof partial
                                        .waveform ===
                                        "string"
                                        ? partial
                                            .waveform
                                        : undefined
                            };
                        }
                    )
                    .filter(
                        Boolean
                    );

            return partials.length
                ? partials
                : [
                    {
                        ratio: 1,
                        gain: 1,
                        detune: 0
                    }
                ];
        }

        #velocityDynamic(
            value,
            instrument
        ) {
            const sensitivity =
                Number(
                    instrument
                        ?.velocitySensitivity
                );
            const amount =
                Number.isFinite(
                    sensitivity
                )
                    ? Math.max(
                        0,
                        Math.min(
                            1,
                            sensitivity
                        )
                    )
                    : 1;

            return (
                1 -
                amount *
                    (
                        1 -
                        value
                    )
            );
        }

        #schedulePitch(
            oscillator,
            tone,
            startAt,
            effectEnd,
            instrument,
            ratio,
            partialDetune
        ) {
            const scale =
                frequency =>
                    frequency *
                    ratio;

            if (tone.kind === "note") {
                oscillator.frequency
                    .setValueAtTime(
                        scale(
                            this.#frequency(
                                tone.note
                            )
                        ),
                        startAt
                    );
            }
            else if (tone.kind === "bend") {
                const fromFrequency =
                    this.#frequency(
                        tone.from
                    );
                const toFrequency =
                    this.#frequency(
                        tone.to
                    );

                if (
                    (
                        tone.direction ===
                            "up" &&
                        toFrequency <=
                            fromFrequency
                    ) ||
                    (
                        tone.direction ===
                            "down" &&
                        toFrequency >=
                            fromFrequency
                    )
                ) {
                    throw new Error(
                        "Bend direction does not match its note order: " +
                        tone.from +
                        (
                            tone.direction ===
                                "up"
                                ? "/"
                                : "\\"
                        ) +
                        tone.to
                    );
                }

                oscillator.frequency
                    .setValueAtTime(
                        scale(
                            fromFrequency
                        ),
                        startAt
                    );
                oscillator.frequency
                    .exponentialRampToValueAtTime(
                        scale(
                            toFrequency
                        ),
                        effectEnd
                    );
            }
            else {
                const fromFrequency =
                    this.#frequency(
                        tone.from
                    );
                const toFrequency =
                    this.#frequency(
                        tone.to
                    );
                const semitoneDistance =
                    Math.abs(
                        12 *
                        Math.log2(
                            toFrequency /
                            fromFrequency
                        )
                    );

                if (
                    Math.abs(
                        semitoneDistance -
                        1
                    ) >
                    0.01
                ) {
                    throw new Error(
                        "Trill notes must be exactly one semitone apart."
                    );
                }

                const subdivision =
                    Math.max(
                        1 / 64,
                        this.#beats(
                            instrument
                                .trillStep ??
                            "1/8"
                        )
                    );
                const beatSeconds =
                    Number(
                        instrument
                            .__beatSeconds
                    );
                const stepSeconds =
                    subdivision *
                    (
                        Number.isFinite(
                            beatSeconds
                        )
                            ? beatSeconds
                            : 0.5
                    );
                let cursor =
                    startAt;
                let alternate =
                    false;

                oscillator.frequency
                    .setValueAtTime(
                        scale(
                            fromFrequency
                        ),
                        startAt
                    );

                while (
                    cursor +
                        stepSeconds <
                    effectEnd
                ) {
                    cursor +=
                        stepSeconds;
                    alternate =
                        !alternate;
                    oscillator.frequency
                        .setValueAtTime(
                            scale(
                                alternate
                                    ? toFrequency
                                    : fromFrequency
                            ),
                            cursor
                        );
                }

                oscillator.frequency
                    .setValueAtTime(
                        scale(
                            toFrequency
                        ),
                        effectEnd
                    );
            }

            const baseDetune =
                (
                    Number.isFinite(
                        Number(
                            instrument
                                ?.detune
                        )
                    )
                        ? Number(
                            instrument
                                .detune
                        )
                        : 0
                ) +
                partialDetune;

            oscillator.detune
                ?.setValueAtTime?.(
                    baseDetune,
                    startAt
                );

            const pitchEnvelope =
                instrument
                    ?.pitchEnvelope;

            if (
                !pitchEnvelope ||
                typeof pitchEnvelope !==
                    "object" ||
                !oscillator.detune
            ) {
                return;
            }

            const amount =
                Number(
                    pitchEnvelope.amount
                );

            if (
                !Number.isFinite(
                    amount
                ) ||
                amount === 0
            ) {
                return;
            }

            const attack =
                Math.max(
                    0,
                    Number(
                        pitchEnvelope.attack
                    ) ||
                    0
                );
            const decay =
                Math.max(
                    0,
                    Number(
                        pitchEnvelope.decay
                    ) ||
                    0
                );
            const peakAt =
                Math.min(
                    effectEnd,
                    startAt +
                        attack
                );
            const settleAt =
                Math.min(
                    effectEnd,
                    peakAt +
                        decay
                );

            if (attack > 0) {
                oscillator.detune
                    .linearRampToValueAtTime(
                        baseDetune +
                            amount,
                        peakAt
                    );
            }
            else {
                oscillator.detune
                    .setValueAtTime(
                        baseDetune +
                            amount,
                        startAt
                    );
            }

            if (
                decay > 0 &&
                settleAt >
                    peakAt
            ) {
                oscillator.detune
                    .linearRampToValueAtTime(
                        baseDetune,
                        settleAt
                    );
            }
        }

        #instrumentResource(
            context,
            name,
            instrument
        ) {
            if (
                this.#instrumentResources.has(
                    name
                )
            ) {
                return this.#instrumentResources.get(
                    name
                );
            }

            const input =
                context.createGain();
            const dry =
                context.createGain();
            const outputs =
                [
                    dry
                ];
            let tail =
                0;

            input.connect(
                dry
            );

            const delay =
                instrument
                    ?.delay;

            if (
                delay &&
                typeof delay ===
                    "object" &&
                typeof context
                    .createDelay ===
                    "function"
            ) {
                const delayTime =
                    Math.max(
                        0,
                        Math.min(
                            5,
                            Number(
                                delay.time
                            ) ||
                            0
                        )
                    );
                const feedback =
                    Math.max(
                        0,
                        Math.min(
                            0.95,
                            Number(
                                delay.feedback
                            ) ||
                            0
                        )
                    );
                const wet =
                    Math.max(
                        0,
                        Math.min(
                            1,
                            Number(
                                delay.wet
                            ) ||
                            0
                        )
                    );

                if (
                    delayTime >
                        0 &&
                    wet >
                        0
                ) {
                    const delayNode =
                        context.createDelay(
                            5
                        );
                    const feedbackGain =
                        context.createGain();
                    const wetGain =
                        context.createGain();

                    delayNode.delayTime.value =
                        delayTime;
                    feedbackGain.gain.value =
                        feedback;
                    wetGain.gain.value =
                        wet;

                    input.connect(
                        delayNode
                    );
                    delayNode.connect(
                        feedbackGain
                    );
                    feedbackGain.connect(
                        delayNode
                    );
                    delayNode.connect(
                        wetGain
                    );

                    outputs.push(
                        wetGain
                    );

                    tail =
                        Math.max(
                            tail,
                            delayTime *
                                (
                                    1 +
                                    feedback *
                                        6
                                )
                        );
                }
            }

            const reverb =
                instrument
                    ?.reverb;

            if (
                reverb &&
                typeof reverb ===
                    "object" &&
                typeof context
                    .createConvolver ===
                    "function"
            ) {
                const wet =
                    Math.max(
                        0,
                        Math.min(
                            1,
                            Number(
                                reverb.wet
                            ) ||
                            0
                        )
                    );
                const decay =
                    Math.max(
                        0.05,
                        Math.min(
                            10,
                            Number(
                                reverb.decay
                            ) ||
                            1.5
                        )
                    );

                if (
                    wet >
                        0
                ) {
                    const convolver =
                        context.createConvolver();
                    const wetGain =
                        context.createGain();

                    convolver.buffer =
                        this.#reverbImpulse(
                            context,
                            decay
                        );
                    wetGain.gain.value =
                        wet;

                    input.connect(
                        convolver
                    );
                    convolver.connect(
                        wetGain
                    );

                    outputs.push(
                        wetGain
                    );
                    tail =
                        Math.max(
                            tail,
                            decay
                        );
                }
            }

            const resource = {
                name,
                input,
                outputs,
                tail,
                refCount:
                    0,
                connected:
                    false
            };

            this.#instrumentResources.set(
                name,
                resource
            );

            return resource;
        }

        #acquireInstrumentResource(
            entry,
            context,
            name,
            instrument
        ) {
            const resource =
                this.#instrumentResource(
                    context,
                    name,
                    instrument
                );

            if (
                !entry.instrumentResources
                    .has(
                        resource
                    )
            ) {
                entry.instrumentResources.add(
                    resource
                );

                resource.refCount++;

                if (!resource.connected) {
                    for (
                        const output of
                        resource.outputs
                    ) {
                        output.connect(
                            this.#programOutputNode(
                                context
                            )
                        );
                    }

                    resource.connected =
                        true;
                }
            }

            return resource;
        }

        #releaseInstrumentResource(
            context,
            resource
        ) {
            if (!resource) {
                return;
            }

            resource.refCount =
                Math.max(
                    0,
                    resource.refCount -
                        1
                );

            if (
                resource.refCount >
                    0 ||
                !resource.connected
            ) {
                return;
            }

            for (
                const output of
                resource.outputs
            ) {
                try {
                    output.disconnect(
                        this.#programOutputNode(
                    context
                )
                    );
                }
                catch {
                    try {
                        output.disconnect();
                    }
                    catch {}
                }
            }

            resource.connected =
                false;
        }

        #noiseBuffer(context, minimumSeconds = 0.25) {
            const sampleRate =
                Math.max(
                    8000,
                    Number(
                        context.sampleRate
                    ) ||
                    48000
                );
            const seconds =
                Math.max(
                    0.25,
                    Math.min(
                        4,
                        Math.ceil(
                            Math.max(
                                0,
                                Number(
                                    minimumSeconds
                                ) ||
                                0
                            ) *
                                4
                        ) /
                            4
                    )
                );
            const key =
                sampleRate +
                ":" +
                seconds.toFixed(
                    2
                );

            if (
                this.#noiseBuffers.has(
                    key
                )
            ) {
                return this.#noiseBuffers.get(
                    key
                );
            }

            const frameCount =
                Math.max(
                    1,
                    Math.ceil(
                        sampleRate *
                        seconds
                    )
                );
            const buffer =
                context.createBuffer(
                    1,
                    frameCount,
                    sampleRate
                );
            const samples =
                buffer.getChannelData(
                    0
                );
            let seed =
                0x7f4a7c15;

            for (
                let index = 0;
                index <
                    samples.length;
                index++
            ) {
                seed =
                    (
                        seed *
                            1664525 +
                        1013904223
                    ) >>>
                    0;

                samples[index] =
                    seed /
                        0x100000000 *
                        2 -
                    1;
            }

            this.#noiseBuffers.set(
                key,
                buffer
            );

            return buffer;
        }

        #distortionCurve(amount) {
            const clamped =
                Math.max(
                    0,
                    Math.min(
                        1,
                        Number(amount) ||
                        0
                    )
                );
            const key =
                clamped.toFixed(
                    4
                );

            if (
                this.#distortionCurves.has(
                    key
                )
            ) {
                return this.#distortionCurves.get(
                    key
                );
            }

            const curve =
                new Float32Array(
                    1024
                );
            const drive =
                1 +
                clamped *
                    24;

            for (
                let index = 0;
                index <
                    curve.length;
                index++
            ) {
                const x =
                    index *
                        2 /
                        (
                            curve.length -
                            1
                        ) -
                    1;

                curve[index] =
                    (
                        1 +
                        drive
                    ) *
                    x /
                    (
                        1 +
                        drive *
                            Math.abs(
                                x
                            )
                    );
            }

            this.#distortionCurves.set(
                key,
                curve
            );

            return curve;
        }

        #reverbImpulse(context, decay) {
            const seconds =
                Math.max(
                    0.05,
                    Math.min(
                        10,
                        Number.isFinite(
                            Number(decay)
                        )
                            ? Number(decay)
                            : 1.5
                    )
                );
            const key =
                context.sampleRate +
                ":" +
                seconds.toFixed(3);

            if (
                this.#reverbImpulses.has(
                    key
                )
            ) {
                return this.#reverbImpulses.get(
                    key
                );
            }

            const length =
                Math.max(
                    1,
                    Math.floor(
                        context.sampleRate *
                        seconds
                    )
                );
            const impulse =
                context.createBuffer(
                    2,
                    length,
                    context.sampleRate
                );
            let seed =
                0x51f15e;

            const random =
                () => {
                    seed =
                        (
                            seed *
                                1664525 +
                            1013904223
                        ) >>>
                        0;

                    return (
                        seed /
                        0x100000000
                    );
                };

            for (
                let channel = 0;
                channel <
                    impulse.numberOfChannels;
                channel++
            ) {
                const data =
                    impulse.getChannelData(
                        channel
                    );

                for (
                    let sample = 0;
                    sample <
                        data.length;
                    sample++
                ) {
                    const progress =
                        sample /
                        data.length;
                    const envelope =
                        Math.pow(
                            1 - progress,
                            2.35
                        );

                    data[sample] =
                        (
                            random() *
                                2 -
                            1
                        ) *
                        envelope;
                }
            }

            this.#reverbImpulses.set(
                key,
                impulse
            );

            return impulse;
        }

        #scheduleTone(
            context,
            entry,
            event,
            instrument,
            bpm,
            songGain,
            instrumentResource
        ) {
            const strikes = this.rollStrikes(event);
            if (strikes) return strikes.reduce((end, strike) => Math.max(end,
                this.#scheduleTone(context, entry, strike, instrument, bpm, songGain, instrumentResource)), entry.startedAt);

            let model = this.#instrumentModels.get(instrument);
            if (!model) {
                model = OscillatorInstrument.from(instrument);
                this.#instrumentModels.set(instrument, model);
            }
            const originalInstrument = instrument;
            instrument = model.forEvent(event, this.#dynamic(event.dynamic).start);
            const nodesBefore =
                new Set(
                    entry.nodes
                );
            const beatSeconds =
                60 /
                bpm;
            const offsetBeats =
                this.#beats(
                    event.offset
                );
            const lengthParts =
                String(
                    event.length ??
                    "1"
                )
                    .split(",")
                    .map(
                        part =>
                            part.trim()
                    );

            if (
                lengthParts.length >
                2
            ) {
                throw new Error(
                    "A tone length may contain at most two values."
                );
            }

            const effectBeats =
                this.#beats(
                    lengthParts[0]
                );
            const sustainBeats =
                lengthParts.length ===
                    2
                    ? this.#beats(
                        lengthParts[1]
                    )
                    : 0;

            const tone =
                this.#parseTone(
                    event.tone
                );

            if (
                sustainBeats &&
                !tone.sustain
            ) {
                throw new Error(
                    "A second tone length requires ... sustain notation."
                );
            }

            const startAt =
                entry.startedAt +
                offsetBeats *
                    beatSeconds + this.#noteDelayMs(event) / 1000;
            const effectEnd =
                startAt +
                Math.max(
                    0,
                    effectBeats *
                        beatSeconds
                );
            const noteEnd =
                effectEnd +
                Math.max(
                    0,
                    sustainBeats *
                        beatSeconds
                );
            const envelope =
                this.#instrumentEnvelope(
                    instrument.__expressive ? {envelope:{attack:0,decay:0,sustain:1,release:instrument.envelope.release}} : instrument
                );
            let endAt =
                noteEnd +
                envelope.release;
            const dynamic =
                this.#dynamic(
                    event.dynamic
                );
            const volume =
                Number.isFinite(
                    Number(
                        instrument.volume
                    )
                )
                    ? Number(
                        instrument.volume
                    )
                    : 1;
            const dynamicGain =
                context.createGain();
            const envelopeGain =
                context.createGain();
            const startDynamic =
                this.#velocityDynamic(
                    dynamic.start,
                    instrument
                );
            const endDynamic =
                this.#velocityDynamic(
                    dynamic.end,
                    instrument
                );

            dynamicGain.gain
                .setValueAtTime(
                    Math.max(
                        0.0001,
                        startDynamic *
                            volume *
                            songGain
                    ),
                    startAt
                );

            if (
                endDynamic !==
                startDynamic
            ) {
                dynamicGain.gain
                    .linearRampToValueAtTime(
                        Math.max(
                            0.0001,
                            endDynamic *
                                volume *
                                songGain
                        ),
                        effectEnd
                    );
            }

            envelopeGain.gain
                .setValueAtTime(
                    envelope.attack >
                        0
                        ? 0.0001
                        : 1,
                    startAt
                );

            const attackEnd =
                Math.min(
                    noteEnd,
                    startAt +
                        envelope.attack
                );

            if (
                envelope.attack >
                0
            ) {
                envelopeGain.gain
                    .linearRampToValueAtTime(
                        1,
                        attackEnd
                    );
            }

            const decayEnd =
                Math.min(
                    noteEnd,
                    attackEnd +
                        envelope.decay
                );

            if (
                envelope.decay >
                    0 &&
                decayEnd >
                    attackEnd
            ) {
                envelopeGain.gain
                    .linearRampToValueAtTime(
                        Math.max(
                            0.0001,
                            envelope.sustain
                        ),
                        decayEnd
                    );
            }
            else if (
                attackEnd <
                noteEnd
            ) {
                envelopeGain.gain
                    .setValueAtTime(
                        Math.max(
                            0.0001,
                            envelope.sustain
                        ),
                        attackEnd
                    );
            }

            if (
                decayEnd <
                noteEnd
            ) {
                envelopeGain.gain
                    .setValueAtTime(
                        Math.max(
                            0.0001,
                            envelope.sustain
                        ),
                        noteEnd
                    );
            }

            if (
                envelope.release >
                0
            ) {
                envelopeGain.gain
                    .setValueAtTime(
                        Math.max(
                            0.0001,
                            envelope.sustain
                        ),
                        noteEnd
                    );
                envelopeGain.gain
                    .exponentialRampToValueAtTime(
                        0.0001,
                        endAt
                    );
            }

            if (instrument.__expressive) {
                // The partial/sample envelopes own the release; do not multiply them by a shared ADSR.
                envelopeGain.gain.cancelScheduledValues(startAt);
                envelopeGain.gain.setValueAtTime(1, startAt);
            }
            let sourceDestination =
                envelopeGain;
            let filterNode;
            const filter =
                instrument
                    ?.filter;

            if (
                filter &&
                typeof filter ===
                    "object" &&
                typeof context
                    .createBiquadFilter ===
                    "function"
            ) {
                filterNode =
                    context
                        .createBiquadFilter();

                if (
                    typeof filter.type ===
                    "string"
                ) {
                    filterNode.type =
                        filter.type;
                }

                const baseFrequency =
                    Number.isFinite(
                        Number(
                            filter.frequency
                        )
                    )
                        ? Math.max(
                            10,
                            Number(
                                filter.frequency
                            )
                        )
                        : 5000;
                const nyquist =
                    Math.max(
                        10,
                        (
                            Number(
                                context.sampleRate
                            ) ||
                            48000
                        ) /
                            2
                    );
                const clampedBase =
                    Math.min(
                        nyquist,
                        baseFrequency
                    );
                const envelopeAmount =
                    Number.isFinite(
                        Number(
                            filter.envelopeAmount
                        )
                    )
                        ? Number(
                            filter
                                .envelopeAmount
                        )
                        : 0;
                const initialFrequency =
                    Math.max(
                        10,
                        Math.min(
                            nyquist,
                            clampedBase +
                                envelopeAmount
                        )
                    );

                filterNode.frequency
                    .setValueAtTime(
                        initialFrequency,
                        startAt
                    );

                if (
                    envelopeAmount !==
                    0
                ) {
                    const filterSettleAt =
                        Math.min(
                            noteEnd,
                            startAt +
                                Math.max(
                                    0.001,
                                    envelope.attack +
                                        envelope.decay
                                )
                        );

                    filterNode.frequency
                        .linearRampToValueAtTime(
                            clampedBase,
                            filterSettleAt
                        );
                }

                if (
                    Number.isFinite(
                        Number(
                            filter.Q
                        )
                    )
                ) {
                    filterNode.Q
                        .setValueAtTime(
                            Math.max(
                                0,
                                Number(
                                    filter.Q
                                )
                            ),
                            startAt
                        );
                }

                filterNode.connect(
                    envelopeGain
                );
                sourceDestination =
                    filterNode;
                entry.nodes.add(
                    filterNode
                );
            }

            envelopeGain.connect(
                dynamicGain
            );

            let outputNode =
                dynamicGain;

            const distortionSource =
                instrument
                    ?.distortion;
            const distortionAmount =
                Number(
                    typeof distortionSource ===
                        "object"
                        ? distortionSource
                            ?.amount
                        : distortionSource
                );

            if (
                Number.isFinite(
                    distortionAmount
                ) &&
                distortionAmount >
                    0 &&
                typeof context
                    .createWaveShaper ===
                    "function"
            ) {
                const amount =
                    Math.max(
                        0,
                        Math.min(
                            1,
                            distortionAmount
                        )
                    );
                const shaper =
                    context
                        .createWaveShaper();

                shaper.curve =
                    this.#distortionCurve(
                        amount
                    );
                shaper.oversample =
                    "2x";

                outputNode.connect(
                    shaper
                );
                outputNode =
                    shaper;

                entry.nodes.add(
                    shaper
                );
            }

            const tremolo =
                instrument
                    ?.tremolo;

            if (
                tremolo &&
                typeof tremolo ===
                    "object" &&
                typeof context
                    .createOscillator ===
                    "function"
            ) {
                const rate =
                    Number(
                        tremolo.rate
                    );
                const depth =
                    Number(
                        tremolo.depth
                    );

                if (
                    Number.isFinite(
                        rate
                    ) &&
                    rate >
                        0 &&
                    Number.isFinite(
                        depth
                    ) &&
                    depth >
                        0
                ) {
                    const clampedDepth =
                        Math.max(
                            0,
                            Math.min(
                                1,
                                depth
                            )
                        );
                    const tremoloGain =
                        context
                            .createGain();
                    const lfo =
                        context
                            .createOscillator();
                    const lfoDepth =
                        context
                            .createGain();

                    tremoloGain.gain
                        .setValueAtTime(
                            1 -
                                clampedDepth /
                                    2,
                            startAt
                        );
                    lfo.type =
                        "sine";
                    lfo.frequency
                        .setValueAtTime(
                            Math.min(
                                30,
                                rate
                            ),
                            startAt
                        );
                    lfoDepth.gain
                        .setValueAtTime(
                            clampedDepth /
                                2,
                            startAt
                        );

                    lfo.connect(
                        lfoDepth
                    );
                    lfoDepth.connect(
                        tremoloGain.gain
                    );
                    outputNode.connect(
                        tremoloGain
                    );
                    outputNode =
                        tremoloGain;

                    lfo.start(
                        startAt
                    );
                    lfo.stop(
                        Math.max(
                            startAt +
                                0.001,
                            endAt
                        )
                    );

                    entry.nodes.add(
                        tremoloGain
                    );
                    entry.nodes.add(
                        lfo
                    );
                    entry.nodes.add(
                        lfoDepth
                    );
                }
            }

            // Optional per-voice chorus leaves every existing instrument's routing intact.
            if (instrument.chorus && (instrument.chorus.wet ?? 0.3) > 0) {
                const chorus = instrument.chorus;
                const mix = context.createGain();
                const dry = context.createGain();
                const wet = chorus.wet ?? 0.3;
                dry.gain.setValueAtTime(1 - wet, startAt);
                outputNode.connect(dry); dry.connect(mix);
                entry.nodes.add(mix); entry.nodes.add(dry);
                const lfo = context.createOscillator();
                lfo.type = "sine";
                lfo.frequency.setValueAtTime(chorus.rate ?? 0.6, startAt);
                entry.nodes.add(lfo);
                for (const side of [-1, 1]) {
                    const delayed = context.createDelay(0.15);
                    const modulation = context.createGain();
                    const level = context.createGain();
                    delayed.delayTime.setValueAtTime(chorus.delay ?? 0.016, startAt);
                    modulation.gain.setValueAtTime(side * (chorus.depth ?? 0.0025), startAt);
                    level.gain.setValueAtTime(wet / 2, startAt);
                    lfo.connect(modulation); modulation.connect(delayed.delayTime);
                    outputNode.connect(delayed); delayed.connect(level);
                    if (typeof context.createStereoPanner === "function") {
                        const pan = context.createStereoPanner();
                        pan.pan.setValueAtTime(side, startAt);
                        level.connect(pan); pan.connect(mix); entry.nodes.add(pan);
                    } else level.connect(mix);
                    for (const node of [delayed, modulation, level]) entry.nodes.add(node);
                }
                lfo.start(startAt);
                lfo.stop(endAt + (chorus.delay ?? 0.016) + (chorus.depth ?? 0.0025));
                outputNode = mix;
            }

            outputNode.connect(
                instrumentResource
                    ?.input ||
                this.#programOutputNode(
                    context
                )
            );

            const effectTail =
                Math.max(
                    0,
                    Number(
                        instrumentResource
                            ?.tail
                    ) ||
                    0
                );

            entry.nodes.add(
                envelopeGain
            );
            entry.nodes.add(
                dynamicGain
            );

            const partials =
                this.#instrumentPartials(
                    instrument
                );
            const instrumentForPitch = {
                ...instrument,
                __beatSeconds:
                    beatSeconds
            };

            if (instrument.repeatDamping) {
                entry.expressiveVoices ??= new Map();
                const voices = entry.expressiveVoices.get(originalInstrument) || new Map();
                const key = event.tone;
                const prior = voices.get(key);
                if (prior && prior.start <= startAt && prior.end > startAt) {
                    // Web Audio holds the actual envelope value at the new strike, avoiding clicks.
                    prior.param.cancelAndHoldAtTime(startAt);
                    prior.param.linearRampToValueAtTime(0, startAt + (instrument.repeatDamping.release ?? 0.02));
                }
                voices.set(key, {param:dynamicGain.gain,start:startAt,end:endAt});
                entry.expressiveVoices.set(originalInstrument, voices);
            }
            if (instrument.samples) {
                if (tone.kind !== "note") throw new TypeError("Sample instruments currently require ordinary notes or bracketed rolls");
                const frequency = this.#frequency(tone.note);
                const sample = model.sampleFor(frequency, instrument.__strikeStrength, event);
                if (!sample.buffer) throw new Error("Instrument sample was not prepared");
                const source = context.createBufferSource();
                const gain = context.createGain();
                source.buffer = sample.buffer;
                if (sample.loopEnd !== undefined) {
                    source.loop = true; source.loopStart = sample.loopStart ?? 0; source.loopEnd = sample.loopEnd;
                }
                const playbackRate = frequency / sample.rootFrequency * 2 ** (instrument.__detuneVariation / 1200);
                source.playbackRate.setValueAtTime(playbackRate, startAt);
                const sampleGain = (sample.gain ?? 1) * instrument.__gainVariation;
                if (sample.naturalDecay) {
                    gain.gain.setValueAtTime(sampleGain, startAt);
                    endAt = startAt + (sample.buffer.duration - (event.sampleStartSeconds || 0)) / playbackRate;
                    // Natural recorded decay owns the end; ignore the written note's gate.
                    envelopeGain.gain.cancelScheduledValues(startAt);
                    envelopeGain.gain.setValueAtTime(1, startAt);
                } else ExpressiveInstrument.envelope(gain.gain, instrument.envelope, startAt, noteEnd, sampleGain);
                source.connect(gain); gain.connect(sourceDestination);
                entry.nodes.add(source); entry.nodes.add(gain);
                source.start(startAt, event.sampleStartSeconds || 0); source.stop(endAt);
            }
            for (
                const partial of
                (instrument.samples ? [] : partials)
            ) {
                const oscillator =
                    context
                        .createOscillator();
                const partialGain =
                    context
                        .createGain();

                oscillator.type =
                    partial.waveform ||
                    (
                        typeof instrument
                            .waveform ===
                            "string"
                            ? instrument
                                .waveform
                            : "sine"
                    );

                partialGain.gain
                    .setValueAtTime(
                        partial.gain,
                        startAt
                    );

                if (instrument.__expressive) {
                    ExpressiveInstrument.envelope(partialGain.gain,
                        partial.envelope || originalInstrument.envelope || {}, startAt, noteEnd, partial.gain);
                }
                this.#schedulePitch(
                    oscillator,
                    tone,
                    startAt,
                    effectEnd,
                    instrumentForPitch,
                    partial.ratio,
                    partial.detune
                );

                oscillator.connect(
                    partialGain
                );
                partialGain.connect(
                    sourceDestination
                );

                oscillator.start(
                    startAt
                );
                oscillator.stop(
                    Math.max(
                        startAt +
                            0.001,
                        endAt
                    )
                );

                entry.nodes.add(
                    oscillator
                );
                entry.nodes.add(
                    partialGain
                );

                oscillator
                    .addEventListener(
                        "ended",
                        () => {
                            entry.nodes
                                .delete(
                                    oscillator
                                );
                            entry.nodes
                                .delete(
                                    partialGain
                                );

                            try {
                                oscillator
                                    .disconnect();
                            }
                            catch {}

                            try {
                                partialGain
                                    .disconnect();
                            }
                            catch {}
                        },
                        {
                            once: true
                        }
                    );
            }

            const noise =
                instrument
                    ?.noise;
            const noiseAmount =
                Number(
                    noise?.amount
                );

            if (
                noise &&
                typeof noise ===
                    "object" &&
                Number.isFinite(
                    noiseAmount
                ) &&
                noiseAmount >
                    0 &&
                typeof context
                    .createBuffer ===
                    "function" &&
                typeof context
                    .createBufferSource ===
                    "function"
            ) {
                const noiseDecay =
                    Math.max(
                        0.001,
                        Number(
                            noise.decay
                        ) ||
                        0.03
                    );
                const noiseEnd =
                    Math.min(
                        endAt,
                        startAt +
                            noiseDecay
                    );
                const buffer =
                    this.#noiseBuffer(
                        context,
                        noiseDecay
                    );
                const source =
                    context
                        .createBufferSource();
                const noiseGain =
                    context
                        .createGain();

                source.buffer =
                    buffer;
                noiseGain.gain
                    .setValueAtTime(
                        noiseAmount,
                        startAt
                    );
                noiseGain.gain
                    .exponentialRampToValueAtTime(
                        0.0001,
                        noiseEnd
                    );

                source.connect(
                    noiseGain
                );
                noiseGain.connect(
                    sourceDestination
                );
                source.start(
                    startAt
                );
                source.stop(
                    Math.max(
                        startAt +
                            0.001,
                        noiseEnd
                    )
                );

                entry.nodes.add(
                    source
                );
                entry.nodes.add(
                    noiseGain
                );

                source.addEventListener(
                    "ended",
                    () => {
                        entry.nodes.delete(
                            source
                        );
                        entry.nodes.delete(
                            noiseGain
                        );

                        try {
                            source.disconnect();
                        }
                        catch {}

                        try {
                            noiseGain
                                .disconnect();
                        }
                        catch {}
                    },
                    {
                        once: true
                    }
                );
            }

            const toneNodes =
                Array.from(
                    entry.nodes
                ).filter(
                    node =>
                        !nodesBefore.has(
                            node
                        )
                );
            const cleanupDelay =
                Math.max(
                    0,
                    (
                        endAt +
                        effectTail +
                        0.05 -
                        context.currentTime
                    ) *
                        1000
                );
            const cleanupTimer =
                setTimeout(
                    () => {
                        entry.timers.delete(
                            cleanupTimer
                        );

                        for (
                            const node of
                            toneNodes
                        ) {
                            entry.nodes.delete(
                                node
                            );

                            try {
                                node.stop?.();
                            }
                            catch {}

                            try {
                                node.disconnect?.();
                            }
                            catch {}
                        }
                    },
                    cleanupDelay
                );

            entry.timers.add(
                cleanupTimer
            );

            return endAt + effectTail;
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
                        speechDelayMs:
                            entry.requestedSpeechDelayMs,
                        loop: true
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
                    beatSeconds +
                (
                    entry.speechDelayMs ||
                    0
                ) /
                    1000;
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

                        if (
                            entry.speechGuard &&
                            entry.speechGuard() ===
                                false
                        ) {
                            entry.pendingSpeech =
                                Math.max(
                                    0,
                                    entry.pendingSpeech -
                                        1
                                );
                            this.#maybeComplete(
                                entry
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

                        const eventRate =
                            Number(
                                event.rate
                            );
                        const speechVelocity =
                            entry.speechVelocity ??
                            this.#outputSettings
                                .speechVelocity;

                        if (
                            Number.isFinite(
                                eventRate
                            )
                        ) {
                            utterance.rate =
                                eventRate *
                                speechVelocity;
                        }
                        else if (
                            speechVelocity !==
                                1
                        ) {
                            // At exactly 1x, leave rate unset so the voice
                            // uses its true browser/native default.
                            utterance.rate =
                                speechVelocity;
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

                        utterance.volume =
                            Math.max(
                                0,
                                Math.min(
                                    1,
                                    (
                                        Number.isFinite(
                                            Number(
                                                event.volume
                                            )
                                        )
                                            ? Number(
                                                event.volume
                                            )
                                            : 1
                                    ) *
                                    (
                                        entry.speechVolume ??
                                        this.#outputSettings.speechVolume
                                    )
                                )
                            );

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
                                globalThis
                                    .dispatchEvent?.(
                                        new CustomEvent(
                                            "wmof-audio-speak",
                                            {
                                                detail: {
                                                    text,
                                                    lang:
                                                        utterance.lang,
                                                    rate:
                                                        utterance.rate,
                                                    pitch:
                                                        utterance.pitch,
                                                    volume:
                                                        utterance.volume,
                                                    voiceProvider:
                                                        "system",
                                                    voice:
                                                        ""
                                                }
                                            }
                                        )
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

                        synthesizedSpeechToken =
                            globalThis
                                .SpeechMenu
                                ?.registerSynthesizedSpeech?.(
                                    text
                                );

                        try {
                            synthesis.speak(
                                utterance
                            );
                        }
                        catch (error) {
                            console.warn("Audio speech failed to start:", text, error);
                            finish();
                        }
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

            if (
                entry.instrumentResources &&
                this.#context
            ) {
                for (
                    const resource of
                    entry.instrumentResources
                ) {
                    this.#releaseInstrumentResource(
                        this.#context,
                        resource
                    );
                }

                entry.instrumentResources.clear();
            }

            for (const node of entry.nodes) {
                try { node.stop?.(); } catch {}
                try { node.disconnect?.(); } catch {}
            }
            entry.nodes.clear();

            this.#active.delete(entry.id);

            entry.resolveFinished?.({
                id:
                    entry.id,
                name:
                    entry.name,
                reason
            });

            entry.resolveFinished =
                undefined;

        }

        // Bracketed groups distinguish struck tremolo from the legacy semitone pitch trill.
        rollStrikes(event, defaultStep = "1/4") {
            if (!String(event?.tone || "").trim().startsWith("[")) return undefined;
            const tone = this.#parseTone(event.tone);
            const lengths = String(event.length ?? "1").split(",");
            if (lengths.length !== 1) throw new Error("Roll length is one duration of repeated strikes.");
            const length = this.#beats(lengths[0]);
            const step = this.#beats(event.rollStep ?? defaultStep);
            if (!(step > 0) || !Number.isFinite(step)) throw new RangeError("Roll step must be greater than zero.");
            const count = Math.ceil(length / step);
            if (count * Math.max(...tone.groups.map(group => group.length)) > 4096) throw new RangeError("Too many roll strikes.");
            const offset = this.#beats(event.offset);
            const strikes = [];
            for (let index = 0; index < count; index++) {
                const at = index * step;
                for (const note of tone.groups[index % 2]) strikes.push({ ...event, tone: note,
                    offset: String(offset + at), length: String(Math.min(step, length - at)) });
            }
            return strikes;
        }

        #noteDelayMs(event) {
            const delay = Number(event?.noteDelayMs ?? 0);
            if (!Number.isFinite(delay) || delay < 0) throw new RangeError("Note delay must be a finite non-negative number.");
            return delay;
        }

        loudnessGain(song, instrument = song?.instrument) {
            const measured = song?.loudness;
            if (!measured || measured.instrument !== instrument || !Number.isFinite(measured.rmsDbFS) ||
                !Number.isFinite(measured.peakDbFS) || !(measured.referenceToneVolume > 0)) return 1;
            // Only attenuate: preserve dynamics, user volume, and peak headroom.
            const balance = Math.pow(10, (-20 - measured.rmsDbFS) / 20);
            const headroom = 0.85 * measured.referenceToneVolume / Math.pow(10, measured.peakDbFS / 20);
            return Math.max(0, Math.min(1, balance, headroom));
        }

        playbackEvents(song, startBeat = 0) {
            if (!song?.approvedMix || song.events?.length !== 1) return song?.events || [];
            const event = song.events[0];
            const offset = this.#beats(event.offset);
            const length = this.#beats(event.length);
            if (startBeat <= offset) return song.events;
            if (startBeat >= offset + length) return [];
            return [{ ...event, offset: String(startBeat), length: String(offset + length - startBeat),
                sampleStartSeconds: (startBeat - offset) * 60 / song.bpm }];
        }

        // Musical metadata only; announcements decide when speech is permitted.
        songTiming(song, { bpm = song?.bpm ?? 120, toneVelocity = 1, startBeat = 0 } = {}) {
            const tempo = Number(bpm) * Number(toneVelocity);
            if (!Number.isFinite(tempo) || tempo <= 0) throw new RangeError("Song BPM must be greater than zero.");
            const beatMs = 60000 / tempo;
            const notes = this.playbackEvents(song, startBeat).flatMap(event => this.rollStrikes(event) ?? [event]).filter(event => event?.tone && this.#beats(event.offset) >= startBeat)
                .map(event => {
                    const lengths = String(event.length ?? "1").split(",");
                    const offset = this.#beats(event.offset) - startBeat;
                    const effect = this.#beats(lengths[0]);
                    const sustain = lengths.length > 1 ? this.#beats(lengths[1]) : 0;
                    const delayMs = this.#noteDelayMs(event);
                    return Object.freeze({ offsetMs: offset * beatMs + delayMs, noteDelayMs: delayMs, durationMs: (effect + sustain) * beatMs,
                        sustainStartMs: sustain > 0 && String(event.tone).endsWith("...") ? (offset + effect) * beatMs + delayMs : null });
                });
            return Object.freeze({ bpm: tempo, noteCount: notes.length, notes: Object.freeze(notes),
                durationMs: notes.reduce((end, note) => Math.max(end, note.offsetMs + note.durationMs), 0),
                sustainStartMs: notes.reduce((first, note) => note.sustainStartMs === null ? first : Math.min(first ?? Infinity, note.sustainStartMs), null) });
        }

        async startSong(
            name,
            {
                bpm,
                volume = 1,
                toneVolume,
                toneVelocity,
                speechVolume,
                speechVelocity,
                speechDelayMs = 0,
                speechGuard,
                loop,
                includeTones = true,
                includeSpeech = true,
                useSelectedInstrument =
                    true,
                startBeat = 0,
                normalizeLoudness = true
            } = {}
        ) {
            const catalog = await this.prepare();
            const song = catalog?.songs?.[name];

            if (!song) {
                throw new Error("Unknown song: " + name);
            }

            const context = await this.#audioContext();

            this.#prepareAudioResources(
                context
            );

            const effectiveToneVelocity =
                Number.isFinite(
                    Number(toneVelocity)
                )
                    ? Math.max(
                        0.5,
                        Math.min(
                            1.5,
                            Number(toneVelocity)
                        )
                    )
                    : this.#outputSettings
                        .toneVelocity;

            const effectiveToneVolume =
                Number.isFinite(
                    Number(toneVolume)
                )
                    ? Math.max(
                        0,
                        Math.min(
                            1,
                            Number(toneVolume)
                        )
                    )
                    : this.#outputSettings
                        .toneVolume;

            const effectiveSpeechVelocity =
                Number.isFinite(
                    Number(speechVelocity)
                )
                    ? Math.max(
                        0.5,
                        Math.min(
                            4,
                            Number(speechVelocity)
                        )
                    )
                    : this.#outputSettings
                        .speechVelocity;

            const effectiveSpeechVolume =
                Number.isFinite(
                    Number(speechVolume)
                )
                    ? Math.max(
                        0,
                        Math.min(
                            1,
                            Number(speechVolume)
                        )
                    )
                    : this.#outputSettings
                        .speechVolume;

            const tempo =
                Number(bpm ?? song.bpm ?? 120) *
                effectiveToneVelocity;

            if (!Number.isFinite(tempo) || tempo <= 0) {
                throw new RangeError("Song BPM must be greater than zero.");
            }

            const songGain =
                (
                    Number.isFinite(Number(volume))
                        ? Math.max(0, Number(volume))
                        : 1
                ) *
                effectiveToneVolume * (normalizeLoudness && !this.#isPhone()
                    ? this.loudnessGain(song, useSelectedInstrument && this.#outputSettings.instrument || song.instrument) : 1);
            const shouldLoop =
                loop === undefined
                    ? Boolean(song.loop)
                    : Boolean(loop);
            const requestedStartBeat =
                Number(
                    startBeat
                );
            const playbackStartBeat =
                Number.isFinite(
                    requestedStartBeat
                )
                    ? Math.max(
                        0,
                        requestedStartBeat
                    )
                    : 0;
            const selectedInstrumentName =
                useSelectedInstrument
                    ? this.#outputSettings
                        .instrument
                    : "";
            const selectedInstrument =
                selectedInstrumentName
                    ? catalog
                        ?.instruments?.[
                            selectedInstrumentName
                        ]
                    : undefined;

            if (
                selectedInstrumentName &&
                !selectedInstrument
            ) {
                throw new Error(
                    "Unknown selected instrument: " +
                    selectedInstrumentName
                );
            }

            const resolveInstrument =
                eventInstrumentName => {
                    const requestedInstrumentName =
                        selectedInstrumentName ||
                        eventInstrumentName ||
                        song.instrument;
                    const requestedInstrument =
                        selectedInstrument ||
                        catalog
                            ?.instruments?.[
                                requestedInstrumentName
                            ];

                    if (!requestedInstrument) {
                        throw new Error(
                            "Unknown instrument: " +
                            requestedInstrumentName
                        );
                    }

                    return {
                        name:
                            requestedInstrumentName,
                        instrument:
                            requestedInstrument
                    };
                };

            resolveInstrument();
            // Samples load asynchronously before scheduling; no network work occurs per strike.
            if (includeTones) {
                const definitions = new Set([resolveInstrument().instrument,
                    ...(song.events || []).filter(event => event.tone).map(event => resolveInstrument(event.instrument).instrument)]);
                await Promise.all(Array.from(definitions, async definition => {
                    let model = this.#instrumentModels.get(definition);
                    if (!model) { model = OscillatorInstrument.from(definition); this.#instrumentModels.set(definition, model); }
                    await model.prepare(context);
                }));
            }

            let resolveFinished;

            const finished =
                new Promise(
                    resolve => {
                        resolveFinished =
                            resolve;
                    }
                );

            const entry = {
                id: ++this.#sequence,
                name,
                nodes: new Set(),
                instrumentResources:
                    new Set(),
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
                toneVelocity:
                    effectiveToneVelocity,
                toneVolume:
                    effectiveToneVolume,
                speechVelocity:
                    effectiveSpeechVelocity,
                speechVolume:
                    effectiveSpeechVolume,
                requestedSpeechDelayMs:
                    Math.max(
                        0,
                        Number(
                            speechDelayMs
                        ) ||
                        0
                    ),
                speechDelayMs:
                    0,
                speechGuard:
                    typeof speechGuard ===
                        "function"
                        ? speechGuard
                        : undefined,
                startedAt:
                    context.currentTime +
                    0.015,
                released: false,
                endTimer: undefined,
                resolveFinished
            };

            const preparedEvents =
                this.playbackEvents(song, playbackStartBeat)
                    .map(
                        event => ({
                            event,
                            offset:
                                this.#beats(
                                    event?.offset
                                )
                        })
                    )
                    .filter(
                        record =>
                            record.offset >=
                            playbackStartBeat
                    )
                    .sort(
                        (left, right) =>
                            left.offset -
                            right.offset
                    );

            const hasChime =
                Boolean(
                    includeTones &&
                    preparedEvents.some(
                        record =>
                            record.event
                                ?.tone
                    )
                );

            const beatSeconds =
                60 /
                tempo;

            const timing = this.songTiming(song, { bpm: tempo, startBeat: playbackStartBeat });
            const chimeDurationBeats = hasChime ? timing.durationMs / (beatSeconds * 1000) : 0;

            const audibleChimeDurationMs = hasChime ? preparedEvents.flatMap(record =>
                (this.rollStrikes(record.event) || [record.event]).map(event => ({event,offset:this.#beats(event.offset)}))
            ).reduce((longest, record) => {
                if (!record.event?.tone) return longest;
                const lengths = String(record.event.length ?? "1").split(",");
                const beats = lengths.reduce((sum, part) => sum + this.#beats(part), record.offset - playbackStartBeat);
                const definition = resolveInstrument(record.event.instrument).instrument;
                const release = this.#instrumentEnvelope(definition).release;
                const model = this.#instrumentModels.get(definition);
                if (definition.samples && model) {
                    const shaped = model.forEvent(record.event, this.#dynamic(record.event.dynamic).start);
                    const tone = this.#parseTone(record.event.tone);
                    if (tone.kind !== "note") throw new TypeError("Sample instruments currently require ordinary notes or bracketed rolls");
                    const frequency = this.#frequency(tone.note);
                    const sample = model.sampleFor(frequency, shaped.__strikeStrength, record.event);
                    if (sample.naturalDecay) {
                        const rate = frequency / sample.rootFrequency * 2 ** (shaped.__detuneVariation / 1200);
                        return Math.max(longest, (record.offset-playbackStartBeat)*beatSeconds*1000 + this.#noteDelayMs(record.event) + (sample.buffer.duration - (record.event.sampleStartSeconds || 0))/rate*1000);
                    }
                }
                return Math.max(longest, beats * beatSeconds * 1000 + this.#noteDelayMs(record.event) + release * 1000);
            }, 0) : 0;

            const musicalChimeEndAt =
                entry.startedAt +
                chimeDurationBeats *
                    beatSeconds;

            entry.speechDelayMs =
                hasChime
                    ? entry.requestedSpeechDelayMs
                    : 0;

            this.#active.set(
                entry.id,
                entry
            );

            try {
                const scheduleAheadSeconds =
                    this.#isPhone()
                        ? 1.8
                        : 2.6;
                const scheduleIntervalMilliseconds =
                    this.#isPhone()
                        ? 280
                        : 360;

                let eventIndex = 0;
                let endAt =
                    entry.startedAt;
                let chimeEndAt =
                    entry.startedAt;
                let scheduleTimer;
                let completionScheduled =
                    false;

                const finishTimeline =
                    () => {
                        if (
                            completionScheduled ||
                            entry.released
                        ) {
                            return;
                        }

                        completionScheduled =
                            true;

                        const durationMilliseconds =
                            Math.max(
                                0,
                                (
                                    endAt -
                                    context.currentTime
                                ) *
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
                    };

                const scheduleWindow =
                    () => {
                        if (entry.released) {
                            return;
                        }

                        if (scheduleTimer) {
                            entry.timers.delete(
                                scheduleTimer
                            );
                            scheduleTimer =
                                undefined;
                        }

                        const elapsedSeconds =
                            Math.max(
                                0,
                                context.currentTime -
                                entry.startedAt
                            );
                        const horizonBeat =
                            playbackStartBeat +
                            (
                                elapsedSeconds +
                                scheduleAheadSeconds
                            ) /
                                beatSeconds;

                        while (
                            eventIndex <
                                preparedEvents.length &&
                            preparedEvents[
                                eventIndex
                            ].offset <=
                                horizonBeat
                        ) {
                            const record =
                                preparedEvents[
                                    eventIndex++
                                ];
                            const event =
                                record.event;
                            const playbackEvent = {
                                ...event,
                                offset:
                                    String(
                                        record.offset -
                                        playbackStartBeat
                                    )
                            };

                            if (
                                includeTones &&
                                event?.tone
                            ) {
                                const resolved =
                                    resolveInstrument(
                                        event.instrument
                                    );
                                const instrumentResource =
                                    this.#acquireInstrumentResource(
                                        entry,
                                        context,
                                        resolved.name,
                                        resolved.instrument
                                    );
                                const toneEndAt =
                                    this.#scheduleTone(
                                        context,
                                        entry,
                                        playbackEvent,
                                        resolved.instrument,
                                        tempo,
                                        songGain,
                                        instrumentResource
                                    );

                                chimeEndAt =
                                    Math.max(
                                        chimeEndAt,
                                        toneEndAt
                                    );
                                endAt =
                                    Math.max(
                                        endAt,
                                        toneEndAt
                                    );
                            }

                            if (
                                includeSpeech &&
                                event?.speech
                            ) {
                                const speechEvent = {
                                    ...playbackEvent
                                };

                                if (
                                    hasChime &&
                                    chimeEndAt >
                                        entry.startedAt &&
                                    effectiveSpeechVelocity !==
                                        1
                                ) {
                                    const originalSpeechStartAt =
                                        entry.startedAt +
                                        (
                                            record.offset -
                                            playbackStartBeat
                                        ) *
                                            beatSeconds;
                                    const postChimeGap =
                                        Math.max(
                                            0,
                                            originalSpeechStartAt -
                                                chimeEndAt
                                        );

                                    if (postChimeGap > 0) {
                                        const scaledSpeechStartAt =
                                            chimeEndAt +
                                            postChimeGap /
                                                effectiveSpeechVelocity;

                                        speechEvent.offset =
                                            String(
                                                (
                                                    scaledSpeechStartAt -
                                                    entry.startedAt
                                                ) /
                                                    beatSeconds
                                            );
                                    }
                                }

                                endAt =
                                    Math.max(
                                        endAt,
                                        this.#scheduleSpeech(
                                            context,
                                            entry,
                                            speechEvent,
                                            tempo
                                        )
                                    );
                            }
                        }

                        if (
                            eventIndex >=
                            preparedEvents.length
                        ) {
                            finishTimeline();
                            return;
                        }

                        scheduleTimer =
                            setTimeout(
                                scheduleWindow,
                                scheduleIntervalMilliseconds
                            );

                        entry.timers.add(
                            scheduleTimer
                        );
                    };

                scheduleWindow();

                return Object.freeze({
                    id: entry.id,
                    name,
                    bpm:
                        tempo,
                    startBeat:
                        playbackStartBeat,
                    hasChime,
                    chimeDurationMs:
                        chimeDurationBeats *
                        beatSeconds *
                        1000,
                    chimeEndsInMs:
                        Math.max(
                            0,
                            (
                                musicalChimeEndAt -
                                context.currentTime
                            ) *
                                1000
                        ),
                    audibleChimeDurationMs,
                    audibleChimeEndsInMs: Math.max(0, (entry.startedAt - context.currentTime) * 1000 + audibleChimeDurationMs),
                    timing,
                    loudness: song.loudness,
                    sustainStartsInMs: hasChime && timing.sustainStartMs !== null
                        ? Math.max(0, (entry.startedAt - context.currentTime) * 1000 + timing.sustainStartMs)
                        : null,
                    finished,
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

        speak(
            value,
            {
                lang,
                rate,
                pitch,
                volume,
                speechVolume,
                speechVelocity,
                voiceProvider,
                voice,
                broadcast = true,
                onEnd,
                onError
            } = {}
        ) {
            const text =
                String(
                    value ??
                    ""
                ).trim();

            if (!text) {
                return false;
            }

            const synthesis =
                globalThis.speechSynthesis;

            const Utterance =
                globalThis
                    .SpeechSynthesisUtterance;

            if (
                !synthesis ||
                typeof Utterance !==
                    "function"
            ) {
                return false;
            }

            const utterance =
                new Utterance(
                    text
                );

            const effectiveLanguage =
                String(
                    lang ||
                    this.#outputSettings
                        .speechLanguage ||
                    "en-US"
                );

            utterance.lang =
                effectiveLanguage;

            const effectiveVoiceProvider =
                typeof voiceProvider ===
                    "string" &&
                voiceProvider.trim()
                    ? voiceProvider.trim()
                    : this.#outputSettings
                        .voiceProvider;
            const effectiveVoice =
                typeof voice ===
                    "string"
                    ? voice.trim()
                    : this.#outputSettings
                        .voice;

            if (
                effectiveVoiceProvider ===
                    "system" &&
                effectiveVoice
            ) {
                const selectedVoice =
                    synthesis
                        .getVoices?.()
                        .find(
                            candidate =>
                                candidate
                                    .voiceURI ===
                                    effectiveVoice ||
                                candidate.name ===
                                    effectiveVoice
                        );

                if (selectedVoice) {
                    utterance.voice =
                        selectedVoice;
                    utterance.lang =
                        selectedVoice.lang ||
                        effectiveLanguage;
                }
            }

            const explicitRate =
                Number(rate);
            const effectiveSpeechVelocity =
                Number.isFinite(
                    Number(speechVelocity)
                )
                    ? Math.max(
                        0.5,
                        Math.min(
                            4,
                            Number(speechVelocity)
                        )
                    )
                    : this.#outputSettings
                        .speechVelocity;

            if (
                Number.isFinite(
                    explicitRate
                )
            ) {
                utterance.rate =
                    explicitRate *
                    effectiveSpeechVelocity;
            }
            else if (
                effectiveSpeechVelocity !==
                    1
            ) {
                // Preserve the browser/voice native default at neutral 1x.
                utterance.rate =
                    effectiveSpeechVelocity;
            }

            if (
                Number.isFinite(
                    Number(pitch)
                )
            ) {
                utterance.pitch =
                    Number(pitch);
            }

            utterance.volume =
                Math.max(
                    0,
                    Math.min(
                        1,
                        (
                            Number.isFinite(
                                Number(volume)
                            )
                                ? Number(volume)
                                : 1
                        ) *
                        (
                            Number.isFinite(
                                Number(speechVolume)
                            )
                                ? Math.max(
                                    0,
                                    Math.min(
                                        1,
                                        Number(speechVolume)
                                    )
                                )
                                : this.#outputSettings
                                    .speechVolume
                        )
                    )
                );

            let synthesizedSpeechToken;
            let speechFinished =
                false;

            const finish =
                (
                    completed,
                    error
                ) => {
                    if (speechFinished) {
                        return;
                    }

                    speechFinished =
                        true;

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

                    const callback =
                        completed
                            ? onEnd
                            : onError;

                    if (
                        typeof callback ===
                            "function"
                    ) {
                        try {
                            callback(
                                error
                            );
                        }
                        catch (callbackError) {
                            console.error(
                                completed
                                    ? "Speech completion callback failed:"
                                    : "Speech error callback failed:",
                                callbackError
                            );
                        }
                    }
                };

            utterance.addEventListener(
                "start",
                () => {
                    if (
                        broadcast !==
                            false
                    ) {
                        globalThis
                            .dispatchEvent?.(
                                new CustomEvent(
                                    "wmof-audio-speak",
                                    {
                                        detail: {
                                            text,
                                            lang:
                                                utterance.lang,
                                            rate:
                                                utterance.rate,
                                            pitch:
                                                utterance.pitch,
                                            volume:
                                                utterance.volume,
                                            voiceProvider:
                                                effectiveVoiceProvider,
                                            voice:
                                                effectiveVoice
                                        }
                                    }
                                )
                            );
                    }

                },
                {
                    once: true
                }
            );

            utterance.addEventListener(
                "end",
                () =>
                    finish(
                        true
                    ),
                {
                    once: true
                }
            );

            utterance.addEventListener(
                "error",
                event =>
                    finish(
                        false,
                        event
                    ),
                {
                    once: true
                }
            );

            try {
                synthesis.resume();
            }
            catch {}

            try {
                synthesizedSpeechToken =
                    globalThis
                        .SpeechMenu
                        ?.registerSynthesizedSpeech?.(
                            text
                        );

                synthesis.speak(
                    utterance
                );
            }
            catch (error) {
                finish(
                    false,
                    error
                );

                return false;
            }

            return true;
        }

        async startFrequencies(
            frequencies,
            {
                waveform = "square",
                volume = 1,
                reason = "direct-tone"
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
                                    (
                                        Number(volume) ||
                                        0
                                    ) *
                                    this.#outputSettings.toneVolume
                                )
                            ),
                            context.currentTime
                        );

                    oscillator.connect(
                        gain
                    );
                    gain.connect(
                        this.#programOutputNode(
                    context
                )
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
