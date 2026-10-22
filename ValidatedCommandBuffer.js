(() => {
    'use strict';
    // Owns validated work and its display lifetime, independently of capture.
    class ValidatedCommandBuffer {
        static SKIPPED=Symbol('validated-command-skipped');
        #entries=new Map(); #tail=Promise.resolve(); #timer;
        constructor({onChange=()=>{},onError=()=>{},now=()=>Date.now(),setTimer=(fn,delay)=>globalThis.setTimeout(fn,delay),clearTimer=id=>globalThis.clearTimeout(id),maxEntries=128}={}){
            this.onChange=onChange;this.onError=onError;this.now=now;
            this.setTimer=setTimer;this.clearTimer=clearTimer;this.maxEntries=maxEntries;
        }
        get snapshot(){
            return Object.freeze([...this.#entries.values()].filter(e=>!['canceled','failed'].includes(e.status)).map(e=>Object.freeze({
                id:e.id,ownerId:e.ownerId,chainId:e.chainId,transcript:e.transcript,status:e.status,
                commandId:e.commandId,executionContext:e.executionContext??null,
                commandElement:e.commandElement,acceptedAt:e.acceptedAt,completedAt:e.completedAt
            })));
        }
        get pendingOwner(){return [...this.#entries.values()].reverse().find(e=>['queued','executing'].includes(e.status))?.owner;}
        hasPendingOwner(ownerId){return [...this.#entries.values()].some(e=>e.ownerId===ownerId&&['queued','executing'].includes(e.status));}
        get pending(){return [...this.#entries.values()].some(e=>['queued','executing'].includes(e.status));}
        enqueue({id,ownerId,transcript,ttl=2000,...metadata},execute){
            if(this.#entries.has(id))return this.#entries.get(id).promise;
            if(typeof execute!=='function'||id===undefined||ownerId===undefined||!String(transcript||'').trim())throw TypeError('Validated command identity, owner, transcript and executor are required.');
            this.#expire();
            if(this.#entries.size>=this.maxEntries)throw RangeError('Validated command buffer is full.');
            let resolve,reject;
            const entry={...metadata,id,ownerId,transcript:String(transcript).trim(),ttl,
                status:'queued',acceptedAt:this.now(),promise:new Promise((done,fail)=>{resolve=done;reject=fail;}),resolve:value=>resolve(value),reject:error=>reject(error)};
            this.#entries.set(id,entry);this.#publish();
            const run=async()=>{
                if(entry.status!=='queued')return;
                entry.status='executing';this.#publish();
                try{
                    const result=await execute();
                    const canceled=entry.status==='canceled';
                    if(!canceled)entry.status=result===ValidatedCommandBuffer.SKIPPED?'canceled':result===false?'failed':'completed';
                    entry.completedAt=this.now();entry.resolve(canceled?false:result===ValidatedCommandBuffer.SKIPPED?true:result);
                }catch(error){
                    entry.completedAt=this.now();
                    if(entry.status==='canceled')entry.resolve(false);
                    else{entry.status='failed';entry.reject(error);this.onError(error,entry);}
                }
                finally{
                    // Keep all accepted components while any command is pending.
                    // Start their idle display TTL only after the chain drains.
                    this.#expire();this.#publish();
                }
            };
            this.#tail=this.#tail.then(run,run);
            return entry.promise;
        }
        annotate(id,{commandId,executionContext}={}){
            const entry=this.#entries.get(id);if(!entry)return;
            if(commandId!==undefined)entry.commandId=commandId;
            if(executionContext!==undefined)entry.executionContext=executionContext;
            this.#publish();
        }
        cancelChain(chainId){
            for(const entry of this.#entries.values())if(entry.chainId===chainId)this.#cancel(entry);
            this.#expire();this.#publish();
        }
        cancelOwner(ownerId){
            for(const entry of this.#entries.values())if(entry.ownerId===ownerId)this.#cancel(entry);
            this.#expire();this.#publish();
        }
        cancelAll(){
            for(const entry of this.#entries.values())this.#cancel(entry);
            this.#expire();this.#publish();
        }
        #cancel(entry){
            const queued=entry.status==='queued';entry.status='canceled';
            if(queued)entry.resolve(false);
        }
        #expire(){
            const now=this.now(),pending=this.pending;
            for(const [id,entry] of this.#entries){
                if(['canceled','failed'].includes(entry.status)){this.#entries.delete(id);continue;}
                if(entry.status!=='completed')continue;
                if(pending){entry.expiresAt=undefined;continue;}
                entry.expiresAt??=Number.isFinite(entry.ttl)?now+Math.max(0,entry.ttl):Infinity;
                if(entry.expiresAt<=now)this.#entries.delete(id);
            }
        }
        #publish(){
            this.clearTimer(this.#timer);this.#timer=undefined;
            const snapshot=this.snapshot;
            this.onChange(Object.freeze({entries:snapshot,pending:this.pending,text:snapshot.map(e=>e.transcript).join(' ')}));
            const next=Math.min(...[...this.#entries.values()].map(e=>e.expiresAt??Infinity));
            if(Number.isFinite(next))this.#timer=this.setTimer(()=>{this.#expire();this.#publish();},Math.max(0,next-this.now()));
        }
    }
    globalThis.ValidatedCommandBuffer=ValidatedCommandBuffer;
})();
