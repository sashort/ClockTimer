(() => {
    "use strict";

    class WMOFAudioEngine {
        #catalogPromise;
        #preparePromise;
        #context;
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
            instrument: ""
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
                        : current.instrument
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
                    context,
                    catalog
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
            context,
            catalog
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

            for (
                const [
                    name,
                    instrument
                ] of Object.entries(
                    catalog?.instruments ||
                    {}
                )
            ) {
                this.#instrumentResource(
                    context,
                    name,
                    instrument
                );
            }

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
                        source.release,
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
                            context.destination
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
                        context.destination
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
                    beatSeconds;
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
                    instrument
                );
            const endAt =
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

            outputNode.connect(
                instrumentResource
                    ?.input ||
                context.destination
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

            for (
                const partial of
                partials
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

                        const eventRate =
                            Number(
                                event.rate
                            );
                        const speechVelocity =
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
                                    this.#outputSettings.speechVolume
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

            if (
                entry.chimeListeningSuspended
            ) {
                entry.chimeListeningSuspended =
                    false;

                globalThis.SpeechMenu
                    ?.resumeListening?.(
                        "audio-chime:" +
                        entry.name +
                        ":" +
                        reason
                    );
            }

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
                includeTones = true,
                includeSpeech = true,
                suspendListening =
                    false,
                suspendChimeListening =
                    true,
                useSelectedInstrument =
                    true,
                startBeat = 0
            } = {}
        ) {
            const catalog = await this.prepare();
            const song = catalog?.songs?.[name];

            if (!song) {
                throw new Error("Unknown song: " + name);
            }

            const context = await this.#audioContext();

            this.#prepareAudioResources(
                context,
                catalog
            );

            const tempo =
                Number(bpm ?? song.bpm ?? 120) *
                this.#outputSettings.toneVelocity;

            if (!Number.isFinite(tempo) || tempo <= 0) {
                throw new RangeError("Song BPM must be greater than zero.");
            }

            const songGain =
                (
                    Number.isFinite(Number(volume))
                        ? Math.max(0, Number(volume))
                        : 1
                ) *
                this.#outputSettings.toneVolume;
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
            const fallbackInstrument =
                catalog?.instruments?.[
                    "legacy-square"
                ];
            const warnedInstruments =
                new Set();

            const resolveInstrument =
                eventInstrumentName => {
                    const requestedInstrumentName =
                        selectedInstrument
                            ? selectedInstrumentName
                            : (
                                eventInstrumentName ||
                                song.instrument
                            );
                    const requestedInstrument =
                        selectedInstrument ||
                        catalog
                            ?.instruments?.[
                                requestedInstrumentName
                            ];
                    const phoneFallbackName =
                        this.#isPhone()
                            ? requestedInstrument
                                ?.phoneFallback
                            : undefined;
                    const phoneFallbackInstrument =
                        phoneFallbackName
                            ? catalog
                                ?.instruments?.[
                                    phoneFallbackName
                                ]
                            : undefined;
                    const resolvedInstrument =
                        phoneFallbackInstrument ||
                        requestedInstrument ||
                        fallbackInstrument;

                    if (!resolvedInstrument) {
                        throw new Error(
                            "Unknown instrument: " +
                            requestedInstrumentName
                        );
                    }

                    if (
                        phoneFallbackName &&
                        !phoneFallbackInstrument &&
                        !warnedInstruments.has(
                            "phone:" +
                            phoneFallbackName
                        )
                    ) {
                        warnedInstruments.add(
                            "phone:" +
                            phoneFallbackName
                        );

                        console.warn(
                            "Unknown phone fallback instrument; using original:",
                            phoneFallbackName
                        );
                    }

                    if (
                        !requestedInstrument &&
                        fallbackInstrument &&
                        !warnedInstruments.has(
                            "missing:" +
                            requestedInstrumentName
                        )
                    ) {
                        warnedInstruments.add(
                            "missing:" +
                            requestedInstrumentName
                        );

                        console.warn(
                            "Unknown instrument; using legacy-square fallback:",
                            requestedInstrumentName
                        );
                    }

                    const resolvedName =
                        phoneFallbackInstrument
                            ? phoneFallbackName
                            : (
                                requestedInstrument
                                    ? requestedInstrumentName
                                    : "legacy-square"
                            );

                    return {
                        name:
                            resolvedName,
                        instrument:
                            resolvedInstrument
                    };
                };

            if (
                selectedInstrumentName &&
                !selectedInstrument
            ) {
                console.warn(
                    "Unknown selected instrument; using song/event defaults:",
                    selectedInstrumentName
                );
            }

            resolveInstrument();

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
                startedAt:
                    context.currentTime +
                    0.015,
                released: false,
                endTimer: undefined,
                chimeListeningSuspended:
                    false,
                suspendsListening:
                    Boolean(
                        suspendListening
                    ),
                resolveFinished
            };

            if (suspendListening) {
                globalThis.SpeechMenu
                    ?.suspendListening?.(
                        "audio:" + name
                    );
            }

            const preparedEvents =
                (song.events || [])
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
                    suspendChimeListening &&
                    includeTones &&
                    preparedEvents.some(
                        record =>
                            record.event
                                ?.tone
                    )
                );

            if (hasChime) {
                entry.chimeListeningSuspended =
                    true;

                globalThis.SpeechMenu
                    ?.suspendListening?.(
                        "audio-chime:" +
                        name
                    );
            }

            this.#active.set(
                entry.id,
                entry
            );

            try {
                const beatSeconds =
                    60 /
                    tempo;
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

                const finishChimeSuspension =
                    () => {
                        if (
                            !entry
                                .chimeListeningSuspended
                        ) {
                            return;
                        }

                        const delayMilliseconds =
                            Math.max(
                                0,
                                (
                                    chimeEndAt -
                                    context.currentTime
                                ) *
                                    1000
                            );

                        const timer =
                            setTimeout(
                                () => {
                                    entry.timers.delete(
                                        timer
                                    );

                                    if (
                                        entry.released ||
                                        !entry
                                            .chimeListeningSuspended
                                    ) {
                                        return;
                                    }

                                    entry.chimeListeningSuspended =
                                        false;

                                    globalThis.SpeechMenu
                                        ?.resumeListening?.(
                                            "audio-chime:" +
                                            name +
                                            ":ended"
                                        );
                                },
                                delayMilliseconds
                            );

                        entry.timers.add(
                            timer
                        );
                    };

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
                        finishChimeSuspension();

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
                                endAt =
                                    Math.max(
                                        endAt,
                                        this.#scheduleSpeech(
                                            context,
                                            entry,
                                            playbackEvent,
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
                lang = "en-US",
                rate,
                pitch,
                volume
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

            utterance.lang =
                String(
                    lang ||
                    "en-US"
                );

            const explicitRate =
                Number(rate);
            const speechVelocity =
                this.#outputSettings
                    .speechVelocity;

            if (
                Number.isFinite(
                    explicitRate
                )
            ) {
                utterance.rate =
                    explicitRate *
                    speechVelocity;
            }
            else if (
                speechVelocity !==
                    1
            ) {
                // Preserve the browser/voice native default at neutral 1x.
                utterance.rate =
                    speechVelocity;
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
                        this.#outputSettings.speechVolume
                    )
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
                finish,
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

            return true;
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
