/* Shared, sample-addressed hypotheses. No DOM access or command execution. */
(() => {
    'use strict';
    const copy = value => structuredClone(value);
    const overlaps = (a,b) => a.startSample < b.endSample && b.startSample < a.endSample;
    class SpeechRecognitionLedger {
        #epoch=0; #revision=0; #sources=new Map(); #slots=[]; #id;
        constructor({streamId, sampleRate=16000, channels=1, sampleFormat='float32', maxSources=8,maxSegments=128,maxSlots=128}={}) {
            for(const n of [maxSources,maxSegments,maxSlots])if(!Number.isInteger(n)||n<1)throw RangeError('Ledger bounds must be positive integers.');
            if(typeof streamId!=='string'||!streamId||!Number.isInteger(sampleRate)||sampleRate<1||channels!==1||!['float32','int16'].includes(sampleFormat))
                throw TypeError('A stream identity and supported PCM layout are required.');
            this.stream=Object.freeze({streamId,sampleRate,channels,sampleFormat,bytesPerSample:sampleFormat==='float32'?4:2});
            Object.assign(this,{maxSources,maxSegments,maxSlots});
        }
        position(startSample,endSample) {
            if(!Number.isSafeInteger(startSample)||!Number.isSafeInteger(endSample)||startSample<0||endSample<=startSample)
                throw TypeError('A stream position requires ordered absolute sample boundaries.');
            const stride=this.stream.channels*this.stream.bytesPerSample;
            return {...this.stream,startSample,endSample,startByte:startSample*stride,endByte:endSample*stride};
        }
        begin(id) { this.#epoch++;this.#revision++;this.#id=id;this.#sources.clear();this.#slots=[];return this.#epoch; }
        get epoch(){return this.#epoch;}
        get slots(){return copy(this.#slots);}
        get forecasts(){return this.#slots.flatMap((slot,index)=>slot.forecast?[{
            ...copy(slot.forecast),sourceSlotId:slot.id,startSample:slot.endSample,
            state:this.#slots[index+1]?.kind===slot.forecast.kind?'filled':'unfilled'
        }]:[]);}
        submit(owner,{segmentId,text='',words,final=false,hypotheses=[]},epoch=this.#epoch) {
            if(epoch!==this.#epoch || this.#id===undefined)return false;
            if(typeof owner!=='string'||!owner||typeof segmentId!=='string')throw TypeError('Recognizer and segment identities are required.');
            let source=this.#sources.get(owner);
            if(!source){if(this.#sources.size>=this.maxSources)throw RangeError('Recognizer limit exceeded.');this.#sources.set(owner,source={revision:0,segments:new Map()});}
            if(words!==undefined && (!Array.isArray(words)||words.some(w=>!w.word || !Number.isInteger(w.startSample)||!Number.isInteger(w.endSample)||w.startSample<0||w.endSample<=w.startSample)))
                throw TypeError('Word positions must be absolute sample intervals.');
            const segment={segmentId,text,words:words&&copy(words),final:Boolean(final),hypotheses:copy(hypotheses.slice(0,10)),
                position:words?.length?this.position(words[0].startSample,words.at(-1).endSample):null};
            const old=source.segments.get(segmentId);
            if(old?.final && !final)return false;
            if(JSON.stringify(old)===JSON.stringify(segment))return false;
            if(!old&&source.segments.size>=this.maxSegments)throw RangeError('Recognition segment limit exceeded.');
            source.segments.set(segmentId,segment);source.revision++;this.#revision++;return true;
        }
        snapshot() {
            return {utteranceId:this.#id,epoch:this.#epoch,revision:this.#revision,stream:{...this.stream},slots:this.slots,
                sources:[...this.#sources].map(([owner,s])=>({owner,revision:s.revision,segments:copy([...s.segments.values()])}))};
        }
        // Resolution may await recognizer/context work. Ownership changes only
        // in commit(), after checking the snapshot's dependencies again.
        async arbitrate(resolve,{dependencies,isCurrent}={}) {
            const snapshot=this.snapshot();
            const plan=await resolve(snapshot);
            return this.commit(snapshot,plan,{dependencies,isCurrent});
        }
        commit(snapshot,plan,{dependencies=snapshot.sources.map(s=>s.owner),isCurrent}={}) {
            if(isCurrent && !isCurrent())return {committed:false,reason:'stale-context'};
            if(snapshot.epoch!==this.#epoch||snapshot.utteranceId!==this.#id)return {committed:false,reason:'stale-utterance'};
            if(snapshot.revision!==this.#revision && dependencies.some(owner=>
                snapshot.sources.find(s=>s.owner===owner)?.revision!==this.#sources.get(owner)?.revision))
                return {committed:false,reason:'stale-candidates'};
            if(!Array.isArray(plan)||plan.length>this.maxSlots)throw RangeError('Invalid slot plan.');
            const slots=copy(plan).sort((a,b)=>a.startSample-b.startSample);
            for(let i=0;i<slots.length;i++) {
                const slot=slots[i];
                if(!slot.id||!slot.owner||!slot.context||!slot.text||!['locked','sealed'].includes(slot.state)||
                    !Number.isInteger(slot.startSample)||!Number.isInteger(slot.endSample)||slot.startSample<0||slot.endSample<=slot.startSample)
                    throw TypeError('A locked slot needs a validated context and sample range.');
                if(slot.position?.streamId && slot.position.streamId!==this.stream.streamId)throw Error('Slot belongs to a different stream.');
                slot.position=this.position(slot.startSample,slot.endSample);
                if(slot.kind==='commands' && slot.validated!==true)throw TypeError('Command ownership requires validation.');
                if(i&&overlaps(slots[i-1],slot))throw Error('Slot ownership overlaps.');
                if(slot.expectedKind&&slot.kind!==slot.expectedKind)throw Error('Slot type does not match its forecast.');
                const forecast=i?slots[i-1].forecast:undefined;
                if(forecast&&slot.kind!=='commands'&&slot.kind!==forecast.kind)throw Error('Slot type does not match the preceding forecast.');
            }
            for(const old of this.#slots) {
                const next=slots.find(s=>s.id===old.id);
                if(!next || next.owner!==old.owner || next.context!==old.context || next.startSample!==old.startSample)
                    return {committed:false,reason:'ownership-conflict'};
                if((old.state==='sealed'||old.kind==='commands') &&
                    (next.text!==old.text||next.endSample!==old.endSample))return {committed:false,reason:'sealed-conflict'};
                if(JSON.stringify(next.forecast)!==JSON.stringify(old.forecast))return {committed:false,reason:'forecast-conflict'};
                if(old.state==='sealed'&&next.state!=='sealed')return {committed:false,reason:'sealed-conflict'};
            }
            this.#slots=slots;
            return {committed:true,slots:this.slots};
        }
        clear() {this.#epoch++;this.#revision++;this.#id=undefined;this.#sources.clear();this.#slots=[];}
    }
    globalThis.SpeechRecognitionLedger=SpeechRecognitionLedger;
})();
