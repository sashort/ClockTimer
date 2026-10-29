(() => {
    'use strict';
    let dataPromise;
    const revision = globalThis.document?.currentScript?.src?.match(/[?&]build=([^&#]+)/)?.[1];
    const catalogUrl = 'api/audio/halloween.json' + (revision ? '?build=' + revision : '');
    const layerBuffers = new WeakMap();
    const idleBuffers = new WeakMap();
    const activityStates = new WeakMap();
    const liveBells = new Set();
    let lastActivity;
    function activityState(context) {
        if (!activityStates.has(context)) activityStates.set(context, {context, active: new Set(), generation: 0});
        return activityStates.get(context);
    }
    function cancelState(state) {
        state.generation++;
        if (state.pending && state.pending.startAt > state.context.currentTime) state.pending.stop();
        state.pending = undefined;
    }
    function cancelPending(all = false) {
        if (lastActivity) cancelState(lastActivity);
        if (all) for (const bell of [...liveBells]) bell.stop();
    }
    async function scheduleIdle(state) {
        cancelState(state);
        const generation = state.generation;
        if (!state.mix?.idleBell || state.active.size) return;
        const bell = await playIdleBell(state.context, state.destination, state.volume, state.frequencies,
            Math.floor(Math.random() * 3), state.context.currentTime + state.mix.idleBell.timeoutSeconds);
        if (generation !== state.generation || state.active.size) {bell.stop(); return;}
        state.pending = bell;
    }
    function buttonActivity() {
        if (lastActivity) return lastActivity.idleTask = scheduleIdle(lastActivity).catch(error => console.warn('Idle bell unavailable', error));
        return Promise.resolve();
    }
    globalThis.addEventListener?.('wmof-seasonal-theme-change',event => {
        if (!event.detail.active) cancelPending(true);
        else void globalThis.WMOFAudio?.unlock?.();
    });
    globalThis.document?.addEventListener?.('pointerdown', event => {
        if (event.target.closest?.('#numberPadDialog button')) buttonActivity();
    }, {capture: true});
    function isActive(date = new Date()) {
        if (globalThis.WMOFSeasonalTheme) return globalThis.WMOFSeasonalTheme.active;
        // This script is loaded only by Order Filler and its Drop In counterpart.
        // Preview is explicit and never writes a user's saved audio preferences.
        const preview = new URLSearchParams(globalThis.location?.search || '').get('halloweenPreview');
        return preview === '1' || (date.getMonth() === 9 && date.getDate() === 31);
    }
    function data() {
        if (!dataPromise) dataPromise = fetch(catalogUrl).then(response => {
            if (!response.ok) throw new Error('Halloween audio could not be loaded');
            return response.json();
        }).catch(error => { dataPromise = undefined; throw error; });
        return dataPromise;
    }
    async function prepare(context) {
        const seasonal = await data();
        if (context && (seasonal.touchtones.bell || seasonal.touchtones.strings)) {
            if (!layerBuffers.has(context)) layerBuffers.set(context, Promise.all(
                seasonal.instruments[seasonal.touchtones.strings ? 'halloween-strings' : 'halloween-bell'].samples.map(async sample => {
                    const response = await fetch(sample.url);
                    if (!response.ok) throw new Error('Layer sample could not be loaded');
                    return {...sample, buffer: await context.decodeAudioData(await response.arrayBuffer())};
                })).catch(error => {layerBuffers.delete(context); throw error;}));
            await layerBuffers.get(context);
        }
        if (context && seasonal.touchtones.idleBell && !seasonal.touchtones.idleBell.pulse) {
            if (!idleBuffers.has(context)) idleBuffers.set(context, Promise.all(
                seasonal.instruments['halloween-idle-bell'].samples.map(async sample => {
                    const response = await fetch(sample.url);
                    if (!response.ok) throw new Error('Idle bell sample could not be loaded');
                    return {...sample, buffer: await context.decodeAudioData(await response.arrayBuffer())};
                })).catch(error => {idleBuffers.delete(context); throw error;}));
            await idleBuffers.get(context);
        }
        return seasonal;
    }
    function chordFrequencies(frequencies, mix) {
        const bass = frequencies.map(f => f * 2 ** mix.octaveShift);
        // Octaves of both bass pitches, plus the lower voice's pure fifth.
        return [bass[0] * 16, bass[1] * 8, bass[0] * 24].sort((a, b) => a - b);
    }
    async function pulseCatalog(base, note) {
        const seasonal = await data();
        return {...base, instruments: {...base.instruments,
            'halloween-idle-pulse': seasonal.instruments['halloween-idle-pulse']},
            songs: {...base.songs, 'halloween-idle-pulse': {bpm: 120, instrument: 'halloween-idle-pulse',
                events: [{offset: '0', tone: note || 'C#2', length: String(seasonal.touchtones.idleBell.holdSeconds * 2), dynamic: 'mf'}]}}};
    }
    async function playIdleBell(context, destination, volume, frequencies, voiceIndex = 0, startAt = context.currentTime) {
        const seasonal = await prepare(context), mix = seasonal.touchtones;
        if (mix.idleBell.pulse) {
            const target = Math.min(...frequencies) * 2 ** mix.octaveShift;
            const midi = Math.round(69 + 12 * Math.log2(target / 440));
            const note = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
            const song = await globalThis.WMOFAudio.startSong('halloween-idle-pulse', {
                seasonalNote: note, toneVolume: volume, volume: mix.idleBell.volume ?? 0.35,
                includeSpeech: false, useSelectedInstrument: false,
                startAtPerformanceMs: performance.now() + (startAt - context.currentTime) * 1000
            });
            const handle = {stop() {globalThis.WMOFAudio.stopSong(song.id); liveBells.delete(handle);},
                pitch: 440 * 2 ** ((midi - 69) / 12), startAt};
            liveBells.add(handle);
            void Promise.resolve(song.finished).finally(() => liveBells.delete(handle));
            return handle;
        }
        const options = chordFrequencies(frequencies, mix).map(f => f / 2);
        const bass = frequencies.map(f => f * 2 ** mix.octaveShift);
        const pitches = mix.idleBell.chord ?
            [bass[0] * 4, bass[1] * 2, bass[0] * 4 * 6 / 5, bass[0] * 6] :
            [options[Math.abs(voiceIndex) % options.length]];
        const samples = await idleBuffers.get(context), nodes = [];
        let remaining = pitches.length;
        const handle = {stop() {
            for (const node of nodes) {
                try {node.stop?.();} catch {}
                node.disconnect();
            }
            liveBells.delete(handle);
        }, pitch: pitches[0], pitches, startAt};
        liveBells.add(handle);
        for (const pitch of pitches) {
            const sample = samples.reduce((a, b) => Math.abs(Math.log2(pitch / a.rootFrequency)) <
                Math.abs(Math.log2(pitch / b.rootFrequency)) ? a : b);
            const source = context.createBufferSource(), gain = context.createGain();
            source.buffer = sample.buffer; source.playbackRate.value = pitch / sample.rootFrequency;
            const peak = volume * mix.idleBell.gain / Math.sqrt(pitches.length), envelope = mix.idleBell.envelope;
            if (envelope) {
                gain.gain.setValueAtTime(0, startAt);
                gain.gain.linearRampToValueAtTime(peak, startAt + envelope.attack);
                gain.gain.setValueAtTime(peak, startAt + envelope.attack + envelope.hold);
                gain.gain.linearRampToValueAtTime(0, startAt + envelope.attack + envelope.hold + envelope.release);
            } else gain.gain.value = peak;
            source.connect(gain); gain.connect(destination);
            nodes.push(source, gain);
            source.start(startAt);
            if (envelope) source.stop(startAt + envelope.attack + envelope.hold + envelope.release + 0.01);
            source.addEventListener('ended', () => {
                source.disconnect(); gain.disconnect();
                if (--remaining === 0) liveBells.delete(handle);
            }, {once: true});
        }
        return handle;
    }
    async function touchtones(context, destination, frequencies, volume, entry) {
        const state = activityState(context); cancelState(state);
        const seasonal = await prepare(context);
        if (entry.released) return;
        state.active.add(entry); lastActivity = state;
        Object.assign(state, {destination, volume, frequencies, mix: seasonal.touchtones});
        const at = context.currentTime;
        const mix = seasonal.touchtones;
        const level = Math.max(0, Math.min(1, volume));
        const output = context.createGain();
        output.gain.setValueAtTime(0, at);
        output.gain.linearRampToValueAtTime(level, at + mix.attackSeconds);
        output.connect(destination); entry.nodes.add(output);
        for (const inputFrequency of frequencies) {
            const frequency = inputFrequency * 2 ** mix.octaveShift;
            const pulse = seasonal.instruments['halloween-pulse'];
            const filter = context.createBiquadFilter();
            filter.type = pulse.filter.type;
            filter.frequency.setValueAtTime(pulse.filter.frequency + pulse.filter.envelopeAmount, at);
            filter.frequency.exponentialRampToValueAtTime(pulse.filter.frequency, at + 0.08);
            filter.Q.value = pulse.filter.Q; filter.connect(output); entry.nodes.add(filter);
            for (const partial of pulse.partials) {
                const oscillator = context.createOscillator(), partialGain = context.createGain();
                oscillator.type = partial.waveform || pulse.waveform;
                oscillator.frequency.value = frequency * partial.ratio;
                oscillator.detune.value = partial.detune || 0;
                const peak = partial.gain * mix.pulseGain / Math.sqrt(frequencies.length);
                partialGain.gain.setValueAtTime(0, at);
                partialGain.gain.linearRampToValueAtTime(peak, at + pulse.envelope.attack);
                partialGain.gain.exponentialRampToValueAtTime(Math.max(0.000001, peak * pulse.envelope.sustain),
                    at + pulse.envelope.attack + pulse.envelope.decay);
                oscillator.detune.setValueAtTime((partial.detune || 0) + pulse.pitchEnvelope.amount, at);
                oscillator.detune.linearRampToValueAtTime(partial.detune || 0, at + pulse.pitchEnvelope.decay);
                oscillator.connect(partialGain); partialGain.connect(filter); oscillator.start(at);
                entry.nodes.add(oscillator); entry.nodes.add(partialGain);
            }
        }
        const ringNodes = new Set();
        if (mix.bell || mix.strings) {
            const layer = mix.strings || mix.bell, samples = await layerBuffers.get(context);
            const pitches = mix.strings && !layer.frequencies ? chordFrequencies(frequencies, mix) :
                layer.frequencies || [Math.max(...frequencies) * 2 ** (mix.octaveShift + layer.octavesAboveBass)];
            for (const pitch of pitches) {
                const sample = samples.reduce((a, b) => Math.abs(Math.log2(pitch / a.rootFrequency)) <
                    Math.abs(Math.log2(pitch / b.rootFrequency)) ? a : b);
                const source = context.createBufferSource(), gain = context.createGain();
                source.buffer = sample.buffer; source.playbackRate.value = pitch / sample.rootFrequency;
                const peak = level * layer.gain / Math.sqrt(pitches.length);
                gain.gain.setValueAtTime(0, at);
                gain.gain.linearRampToValueAtTime(peak, at + (mix.strings ? 0.025 : 0.004));
                gain.gain.setValueAtTime(peak, at + layer.ringSeconds);
                if (mix.strings) gain.gain.linearRampToValueAtTime(0, at + layer.ringSeconds + layer.decaySeconds);
                else gain.gain.exponentialRampToValueAtTime(0.000001, at + layer.ringSeconds + layer.decaySeconds);
                source.connect(gain); gain.connect(destination);
                source.start(at); source.stop(at + layer.ringSeconds + layer.decaySeconds + 0.01);
                ringNodes.add(source); ringNodes.add(gain);
                entry.nodes.add(source); entry.nodes.add(gain);
                const tail = {stop() {
                    try {source.stop();} catch {}
                    source.disconnect(); gain.disconnect(); liveBells.delete(tail);
                }};
                liveBells.add(tail);
                source.addEventListener('ended', () => {
                    source.disconnect(); gain.disconnect(); liveBells.delete(tail);
                    entry.nodes.delete(source); entry.nodes.delete(gain);
                }, {once: true});
            }
        }
        entry.releaseAudioNodes = reason => {
            const end = context.currentTime + mix.releaseSeconds;
            if (output.gain.cancelAndHoldAtTime) output.gain.cancelAndHoldAtTime(context.currentTime);
            else {
                const held = output.gain.value;
                output.gain.cancelScheduledValues(context.currentTime);
                output.gain.setValueAtTime(held, context.currentTime);
            }
            output.gain.linearRampToValueAtTime(0, end);
            const nodes = [...entry.nodes].filter(node => reason !== 'key-released' || !ringNodes.has(node));
            for (const node of nodes) {try {node.stop?.(end);} catch {}}
            // Retain the final few milliseconds of audio before disconnecting.
            setTimeout(() => {for (const node of nodes) {try {node.disconnect();} catch {}}},
                Math.ceil(mix.releaseSeconds * 1000) + 8);
            state.active.delete(entry);
            if (reason === 'key-released') state.idleTask = scheduleIdle(state).catch(error => console.warn('Idle bell unavailable', error));
            else cancelState(state);
        };
    }
    globalThis.WMOFHalloweenAudio = Object.freeze({isActive, prepare, touchtones, chordFrequencies, playIdleBell, buttonActivity, cancelPending, pulseCatalog, whenIdleScheduled: () => lastActivity?.idleTask || Promise.resolve()});
})();
