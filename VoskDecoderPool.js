/* Prepared decoders are idle: no microphone PCM is submitted until take(). */
(() => {
 'use strict';
 class VoskDecoderPool {
  #entries=new Map();#closed=false;
  constructor({limit=3}={}){if(!Number.isInteger(limit)||limit<1)throw RangeError('Invalid decoder pool bound.');this.limit=limit;}
  get size(){return this.#entries.size;}
  prepare(key,factory){
   if(this.#closed)return Promise.reject(Error('Decoder pool is closed.'));
   if(this.#entries.has(key))return this.#entries.get(key);
   if(this.#entries.size>=this.limit){const oldest=this.#entries.keys().next().value;this.#entries.get(oldest).then(d=>d.close(),()=>{});this.#entries.delete(oldest);}
   const pending=Promise.resolve().then(factory).then(async decoder=>{
    try{if(typeof decoder.prepare==='function')await decoder.prepare();if(this.#closed){decoder.close();throw Error('Decoder pool closed during preparation.');}return decoder;}
    catch(error){decoder.close();throw error;}
   });
   this.#entries.set(key,pending);
   pending.catch(()=>{if(this.#entries.get(key)===pending)this.#entries.delete(key);});
   return pending;
  }
  async take(key){const pending=this.#entries.get(key);if(!pending)return;this.#entries.delete(key);return pending;}
  close(){this.#closed=true;for(const pending of this.#entries.values())pending.then(d=>d.close(),()=>{});this.#entries.clear();}
 }
 globalThis.VoskDecoderPool=VoskDecoderPool;
})();
