(() => {
    'use strict';
    const revision=globalThis.document?.currentScript?.src?.match(/[?&]build=([^&#]+)/)?.[1];
    const versioned=url=>url+(revision?'?build='+revision:'');
    let dataPromise,lastState,generation=0;
    const states=new WeakMap(),buffers=new WeakMap(),catalogs=new WeakMap(),playbackCatalogs=new WeakMap(),live=new Set();
    const frequency=note=>{const m=/^([A-G])([#b]?)(-?\d+)$/.exec(note);if(!m)throw Error('Invalid seasonal note');return 440*2**(((Number(m[3])+1)*12+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0)-69)/12);};
    function isActive(date=new Date()){
        if(globalThis.WMOFSeasonalTheme)return globalThis.WMOFSeasonalTheme.active;
        return new URLSearchParams(globalThis.location?.search||'').get('halloweenPreview')==='1'||date.getMonth()===9&&date.getDate()===31;
    }
    function data(){return dataPromise||=fetch(versioned('api/audio/halloween.json')).then(r=>{if(!r.ok)throw Error('Halloween audio could not be loaded');return r.json();}).catch(e=>{dataPromise=undefined;throw e;});}
    function buffer(context,url){
        if(globalThis.WMOFAudio?.loadSample)return globalThis.WMOFAudio.loadSample(context,versioned(url));
        let cache=buffers.get(context);if(!cache)buffers.set(context,cache=new Map());
        if(!cache.has(url))cache.set(url,fetch(versioned(url)).then(r=>{if(!r.ok)throw Error('Halloween recording unavailable');return r.arrayBuffer();}).then(b=>context.decodeAudioData(b)).catch(e=>{cache.delete(url);throw e;}));
        return cache.get(url);
    }
    async function prepare(context){
        const d=await data();if(!context)return d;
        await Promise.all(d.instruments['halloween-opening-strings'].samples.map(s=>buffer(context,s.url)));
        const speed=String(globalThis.WMOFAudio?.outputSettings?.toneVelocity ?? 1);
        // Warm only the selected speed, sequentially, so decoding cannot burst on a phone.
        for(const name of ['trip-started','trip-ended']){
            if(!isActive()||String(globalThis.WMOFAudio?.outputSettings?.toneVelocity ?? 1)!==speed)break;
            const variant=d.songs[name]?.renderedVariants?.[speed];
            if(variant)await buffer(context,d.instruments[variant.instrument].samples[0].url);
        }
        return d;
    }
    async function catalogForSong(base,name,options={}){
        const seasonal=await data();if(!seasonal.songs[name])return base;
        if(!catalogs.has(base)){
            const definitions=Object.fromEntries(Object.entries(seasonal.instruments).map(([key,d])=>[key,{...d,...(d.samples?{samples:d.samples.map(sample=>({...sample,url:versioned(sample.url)}))}:{})}]));
            catalogs.set(base,{...base,instruments:{...base.instruments,...definitions},songs:{...base.songs,...seasonal.songs}});
        }
        const merged=catalogs.get(base),speed=String(options.toneVelocity ?? 1);
        if(!seasonal.songs[name].renderedVariants?.[speed] || options.bpm!=null && Number(options.bpm)!==Number(seasonal.songs[name].bpm))return merged;
        let variants=playbackCatalogs.get(merged);if(!variants)playbackCatalogs.set(merged,variants=new Map());
        if(!variants.has(speed)){
            const songs={...merged.songs};
            for(const [key,song]of Object.entries(merged.songs)){
                const v=song.renderedVariants?.[speed];if(!v)continue;
                songs[key]={...song,instrument:v.instrument,seasonalGain:1,seasonalPreRendered:true,events:[{offset:'0',tone:'C4',length:String(v.seconds*song.bpm*Number(speed)/60),dynamic:'fff',instrument:v.instrument}]};
            }
            variants.set(speed,{...merged,songs});
        }
        return variants.get(speed);
    }
    function state(context){if(!states.has(context))states.set(context,{context,index:0,active:new Set(),releasedAt:-Infinity});return states.get(context);}
    function resetSequence(){if(lastState){lastState.index=0;lastState.releasedAt=-Infinity;}}
    function cancelPending(all=false){resetSequence();if(all){generation++;for(const voice of [...live])voice.stop();}}
    globalThis.addEventListener?.('wmof-seasonal-theme-change',event=>{if(!event.detail.active){cancelPending(true);globalThis.WMOFAudio?.stopSeasonalSongs?.();}else void globalThis.WMOFAudio?.unlock?.();});
    async function touchtones(context,destination,_frequencies,volume,entry){
        const d=await data();if(entry.released)return;
        const s=state(context),mix=d.touchtones;
        if(!s.active.size&&context.currentTime-s.releasedAt>=mix.timeoutSeconds)s.index=0;
        const note=mix.notes[s.index];s.index=(s.index+1)%mix.notes.length;lastState=s;s.active.add(entry);
        const at=context.currentTime,pulse=d.instruments['halloween-pulse'],output=context.createGain();entry.seasonalNote=note;
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
    async function playCue(context,destination,volume,kind){
        const ticket=generation,d=await data();if(kind!=='open')throw Error('Unknown keypad cue');
        const definition=d.instruments['halloween-opening-strings'];
        const recordings=await Promise.all(definition.samples.map(s=>buffer(context,s.url)));
        if(ticket!==generation||!isActive())return null;
        const at=context.currentTime+.005,nodes=[],sources=[];let resolveFinished,stopped=false;
        const handle={startedAtPerformanceMs:performance.now()+5,speechAtPerformanceMs:performance.now()+5,finished:new Promise(r=>resolveFinished=r),stop(){if(stopped)return;stopped=true;for(const n of sources){try{n.stop();}catch{}}for(const n of nodes){try{n.disconnect();}catch{}}live.delete(handle);resolveFinished({reason:'stopped'});}};
        let remaining=d.opening.notes.length;
        const ended=()=>{if(--remaining>0)return;for(const n of nodes)n.disconnect();live.delete(handle);resolveFinished({reason:stopped?'stopped':'ended'});};
        function source(b,pitch=1){const n=context.createBufferSource();n.buffer=b;n.playbackRate.value=pitch;sources.push(n);nodes.push(n);n.addEventListener('ended',ended,{once:true});return n;}
        for(const note of d.opening.notes){
            const pitch=frequency(note),index=definition.samples.reduce((best,s,i)=>Math.abs(Math.log2(pitch/s.rootFrequency))<Math.abs(Math.log2(pitch/definition.samples[best].rootFrequency))?i:best,0),n=source(recordings[index],pitch/definition.samples[index].rootFrequency),gain=context.createGain(),peak=volume*d.opening.volume/Math.sqrt(d.opening.notes.length),hold=at+d.opening.holdSeconds;
            gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(peak,at+definition.envelope.attack);gain.gain.linearRampToValueAtTime(peak*definition.envelope.sustain,at+definition.envelope.attack+definition.envelope.decay);gain.gain.setValueAtTime(peak*definition.envelope.sustain,hold);gain.gain.linearRampToValueAtTime(0,hold+definition.envelope.release);n.connect(gain);gain.connect(destination);nodes.push(gain);n.start(at);n.stop(hold+definition.envelope.release+.01);
        }
        live.add(handle);return Object.freeze(handle);
    }
    globalThis.WMOFHalloweenAudio=Object.freeze({isActive,prepare,touchtones,playCue,catalogForSong,resetSequence,cancelPending,frequency});
})();
