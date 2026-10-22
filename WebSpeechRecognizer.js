/* Browser-owned capture and N-best results. Only SpeechMenu validates commands. */
(() => {
    "use strict";
    // Owns browser capture lifecycle independently of transcript/command work.
    class BrowserSpeechSession extends EventTarget {
        #Recognition; #options; #native; #closed=false; #started=false; #audio=false;
        #attempts=0; #readyAt=0; #sequence=0; #restartTimer; #startupTimer; #audioEndTimer; #stableTimer;
        #resolve; #reject; #starting; #listeners=[];
        get listening(){return !this.#closed&&this.#started&&this.#audio;}
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
            this.#restartTimer=undefined;this.#started=this.#audio=false;this.#readyAt=0;
            const native=this.#native=new this.#Recognition(),sessionId=++this.#sequence;
            const current=()=>!this.#closed&&this.#native===native;
            Object.assign(native,{lang:this.#options.language,continuous:true,interimResults:true,maxAlternatives:this.#options.maxAlternatives});
            if('processLocally' in native)native.processLocally=this.#options.processLocally;
            this.#status(this.#attempts?'browser-reconnecting':'browser-starting','start');
            this.#startupTimer=setTimeout(()=>{if(current())this.recover('startup-timeout');},10000);
            native.onstart=()=>{if(current()){this.#started=true;this.#ready();}};
            native.onaudiostart=()=>{if(current()){this.#audio=true;clearTimeout(this.#audioEndTimer);this.#ready();}};
            native.onaudioend=()=>{
                if(!current())return;this.#audio=false;this.#status('browser-reconnecting','audio-ended');
                clearTimeout(this.#audioEndTimer);
                // Some browser interruptions omit end. Do not wait forever for it.
                this.#audioEndTimer=setTimeout(()=>{if(current())this.recover('audio-ended');},1000);
            };
            native.onspeechstart=()=>{if(current())this.#emit('speechStart');};
            native.onspeechend=()=>{if(current())this.#emit('speechEnd');};
            native.onresult=event=>{
                if(!current())return;
                this.#started=this.#audio=true;this.#attempts=0;this.#ready();
                this.#emit('result',{event,sessionId});
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
            if(stable||reason==='no-speech')this.#attempts=0;
            else this.#attempts++;
            this.#detach();this.#started=this.#audio=false;
            this.#status('browser-reconnecting',reason);this.#emit('end',{reason,sessionId:this.#sequence});
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
        get transcriptMode(){return "cumulative";}
        get speechActive(){return this.#speechActive;}
        get listening(){return this.#session.listening;}
        get processingResult(){return this.#processingResults>0;}
        constructor({language="en-US",maxAlternatives=10,maxCandidates=50,processLocally=false,
            selectHypothesis,Recognition=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition}={}) {
            super();
            if(typeof Recognition!=="function")throw Error("This browser does not expose SpeechRecognition or webkitSpeechRecognition.");
            if(typeof selectHypothesis!=="function")throw Error("Browser speech requires the command planner's alternative selector.");
            if(!Number.isInteger(maxAlternatives)||maxAlternatives<1||maxAlternatives>30||!Number.isInteger(maxCandidates)||maxCandidates<1||maxCandidates>100)throw Error("Choose 1–30 alternatives and 1–100 combined candidates.");
            this.language=language;this.maxAlternatives=maxAlternatives;this.maxCandidates=maxCandidates;this.selectHypothesis=selectHypothesis;
            if(processLocally && !("processLocally" in new Recognition()))throw Error("This browser cannot require local speech processing.");
            const session=this.#session=new BrowserSpeechSession(Recognition,{language,maxAlternatives,processLocally});
            session.addEventListener('status',event=>this.#emit('status',{...event.detail,requestedAlternatives:maxAlternatives,processLocally}));
            session.addEventListener('error',event=>this.#fail(event.detail.message,event.detail.error));
            session.addEventListener('speechStart',()=>this.#activity(true));
            session.addEventListener('speechEnd',()=>this.#activity(false));
            session.addEventListener('nomatch',()=>{if(this.#id!==undefined)this.#complete('',true);});
            session.addEventListener('result',({detail:{event}})=>{
                if(this.#closed)return;
                const results=Array.from(event.results,result=>({isFinal:result.isFinal,
                    alternatives:Array.from(result).slice(0,maxAlternatives).map((value,rank)=>({text:String(value.transcript||'').trim(),confidence:Number(value.confidence)||0,rank}))}));
                const generation=this.#generation,receivedAt=Date.now();
                this.#queue=this.#queue.then(()=>generation===this.#generation&&!this.#closed?this.#processResult(results,receivedAt):undefined).catch(error=>{
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
                    if(this.#id!==undefined)this.#complete('',true);
                    this.#offset=0;this.#snapshot=[];this.#ignored=false;
                }).catch(error=>this.#fail(error.message));
            });
        }
        #emit(type,detail){this.dispatchEvent(new CustomEvent(type,{detail}));}
        #activity(active){if(this.#closed)return;this.#speechActive=active;this.#emit(active?"speechStart":"speechEnd",{});}
        start(){return this.#session.start();}
        beginUtterance(id){this.#id=id;}
        accept(){/* Browser capture supplies its own audio; no PCM substitution. */}
        async #processResult(results,receivedAt){
            this.#processingResults++;
            try{return await this.#result(results,receivedAt);}
            finally{this.#processingResults--;}
        }
        async #result(results,receivedAt=Date.now()){
            if(results.length-this.#offset>64)throw Error("Browser speech pending results exceeded their bound.");
            this.#snapshot=results;
            const pending=results.slice(this.#offset);if(!pending.length)return;
            const isFinal=pending.every(result=>result.isFinal);
            if(this.#ignored){if(isFinal){this.#offset=results.length;this.#ignored=false;}return;}
            if(this.#id===undefined)this.#activity(true);
            if(this.#id===undefined){if(isFinal){this.#offset=results.length;this.#ignored=false;}return;}
            const id=this.#id;
            let candidates=[{text:"",rank:0,maxRank:0,confidence:1}];
            for(const result of pending){
                candidates=candidates.flatMap(prefix=>result.alternatives.filter(value=>value.text).map(value=>({
                    text:[prefix.text,value.text].filter(Boolean).join(" "),rank:prefix.rank+value.rank,
                    maxRank:Math.max(prefix.maxRank,value.rank),
                    confidence:Math.min(prefix.confidence,value.confidence)
                }))).filter(value=>value.text.length<=2048).sort((a,b)=>a.rank-b.rank||b.confidence-a.confidence).slice(0,this.maxCandidates);
            }
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
            if(isFinal){this.#offset=results.length;this.#complete(selected?.text||"",!selected);}
            else if(selected)this.#emit("transcript",{utteranceId:id,transcript:selected.text,isFinal:false});
        }
        #complete(text,rejected=false){
            const id=this.#id;if(id===undefined)return;
            clearTimeout(this.#finalTimer);this.#id=undefined;this.#speechActive=false;
            this.#emit("transcript",{utteranceId:id,transcript:text,isFinal:true,rejected});
            this.#emit("utteranceEnded",{utteranceId:id,transcript:text});this.#finishing?.();this.#finishing=undefined;
        }
        finishUtterance(id){
            if(this.#closed||this.#id!==id)return Promise.resolve();
            return new Promise(resolve=>{
                this.#finishing=resolve;
                this.#finalTimer=setTimeout(()=>{if(this.#id===id){this.#complete('',true);this.#session.recover('final-timeout');}},7000);
                this.#session.stopCapture();
            });
        }
        abortUtterance(id){if(this.#id!==id)return;this.#id=undefined;this.#offset=this.#snapshot.length;clearTimeout(this.#finalTimer);this.#finishing?.();this.#finishing=undefined;}
        ignoreUtterance(){this.#ignored=true;}
        #fail(message,code="browser-speech"){
            const id=this.#id;this.#emit("error",{utteranceId:id,message,error:code,fatal:true});this.close();
        }
        close(){
            if(this.#closed)return;this.#closed=true;this.#generation++;this.#id=undefined;
            clearTimeout(this.#finalTimer);clearTimeout(this.#selectionTimer);
            this.#cancelSelection?.(Error('Browser speech selection was canceled.'));this.#cancelSelection=undefined;
            this.#finishing?.();this.#finishing=undefined;this.#session.close();
        }
    }
    globalThis.WebSpeechRecognizer=WebSpeechRecognizer;
})();
