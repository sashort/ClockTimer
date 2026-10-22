/* Remote PCM transport; the existing Vosk adapter still owns collectors and boundaries. */
(() => {
    'use strict';
    class VoskServerRecognizer extends EventTarget {
        #socket; #adapter; #closed=false; #abort=new AbortController(); #openingReject;
        #leaseTimer; #expired=false; #requestGrant; #authenticated=false; #authTail=Promise.resolve(); #authResponse; #sendLimit;
        constructor({language='en-US',sessionUrl=new URL('api/speech/session/',document.baseURI).href,
            sessionProvider,websocketUrl,connectTimeoutMilliseconds=15000,maxBufferedBytes=1048576,
            getCollectionSession}={}) {
            super();
            this.#sendLimit=maxBufferedBytes;
            this.ready=(async()=>{
                this.dispatchEvent(new CustomEvent('status',{detail:{status:'connecting'}}));
                const request=async options=>{
                    const response=await fetch(sessionUrl,{credentials:'same-origin',signal:this.#abort.signal,...options});
                    const payload=await response.json();
                    if(!response.ok)throw Error(payload.message||'Speech service is unavailable.');
                    return payload;
                };
                this.#requestGrant=async()=>{
                    const timer=setTimeout(()=>this.#abort.abort(),connectTimeoutMilliseconds);
                    try {
                        if(sessionProvider)return await sessionProvider(language);
                        const info=await request();
                        return await request({method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':info.csrfToken},body:JSON.stringify({language})});
                    } finally {clearTimeout(timer);}
                };
                const grant=await this.#requestGrant();
                if(this.#closed)throw Error('Speech session was closed.');
                if(grant.language?.toLowerCase()!==language.toLowerCase())throw Error('Speech service returned a different language.');
                const url=new URL(websocketUrl||grant.websocketPath,sessionUrl);
                url.protocol=url.protocol==='https:'?'wss:':url.protocol==='http:'?'ws:':url.protocol;
                if(!['ws:','wss:'].includes(url.protocol) || (location.protocol==='https:'&&url.protocol!=='wss:'))throw Error('Speech requires a secure WebSocket.');
                const socket=this.#socket=new WebSocket(url.href);
                let decoder;
                const transport=this;
                const emit=(name,message)=>decoder?.listeners.get(name)?.(message);
                await new Promise((resolve,reject)=>{
                    this.#openingReject=reject;
                    const timeout=setTimeout(()=>{reject(Error('Speech service connection timed out.'));socket.close();},connectTimeoutMilliseconds);
                    const finish=()=>{clearTimeout(timeout);this.#openingReject=undefined;};
                    socket.onopen=()=>socket.send(JSON.stringify({type:'start',ticket:grant.ticket,
                        language:grant.language,sampleRate:16000,format:'pcm_s16le'}));
                    socket.onmessage=event=>{
                        let message;
                        try {message=JSON.parse(event.data);}catch {this.#fail('Invalid speech service response.');return;}
                        if(message.type==='ready') {
                            if(message.protocol!==1 || message.language!==grant.language || message.sampleRate!==16000){finish();reject(Error('Speech protocol mismatch.'));socket.close();return;}
                            this.#authenticated=message.authenticated===true;
                            this.#lease(message);finish();resolve();return;
                        }
                        if(message.type==='authentication'){
                            this.#authenticated=message.authenticated===true;
                            this.#lease(message);
                            this.#authResponse?.resolve(this.#authenticated);
                            return;
                        }
                        if(message.type==='error' && message.code==='login_timeout'){this.#expire();return;}
                        if(message.type==='error'){this.#fail('Speech service: '+message.code);return;}
                        if(['partial','result'].includes(message.type))emit(message.type==='partial'?'partialresult':'result',{result:message.result});
                    };
                    socket.onerror=()=>this.#fail('Speech service connection failed.');
                    socket.onclose=()=>{finish();if(!this.#closed)this.#fail('Speech service disconnected.');};
                });
                if(this.#closed)throw Error('Speech session was closed.');
                this.#adapter=new globalThis.VoskRecognizer({getCollectionSession,model:{KaldiRecognizer:class {
                    listeners=new Map();
                    constructor(rate){if(rate!==16000 || decoder)throw Error('Speech session requires one 16 kHz decoder.');decoder=this;}
                    on(name,callback){this.listeners.set(name,callback);}
                    setWords(){}
                    acceptWaveformFloat(samples,rate){
                        if(rate!==16000)throw Error('Invalid speech sample rate.');
                        const pcm=new ArrayBuffer(samples.length*2),view=new DataView(pcm);
                        for(let i=0;i<samples.length;i++){
                            const value=Math.max(-1,Math.min(1,Number.isFinite(samples[i])?samples[i]:0));
                            view.setInt16(i*2,value<0?Math.round(value*32768):Math.round(value*32767),true);
                        }
                        transport.#send(pcm,maxBufferedBytes);
                    }
                    retrieveFinalResult(){transport.#send(JSON.stringify({type:'boundary'}),maxBufferedBytes);}
                    remove(){transport.close();}
                }}});
                for(const name of ['transcript','error','status','utteranceEnded'])this.#adapter.addEventListener(name,event=>{if(!this.#expired)this.dispatchEvent(new CustomEvent(name,{detail:event.detail}));});
                await this.#adapter.ready;
                return this;
            })().catch(error=>{this.close();throw error;});
        }
        #lease(message){
            clearInterval(this.#leaseTimer);
            if(message.authenticated===true){this.dispatchEvent(new CustomEvent('status',{detail:{status:'authenticated'}}));return;}
            const seconds=Number(message.preloginSeconds);
            if(!Number.isFinite(seconds)||seconds<=0){this.#expire();return;}
            const deadline=performance.now()+seconds*1000;
            let previous;
            const tick=()=>{
                const remaining=Math.max(0,Math.ceil((deadline-performance.now())/1000));
                if(remaining===previous)return;previous=remaining;
                this.dispatchEvent(new CustomEvent('status',{detail:{status:'login-countdown',remaining}}));
                if(!remaining)clearInterval(this.#leaseTimer);
            };
            tick();this.#leaseTimer=setInterval(tick,100);
        }
        #expire(){
            if(this.#expired||this.#closed)return;
            this.#expired=true;
            // Expected expiry is not a recognition error and must not cancel login HTTP work.
            this.dispatchEvent(new CustomEvent('status',{detail:{status:'login-timeout',remaining:0}}));
            this.close();
        }
        #send(message,limit){
            if(this.#closed||this.#socket?.readyState!==WebSocket.OPEN)throw Error('Speech service is disconnected.');
            const size=typeof message==='string'?message.length:message.byteLength;
            if(this.#socket.bufferedAmount+size>limit){this.#fail('Speech network cannot keep up with microphone audio.');throw Error('Speech network backlog exceeded.');}
            this.#socket.send(message);
        }
        #fail(message){
            if(this.#closed)return;
            this.#openingReject?.(Error(message));
            this.dispatchEvent(new CustomEvent('error',{detail:{message,fatal:true}}));
            this.close();
        }
        setAuthenticated(enabled){
            const work=this.#authTail.then(async()=>{
                await this.ready;
                if(this.#closed)return false;
                if(this.#authenticated===enabled)return true;
                let control={type:'deauthenticate'};
                if(enabled){
                    const grant=await this.#requestGrant();
                    // A login/logout race must never promote an anonymous grant.
                    if(grant.authenticated!==true)return false;
                    control={type:'authenticate',ticket:grant.ticket};
                }
                const confirmed=await new Promise((resolve,reject)=>{
                    const timer=setTimeout(()=>{this.#authResponse=undefined;reject(Error('Speech authentication acknowledgement timed out.'));},10000);
                    this.#authResponse={resolve:value=>{clearTimeout(timer);this.#authResponse=undefined;resolve(value);},
                        reject:error=>{clearTimeout(timer);this.#authResponse=undefined;reject(error);}};
                    try{this.#send(JSON.stringify(control),this.#sendLimit);}catch(error){this.#authResponse.reject(error);}
                });
                return confirmed===enabled;
            });
            this.#authTail=work.catch(()=>false);
            return work;
        }
        get continuousInput(){return true;}
        get transcriptMode(){return 'cumulative';}
        get audioDelivery(){return this.#adapter?.audioDelivery;}
        async beginUtterance(id){await this.ready;if(!this.#closed)return this.#adapter.beginUtterance(id);}
        async acceptAudio(samples){await this.ready;return !this.#closed&&this.#adapter.acceptAudio(samples);}
        async accept(id,samples){await this.ready;return !this.#closed&&this.#adapter.accept(id,samples);}
        async finishUtterance(id){await this.ready;if(!this.#closed)return this.#adapter.finishUtterance(id);}
        async abortUtterance(id){await this.ready;if(!this.#closed)return this.#adapter.abortUtterance(id);}
        close(){clearInterval(this.#leaseTimer);if(this.#closed)return;this.#closed=true;this.#abort.abort();this.#openingReject?.(Error('Speech session was closed.'));this.#authResponse?.reject(Error('Speech session was closed.'));this.#socket?.close();this.#adapter?.close();}
    }
    globalThis.VoskServerRecognizer=VoskServerRecognizer;
})();
