/* Client-only sequential recognition. One model, one PCM ring, one active decoder.
 * Replayed audio is identified by absolute sample position, never text deduplication. */
(() => {
    'use strict';
    const tokens = text => String(text || '').trim().split(/\s+/).filter(Boolean);
    const copyRouter = router => Object.assign(Object.create(Object.getPrototypeOf(router)), router);
    class VoskContextRecognizer extends EventTarget {
        #loader; #decoder; #buffer; #router; #id; #closed=false; #epoch=0;
        #queue=Promise.resolve(); #analysis=Promise.resolve(); #flushing=false; #flushResult;
        #origin=0; #boundary=0; #fed=0; #words=new Map(); #prefix='';
        #switchQueued=false; #lastProbe=''; #hops=0; #submitted=0; #replayed=0;
        constructor({contextProvider, routerFactory, valuePhrases, overlapMilliseconds=120,
            bufferSeconds=30, preRollMilliseconds=350, maxHandoffs=64, ...options}={}) {
            super();
            if (typeof contextProvider!=='function') throw TypeError('Sequential Vosk requires a context provider.');
            for (const value of [overlapMilliseconds,preRollMilliseconds])
                if (!Number.isFinite(value) || value<0) throw RangeError('Replay intervals must be nonnegative.');
            if (!Number.isFinite(bufferSeconds) || bufferSeconds<=0 || !Number.isInteger(maxHandoffs) || maxHandoffs<1)
                throw RangeError('Invalid bounded handoff configuration.');
            this.sampleRate=options.sampleRate || 16000;
            if (Math.max(overlapMilliseconds,preRollMilliseconds)>=bufferSeconds*1000) throw RangeError('Replay interval exceeds PCM retention.');
            this.options=options; this.contextProvider=contextProvider; this.maxHandoffs=maxHandoffs;
            this.overlapSamples=Math.ceil(overlapMilliseconds*this.sampleRate/1000);
            this.preRollSamples=Math.ceil(preRollMilliseconds*this.sampleRate/1000);
            this.boundaryAnalyzer=new globalThis.SpeechBoundaryAnalyzer({sampleRate:this.sampleRate,
                minimumOverlapMilliseconds:overlapMilliseconds,maximumLookbackMilliseconds:Math.max(300,overlapMilliseconds)});
            this.#buffer=new globalThis.PcmSampleBuffer(Math.ceil(bufferSeconds*this.sampleRate));
            this.routerFactory=routerFactory || (request=>new globalThis.VoskGrammarRouter({records:request.records,
                valuePhrases:valuePhrases || (this.valuePhrases ||= globalThis.VoskGrammarRouter.valuePhrases()),
                nextRecords:async text=>(await contextProvider(this.#id,text))?.records || []}));
            // The loader owns the shared model, but never creates a decoder.
            this.#loader=new globalThis.VoskRecognizer(options);
            this.#loader.addEventListener('status',e=>this.#emit('status',e.detail));
            this.ready=this.#loader.ready.then(()=>this);
        }
        get continuousInput(){return true;}
        get transcriptMode(){return 'cumulative';}
        get audioDelivery(){return Object.freeze({receivedSamples:this.#buffer.end,submittedSamples:this.#submitted,
            replayedSamples:this.#replayed,queuedSamples:this.#buffer.end-this.#fed,
            retainedSamples:this.#buffer.end-this.#buffer.start,capacitySamples:this.#buffer.capacity});}
        #emit(type,detail){if(!this.#closed)this.dispatchEvent(new CustomEvent(type,{detail}));}
        #enqueue(task){
            const result=this.#queue.then(()=>this.#closed?false:task());
            this.#queue=result.catch(error=>{if(!this.#closed){this.#emit('error',{error,message:error.message,fatal:true,utteranceId:this.#id});this.close();}});
            return result;
        }
        beginUtterance(id){return this.#enqueue(async()=>{
            await this.ready;
            if(this.#closed)return;
            if(this.#id!==undefined)throw Error('Previous Vosk utterance must settle before beginning another.');
            this.#id=id;this.#prefix='';this.#hops=0;this.#lastProbe='';
            this.#boundary=Math.max(this.#buffer.start,this.#fed-this.preRollSamples);
            this.#router=this.routerFactory(await this.contextProvider(id,''));
            await this.#replace(this.#boundary,this.#fed);
        });}
        accept(id,samples){return this.#accept(id,samples);}
        acceptAudio(samples){return this.#accept(undefined,samples);}
        #accept(id,samples){
            if(this.#closed)return Promise.resolve(false);
            // Copy immediately: the capture worklet may reuse its Float32Array.
            const span=this.#buffer.append(samples);
            if(this.#buffer.end-this.#fed>this.#buffer.capacity){
                const error=Error('Sequential Vosk audio backlog exceeded retained PCM.');
                this.#emit('error',{error,message:error.message,fatal:true,utteranceId:this.#id});this.close();return Promise.resolve(false);
            }
            return this.#enqueue(async()=>{
                if(id!==undefined && id!==this.#id){this.#fed=span.end;return false;}
                if(this.#decoder)await this.#feed(this.#buffer.read(span.start,span.end),false);
                this.#fed=span.end;return true;
            });
        }
        async #feed(samples,replay){
            for(let offset=0;offset<samples.length;offset+=640){
                const block=samples.subarray(offset,offset+640);
                await this.#decoder.accept(this.#id,block);
                this.#submitted+=block.length;if(replay)this.#replayed+=block.length;
            }
        }
        async #lookahead(router){
            const phrases=new Set(router.phrases);
            if(!globalThis.VoskPhraseListCompiler)return [...phrases];
            const visit=async(paths,prefix,depth)=>{
                if(depth===0)return;
                for(const path of paths){
                    const stage=path.stages[0];
                    if(stage?.grammar!=='commands' || !path.record.nextContext || stage.phrases.length>32)continue;
                    for(const head of stage.phrases){
                        const full=[prefix,head].filter(Boolean).join(' ');
                        const records=(await this.contextProvider(this.#id,[router.prefix,full].filter(Boolean).join(' ')))?.records || [];
                        const next=globalThis.VoskPhraseListCompiler.compileStages(records,{valuePhrases:this.valuePhrases});
                        for(const following of next.paths){
                            if(following.stages[0]?.grammar!=='commands')continue;
                            for(const phrase of following.stages[0].phrases)phrases.add(full+' '+phrase);
                        }
                        await visit(next.paths,full,depth-1);
                    }
                }
            };
            await visit(router.paths,'',2);
            return [...phrases];
        }
        async #replace(start,end){
            this.#epoch++;this.#decoder?.close();this.#words.clear();this.#origin=start;
            if(this.#closed)return;
            const epoch=this.#epoch;
            const phrases=[...new Set([...await this.#lookahead(this.#router),'[unk]'])];
            const decoder=this.#decoder=new globalThis.VoskRecognizer({...this.options,model:this.#loader.model,grammar:phrases,getCollectionSession:undefined,
                // Routing must see the native candidates even when a narrow stage
                // alone is not a complete application command yet.
                selectHypothesis:async(id,list,options)=>{
                    if(!this.options.selectHypothesis)return list[0];
                    const projected=list.map(h=>({...h,text:[this.#prefix,h.text].filter(Boolean).join(' ')}));
                    return await this.options.selectHypothesis(id,projected,{...options,isFinal:false}) || list[0];
                }});
            decoder.addEventListener('error',e=>{if(epoch===this.#epoch)this.#emit('error',e.detail);});
            decoder.addEventListener('alternatives',e=>{if(epoch===this.#epoch)this.#emit('alternatives',{...e.detail,recognitionContext:this.#router.grammar,decoderEpoch:epoch});});
            decoder.addEventListener('transcript',e=>{
                if(this.#closed || epoch!==this.#epoch)return;
                const detail=e.detail;
                const segment=detail.segments.at(-1);
                if(segment && Array.isArray(detail.words) && segment.text)
                    this.#words.set(segment.id,detail.words.map(word=>({...word,
                        startSample:start+Math.round(word.start*this.sampleRate),endSample:start+Math.round(word.end*this.sampleRate)})));
                if(this.#flushing){this.#flushResult=detail;return;}
                this.#analysis=this.#analysis.then(()=>this.#inspect(detail,epoch)).catch(error=>{
                    this.#emit('error',{error,message:error.message,fatal:true,utteranceId:this.#id});this.close();});
            });
            await decoder.beginUtterance(this.#id);
            if(end>start)await this.#feed(this.#buffer.read(start,end),true);
        }
        #aligned(detail){
            const words=[...this.#words.values()].flat().filter(w=>(w.startSample+w.endSample)/2>this.#boundary);
            if(words.some(w=>!Number.isFinite(w.startSample)||!Number.isFinite(w.endSample)))throw Error('Invalid Vosk word timing.');
            // Without partial-word timestamps, overlapping partials are speculative.
            // They may request a flush, but never become duplicate executable text.
            const timed=detail.segmentFinal || Array.isArray(detail.words);
            return {words,text:timed?words.map(w=>w.word).join(' '):detail.transcript,timed};
        }
        async #project(router,text){
            const decision=await router.update(text);
            // An unambiguous terminal head can open a different command surface
            // even when both decoders are called "commands" (Break Start -> choice).
            if(decision.stableHead && router.continuations?.length){
                router.consume(decision.stableHead);
                router.paths=router.continuations;router.continuations=[];
                const types=[...new Set(router.paths.map(path=>path.stages[0]?.grammar))];
                router.grammar=types.length===1?types[0]:'commands';
                decision.grammar=router.grammar;
            }
            return decision;
        }
        async #inspect(detail,epoch){
            if(this.#closed || epoch!==this.#epoch || this.#id===undefined)return;
            const aligned=this.#aligned(detail),probe=copyRouter(this.#router);
            const decision=await this.#project(probe,aligned.text);
            if(this.#closed || epoch!==this.#epoch)return;
            const changes=probe.prefix!==this.#router.prefix || decision.grammar!==this.#router.grammar;
            const key=this.#prefix+'|'+decision.grammar+'|'+probe.prefix;
            if(changes && !this.#switchQueued && key!==this.#lastProbe){
                this.#switchQueued=true;this.#lastProbe=key;
                void this.#enqueue(async()=>{
                    try{if(epoch===this.#epoch)await this.#checkpoint(false);}
                    finally{this.#switchQueued=false;}
                }).catch(()=>{});
                return;
            }
            if(aligned.timed || this.#origin>=this.#boundary)
                this.#publish(aligned.text,false);
        }
        #publish(tail,isFinal){
            this.#emit('transcript',{utteranceId:this.#id,transcript:[this.#prefix,tail].filter(Boolean).join(' '),
                isFinal,recognitionContext:this.#router.grammar,decoderEpoch:this.#epoch,
                audioBoundarySample:this.#boundary});
        }
        async #checkpoint(ending){
            for(let turn=0;turn<this.maxHandoffs;turn++){
                const checkpointStarted=performance.now();
                this.#flushing=true;this.#flushResult=undefined;
                try{await this.#decoder.finishUtterance(this.#id);}finally{this.#flushing=false;}
                const finalizationMilliseconds=performance.now()-checkpointStarted;
                if(this.#closed)return;
                const detail=this.#flushResult || {transcript:'',segmentFinal:true};
                const aligned=this.#aligned(detail),next=copyRouter(this.#router);
                await this.#project(next,aligned.text);
                const consumed=tokens(next.prefix).length-tokens(this.#prefix).length;
                const changed=next.grammar!==this.#router.grammar || consumed>0;
                if(consumed<0 || consumed>aligned.words.length)throw Error('Vosk handoff boundary has no complete word timing.');
                if(consumed && tokens(next.prefix).slice(-consumed).join(' ')!==aligned.words.slice(0,consumed).map(w=>w.word).join(' '))
                    throw Error('Vosk handoff revised its proposed command boundary.');
                if(!changed){
                    this.#publish(aligned.text,ending);
                    if(!ending)await this.#replace(Math.max(this.#buffer.start,this.#boundary-this.overlapSamples),this.#fed);
                    return;
                }
                if(++this.#hops>this.maxHandoffs)throw Error('Too many recognizer handoffs in one utterance.');
                const boundary=consumed?aligned.words[consumed-1].endSample:this.#boundary;
                if(boundary<this.#boundary || boundary>this.#fed)throw Error('Vosk supplied an out-of-range handoff boundary.');
                const from=this.#router.grammar;this.#prefix=next.prefix;this.#router=next;this.#boundary=boundary;
                this.#publish('',false);
                const analysisStarted=performance.now();
                let analysisMilliseconds;
                this.boundaryAnalyzer.setDestination({router:next,epoch:this.#epoch});
                const positioning=await this.boundaryAnalyzer.handoff(this.#buffer,boundary,async(destination,position)=>{
                    analysisMilliseconds=performance.now()-analysisStarted;
                    if(this.#closed || destination.epoch!==this.#epoch)return;
                    await this.#replace(position.replayStartSample,this.#fed);
                });
                const start=positioning.replayStartSample;
                // Missing unconsumed audio is an error, never an implicit truncation.
                if(boundary<this.#buffer.start)throw Error('Vosk handoff audio expired.');
                this.#emit('handoff',{utteranceId:this.#id,from,to:next.grammar,boundarySample:boundary,
                    replayStartSample:start,replayEndSample:this.#fed,decoderEpoch:this.#epoch,
                    boundaryAnalysis:positioning,analysisMilliseconds,finalizationMilliseconds,
                    handoffMilliseconds:performance.now()-checkpointStarted});
                if(!ending)return;
            }
            throw Error('Vosk handoff could not settle its final audio.');
        }
        finishUtterance(id){return this.#enqueue(async()=>{
            if(id!==this.#id)return;
            await this.#checkpoint(true);
            this.#epoch++;this.#decoder?.close();this.#decoder=undefined;
            this.#id=undefined;this.#words.clear();this.#emit('utteranceEnded',{utteranceId:id});
        });}
        abortUtterance(id){return this.#enqueue(()=>{
            if(id!==this.#id)return;
            this.boundaryAnalyzer.cancel();this.#epoch++;this.#decoder?.close();this.#decoder=undefined;this.#id=undefined;this.#words.clear();
        });}
        close(){this.boundaryAnalyzer.cancel();this.#closed=true;this.#epoch++;this.#decoder?.close();this.#loader.close();this.#words.clear();}
    }
    globalThis.VoskContextRecognizer=VoskContextRecognizer;
})();
