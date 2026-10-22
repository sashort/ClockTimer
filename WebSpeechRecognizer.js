/* Browser-owned capture and N-best results. Only SpeechMenu validates commands. */
(() => {
    "use strict";
    class WebSpeechRecognizer extends EventTarget {
        #native; #id; #queue=Promise.resolve(); #closed=false; #offset=0;
        #snapshot=[]; #finishing; #finalTimer; #restartTimer; #generation=0;
        #speechActive=false; #startResolve; #startReject; #startupTimer; #started=false; #ignored=false;
        get transcriptMode(){return "cumulative";}
        get speechActive(){return this.#speechActive;}
        constructor({language="en-US",maxAlternatives=10,maxCandidates=50,processLocally=false,
            selectHypothesis,Recognition=globalThis.SpeechRecognition||globalThis.webkitSpeechRecognition}={}) {
            super();
            if(typeof Recognition!=="function")throw Error("This browser does not expose SpeechRecognition or webkitSpeechRecognition.");
            if(typeof selectHypothesis!=="function")throw Error("Browser speech requires the command planner's alternative selector.");
            if(!Number.isInteger(maxAlternatives)||maxAlternatives<1||maxAlternatives>30||!Number.isInteger(maxCandidates)||maxCandidates<1||maxCandidates>100)throw Error("Choose 1–30 alternatives and 1–100 combined candidates.");
            this.language=language;this.maxAlternatives=maxAlternatives;this.maxCandidates=maxCandidates;this.selectHypothesis=selectHypothesis;
            const native=this.#native=new Recognition();native.lang=language;native.continuous=true;native.interimResults=true;native.maxAlternatives=maxAlternatives;
            if(processLocally && !("processLocally" in native))throw Error("This browser cannot require local speech processing.");
            if("processLocally" in native)native.processLocally=processLocally;
            native.onstart=()=>{if(this.#closed)return;this.#started=true;clearTimeout(this.#startupTimer);this.#startResolve?.();this.#startResolve=this.#startReject=undefined;this.#emit("status",{status:"browser-listening",requestedAlternatives:maxAlternatives,processLocally});};
            native.onspeechstart=()=>this.#activity(true);
            native.onspeechend=()=>this.#activity(false);
            native.onresult=event=>{
                if(this.#closed)return;
                // Snapshot mutable browser lists; rebuilding from the current
                // list also handles interim replacements and removals.
                const results=Array.from(event.results,result=>({isFinal:result.isFinal,
                    alternatives:Array.from(result).slice(0,maxAlternatives).map((value,rank)=>({text:String(value.transcript||"").trim(),confidence:Number(value.confidence)||0,rank}))}));
                const generation=this.#generation;
                this.#queue=this.#queue.then(()=>generation===this.#generation&&!this.#closed?this.#result(results):undefined).catch(error=>this.#fail(error.message));
            };
            native.onnomatch=()=>{if(this.#id!==undefined)this.#complete("",true);};
            native.onerror=event=>{
                if(this.#closed||event.error==="aborted")return;
                if(event.error==="no-speech"){if(this.#id!==undefined)this.#complete("",true);return;}
                this.#fail(event.message||"Browser speech recognition failed: "+event.error,event.error);
            };
            native.onend=()=>{
                this.#started=false;this.#speechActive=false;
                const generation=this.#generation;
                this.#queue=this.#queue.then(()=>{
                    if(this.#closed||generation!==this.#generation)return;
                    if(this.#id!==undefined)this.#complete("",true);
                    this.#offset=0;this.#snapshot=[];this.#ignored=false;
                    this.#restartTimer=setTimeout(()=>{if(!this.#closed){try{native.start();}catch(error){this.#fail(error.message);}}},300);
                }).catch(error=>this.#fail(error.message));
            };
        }
        #emit(type,detail){this.dispatchEvent(new CustomEvent(type,{detail}));}
        #activity(active){if(this.#closed)return;this.#speechActive=active;this.#emit(active?"speechStart":"speechEnd",{});}
        start(){
            if(this.#closed)return Promise.reject(Error("Browser speech has been closed."));
            return new Promise((resolve,reject)=>{
                this.#startResolve=resolve;this.#startReject=reject;
                this.#startupTimer=setTimeout(()=>this.#fail("Browser speech startup timed out."),10000);
                try{this.#native.start();}catch(error){this.#fail(error.message);}
            });
        }
        beginUtterance(id){this.#id=id;}
        accept(){/* Browser capture supplies its own audio; no PCM substitution. */}
        async #result(results){
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
            const selected=await this.selectHypothesis(id,candidates,{isFinal});
            if(this.#closed||this.#id!==id)return;
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
                this.#finalTimer=setTimeout(()=>{if(this.#id===id)this.#fail("Browser speech did not deliver a final result.");},7000);
                try{this.#native.stop();}catch(error){this.#fail(error.message);}
            });
        }
        abortUtterance(id){if(this.#id!==id)return;this.#id=undefined;this.#offset=this.#snapshot.length;clearTimeout(this.#finalTimer);this.#finishing?.();this.#finishing=undefined;}
        ignoreUtterance(){this.#ignored=true;}
        #fail(message,code="browser-speech"){
            const id=this.#id;this.#startReject?.(Error(message));this.#emit("error",{utteranceId:id,message,error:code,fatal:true});this.close();
        }
        close(){
            if(this.#closed)return;this.#closed=true;this.#generation++;this.#id=undefined;
            this.#startReject?.(Error("Browser speech startup was canceled."));this.#startResolve=this.#startReject=undefined;
            clearTimeout(this.#startupTimer);clearTimeout(this.#finalTimer);clearTimeout(this.#restartTimer);
            this.#finishing?.();this.#finishing=undefined;
            for(const name of ["onstart","onspeechstart","onspeechend","onresult","onnomatch","onerror","onend"])this.#native[name]=null;
            try{this.#native.abort();}catch{}
        }
    }
    globalThis.WebSpeechRecognizer=WebSpeechRecognizer;
})();
