(() => {
    'use strict';
    // Owns validated work and its display lifetime, independently of capture.
    class ValidatedCommandBuffer {
        static SKIPPED=Symbol('validated-command-skipped');
        #entries=new Map(); #timer; #slots=new Map(); #slotHeads=new Map();
        constructor({onChange=()=>{},onError=()=>{},now=()=>Date.now(),setTimer=(fn,delay)=>globalThis.setTimeout(fn,delay),clearTimer=id=>globalThis.clearTimeout(id),maxEntries=128}={}){
            this.onChange=onChange;this.onError=onError;this.now=now;
            this.setTimer=setTimer;this.clearTimer=clearTimer;this.maxEntries=maxEntries;
        }
        get snapshot(){
            return Object.freeze([...this.#entries.values()].filter(e=>!['canceled','failed'].includes(e.status)).map(e=>Object.freeze({
                id:e.id,ownerId:e.ownerId,chainId:e.chainId,transcript:e.transcript,status:e.status,
                dependencyIds:Object.freeze(e.dependencyIds.slice()),commandId:e.commandId,executionContext:e.executionContext??null,
                commandElement:e.commandElement,acceptedAt:e.acceptedAt,completedAt:e.completedAt
            })));
        }
        get pendingOwner(){return [...this.#entries.values()].reverse().find(e=>['queued','executing'].includes(e.status))?.owner;}
        hasPendingOwner(ownerId){return [...this.#entries.values()].some(e=>e.ownerId===ownerId&&['queued','executing'].includes(e.status));}
        get pending(){return [...this.#entries.values()].some(e=>['queued','executing'].includes(e.status));}
        get slots(){return Object.freeze([...this.#slots.values()].map(slot=>Object.freeze({
            id:slot.id,kind:slot.kind,key:slot.key,context:slot.context,ownerId:slot.ownerId,status:slot.status,ownerHeadSlotId:slot.ownerHeadSlotId,
            dependencyRanges:Object.freeze(slot.dependencyRanges.map(range=>Object.freeze({...range}))),
            dependencies:Object.freeze(slot.dependencies.map(dependency=>Object.freeze({id:dependency.id,kind:dependency.kind}))),
            waitingForSlotIds:Object.freeze(slot.dependencies.filter(dependency=>['pending','executing'].includes(dependency.status)).map(dependency=>dependency.id)),
            invalidDependencySlotIds:Object.freeze(slot.dependencies.filter(dependency=>dependency.status==='invalid').map(dependency=>dependency.id))
        })));}
        #createSlot({id,kind,key,context,ownerId,ownerHeadSlotId}){
            if(this.#slots.has(id))throw TypeError('Slot identity already exists.');
            if(id===undefined||!['value','command'].includes(kind))throw TypeError('A slot needs an identity and value/command kind.');
            if(this.#slots.size>=this.maxEntries*2){
                for(const [oldId,old] of this.#slots){
                    if(['resolved','invalid'].includes(old.status)){
                        this.#slots.delete(oldId);
                        if(old.key&&this.#slotHeads.get(old.key)===old)this.#slotHeads.delete(old.key);
                        if(this.#slots.size<this.maxEntries*2)break;
                    }
                }
                if(this.#slots.size>=this.maxEntries*2)throw RangeError('Speech slot buffer is full.');
            }
            let resolve;
            const slot={id,kind,key,context,ownerId,ownerHeadSlotId,status:'pending',dependencies:[],dependencyRanges:[],completion:new Promise(done=>resolve=done),resolve:result=>resolve(result)};
            this.#slots.set(id,slot);if(key)this.#slotHeads.set(key,slot);return slot;
        }
        declareValueSlot({id,key,context,ownerId,ownerHeadSlotId}){
            this.#createSlot({id,key,context,ownerId,ownerHeadSlotId,kind:'value'});this.#publish();return id;
        }
        declareCommandSlot({id,context,ownerId}){
            this.#createSlot({id,context,ownerId,kind:'command'});this.#publish();return id;
        }
        settleValueSlot(id,status){
            const slot=this.#slots.get(id);
            if(!slot||slot.kind!=='value'||!['resolved','invalid'].includes(status))throw TypeError('Settle a declared value slot as resolved or invalid.');
            if(['resolved','invalid'].includes(slot.status))return false;
            this.#settleSlot(slot,status);this.#publish();return true;
        }
        #settleSlot(slot,status){
            slot.status=status;slot.resolve(status==='resolved');
            if(status==='invalid'&&slot.key&&this.#slotHeads.get(slot.key)===slot)this.#slotHeads.delete(slot.key);
        }
        enqueue({id,ownerId,transcript,ttl=2000,dependsOn=[],dependsOnRanges=[],waitForSlotKeys=[],slotKey,slotContext,...metadata},execute){
            if(this.#entries.has(id))return this.#entries.get(id).promise;
            if(typeof execute!=='function'||id===undefined||ownerId===undefined||!String(transcript||'').trim())throw TypeError('Validated command identity, owner, transcript and executor are required.');
            if(!Array.isArray(dependsOn)||!Array.isArray(waitForSlotKeys)||waitForSlotKeys.some(key=>typeof key!=='string'||!key))throw TypeError('Command dependencies must be slot references or keys.');
            if(!Array.isArray(dependsOnRanges))throw TypeError('Slot dependency ranges must be an array.');
            const ordered=[...this.#slots.values()];
            const ranged=dependsOnRanges.flatMap(range=>{
                const start=ordered.findIndex(slot=>slot.id===range?.startSlotId),end=ordered.findIndex(slot=>slot.id===range?.endSlotId);
                if(start<0||end<start)throw TypeError('Dependency ranges require ordered declared slot endpoints.');
                return ordered.slice(start,end+1);
            });
            const references=[...dependsOn,...ranged,...waitForSlotKeys.map(key=>this.#slotHeads.get(key)).filter(Boolean)];
            const dependencies=references.map(dependency=>{
                const slot=this.#slots.get(typeof dependency==='object'?dependency.id:dependency);
                if(slot){if(slot.id===id)throw TypeError('A slot cannot depend on itself.');return slot;}
                const entry=this.#entries.get(dependency);
                if(entry)return {id:entry.id,completion:entry.promise};
                if(dependency?.completion?.then && dependency.id!==undefined && dependency.id!==id){
                    const external={...dependency,kind:dependency.kind||'command',status:'pending'};
                    external.completion=Promise.resolve(dependency.completion).then(result=>{external.status=result===false?'invalid':'resolved';return result;},()=>{external.status='invalid';return false;});
                    return external;
                }
                throw TypeError('Command dependency must reference previously accepted work.');
            }).filter((dependency,index,all)=>all.findIndex(other=>other.id===dependency.id)===index);
            this.#expire();
            if(this.#entries.size>=this.maxEntries)throw RangeError('Validated command buffer is full.');
            let resolve,reject;
            const entry={...metadata,id,ownerId,dependencyIds:dependencies.map(d=>d.id),transcript:String(transcript).trim(),ttl,
                status:'queued',acceptedAt:this.now(),promise:new Promise((done,fail)=>{resolve=done;reject=fail;}),resolve:value=>resolve(value),reject:error=>reject(error)};
            const reserved=this.#slots.get(id);
            if(reserved&&(reserved.kind!=='command'||reserved.ownerId!==ownerId||reserved.status!=='pending'))throw TypeError('Command slot reservation does not match accepted work.');
            entry.slot=reserved||this.#createSlot({id,ownerId,kind:'command',context:slotContext});
            entry.slot.key=slotKey;entry.slot.context=slotContext;entry.slot.dependencies=dependencies;
            entry.slot.dependencyRanges=[...dependsOnRanges.map(range=>({...range})),...dependencies.filter(dependency=>!ranged.includes(dependency)).map(dependency=>({startSlotId:dependency.id,endSlotId:dependency.id}))];
            if(slotKey)this.#slotHeads.set(slotKey,entry.slot);
            this.#entries.set(id,entry);this.#publish();
            const run=async()=>{
                const outcomes=await Promise.all(dependencies.map(d=>Promise.resolve(d.completion).catch(()=>false)));
                if(entry.status!=='queued')return;
                if(outcomes.some(result=>result===false)){
                    entry.status='canceled';this.#settleSlot(entry.slot,'invalid');entry.resolve(false);this.#expire();this.#publish();return;
                }
                entry.status='executing';entry.slot.status='executing';this.#publish();
                try{
                    const result=await execute();
                    const canceled=entry.status==='canceled';
                    if(!canceled)entry.status=result===ValidatedCommandBuffer.SKIPPED?'canceled':result===false?'failed':'completed';
                    this.#settleSlot(entry.slot,!canceled&&(entry.status==='completed'||result===ValidatedCommandBuffer.SKIPPED)?'resolved':'invalid');
                    entry.completedAt=this.now();entry.resolve(canceled?false:result===ValidatedCommandBuffer.SKIPPED?true:result);
                }catch(error){
                    this.#settleSlot(entry.slot,'invalid');
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
            void Promise.resolve().then(run);
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
            for(const slot of this.#slots.values())if(slot.ownerId===ownerId&&slot.kind==='value'&&slot.status==='pending')this.#settleSlot(slot,'invalid');
            this.#expire();this.#publish();
        }
        cancelAll(){
            for(const entry of this.#entries.values())this.#cancel(entry);
            for(const slot of this.#slots.values())if(slot.kind==='value'&&slot.status==='pending')this.#settleSlot(slot,'invalid');
            this.#slotHeads.clear();
            this.#expire();this.#publish();
        }
        #cancel(entry){
            entry.status='canceled';
            this.#settleSlot(entry.slot,'invalid');
            entry.resolve(false);
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
            this.onChange(Object.freeze({entries:snapshot,slots:this.slots,pending:this.pending,text:snapshot.map(e=>e.transcript).join(' ')}));
            const next=Math.min(...[...this.#entries.values()].map(e=>e.expiresAt??Infinity));
            if(Number.isFinite(next))this.#timer=this.setTimer(()=>{this.#expire();this.#publish();},Math.max(0,next-this.now()));
        }
    }
    globalThis.ValidatedCommandBuffer=ValidatedCommandBuffer;
})();
