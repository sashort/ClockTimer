/* Availability is cached only within an explicitly versioned application state. */
(() => {
 'use strict';
 class SpeechContextSnapshotCache {
  #entries=new Map();
  constructor(provider,version,{limit=128}={}){
   if(typeof provider!=='function'||typeof version!=='function'||!Number.isInteger(limit)||limit<1)throw TypeError('Context cache needs a provider, version and bound.');
   Object.assign(this,{provider,version,limit});this.hits=0;this.misses=0;
  }
  async get(id,text=''){
   const version=this.version(id),key=JSON.stringify([id,text,version]);
   let pending=this.#entries.get(key);
   if(pending){this.hits++;return pending;}
   this.misses++;pending=Promise.resolve().then(()=>this.provider(id,text));
   if(this.#entries.size>=this.limit)this.#entries.delete(this.#entries.keys().next().value);
   this.#entries.set(key,pending);
   try{const value=await pending;if(version!==this.version(id))this.#entries.delete(key);return value;}
   catch(error){this.#entries.delete(key);throw error;}
  }
  clear(){this.#entries.clear();}
 }
 globalThis.SpeechContextSnapshotCache=SpeechContextSnapshotCache;
})();
