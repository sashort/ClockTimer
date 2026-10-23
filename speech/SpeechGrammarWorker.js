/* No capture, DOM access, network requests for audio, or command execution. */
'use strict';
importScripts('../SpeechGrammarContext.js','../VoskPhraseListCompiler.js');
let valuePhrases;
self.onmessage=({data})=>{
 if(data.type==='initialize'){
  valuePhrases=Object.freeze(Object.fromEntries(Object.entries(data.valuePhrases).map(([kind,phrases])=>[kind,Object.freeze(phrases)])));return;
 }
 if(data.type!=='compile')return;
 try{
  if(!valuePhrases)throw Error('Worker vocabulary is not initialized.');
  const result=VoskPhraseListCompiler.compileStages(data.records,{valuePhrases});
  self.postMessage({id:data.id,result});
 }catch(error){self.postMessage({id:data.id,error:String(error.message||error)});}
};
