(() => {
    'use strict';
    const revision=globalThis.document?.currentScript?.src?.match(/[?&]build=([^&#]+)/)?.[1];
    const versioned=url=>url+(revision?'?build='+revision:'');
    let dataPromise,lastState,generation=0;
    const states=new WeakMap(),live=new Set();
    const frequency=note=>{const m=/^([A-G])([#b]?)(-?\d+)$/.exec(note);if(!m)throw Error('Invalid seasonal note');return 440*2**(((Number(m[3])+1)*12+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0)-69)/12);};
    function isActive(date=new Date()){
        if(globalThis.WMOFSeasonalTheme)return globalThis.WMOFSeasonalTheme.active;
        return new URLSearchParams(globalThis.location?.search||'').get('halloweenPreview')==='1'||date.getMonth()===9&&date.getDate()===31;
    }
    function data(){return dataPromise||=Promise.all([
        fetch(versioned('api/audio/themes/halloween/windows.json')).then(r=>{if(!r.ok)throw Error('Theme interactions unavailable');return r.json();}),
        fetch(versioned('api/audio/instruments/library.json')).then(r=>{if(!r.ok)throw Error('Instrument library unavailable');return r.json();})
    ]).then(([theme,library])=>({touchtones:theme.windows.numberpad.controls.press,instruments:library.instruments})).catch(e=>{dataPromise=undefined;throw e;});}
    async function prepare(context){
        const d=await data();if(!context)return d;
        // Key notes use the shared live pulse; complete opening cues are WAV-backed.
        return d;
    }
    function state(context){if(!states.has(context))states.set(context,{context,index:0,active:new Set(),releasedAt:-Infinity});return states.get(context);}
    function resetSequence(){if(lastState){lastState.index=0;lastState.releasedAt=-Infinity;}}
    function cancelPending(all=false){resetSequence();if(all){generation++;for(const voice of [...live])voice.stop();}}
    globalThis.addEventListener?.('wmof-seasonal-theme-change',event=>{if(!event.detail.active){cancelPending(true);globalThis.WMOFAudio?.stopSeasonalSongs?.();}else void globalThis.WMOFAudio?.unlock?.();});
    async function touchtones(context,destination,frequencies,volume,entry){
        const d=await data();if(entry.released)return;
        const s=state(context),mix={...d.touchtones,releaseSeconds:d.instruments[d.touchtones.instrument].envelope.release};
        if(!s.active.size&&context.currentTime-s.releasedAt>=mix.timeoutSeconds)s.index=0;
        const row=[697,770,852,941].indexOf(frequencies[0]),column=[1209,1336,1477].indexOf(frequencies[1]);
        if(row<0||column<0)throw Error('Unknown keypad position');
        const note=mix.rows[row][column];lastState=s;s.active.add(entry);
        const at=context.currentTime,pulse=d.instruments[mix.instrument],output=context.createGain();entry.seasonalNote=note;
        output.gain.setValueAtTime(0,at);output.gain.linearRampToValueAtTime(Math.max(0,Math.min(1,volume)),at+mix.attackSeconds);output.connect(destination);entry.nodes.add(output);
        const filter=context.createBiquadFilter();filter.type=pulse.filter.type;filter.frequency.setValueAtTime(pulse.filter.frequency+pulse.filter.envelopeAmount,at);filter.frequency.exponentialRampToValueAtTime(pulse.filter.frequency,at+pulse.envelope.attack+pulse.envelope.decay);filter.Q.value=pulse.filter.Q;filter.connect(output);entry.nodes.add(filter);
        for(const partial of pulse.partials){
            const oscillator=context.createOscillator(),gain=context.createGain(),peak=partial.gain*mix.pulseGain;
            oscillator.type=partial.waveform||pulse.waveform;oscillator.frequency.value=frequency(note)*partial.ratio;
            oscillator.detune.setValueAtTime((partial.detune||0)+pulse.pitchEnvelope.amount,at);oscillator.detune.linearRampToValueAtTime(partial.detune||0,at+pulse.pitchEnvelope.decay);
            gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(peak,at+pulse.envelope.attack);gain.gain.exponentialRampToValueAtTime(Math.max(.000001,peak*pulse.envelope.sustain),at+pulse.envelope.attack+pulse.envelope.decay);
            oscillator.connect(gain);gain.connect(filter);oscillator.start(at);entry.nodes.add(oscillator);entry.nodes.add(gain);
        }
        let released=false;
        const voice={stop(){entry.releaseAudioNodes('canceled');}};live.add(voice);
        entry.releaseAudioNodes=()=>{
            if(released)return;released=true;const end=context.currentTime+mix.releaseSeconds;
            if(output.gain.cancelAndHoldAtTime)output.gain.cancelAndHoldAtTime(context.currentTime);else{const held=output.gain.value;output.gain.cancelScheduledValues(context.currentTime);output.gain.setValueAtTime(held,context.currentTime);}
            output.gain.linearRampToValueAtTime(0,end);const nodes=[...entry.nodes];for(const n of nodes){try{n.stop?.(end);}catch{}}
            setTimeout(()=>{for(const n of nodes){try{n.disconnect();}catch{}}},Math.ceil(mix.releaseSeconds*1000)+8);
            s.active.delete(entry);s.releasedAt=context.currentTime;live.delete(voice);
        };
    }
    globalThis.WMOFHalloweenAudio=Object.freeze({isActive,prepare,touchtones,resetSequence,cancelPending,frequency});
})();
