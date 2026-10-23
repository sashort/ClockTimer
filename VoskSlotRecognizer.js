/* Parallel context decoders share one model and capture. They never execute
 * commands. Sample-addressed slots are arbitrated against SpeechMenu's planner. */
(() => {
    'use strict';
    const kinds=['commands','time','duration','number','digits','date'];
    const normalize=text=>globalThis.SpeechGrammarContext.normalize(text);
    const unique=values=>[...new Set(values)];
    let streams=0;
    class VoskSlotRecognizer extends EventTarget {
        #loader; #decoders=new Map(); #queue=Promise.resolve(); #analysis=Promise.resolve();
        #closed=false; #id; #epoch=0; #received=0; #submitted=0; #origin=0;
        #dirty=false; #scheduled=false; #ending=false; #records=[]; #last=''; #startedAt=0;
        #metrics; #inputAt=0;
        constructor({contextProvider,vocabularyProvider,selectHypothesis,valuePhrases,getContextVersion=()=>0,
            maxQueuedAudioSeconds=30,maxCommands=32,...options}={}) {
            super();
            if(typeof contextProvider!=='function'||typeof selectHypothesis!=='function')
                throw TypeError('Parallel slots require context and command validation.');
            Object.assign(this,{contextProvider,vocabularyProvider,selectHypothesis,valuePhrases,getContextVersion,maxCommands,options});
            this.sampleRate=options.sampleRate||16000;
            this.maxQueuedSamples=Math.ceil(maxQueuedAudioSeconds*this.sampleRate);
            this.ledger=new globalThis.SpeechRecognitionLedger({streamId:'vosk-slots-'+(++streams),sampleRate:this.sampleRate,sampleFormat:'float32'});
            this.#loader=new globalThis.VoskRecognizer(options);
            this.#loader.addEventListener('status',e=>this.#emit('status',e.detail));
            this.ready=this.#loader.ready.then(()=>this);
        }
        get recognitionMode(){return "parallel";}
        get continuousInput(){return true;}
        get transcriptMode(){return 'cumulative';}
        get audioDelivery(){return {receivedSamples:this.#received,submittedSamples:this.#submitted,
            queuedSamples:this.#received-this.#submitted,decoderCount:this.#decoders.size,replayedSamples:0};}
        get slots(){return this.ledger.slots;}
        #emit(type,detail){if(!this.#closed)this.dispatchEvent(new CustomEvent(type,{detail}));}
        #enqueue(fn){const work=this.#queue.then(()=>this.#closed?false:fn());this.#queue=work.catch(error=>this.#fail(error));return work;}
        #fail(error){if(this.#closed)return;this.#emit('error',{error,message:error.message,fatal:true,utteranceId:this.#id});this.close();}
        beginUtterance(id){return this.#enqueue(async()=>{
            await this.ready;
            if(this.#id!==undefined)throw Error('Previous slot utterance has not settled.');
            this.#id=id;this.#epoch++;this.#origin=this.#submitted;this.#last='';this.#ending=false;
            this.#records=(await this.contextProvider(id,''))?.records||[];
            this.ledger.begin(id);this.#startedAt=performance.now();
            this.#metrics={mode:'parallel',utteranceId:id,firstCandidateMilliseconds:null,firstSlotMilliseconds:null,
                arbitrationMilliseconds:0,arbitrationPasses:0,stalePasses:0,peakQueuedSamples:0};
            const values=this.valuePhrases ||= globalThis.VoskGrammarRouter.valuePhrases();
            const records=this.vocabularyProvider?await this.vocabularyProvider():this.#records;
            const compiled=globalThis.VoskPhraseListCompiler.compileStages(records,{valuePhrases:values});
            const literals=unique(compiled.paths.flatMap(path=>path.stages.filter(s=>s.grammar==='commands').flatMap(s=>s.phrases)));
            const grammar={...values,commands:literals};
            const epoch=this.#epoch,ledgerEpoch=this.ledger.epoch,origin=this.#origin;
            for(const owner of kinds){
                if(!grammar[owner]?.length)continue;
                // All decoders start at the SAME stream position and receive
                // every subsequent sample. None waits for a context handoff.
                const decoder=new globalThis.VoskRecognizer({...this.options,model:this.#loader.model,
                    grammar:unique([...grammar[owner],'[unk]']),selectHypothesis:undefined,getCollectionSession:undefined});
                this.#decoders.set(owner,decoder);
                decoder.addEventListener('error',e=>{if(epoch===this.#epoch)this.#fail(e.detail.error||Error(e.detail.message));});
                decoder.addEventListener('alternatives',e=>{if(epoch===this.#epoch)this.#emit('alternatives',{
                    ...e.detail,recognitionContext:owner,decoderEpoch:epoch,streamId:this.ledger.stream.streamId});});
                decoder.addEventListener('transcript',e=>{
                    if(this.#closed||epoch!==this.#epoch)return;
                    const d=e.detail,segment=d.segments?.at(-1);
                    if(!segment)return;
                    const convert=words=>Array.isArray(words)?words.filter(w=>Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.end>w.start)
                        .map(w=>({...w,word:normalize(w.word),startSample:origin+Math.round(w.start*this.sampleRate),endSample:origin+Math.round(w.end*this.sampleRate)})):undefined;
                    const words=convert(d.words);
                    const changed=this.ledger.submit(owner,{segmentId:segment.id,text:segment.text,words,final:segment.final,
                        hypotheses:(d.hypotheses||[]).map(h=>({...h,words:convert(h.words)}))},ledgerEpoch);
                    this.#metrics.firstCandidateMilliseconds??=performance.now()-this.#startedAt;
                    this.#emit('candidate',{utteranceId:id,owner,text:segment.text,position:words?.length?this.ledger.position(words[0].startSample,words.at(-1).endSample):null,
                        timed:Boolean(words?.length),final:segment.final});
                    if(changed){this.#dirty=true;if(!this.#ending)this.#schedule();}
                });
            }
            await Promise.all([...this.#decoders.values()].map(d=>d.beginUtterance(id)));
        });}
        accept(id,samples){return this.#accept(id,samples);}
        acceptAudio(samples){return this.#accept(undefined,samples);}
        #accept(id,samples){
            if(this.#closed)return Promise.resolve(false);
            const pcm=new Float32Array(samples),end=this.#received+pcm.length;this.#received=end;this.#inputAt=performance.now();
            if(end-this.#submitted>this.maxQueuedSamples){this.#fail(Error('Parallel recognition audio backlog exceeded its limit.'));return Promise.resolve(false);}
            if(this.#metrics)this.#metrics.peakQueuedSamples=Math.max(this.#metrics.peakQueuedSamples,end-this.#submitted);
            return this.#enqueue(async()=>{
                if(id!==undefined&&id!==this.#id){this.#submitted=end;return false;}
                await Promise.all([...this.#decoders.values()].map(d=>d.accept(this.#id,pcm)));
                this.#submitted=end;return true;
            });
        }
        #schedule(){
            if(this.#scheduled||this.#closed)return;
            this.#scheduled=true;
            this.#analysis=this.#analysis.then(async()=>{
                while(this.#dirty&&!this.#closed&&!this.#ending){this.#dirty=false;await this.#arbitrate(false);if(this.#dirty)await new Promise(resolve=>setTimeout(resolve,0));}
            }).catch(e=>this.#fail(e)).finally(()=>{this.#scheduled=false;if(this.#dirty&&!this.#ending)this.#schedule();});
        }
        #wordLists(source){
            if(!source)return [];
            const segments=source.segments,primary=segments.flatMap(s=>s.words||[]);
            const lists=[primary];
            const last=segments.at(-1);
            if(last)for(const alternative of last.hypotheses||[]){
                if(alternative.words?.length)lists.push([...segments.slice(0,-1).flatMap(s=>s.words||[]),...alternative.words]);
            }
            const seen=new Set();return lists.filter(words=>{const key=JSON.stringify(words.map(w=>[w.word,w.startSample,w.endSample]));if(seen.has(key))return false;seen.add(key);return words.length;});
        }
        #matches(stage,source,cursor,record,ending){
            const found=[],seen=new Set();
            for(const words of this.#wordLists(source)){
                const tail=words.filter(w=>(w.startSample+w.endSample)/2>cursor).slice(0,32);
                for(let length=1;length<=tail.length;length++){
                    const selected=tail.slice(0,length),text=selected.map(w=>w.word).join(' ');
                    if(text.includes('[unk]'))break;
                    let value,components,inferred;
                    if(stage.grammar==='commands'){
                        if(!stage.phrases.includes(text))continue;
                    }else if(stage.grammar==='digits'){
                        value=globalThis.DigitSequence?.parse(text,record.digitVocabulary||{});
                        if(value===null||value===undefined||record.digitCounts?.length&&!record.digitCounts.includes(value.length))continue;
                    }else{
                        const result=globalThis.SpeechLanguageController?.classify(text,stage.grammar,{final:ending});
                        if(result?.status!=='valid')continue;
                        ({value,components,inferred}=result);
                    }
                    const startSample=Math.max(cursor,selected[0].startSample),endSample=selected.at(-1).endSample;
                    if(endSample<=startSample)continue;
                    const key=text+'|'+startSample+'|'+endSample;if(seen.has(key))continue;seen.add(key);
                    found.push({text,startSample,endSample,value,components,inferred,owner:stage.grammar,kind:stage.grammar});
                }
            }
            return found.sort((a,b)=>b.endSample-a.endSample).slice(0,16);
        }
        async #resolve(snapshot,ending){
            const sources=new Map(snapshot.sources.map(s=>[s.owner,s]));
            let prefix='',cursor=this.#origin,records=this.#records,slots=[];
            for(let command=0;command<this.maxCommands;command++){
                const compiled=globalThis.VoskPhraseListCompiler.compileStages(records,{valuePhrases:this.valuePhrases});
                const proposals=[];
                const visit=(path,index,at,parts)=>{
                    if(index===path.stages.length){proposals.push({path,parts,text:parts.map(p=>p.text).join(' '),endSample:at,complete:true});return;}
                    const stage=path.stages[index];
                    if(parts.length&&parts.every(p=>p.kind==='commands')&&stage.grammar!=='commands')
                        proposals.push({path,parts,text:parts.map(p=>p.text).join(' '),endSample:at,complete:false});
                    for(const match of this.#matches(stage,sources.get(stage.grammar),at,path.record,ending)){
                        visit(path,index+1,match.endSample,[...parts,match]);if(proposals.length>=128)return;
                    }
                };
                const paths=[...compiled.paths].sort((a,b)=>(b.stages[0]?.grammar==='commands')-(a.stages[0]?.grammar==='commands'));
                for(const path of paths){visit(path,0,cursor,[]);if(proposals.length>=128)break;}
                proposals.sort((a,b)=>b.endSample-a.endSample||Number(b.complete)-Number(a.complete)||b.parts.filter(p=>p.kind==='commands').length-a.parts.filter(p=>p.kind==='commands').length);
                let winner;
                for(const proposal of proposals){
                    if(!ending&&proposal.parts.length===1&&proposal.parts[0].kind==='commands'&&compiled.paths.some(path=>
                        path.stages[0]?.grammar==='commands'&&path.stages[0].phrases.some(p=>p.startsWith(proposal.text+' '))))continue;
                    const text=[prefix,proposal.text].filter(Boolean).join(' ');
                    const validated=await this.selectHypothesis(this.#id,[{index:0,text}],{isFinal:ending,afterBarrier:true});
                    if(validated){winner=proposal;break;}
                }
                if(!winner)break;
                const record=winner.path.record;
                const context=record.executionContext||record.digitContext||record.nextContext||record.capture||record.id||'command';
                for(const part of winner.parts)slots.push({...part,id:part.owner+':'+part.startSample,context,
                    commandId:record.id||record.pattern,validated:true,state:ending?'sealed':'locked'});
                prefix=[prefix,winner.text].filter(Boolean).join(' ');cursor=winner.endSample;
                if(!winner.complete)break;
                const next=await this.contextProvider(this.#id,prefix);records=next?.records||[];
                if(!records.length)break;
            }
            return {slots,text:prefix};
        }
        async #arbitrate(ending){
            const epoch=this.#epoch,snapshot=this.ledger.snapshot(),start=performance.now(),contextVersion=this.getContextVersion();
            const result=await this.#resolve(snapshot,ending);
            if(this.#closed||epoch!==this.#epoch)return;
            if(contextVersion!==this.getContextVersion()){
                this.#metrics.stalePasses++;if(!ending)this.#dirty=true;return;
            }
            const committed=this.ledger.commit(snapshot,result.slots);
            this.#metrics.arbitrationMilliseconds+=performance.now()-start;this.#metrics.arbitrationPasses++;
            if(!committed.committed){this.#metrics.stalePasses++;if(!ending&&committed.reason==='stale-candidates')this.#dirty=true;return;}
            if(committed.slots.length)this.#metrics.firstSlotMilliseconds??=performance.now()-this.#startedAt;
            this.#emit('slots',{utteranceId:this.#id,stream:this.ledger.stream,slots:committed.slots,revision:snapshot.revision});
            if(result.text!==this.#last||ending){this.#last=result.text;this.#emit('transcript',{
                utteranceId:this.#id,transcript:result.text,isFinal:ending,recognitionContext:'parallel-slots',decoderEpoch:epoch,
                slots:committed.slots,streamId:this.ledger.stream.streamId});}
        }
        finishUtterance(id){return this.#enqueue(async()=>{
            if(id!==this.#id)return;
            this.#ending=true;await Promise.all([...this.#decoders.values()].map(d=>d.finishUtterance(id)));
            await this.#analysis;await this.#arbitrate(true);
            this.#emit('metrics',{...this.#metrics,decoderCount:this.#decoders.size,totalMilliseconds:performance.now()-this.#startedAt,
                inputDrainMilliseconds:performance.now()-this.#inputAt,audioDurationMilliseconds:(this.#submitted-this.#origin)/this.sampleRate*1000,
                delivery:this.audioDelivery});
            this.#retire();this.#emit('utteranceEnded',{utteranceId:id});
        });}
        #retire(){this.#epoch++;for(const d of this.#decoders.values())d.close();this.#decoders.clear();this.#id=undefined;this.#dirty=false;}
        abortUtterance(id){return this.#enqueue(()=>{if(id===this.#id){this.#retire();this.ledger.clear();}});}
        close(){if(this.#closed)return;this.#closed=true;this.#retire();this.ledger.clear();this.#loader.close();}
    }
    globalThis.VoskSlotRecognizer=VoskSlotRecognizer;
})();
