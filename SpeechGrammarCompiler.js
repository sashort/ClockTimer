/* Pure finite-grammar work runs in a dedicated worker when available. */
(() => {
 'use strict';
 class SpeechGrammarCompiler {
  #worker;#next=0;#pending=new Map();#closed=false;#values;
  constructor({valuePhrases,workerUrl,enabled=true,timeoutMilliseconds=15000}={}){
   this.#values=valuePhrases;this.timeout=timeoutMilliseconds;this.execution='main-thread';
   if(enabled&&typeof Worker==='function'){
    this.#worker=new Worker(workerUrl||new URL('speech/SpeechGrammarWorker.js',document.baseURI));this.execution='worker';
    this.#worker.onmessage=({data})=>{const item=this.#pending.get(data.id);if(!item)return;clearTimeout(item.timer);this.#pending.delete(data.id);if(data.error){item.reject(Error(data.error));return;}
     try{
      const {phraseTables,paths,unsupported}=data.result;
      const tables=phraseTables.map(table=>{const phrases=table.vocabulary?this.#values[table.vocabulary]:table.phrases;if(!Array.isArray(phrases))throw Error('Invalid grammar phrase table.');return Object.isFrozen(phrases)?phrases:Object.freeze(phrases);});
      item.resolve({unsupported,paths:paths.map(path=>({...path,stages:path.stages.map(({phraseTable,...stage})=>{if(!Number.isInteger(phraseTable)||!tables[phraseTable])throw Error('Invalid grammar phrase reference.');return {...stage,phrases:tables[phraseTable]};})}))});
     }catch(error){item.reject(error);}};
    this.#worker.onerror=()=>this.#fail(Error('Speech grammar worker failed.'));
    this.#worker.postMessage({type:'initialize',valuePhrases});
   }
  }
  compile(records){
   if(this.#closed)return Promise.reject(Error('Speech grammar compiler is closed.'));
   if(!this.#worker)return Promise.resolve(globalThis.VoskPhraseListCompiler.compileStages(records,{valuePhrases:this.#values}));
   const id=++this.#next;
   return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.#pending.delete(id);reject(Error('Speech grammar preparation timed out.'));},this.timeout);
    this.#pending.set(id,{resolve,reject,timer});this.#worker.postMessage({type:'compile',id,records});});
  }
  #fail(error){for(const item of this.#pending.values()){clearTimeout(item.timer);item.reject(error);}this.#pending.clear();}
  close(){this.#closed=true;this.#worker?.terminate();this.#fail(Error('Speech grammar compiler closed.'));}
 }
 globalThis.SpeechGrammarCompiler=SpeechGrammarCompiler;
})();
