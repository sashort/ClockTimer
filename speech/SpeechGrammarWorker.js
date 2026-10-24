/* No capture, DOM access, network requests for audio, or command execution. */
'use strict';
importScripts('../SpeechGrammarContext.js','../VoskPhraseListCompiler.js');
let valuePhrases;
const packedTables=new WeakMap();
function pack(result){
 const tables=[],indexes=new Map();
 const table=phrases=>{
  let descriptor=packedTables.get(phrases);
  if(!descriptor){
   const vocabulary=Object.keys(valuePhrases).find(kind=>valuePhrases[kind].length===phrases.length&&valuePhrases[kind].every((phrase,i)=>phrase===phrases[i]));
   descriptor=vocabulary?{vocabulary}:{phrases};packedTables.set(phrases,descriptor);
  }
  const key=descriptor.vocabulary?"v:"+descriptor.vocabulary:JSON.stringify(descriptor.phrases);
  if(!indexes.has(key)){indexes.set(key,tables.length);tables.push(descriptor);}
  return indexes.get(key);
 };
 return {paths:result.paths.map(path=>({...path,stages:path.stages.map(({phrases,...stage})=>({...stage,phraseTable:table(phrases)}))})),unsupported:result.unsupported,phraseTables:tables};
}
self.onmessage=({data})=>{
 if(data.type==='initialize'){
  valuePhrases=Object.freeze(Object.fromEntries(Object.entries(data.valuePhrases).map(([kind,phrases])=>[kind,Object.freeze(phrases)])));return;
 }
 if(data.type!=='compile')return;
 try{
  if(!valuePhrases)throw Error('Worker vocabulary is not initialized.');
  const result=VoskPhraseListCompiler.compileStages(data.records,{valuePhrases});
  self.postMessage({id:data.id,result:data.format===2?pack(result):result});
 }catch(error){self.postMessage({id:data.id,error:String(error.message||error)});}
};
