/* Browser-owned capture and N-best results. Only SpeechMenu validates commands. */
(() => {
    "use strict";
    const finalResultTimeoutMilliseconds=10000;
    // Owns browser capture lifecycle independently of transcript/command work.
    class BrowserSpeechSession extends EventTarget {
        #Recognition; #options; #native; #closed=false; #started=false; #audio=false;
        #attempts=0; #readyAt=0; #sequence=0; #restartTimer; #startupTimer; #audioEndTimer; #stableTimer;
        #resolve; #reject; #starting; #listeners=[]; #draining=false; #normalRestart=false;
        get listening(){return !this.#closed&&this.#started&&this.#audio;}
        get processing(){return !this.#closed&&(this.#draining||this.#normalRestart);}
        constructor(Recognition,options){
            super();this.#Recognition=Recognition;this.#options=options;
            const bind=(target,type,handler)=>{target?.addEventListener?.(type,handler);this.#listeners.push(()=>target?.removeEventListener?.(type,handler));};
            bind(globalThis.document,'visibilitychange',()=>{if(document.visibilityState==='visible')this.recover('foreground');});
            bind(globalThis,'pageshow',event=>{if(event.persisted)this.recover('page-restored');});
            bind(globalThis,'online',()=>{if(!this.listening)this.recover('online');});
        }
        #emit(type,detail={}){this.dispatchEvent(new CustomEvent(type,{detail}));}
        #status(status,reason){this.#emit('status',{status,reason,captureActive:this.listening,attempt:this.#attempts,sessionId:this.#sequence});}
        start(){
            if(this.#closed)return Promise.reject(Error('Browser speech has been closed.'));
            if(this.listening)return Promise.resolve();
            if(this.#starting)return this.#starting;
            this.#starting=new Promise((resolve,reject)=>{this.#resolve=resolve;this.#reject=reject;});
            this.#open();return this.#starting;
        }
        #open(){
            if(this.#closed)return;
            this.#restartTimer=undefined;this.#started=this.#audio=this.#draining=false;this.#readyAt=0;
            this.#normalRestart=this.#sequence>0&&this.#attempts===0;
            const native=this.#native=new this.#Recognition(),sessionId=++this.#sequence;
            const current=()=>!this.#closed&&this.#native===native;
            Object.assign(native,{lang:this.#options.language,continuous:true,interimResults:true,maxAlternatives:this.#options.maxAlternatives});
            if('processLocally' in native)native.processLocally=this.#options.processLocally;
            this.#status(this.#attempts?'browser-reconnecting':this.#normalRestart?'browser-restarting':'browser-starting','start');
            this.#startupTimer=setTimeout(()=>{if(current())this.recover('startup-timeout');},10000);
            native.onstart=()=>{if(current()){this.#started=true;this.#ready();}};
            native.onaudiostart=()=>{if(current()){this.#audio=true;this.#draining=false;clearTimeout(this.#audioEndTimer);this.#ready();}};
            native.onaudioend=()=>{
                if(!current())return;this.#audio=false;this.#draining=true;this.#status('browser-processing','audio-ended');
                clearTimeout(this.#audioEndTimer);
                // Capture may end before the remote recognizer delivers its result.
                this.#audioEndTimer=setTimeout(()=>{if(current())this.recover('result-drain-timeout');},finalResultTimeoutMilliseconds);
            };
            native.onspeechstart=()=>{if(current())this.#emit('speechStart');};
            native.onspeechend=()=>{if(current())this.#emit('speechEnd');};
            native.onresult=event=>{
                if(!current())return;
                this.#attempts=0;
                // A result from already captured audio does not reopen capture.
                if(!this.#draining){this.#started=this.#audio=true;this.#ready();}
                this.#emit('result',{event,sessionId});
                if(this.#draining&&Array.from(event.results).every(result=>result.isFinal)){
                    clearTimeout(this.#audioEndTimer);
                    // Final text is safely queued; recover only if end is missing.
                    this.#audioEndTimer=setTimeout(()=>{if(current())this.recover('final-result-no-end');},1000);
                }
            };
            native.onnomatch=()=>{if(current())this.#emit('nomatch');};
            native.onerror=event=>{
                if(!current())return;
                const code=event.error||'browser-speech';
                if(['no-speech','aborted','network','audio-capture','timeout'].includes(code))this.recover(code);
                else this.#fail(event.message||'Browser speech recognition failed: '+code,code);
            };
            native.onend=()=>{if(current())this.recover('ended');};
            try{native.start();}catch(error){
                if(error.name==='InvalidStateError'||error.name==='AbortError')this.recover(error.name);
                else this.#fail(error.message,error.name);
            }
        }
        #ready(){
            if(!this.listening)return;
            this.#normalRestart=false;
            clearTimeout(this.#startupTimer);clearTimeout(this.#audioEndTimer);
            if(!this.#readyAt){
                this.#readyAt=Date.now();clearTimeout(this.#stableTimer);
                this.#stableTimer=setTimeout(()=>{this.#attempts=0;},5000);
            }
            this.#resolve?.();this.#resolve=this.#reject=undefined;
            this.#status('browser-listening','capture-active');
        }
        recover(reason){
            if(this.#closed||this.#restartTimer!==undefined)return;
            const stable=this.#readyAt&&Date.now()-this.#readyAt>=5000;
            const normal=['ended','no-speech','final-result-no-end'].includes(reason);
            if(stable||normal)this.#attempts=0;
            else this.#attempts++;
            this.#detach();this.#started=this.#audio=this.#draining=false;this.#normalRestart=normal;
            this.#status(normal?'browser-restarting':'browser-reconnecting',reason);this.#emit('end',{reason,sessionId:this.#sequence});
            if(this.#attempts>6){this.#fail('Browser speech could not resume after repeated interruptions.','recovery-exhausted');return;}
            this.#restartTimer=setTimeout(()=>this.#open(),Math.min(5000,300*2**Math.max(0,this.#attempts-1)));
        }
        stopCapture(){try{this.#native?.stop();}catch{this.recover('stop-failed');}}
        #detach(){
            clearTimeout(this.#startupTimer);clearTimeout(this.#audioEndTimer);clearTimeout(this.#stableTimer);
            const native=this.#native;this.#native=undefined;
            if(!native)return;
            for(const name of ['onstart','onaudiostart','onaudioend','onspeechstart','onspeechend','onresult','onnomatch','onerror','onend'])native[name]=null;
            try{native.abort();}catch{}
        }
        #fail(message,error){
            this.#reject?.(Error(message));this.#resolve=this.#reject=undefined;
            this.#emit('error',{message,error,fatal:true});this.close();
        }
        close(){
            if(this.#closed)return;this.#closed=true;clearTimeout(this.#restartTimer);this.#restartTimer=undefined;
            this.#detach();for(const remove of this.#listeners)remove();this.#listeners=[];
            this.#reject?.(Error('Browser speech startup was canceled.'));this.#resolve=this.#reject=undefined;
        }
    }
    class WebSpeechRecognizer extends EventTarget {
        #session; #id; #queue=Promise.resolve(); #closed=false; #offset=0;
        #snapshot=[]; #finishing; #finalTimer; #selectionTimer; #cancelSelection; #generation=0;
        #speechActive=false; #ignored=false; #processingResults=0;
        #value; #valuePending=false; #valueTimer; #collectionSession;
        get transcriptMode(){return "cumulative";}
        get utteranceId(){return this.#id;}
        get speechActive(){return this.#speechActive;}
        get listening(){return this.#session.listening;}
        get processing(){return this.#session.processing;}
        get processingResult(){return this.#processingResults>0;}
        constructor({language="en-US",maxAlternatives=10,maxCandidates=50,processLocally=false,
            selectHypothesis,getCollectionSession,collectionSilenceMilliseconds=()=>1000,Recognition=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition}={}) {
            super();
            if(typeof Recognition!=="function")throw Error("This browser does not expose SpeechRecognition or webkitSpeechRecognition.");
            if(typeof selectHypothesis!=="function")throw Error("Browser speech requires the command planner's alternative selector.");
            if(!Number.isInteger(maxAlternatives)||maxAlternatives<1||maxAlternatives>30||!Number.isInteger(maxCandidates)||maxCandidates<1||maxCandidates>100)throw Error("Choose 1–30 alternatives and 1–100 combined candidates.");
            this.getCollectionSession=getCollectionSession;this.collectionSilenceMilliseconds=collectionSilenceMilliseconds;
            this.language=language;this.maxAlternatives=maxAlternatives;this.maxCandidates=maxCandidates;this.selectHypothesis=selectHypothesis;
            if(processLocally && !("processLocally" in new Recognition()))throw Error("This browser cannot require local speech processing.");
            const session=this.#session=new BrowserSpeechSession(Recognition,{language,maxAlternatives,processLocally});
            session.addEventListener('status',event=>this.#emit('status',{...event.detail,requestedAlternatives:maxAlternatives,processLocally}));
            session.addEventListener('error',event=>this.#fail(event.detail.message,event.detail.error));
            session.addEventListener('speechStart',()=>this.#activity(true));
            session.addEventListener('speechEnd',()=>this.#activity(false));
            session.addEventListener('nomatch',()=>{if(this.#id!==undefined)this.#complete('',true);});
            session.addEventListener('result',({detail:{event,sessionId}})=>{
                if(this.#closed)return;
                const results=Array.from(event.results,result=>({isFinal:result.isFinal,
                    alternatives:Array.from(result).slice(0,maxAlternatives).map((value,rank)=>({text:String(value.transcript||'').trim(),confidence:Number(value.confidence)||0,rank}))}));
                const generation=this.#generation,receivedAt=Date.now();
                this.#queue=this.#queue.then(()=>generation===this.#generation&&!this.#closed?this.#processResult(results,receivedAt,sessionId):undefined).catch(error=>{
                    if(error.code==='selection-timeout'){
                        this.#generation++;this.#queue=Promise.resolve();this.#complete('',true);this.#session.recover(error.code);
                    }else this.#fail(error.message);
                });
            });
            session.addEventListener('end',()=>{
                this.#speechActive=false;
                const generation=this.#generation;
                this.#queue=this.#queue.then(()=>{
                    if(this.#closed||generation!==this.#generation)return;
                    if(this.#valuePending&&this.#value?.segments.some(segment=>!segment.final&&!segment.sealed)){
                        // Capture cannot revise its last accepted interim after
                        // end. Retain it across restart, but still await the
                        // logical value's silence/command boundary.
                        this.#value.sealCapture();this.#armValueSilence();
                    }
                    if(this.#id!==undefined&&!this.#valuePending)this.#complete('',true);
                    this.#offset=0;this.#snapshot=[];this.#ignored=false;
                }).catch(error=>this.#fail(error.message));
            });
        }
        #emit(type,detail){this.dispatchEvent(new CustomEvent(type,{detail}));}
        #activity(active){if(this.#closed)return;if(active)this.#cancelValueSilence();this.#speechActive=active;this.#emit(active?"speechStart":"speechEnd",{});}
        start(){return this.#session.start();}
        beginUtterance(id){this.#id=id;}
        accept(){/* Browser capture supplies its own audio; no PCM substitution. */}
        async #processResult(results,receivedAt,sessionId){
            this.#processingResults++;
            try{return await this.#result(results,receivedAt,sessionId);}
            finally{this.#processingResults--;}
        }
        async #result(results,receivedAt=Date.now(),sessionId=0){
            if(results.length-this.#offset>64)throw Error("Browser speech pending results exceeded their bound.");
            this.#snapshot=results;
            const pending=results.slice(this.#offset);if(!pending.length)return;
            this.#cancelValueSilence();
            const isFinal=pending.every(result=>result.isFinal);
            if(this.#ignored){if(isFinal){this.#offset=results.length;this.#ignored=false;}return;}
            if(this.#id===undefined)this.#activity(true);
            if(this.#id===undefined){if(isFinal){this.#offset=results.length;this.#ignored=false;}return;}
            const id=this.#id;
            const owner=this.getCollectionSession?.(id);
            this.#value ??= owner?.valueCollector('browser-segments',{id}) || new globalThis.SpeechValueCollector({id});
            this.#collectionSession=this.#value.continuation;
            let candidates=[{text:"",rank:0,maxRank:0,confidence:1,segments:[]}];
            for(const [index,result] of pending.entries()){
                candidates=candidates.flatMap(prefix=>result.alternatives.filter(value=>value.text).map(value=>({
                    text:[prefix.text,value.text].filter(Boolean).join(" "),
                    segments:[...prefix.segments,{id:`${sessionId}:${this.#offset+index}`,text:value.text,final:result.isFinal}],rank:prefix.rank+value.rank,
                    maxRank:Math.max(prefix.maxRank,value.rank),
                    confidence:Math.min(prefix.confidence,value.confidence)
                }))).filter(value=>value.text.length<=2048).sort((a,b)=>a.rank-b.rank||b.confidence-a.confidence).slice(0,this.maxCandidates);
            }
            candidates=candidates.map(candidate=>({...candidate,text:this.#value.project(candidate.segments)})).filter(candidate=>candidate.text.length<=2048);
            // Preserve rank order while deduplicating equivalent hypotheses.
            const unique=new Map();
            for(const candidate of candidates)if(!unique.has(candidate.text))unique.set(candidate.text,candidate);
            candidates=[...unique.values()];
            this.#emit("alternatives",{utteranceId:id,isFinal,requested:this.maxAlternatives,returned:pending.map(result=>result.alternatives.length),candidates});
            const selectionStartedAt=Date.now();
            let selected;
            try{
                selected=await Promise.race([this.selectHypothesis(id,candidates,{isFinal}),new Promise((_,reject)=>{
                    this.#cancelSelection=reject;
                    this.#selectionTimer=setTimeout(()=>reject(Object.assign(Error('Browser speech selection timed out.'),{code:'selection-timeout'})),10000);
                })]);
            }finally{clearTimeout(this.#selectionTimer);this.#cancelSelection=undefined;}

            if(this.#closed||this.#id!==id)return;
            this.#emit('resultTiming',{utteranceId:id,isFinal,accepted:Boolean(selected),
                receivedAt,queueMilliseconds:selectionStartedAt-receivedAt,
                selectionMilliseconds:Date.now()-selectionStartedAt});
            if(selected?.segments){
                this.#value.update(selected.segments);
                this.#value.classify=(_text,{final})=>({status:final&&selected.valueStatus==='incomplete'?'malformed':selected.valueStatus||'valid',value:selected.text});
                this.#value.evaluate({canContinue:Boolean(selected.collectingValue)});
            }
            this.#valuePending=Boolean(selected?.collectingValue);
            if(isFinal)this.#offset=results.length;
            if(this.#valuePending){
                this.#emit("transcript",{utteranceId:id,transcript:selected.text,isFinal:false,segmentFinal:isFinal});
                if(isFinal)this.#armValueSilence();
            }else if(isFinal)this.#complete(selected?.text||"",!selected);
            else if(selected)this.#emit("transcript",{utteranceId:id,transcript:selected.text,isFinal:false});
        }
        #cancelValueSilence(){
            clearTimeout(this.#valueTimer);this.#valueTimer=undefined;
            if(this.#valuePending)this.#collectionSession?.cancelSilence();
        }
        #armValueSilence(){
            const id=this.#id;
            const delay=this.collectionSilenceMilliseconds();
            if(!Number.isFinite(delay)||delay<0)throw RangeError('Value silence must be a nonnegative number.');
            const expire=()=>{
                this.#queue=this.#queue.then(()=>{if(this.#id===id&&this.#valuePending)this.#complete(this.#value.transcript);});
            };
            if(this.#collectionSession)this.#collectionSession.armSilence(delay,expire);
            else this.#valueTimer=setTimeout(expire,delay);
        }
        #complete(text,rejected=false){
            const id=this.#id;if(id===undefined)return;
            this.#cancelValueSilence();this.#value?.complete();this.#value=undefined;this.#valuePending=false;this.#collectionSession=undefined;
            clearTimeout(this.#finalTimer);this.#id=undefined;this.#speechActive=false;
            this.#emit("transcript",{utteranceId:id,transcript:text,isFinal:true,rejected});
            this.#emit("utteranceEnded",{utteranceId:id,transcript:text});this.#finishing?.();this.#finishing=undefined;
        }
        finishUtterance(id){
            if(this.#closed||this.#id!==id)return Promise.resolve();
            if(this.#valuePending&&this.#snapshot.every(result=>result.isFinal)){
                return this.#queue=this.#queue.then(()=>{if(this.#id===id)this.#complete(this.#value.transcript);});
            }
            return new Promise(resolve=>{
                this.#finishing=resolve;
                this.#finalTimer=setTimeout(()=>{if(this.#id===id){this.#complete('',true);this.#session.recover('final-timeout');}},finalResultTimeoutMilliseconds);
                this.#session.stopCapture();
            });
        }
        abortUtterance(id){if(this.#id!==id)return;this.#cancelValueSilence();this.#value?.cancel();this.#value=undefined;this.#valuePending=false;this.#id=undefined;this.#offset=this.#snapshot.length;clearTimeout(this.#finalTimer);this.#finishing?.();this.#finishing=undefined;}
        ignoreUtterance(){this.#ignored=true;}
        #fail(message,code="browser-speech"){
            const id=this.#id;this.#emit("error",{utteranceId:id,message,error:code,fatal:true});this.close();
        }
        close(){
            if(this.#closed)return;this.#cancelValueSilence();this.#value?.cancel();this.#value=undefined;this.#valuePending=false;this.#closed=true;this.#generation++;this.#id=undefined;
            clearTimeout(this.#finalTimer);clearTimeout(this.#selectionTimer);
            this.#cancelSelection?.(Error('Browser speech selection was canceled.'));this.#cancelSelection=undefined;
            this.#finishing?.();this.#finishing=undefined;this.#session.close();
        }
    }
    globalThis.WebSpeechRecognizer=WebSpeechRecognizer;
})();
