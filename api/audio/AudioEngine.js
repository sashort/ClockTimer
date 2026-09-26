(() => {
    "use strict";

    class WMOFAudioEngine {
        #catalogPromise;
        #context;
        #active = new Map();
        #sequence = 0;
        #reverbImpulses = new Map();
        #outputSettings = {
            speechVolume: 1,
            toneVolume: 1,
            speechVelocity: 1,
            toneVelocity: 1
        };

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

        get outputSettings() {
            return {...this.#outputSettings};
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
                )
            };

            return this.outputSettings;
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
                0x12345678;

            const random =
                () => {
                    seed =
                        (
                            (
                                seed *
                                1664525
                            ) +
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
                    let index = 0;
                    index < length;
                    index++
                ) {
                    const progress =
                        index /
                        length;
                    const envelope =
                        Math.pow(
                            1 - progress,
                            2.35
                        );

                    data[index] =
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

        #scheduleTone(context, entry, event, instrument, bpm, songGain) {
            const number =
                (
                    value,
                    fallback = 0
                ) => {
                    const numeric =
                        Number(value);

                    return Number.isFinite(
                        numeric
                    )
                        ? numeric
                        : fallback;
                };
            const clamp =
                (
                    value,
                    minimum,
                    maximum,
                    fallback
                ) =>
                    Math.max(
                        minimum,
                        Math.min(
                            maximum,
                            number(
                                value,
                                fallback
                            )
                        )
                    );

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
                instrument.envelope &&
                typeof instrument.envelope ===
                    "object"
                    ? instrument.envelope
                    : {};
            const attack =
                clamp(
                    envelope.attack,
                    0,
                    10,
                    0
                );
            const decay =
                clamp(
                    envelope.decay,
                    0,
                    10,
                    0
                );
            const sustainLevel =
                clamp(
                    envelope.sustain,
                    0,
                    1,
                    1
                );
            const release =
                clamp(
                    envelope.release,
                    0,
                    10,
                    0
                );
            const releaseEnd =
                noteEnd +
                release;

            const dynamic =
                this.#dynamic(
                    event.dynamic
                );
            const velocitySensitivity =
                clamp(
                    instrument
                        .velocitySensitivity,
                    0,
                    1,
                    1
                );
            const dynamicStart =
                1 -
                (
                    1 -
                    dynamic.start
                ) *
                velocitySensitivity;
            const dynamicEnd =
                1 -
                (
                    1 -
                    dynamic.end
                ) *
                velocitySensitivity;
            const volume =
                Number.isFinite(
                    Number(
                        instrument.volume
                    )
                )
                    ? Math.max(
                        0,
                        Number(
                            instrument.volume
                        )
                    )
                    : 1;

            const sourceMix =
                context.createGain();
            const envelopeGain =
                context.createGain();
            const dynamicGain =
                context.createGain();

            const envelopeParam =
                envelopeGain.gain;
            envelopeParam.setValueAtTime(
                0.0001,
                startAt
            );

            const attackEnd =
                startAt +
                attack;
            const decayEnd =
                attackEnd +
                decay;

            if (attack > 0) {
                envelopeParam.linearRampToValueAtTime(
                    1,
                    attackEnd
                );
            }
            else {
                envelopeParam.setValueAtTime(
                    1,
                    startAt
                );
            }

            if (decay > 0) {
                envelopeParam.linearRampToValueAtTime(
                    Math.max(
                        0.0001,
                        sustainLevel
                    ),
                    decayEnd
                );
            }
            else {
                envelopeParam.setValueAtTime(
                    Math.max(
                        0.0001,
                        sustainLevel
                    ),
                    attackEnd
                );
            }

            if (
                typeof envelopeParam
                    .cancelAndHoldAtTime ===
                    "function"
            ) {
                envelopeParam.cancelAndHoldAtTime(
                    noteEnd
                );
            }
            else {
                envelopeParam.cancelScheduledValues(
                    noteEnd
                );
                envelopeParam.setValueAtTime(
                    Math.max(
                        0.0001,
                        sustainLevel
                    ),
                    noteEnd
                );
            }

            if (release > 0) {
                envelopeParam.exponentialRampToValueAtTime(
                    0.0001,
                    releaseEnd
                );
            }
            else {
                envelopeParam.setValueAtTime(
                    0.0001,
                    noteEnd
                );
            }

            dynamicGain.gain.setValueAtTime(
                Math.max(
                    0.0001,
                    dynamicStart *
                        volume *
                        songGain
                ),
                startAt
            );

            if (
                dynamicEnd !==
                    dynamicStart &&
                effectEnd >
                    startAt
            ) {
                dynamicGain.gain.linearRampToValueAtTime(
                    Math.max(
                        0.0001,
                        dynamicEnd *
                            volume *
                            songGain
                    ),
                    effectEnd
                );
            }

            let chain =
                sourceMix;

            const filter =
                instrument.filter &&
                typeof instrument.filter ===
                    "object"
                    ? instrument.filter
                    : undefined;

            if (filter) {
                const biquad =
                    context.createBiquadFilter();

                try {
                    biquad.type =
                        String(
                            filter.type ||
                            "lowpass"
                        );
                }
                catch {
                    biquad.type =
                        "lowpass";
                }

                const baseFrequency =
                    clamp(
                        filter.frequency,
                        10,
                        context.sampleRate /
                            2 -
                            1,
                        context.sampleRate /
                            2 -
                            1
                    );
                const filterQ =
                    clamp(
                        filter.Q ??
                            filter.q,
                        0,
                        100,
                        0
                    );
                const envelopeAmount =
                    number(
                        filter.envelopeAmount,
                        0
                    );
                const peakFrequency =
                    clamp(
                        baseFrequency +
                            envelopeAmount,
                        10,
                        context.sampleRate /
                            2 -
                            1,
                        baseFrequency
                    );

                biquad.Q.setValueAtTime(
                    filterQ,
                    startAt
                );

                if (
                    envelopeAmount !==
                    0
                ) {
                    if (attack > 0) {
                        biquad.frequency.setValueAtTime(
                            baseFrequency,
                            startAt
                        );
                        biquad.frequency.linearRampToValueAtTime(
                            peakFrequency,
                            attackEnd
                        );
                    }
                    else {
                        biquad.frequency.setValueAtTime(
                            peakFrequency,
                            startAt
                        );
                    }

                    if (decay > 0) {
                        biquad.frequency.linearRampToValueAtTime(
                            baseFrequency,
                            decayEnd
                        );
                    }
                    else {
                        biquad.frequency.setValueAtTime(
                            baseFrequency,
                            attackEnd
                        );
                    }
                }
                else {
                    biquad.frequency.setValueAtTime(
                        baseFrequency,
                        startAt
                    );
                }

                chain.connect(
                    biquad
                );
                chain =
                    biquad;

                entry.nodes.add(
                    biquad
                );
            }

            const distortionAmount =
                clamp(
                    instrument
                        .distortion
                        ?.amount ??
                    instrument
                        .distortion,
                    0,
                    1,
                    0
                );

            if (
                distortionAmount >
                0
            ) {
                const shaper =
                    context.createWaveShaper();
                const samples =
                    1024;
                const curve =
                    new Float32Array(
                        samples
                    );
                const drive =
                    1 +
                    distortionAmount *
                        24;

                for (
                    let index = 0;
                    index < samples;
                    index++
                ) {
                    const x =
                        index *
                            2 /
                            (
                                samples -
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

                shaper.curve =
                    curve;
                shaper.oversample =
                    "2x";

                chain.connect(
                    shaper
                );
                chain =
                    shaper;

                entry.nodes.add(
                    shaper
                );
            }

            const tremolo =
                instrument.tremolo &&
                typeof instrument.tremolo ===
                    "object"
                    ? instrument.tremolo
                    : undefined;

            if (tremolo) {
                const rate =
                    clamp(
                        tremolo.rate,
                        0,
                        30,
                        0
                    );
                const depth =
                    clamp(
                        tremolo.depth,
                        0,
                        1,
                        0
                    );

                if (
                    rate > 0 &&
                    depth > 0
                ) {
                    const tremoloGain =
                        context.createGain();
                    const lfo =
                        context.createOscillator();
                    const lfoDepth =
                        context.createGain();

                    tremoloGain.gain.setValueAtTime(
                        1 -
                            depth /
                                2,
                        startAt
                    );
                    lfo.type =
                        "sine";
                    lfo.frequency.setValueAtTime(
                        rate,
                        startAt
                    );
                    lfoDepth.gain.setValueAtTime(
                        depth /
                            2,
                        startAt
                    );

                    lfo.connect(
                        lfoDepth
                    );
                    lfoDepth.connect(
                        tremoloGain.gain
                    );
                    chain.connect(
                        tremoloGain
                    );
                    chain =
                        tremoloGain;

                    lfo.start(
                        startAt
                    );
                    lfo.stop(
                        Math.max(
                            startAt +
                                0.001,
                            releaseEnd
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

            chain.connect(
                envelopeGain
            );
            envelopeGain.connect(
                dynamicGain
            );
            dynamicGain.connect(
                context.destination
            );

            entry.nodes.add(
                sourceMix
            );
            entry.nodes.add(
                envelopeGain
            );
            entry.nodes.add(
                dynamicGain
            );

            const delay =
                instrument.delay &&
                typeof instrument.delay ===
                    "object"
                    ? instrument.delay
                    : undefined;
            const delayWet =
                delay
                    ? clamp(
                        delay.wet,
                        0,
                        1,
                        0
                    )
                    : 0;
            const delayTime =
                delay
                    ? clamp(
                        delay.time,
                        0,
                        5,
                        0
                    )
                    : 0;
            const delayFeedback =
                delay
                    ? clamp(
                        delay.feedback,
                        0,
                        0.95,
                        0
                    )
                    : 0;

            if (
                delayWet > 0 &&
                delayTime > 0
            ) {
                const delayNode =
                    context.createDelay(
                        5
                    );
                const feedbackGain =
                    context.createGain();
                const wetGain =
                    context.createGain();

                delayNode.delayTime.setValueAtTime(
                    delayTime,
                    startAt
                );
                feedbackGain.gain.setValueAtTime(
                    delayFeedback,
                    startAt
                );
                wetGain.gain.setValueAtTime(
                    delayWet,
                    startAt
                );

                dynamicGain.connect(
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
                wetGain.connect(
                    context.destination
                );

                entry.nodes.add(
                    delayNode
                );
                entry.nodes.add(
                    feedbackGain
                );
                entry.nodes.add(
                    wetGain
                );
            }

            const reverb =
                instrument.reverb &&
                typeof instrument.reverb ===
                    "object"
                    ? instrument.reverb
                    : undefined;
            const reverbWet =
                reverb
                    ? clamp(
                        reverb.wet,
                        0,
                        1,
                        0
                    )
                    : 0;
            const reverbDecay =
                reverb
                    ? clamp(
                        reverb.decay,
                        0.05,
                        10,
                        1.5
                    )
                    : 0;

            if (
                reverbWet >
                0
            ) {
                const convolver =
                    context.createConvolver();
                const wetGain =
                    context.createGain();

                convolver.buffer =
                    this.#reverbImpulse(
                        context,
                        reverbDecay
                    );
                wetGain.gain.setValueAtTime(
                    reverbWet,
                    startAt
                );

                dynamicGain.connect(
                    convolver
                );
                convolver.connect(
                    wetGain
                );
                wetGain.connect(
                    context.destination
                );

                entry.nodes.add(
                    convolver
                );
                entry.nodes.add(
                    wetGain
                );
            }

            const instrumentDetune =
                number(
                    instrument.detune,
                    0
                );
            const pitchEnvelope =
                instrument.pitchEnvelope &&
                typeof instrument.pitchEnvelope ===
                    "object"
                    ? instrument.pitchEnvelope
                    : {};
            const pitchAmount =
                number(
                    pitchEnvelope.amount,
                    0
                );
            const pitchAttack =
                clamp(
                    pitchEnvelope.attack,
                    0,
                    10,
                    0
                );
            const pitchDecay =
                clamp(
                    pitchEnvelope.decay,
                    0,
                    10,
                    0
                );

            const configurePitch =
                (
                    oscillator,
                    ratio,
                    detuneOffset
                ) => {
                    const fromFrequency =
                        tone.kind ===
                            "note"
                            ? this.#frequency(
                                tone.note
                            )
                            : this.#frequency(
                                tone.from
                            );
                    const toFrequency =
                        tone.kind ===
                            "note"
                            ? fromFrequency
                            : this.#frequency(
                                tone.to
                            );
                    const scaledFrom =
                        fromFrequency *
                        ratio;
                    const scaledTo =
                        toFrequency *
                        ratio;
                    const baseDetune =
                        instrumentDetune +
                        detuneOffset;

                    oscillator.detune.setValueAtTime(
                        baseDetune,
                        startAt
                    );

                    if (
                        pitchAmount !==
                        0
                    ) {
                        const pitchPeak =
                            baseDetune +
                            pitchAmount;
                        const pitchAttackEnd =
                            startAt +
                            pitchAttack;
                        const pitchDecayEnd =
                            pitchAttackEnd +
                            pitchDecay;

                        if (
                            pitchAttack >
                            0
                        ) {
                            oscillator.detune.linearRampToValueAtTime(
                                pitchPeak,
                                pitchAttackEnd
                            );
                        }
                        else {
                            oscillator.detune.setValueAtTime(
                                pitchPeak,
                                startAt
                            );
                        }

                        if (
                            pitchDecay >
                            0
                        ) {
                            oscillator.detune.linearRampToValueAtTime(
                                baseDetune,
                                pitchDecayEnd
                            );
                        }
                        else {
                            oscillator.detune.setValueAtTime(
                                baseDetune,
                                pitchAttackEnd
                            );
                        }
                    }

                    if (
                        tone.kind ===
                        "note"
                    ) {
                        oscillator.frequency.setValueAtTime(
                            scaledFrom,
                            startAt
                        );

                        return;
                    }

                    if (
                        tone.kind ===
                        "bend"
                    ) {
                        if (
                            (
                                tone.direction ===
                                    "up" &&
                                scaledTo <=
                                    scaledFrom
                            ) ||
                            (
                                tone.direction ===
                                    "down" &&
                                scaledTo >=
                                    scaledFrom
                            )
                        ) {
                            throw new Error(
                                "Bend direction does not match its note order: " +
                                event.tone
                            );
                        }

                        oscillator.frequency.setValueAtTime(
                            scaledFrom,
                            startAt
                        );
                        oscillator.frequency.exponentialRampToValueAtTime(
                            scaledTo,
                            effectEnd
                        );

                        return;
                    }

                    const semitoneDistance =
                        Math.abs(
                            12 *
                            Math.log2(
                                scaledTo /
                                scaledFrom
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
                    const stepSeconds =
                        subdivision *
                        beatSeconds;
                    let cursor =
                        startAt;
                    let alternate =
                        false;

                    oscillator.frequency.setValueAtTime(
                        scaledFrom,
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

                        oscillator.frequency.setValueAtTime(
                            alternate
                                ? scaledTo
                                : scaledFrom,
                            cursor
                        );
                    }

                    oscillator.frequency.setValueAtTime(
                        scaledTo,
                        effectEnd
                    );
                };

            const addOscillator =
                (
                    {
                        ratio = 1,
                        gain = 1,
                        detune = 0,
                        waveform
                    } = {}
                ) => {
                    const oscillator =
                        context.createOscillator();
                    const partialGain =
                        context.createGain();
                    const normalizedRatio =
                        Math.max(
                            0.001,
                            number(
                                ratio,
                                1
                            )
                        );
                    const normalizedGain =
                        Math.max(
                            0,
                            number(
                                gain,
                                1
                            )
                        );

                    if (
                        normalizedGain ===
                        0
                    ) {
                        return;
                    }

                    oscillator.type =
                        typeof waveform ===
                            "string"
                            ? waveform
                            : (
                                typeof instrument
                                    .waveform ===
                                    "string"
                                    ? instrument
                                        .waveform
                                    : "sine"
                            );
                    partialGain.gain.setValueAtTime(
                        normalizedGain,
                        startAt
                    );

                    configurePitch(
                        oscillator,
                        normalizedRatio,
                        number(
                            detune,
                            0
                        )
                    );

                    oscillator.connect(
                        partialGain
                    );
                    partialGain.connect(
                        sourceMix
                    );

                    oscillator.start(
                        startAt
                    );
                    oscillator.stop(
                        Math.max(
                            startAt +
                                0.001,
                            releaseEnd
                        )
                    );

                    entry.nodes.add(
                        oscillator
                    );
                    entry.nodes.add(
                        partialGain
                    );

                    oscillator.addEventListener(
                        "ended",
                        () => {
                            entry.nodes.delete(
                                oscillator
                            );
                            entry.nodes.delete(
                                partialGain
                            );
                            try {
                                oscillator.disconnect();
                            }
                            catch {}
                            try {
                                partialGain.disconnect();
                            }
                            catch {}
                        },
                        {
                            once: true
                        }
                    );
                };

            addOscillator();

            if (
                Array.isArray(
                    instrument.partials
                )
            ) {
                for (
                    const partial of
                    instrument.partials
                ) {
                    if (
                        !partial ||
                        typeof partial !==
                            "object"
                    ) {
                        continue;
                    }

                    addOscillator(
                        partial
                    );
                }
            }

            const noise =
                instrument.noise &&
                typeof instrument.noise ===
                    "object"
                    ? instrument.noise
                    : undefined;
            const noiseAmount =
                noise
                    ? clamp(
                        noise.amount,
                        0,
                        1,
                        0
                    )
                    : 0;

            if (
                noiseAmount >
                0
            ) {
                const noiseSource =
                    context.createBufferSource();
                const noiseGain =
                    context.createGain();
                const noiseDuration =
                    Math.max(
                        0.01,
                        releaseEnd -
                            startAt
                    );
                const noiseBuffer =
                    context.createBuffer(
                        1,
                        Math.max(
                            1,
                            Math.ceil(
                                noiseDuration *
                                context.sampleRate
                            )
                        ),
                        context.sampleRate
                    );
                const data =
                    noiseBuffer.getChannelData(
                        0
                    );
                let seed =
                    0x87654321;

                for (
                    let index = 0;
                    index <
                        data.length;
                    index++
                ) {
                    seed =
                        (
                            (
                                seed *
                                1664525
                            ) +
                            1013904223
                        ) >>>
                        0;
                    data[index] =
                        (
                            seed /
                            0x100000000
                        ) *
                            2 -
                        1;
                }

                noiseSource.buffer =
                    noiseBuffer;
                noiseGain.gain.setValueAtTime(
                    noiseAmount,
                    startAt
                );

                const noiseDecay =
                    clamp(
                        noise.decay,
                        0,
                        10,
                        0
                    );

                if (
                    noiseDecay >
                    0
                ) {
                    noiseGain.gain.exponentialRampToValueAtTime(
                        0.0001,
                        Math.min(
                            releaseEnd,
                            startAt +
                                noiseDecay
                        )
                    );
                }

                noiseSource.connect(
                    noiseGain
                );
                noiseGain.connect(
                    sourceMix
                );

                noiseSource.start(
                    startAt
                );
                noiseSource.stop(
                    Math.max(
                        startAt +
                            0.001,
                        releaseEnd
                    )
                );

                entry.nodes.add(
                    noiseSource
                );
                entry.nodes.add(
                    noiseGain
                );
            }

            const delayTail =
                delayWet > 0
                    ? delayTime *
                        (
                            1 +
                            delayFeedback *
                                4
                        )
                    : 0;
            const reverbTail =
                reverbWet > 0
                    ? reverbDecay
                    : 0;

            return (
                releaseEnd +
                Math.max(
                    delayTail,
                    reverbTail
                )
            );
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
                    false
            } = {}
        ) {
            const catalog = await this.load();
            const song = catalog?.songs?.[name];

            if (!song) {
                throw new Error("Unknown song: " + name);
            }

            const context = await this.#audioContext();
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
                    ),
                resolveFinished
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
                    if (includeTones && event?.tone) {
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

                    if (includeSpeech && event?.speech) {
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
