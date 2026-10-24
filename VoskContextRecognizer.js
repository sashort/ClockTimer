/* Client-only sequential recognition. One model, one PCM ring, one active decoder.
 * Replayed audio is identified by absolute sample position, never text deduplication. */
(() => {
    'use strict';
    const tokens = text => String(text || '').trim().split(/\s+/).filter(Boolean);
    const copyRouter = router => Object.assign(Object.create(Object.getPrototypeOf(router)), router);
    let streamSequence=0;
    class VoskContextRecognizer extends EventTarget {
        #phase='idle';#phaseAt=0;#ending=false;
        #loader; #decoder; #buffer; #router; #id; #closed=false; #epoch=0;
        #queue=Promise.resolve(); #analysis=Promise.resolve(); #flushing=false; #flushResult;
        #origin=0; #boundary=0; #fed=0; #words=new Map(); #prefix='';
        #switchQueued=false; #lastProbe=''; #hops=0; #submitted=0; #replayed=0;
        #compiler; #pool; #contextCache; #prepared=new Map(); #partial; #partialQueued=false; #metrics; #lastReplacement; #startedAt=0;
        constructor({contextProvider, routerFactory, valuePhrases, overlapMilliseconds=120,
            bufferSeconds=30, preRollMilliseconds=350, maxHandoffs=64, warmDecoders=true, grammarWorker=true, coalescePartials=true, getContextVersion, ...options}={}) {
            super();
            if (typeof contextProvider!=='function') throw TypeError('Sequential Vosk requires a context provider.');
            for (const value of [overlapMilliseconds,preRollMilliseconds])
                if (!Number.isFinite(value) || value<0) throw RangeError('Replay intervals must be nonnegative.');
            if (!Number.isFinite(bufferSeconds) || bufferSeconds<=0 || !Number.isInteger(maxHandoffs) || maxHandoffs<1)
                throw RangeError('Invalid bounded handoff configuration.');
            this.sampleRate=options.sampleRate || 16000;
            if (Math.max(overlapMilliseconds,preRollMilliseconds)>=bufferSeconds*1000) throw RangeError('Replay interval exceeds PCM retention.');
            this.options=options;this.grammarWorker=grammarWorker;this.coalescePartials=coalescePartials;
            this.getContextVersion=getContextVersion || (()=>0);
            if(globalThis.SpeechContextSnapshotCache && getContextVersion){
                this.#contextCache=new globalThis.SpeechContextSnapshotCache(contextProvider,getContextVersion);
                this.contextProvider=this.#contextCache.get.bind(this.#contextCache);
            }else this.contextProvider=contextProvider;
            this.maxHandoffs=maxHandoffs;
            if(warmDecoders && globalThis.VoskDecoderPool)this.#pool=new globalThis.VoskDecoderPool();
            if(globalThis.SpeechRecognitionLedger)this.ledger=new globalThis.SpeechRecognitionLedger({streamId:'vosk-sequential-'+(++streamSequence),sampleRate:this.sampleRate,sampleFormat:'float32'});
            this.overlapSamples=Math.ceil(overlapMilliseconds*this.sampleRate/1000);
            this.preRollSamples=Math.ceil(preRollMilliseconds*this.sampleRate/1000);
            this.boundaryAnalyzer=new globalThis.SpeechBoundaryAnalyzer({sampleRate:this.sampleRate,
                minimumOverlapMilliseconds:overlapMilliseconds,maximumLookbackMilliseconds:Math.max(300,overlapMilliseconds)});
            this.#buffer=new globalThis.PcmSampleBuffer(Math.ceil(bufferSeconds*this.sampleRate));
            this.routerFactory=routerFactory || (request=>new globalThis.VoskGrammarRouter({records:request.records,compiled:request.compiled,compileRecords:records=>this.#compile(records),
                valuePhrases:valuePhrases || (this.valuePhrases ||= globalThis.VoskGrammarRouter.valuePhrases()),
                nextRecords:async text=>(await this.contextProvider(this.#id,text))?.records || []}));
            // The loader owns the shared model, but never creates a decoder.
            this.#loader=new globalThis.VoskRecognizer(options);
            this.#loader.addEventListener('status',e=>this.#emit('status',e.detail));
            this.ready=this.#loader.ready.then(()=>this);
        }
        #setPhase(phase){if(this.#phase===phase)return;this.#phase=phase;this.#phaseAt=performance.now();this.#emit('status',{status:this.processing?'recognition-processing':'recognition-listening',phase,utteranceId:this.#id});}
        get processing(){return !['idle','decoding','closed'].includes(this.#phase);}
        get listening(){return !this.#closed&&!this.processing;}
        get recognitionMode(){return "sequential";}
        get slots(){return this.ledger?.slots || [];}
        get executionDiagnostics(){return {phase:this.#phase,phaseMilliseconds:performance.now()-this.#phaseAt,grammar:this.#compiler?.execution || 'main-thread',warmDecoders:this.#pool?.size || 0,contextCacheHits:this.#contextCache?.hits || 0};}
        get continuousInput(){return true;}
        get transcriptMode(){return 'cumulative';}
        get audioDelivery(){return Object.freeze({receivedSamples:this.#buffer.end,submittedSamples:this.#submitted,
            replayedSamples:this.#replayed,queuedSamples:this.#buffer.end-this.#fed,
            retainedSamples:this.#buffer.end-this.#buffer.start,capacitySamples:this.#buffer.capacitySamples || this.#buffer.capacity,
            nativeQueuedSamples:this.#decoder?.audioDelivery?.queuedSamples || 0,
            oldestQueuedAudioMilliseconds:this.#decoder?.audioDelivery?.oldestQueuedAudioMilliseconds || 0});}
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
            this.#setPhase('preparing-grammar');this.#id=id;this.#prefix='';this.#hops=0;this.#lastProbe='';this.#prepared.clear();this.#contextCache?.clear();this.ledger?.begin(id);this.#startedAt=performance.now();
            this.#metrics={utteranceId:id,mode:'sequential',maximumInputQueueMilliseconds:0,coalescedPartials:0,handoffs:[]};
            this.#boundary=Math.max(this.#buffer.start,this.#fed-this.preRollSamples);
            const request=await this.contextProvider(id,'');
            if(globalThis.VoskPhraseListCompiler)request.compiled=await this.#compile(request.records);
            this.#router=this.routerFactory(request);
            await this.#replace(this.#boundary,this.#fed);
        });}
        accept(id,samples){return this.#accept(id,samples);}
        acceptAudio(samples){return this.#accept(undefined,samples);}
        #accept(id,samples){
            if(this.#closed)return Promise.resolve(false);
            // Copy immediately: the capture worklet may reuse its Float32Array.
            const span=this.#buffer.append(samples),receivedAt=performance.now();
            if(this.#buffer.end-this.#fed>this.#buffer.capacity){
                const error=Error('Sequential Vosk audio backlog exceeded retained PCM.');
                this.#emit('error',{error,message:error.message,fatal:true,utteranceId:this.#id});this.close();return Promise.resolve(false);
            }
            return this.#enqueue(async()=>{
                if(this.#metrics)this.#metrics.maximumInputQueueMilliseconds=Math.max(this.#metrics.maximumInputQueueMilliseconds,performance.now()-receivedAt);
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
            const phrases=new Set(router.phrases),visited=new Set();
            const installed=this.options.vocabularyProvider?await (this.installedVocabulary ||= Promise.resolve(this.options.vocabularyProvider()).then(records=>this.#compile(records))):undefined;
            if(!globalThis.VoskPhraseListCompiler)return [...phrases];
            if(router.digitRecords?.some(record=>record.digitCounts?.includes(8))&&this.options.vocabularyProvider){
                this.authenticationVocabulary ||= Promise.resolve(installed).then(compiled=>{
                    const vocabulary=new Set(),seenPhrases=new Set();
                    for(const path of compiled.paths)for(const stage of path.stages){
                        if(!seenPhrases.has(stage.phrases)){
                            seenPhrases.add(stage.phrases);
                            for(const phrase of stage.phrases)for(const part of phrase.split(' '))if(/^\p{L}[\p{L}'’-]*$/u.test(part))vocabulary.add(part);
                        }
                        if(stage.grammar==='commands'&&!path.record.atomic)for(const phrase of stage.phrases)
                            if(phrase.split(' ').length<=6&&/^[\p{L}'’ -]+$/u.test(phrase))vocabulary.add(phrase);
                    }
                    return [...vocabulary];
                });
                for(const phrase of await this.authenticationVocabulary)phrases.add(phrase);
            }
            const visit=async(paths,prefix,depth)=>{
                if(depth===0)return;
                for(const path of paths){
                    const stage=path.stages[0];
                    if(stage?.grammar!=='commands' || !path.record.nextContext || stage.phrases.length>32)continue;
                    for(const head of stage.phrases){
                        const full=[prefix,head].filter(Boolean).join(' ');
                        if(visited.has(full))continue;
                        visited.add(full);
                        // Acoustic lookahead follows declared context links; it never needs to
                        // execute the full application planner for every possible future head.
                        const next=installed?{paths:installed.paths.filter(next=>next.record.contexts?.includes(path.record.nextContext))}:
                            await this.#compile((await this.contextProvider(this.#id,[router.prefix,full].filter(Boolean).join(' ')))?.records || []);
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
            const grammarStarted=performance.now();
            this.#setPhase('preparing-grammar');const prepared=await this.#grammar(this.#router);
            const grammarMilliseconds=performance.now()-grammarStarted;
            this.#setPhase('preparing-decoder');const decoderStarted=performance.now();
            const warmed=await this.#pool?.take(prepared.key);
            const decoder=this.#decoder=warmed || this.#createDecoder(prepared.phrases);
            if(!warmed)await decoder.prepare?.();
            const decoderMilliseconds=performance.now()-decoderStarted;
            decoder.addEventListener('error',e=>{if(epoch===this.#epoch)this.#emit('error',e.detail);});
            decoder.addEventListener('alternatives',e=>{if(epoch===this.#epoch)this.#emit('alternatives',{...e.detail,recognitionContext:this.#router.grammar,decoderEpoch:epoch});});
            decoder.addEventListener('transcript',e=>{
                if(this.#closed || epoch!==this.#epoch)return;
                const detail=e.detail;
                const segment=detail.segments.at(-1);
                if(segment && Array.isArray(detail.words) && segment.text)
                    this.#words.set(segment.id,detail.words.map(word=>({...word,
                        startSample:start+Math.round(word.start*this.sampleRate),endSample:start+Math.round(word.end*this.sampleRate)})));
                this.ledger?.submit(this.#router.grammar,{segmentId:epoch+':'+(segment?.id || 'partial'),text:segment?.text || '',words:this.#words.get(segment?.id),final:Boolean(segment?.final)},this.ledger.epoch);
                if(this.#flushing){this.#flushResult=detail;return;}
                this.#scheduleInspection(detail,epoch);
            });
            await decoder.beginUtterance(this.#id);
            this.#setPhase('replaying');const replayStarted=performance.now();
            if(end>start)await this.#feed(this.#buffer.read(start,end),true);
            this.#lastReplacement={grammarMilliseconds,decoderMilliseconds,replayMilliseconds:performance.now()-replayStarted,warmDecoder:Boolean(warmed)};if(!this.#ending)this.#setPhase('decoding');
        }
        #createDecoder(phrases){
            return new globalThis.VoskRecognizer({...this.options,model:this.#loader.model,grammar:phrases,getCollectionSession:undefined,
                // Routing must see the native candidates even when a narrow stage
                // alone is not a complete application command yet.
                selectHypothesis:async(id,list,options)=>{
                    if(!this.options.selectHypothesis)return list[0];
                    const projected=list.map(h=>({...h,text:[this.#prefix,h.text].filter(Boolean).join(' ')}));
                    return await this.options.selectHypothesis(id,projected,{...options,isFinal:false}) || list[0];
                }});
        }
        async #compile(records){
            this.valuePhrases ||= globalThis.VoskGrammarRouter.valuePhrases();
            if(!globalThis.SpeechGrammarCompiler)return globalThis.VoskPhraseListCompiler.compileStages(records,{valuePhrases:this.valuePhrases});
            this.#compiler ||= new globalThis.SpeechGrammarCompiler({valuePhrases:this.valuePhrases,enabled:this.grammarWorker});
            return this.#compiler.compile(records);
        }
        #grammar(router){
            const stamp=this.getContextVersion(this.#id);
            const key=JSON.stringify([stamp,router.grammar,router.prefix,router.paths?.map(p=>[p.record.pattern,p.record.expect,p.stages.map(s=>[s.grammar,s.capture,s.phrases.length,s.grammar==='commands'?s.phrases:null])])]);
            let pending=this.#prepared.get(key);
            if(!pending){
                pending=this.#lookahead(router).then(phrases=>{const values=[...new Set([...phrases,'[unk]'])];return {phrases:values,key:values.join('\n')};});
                if(this.#prepared.size>=128)this.#prepared.delete(this.#prepared.keys().next().value);
                this.#prepared.set(key,pending);pending.catch(()=>this.#prepared.delete(key));
            }
            return pending;
        }
        async #forecast(router){
            const epoch=this.#epoch,prepared=await this.#grammar(router);
            if(this.#closed||epoch!==this.#epoch)return;
            await this.#pool.prepare(prepared.key,()=>this.#createDecoder(prepared.phrases));
        }
        #scheduleInspection(detail,epoch){
            const run=()=>this.#inspect(detail,epoch);
            if(this.coalescePartials&&!detail.segmentFinal){
                if(this.#partial&&this.#metrics)this.#metrics.coalescedPartials++;
                this.#partial={detail,epoch};
                if(this.#partialQueued)return;
                this.#partialQueued=true;
                this.#analysis=this.#analysis.then(async()=>{const latest=this.#partial;this.#partial=undefined;this.#partialQueued=false;if(latest)await this.#inspect(latest.detail,latest.epoch);});
            }else{
                this.#partial=undefined;
                this.#analysis=this.#analysis.then(run);
            }
            this.#analysis=this.#analysis.catch(error=>{this.#emit('error',{error,message:error.message,fatal:true,utteranceId:this.#id});this.close();});
        }
        async #lockSlots(words,router,final){
            if(!this.ledger||!words.length)return;
            const stamp=this.getContextVersion(this.#id);
            const existing=this.ledger.slots,lastEnd=existing.at(-1)?.endSample || 0;
            words=words.filter(w=>(w.startSample+w.endSample)/2>lastEnd);
            if(!words.length)return;
            // Context-declared stages validate ownership, including incomplete
            // heads. Only the command buffer decides whether to execute them.
            // Bounded digit collectors bypass finite expansion of all possible
            // digit strings. They still declare typed slot ownership.
            const paths=[...(router.paths || []),...(router.digitRecords || []).map(record=>({record,stages:[
                {grammar:'digits',phrases:[]},
                ...(/confirmation/.test(record.pattern)?[{grammar:'commands',phrases:['okay']}]:[])
            ]}))],plans=[];
            const classify=(stage,value,record)=>{
                if(stage.grammar==='commands')return stage.phrases.includes(value)?{status:'valid'}:undefined;
                if(stage.grammar==='digits'&&globalThis.DigitSequence){
                    const digits=globalThis.DigitSequence.parse(value,record.digitVocabulary || {});
                    return digits!==null&&(!record.digitCounts?.length||record.digitCounts.includes(digits.length))?{status:'valid',value:digits}:undefined;
                }
                const result=globalThis.SpeechLanguageController?.classify(value,stage.grammar,{final});
                return result?.status==='valid'?result:stage.phrases.includes(value)?{status:'valid',value}:undefined;
            };
            for(const path of paths){
                const visit=(index,offset,parts)=>{
                    if(plans.length>=32)return;
                    if(offset===words.length){plans.push({path,parts,forecast:path.stages[index]});return;}
                    const stage=path.stages[index];if(!stage)return;
                    for(let end=words.length;end>offset;end--){
                        const selected=words.slice(offset,end),value=selected.map(w=>w.word).join(' '),parsed=classify(stage,value,path.record);
                        if(parsed?.status==='valid')visit(index+1,end,[...parts,{stage,words:selected,text:value,parsed}]);
                    }
                };
                visit(0,0,[]);
            }
            plans.sort((a,b)=>Number(Boolean(b.forecast))-Number(Boolean(a.forecast))||a.parts.length-b.parts.length);
            const plan=plans[0];
            if(!plan)return; // No declared interpretation means no locked slot.
            const record=plan.path.record,context=record.slotContext||record.executionContext||record.digitContext||record.capture||record.id||router.grammar;
            const added=plan.parts.map((part,index)=>{
                const startSample=Math.max(lastEnd,part.words[0].startSample),endSample=part.words.at(-1).endSample;
                const next=plan.parts[index+1]?.stage || (index===plan.parts.length-1?plan.forecast:undefined);
                return {id:part.stage.grammar+':'+startSample,owner:router.grammar,kind:part.stage.grammar,
                    expectedKind:part.stage.grammar,context,text:part.text,value:part.parsed.value,
                    components:part.parsed.components,inferred:part.parsed.inferred,
                    startSample,endSample,state:'sealed',validated:true,commandId:record.id||record.pattern,
                    decoderEpoch:this.#epoch,decoderOriginSample:this.#origin,
                    forecast:next?{kind:next.grammar,context,field:next.capture || null}:undefined};
            });
            const result=await this.ledger.arbitrate(async snapshot=>[...snapshot.slots,...added],{
                isCurrent:()=>stamp===this.getContextVersion(this.#id)
            });
            if(result.committed)this.#emit('slots',{utteranceId:this.#id,stream:this.ledger.stream,slots:result.slots,forecasts:this.ledger.forecasts});
            else this.#emit('slotDiagnostic',{utteranceId:this.#id,reason:result.reason});
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
                if(this.#pool)void this.#forecast(probe).catch(error=>this.#emit('preparationDiagnostic',{message:error.message}));
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
                audioBoundarySample:this.#boundary,streamId:this.ledger?.stream.streamId});
        }
        async #checkpoint(ending){
            for(let turn=0;turn<this.maxHandoffs;turn++){
                this.#setPhase('finalizing');const checkpointStarted=performance.now();
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
                    if(ending)await this.#lockSlots(aligned.words,this.#router,true);
                    this.#publish(aligned.text,ending);
                    if(!ending)await this.#replace(Math.max(this.#buffer.start,this.#boundary-this.overlapSamples),this.#fed);
                    return;
                }
                if(++this.#hops>this.maxHandoffs)throw Error('Too many recognizer handoffs in one utterance.');
                const boundary=consumed?aligned.words[consumed-1].endSample:this.#boundary;
                if(boundary<this.#boundary || boundary>this.#fed)throw Error('Vosk supplied an out-of-range handoff boundary.');
                const from=this.#router.grammar;
                if(consumed)await this.#lockSlots(aligned.words.slice(0,consumed),this.#router,true);
                this.#prefix=next.prefix;this.#router=next;this.#boundary=boundary;
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
                    handoffMilliseconds:performance.now()-checkpointStarted,...this.#lastReplacement});
                this.#metrics?.handoffs.push({from,to:next.grammar,finalizationMilliseconds,analysisMilliseconds,...this.#lastReplacement,totalMilliseconds:performance.now()-checkpointStarted});
                if(!ending)return;
            }
            throw Error('Vosk handoff could not settle its final audio.');
        }
        finishUtterance(id){return this.#enqueue(async()=>{
            if(id!==this.#id)return;
            this.#ending=true;try{await this.#checkpoint(true);}finally{this.#ending=false;}
            this.#emit('metrics',{...this.#metrics,totalMilliseconds:performance.now()-this.#startedAt,delivery:this.audioDelivery,preparation:this.executionDiagnostics});
            this.#epoch++;this.#decoder?.close();this.#decoder=undefined;
            this.#id=undefined;this.#words.clear();this.#setPhase('idle');this.#emit('utteranceEnded',{utteranceId:id});
        });}
        abortUtterance(id){return this.#enqueue(()=>{
            if(id!==this.#id)return;
            this.boundaryAnalyzer.cancel();this.#epoch++;this.#decoder?.close();this.#decoder=undefined;this.#id=undefined;this.#words.clear();this.ledger?.clear();this.#contextCache?.clear();this.#setPhase('idle');
        });}
        close(){this.boundaryAnalyzer.cancel();this.#pool?.close();this.#compiler?.close();this.ledger?.clear();this.#contextCache?.clear();this.#closed=true;this.#epoch++;this.#decoder?.close();this.#loader.close();this.#words.clear();}
    }
    globalThis.VoskContextRecognizer=VoskContextRecognizer;
})();
