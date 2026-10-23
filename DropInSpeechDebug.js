(() => {
 'use strict';
 const events=['speechRecognizerTranscript','speechTranscriptScoped','speechValueValidated','speechValueDiagnosticError','speechRecognitionAlternatives','speechRecognitionStatusChanged',
  'speechRecognitionHandoff','speechCommandBufferChanged','speechCommandDigested','speechCommandDispatched',
  'speechCommandSkipped','speechAttemptRejected','utteranceUnrecognized','speechMenuCommandError',
  'speechRecognitionFailed','listeningSuspended','listeningResumed','started','stopped'];
 const text=value=>typeof value==='string'?value.slice(0,2048):undefined;
 // Copy diagnostic primitives only. Never serialize elements, arguments, audio,
 // credentials, or arbitrary objects supplied by command handlers.
 function detail(source={}) {
  const result={};
  for(const key of ['id','utteranceId','commandId','executionContext','transcript','rawTranscript',
   'canonicalTranscript','consumedTranscript','status','reason','backend','recognitionContext','decoderEpoch','isFinal','selectedIndex','pending','text','kind','field','value']) {
   const value=source[key];
   if(['string','number','boolean'].includes(typeof value))result[key]=typeof value==='string'?text(value):value;
  }
  const command=source.commandElement;
  if(command)result.command={id:command.dataset?.speechEditorId||command.id||null,
   action:command.getAttribute?.('speech-function'),context:command.getAttribute?.('speech-execution-context')};
  else if(source.command)result.command={id:text(source.command.id),action:text(source.command.action),context:text(source.command.context)};
  const hypotheses=source.hypotheses||source.alternatives;
  if(Array.isArray(hypotheses))result.alternatives=hypotheses.slice(0,10).map(h=>({index:h.index,text:text(h.text||h.transcript),
   confidence:Number.isFinite(h.confidence)?h.confidence:undefined,selected:typeof h.selected==='boolean'?h.selected:undefined}));
  if(source.error)result.error=text(source.error.message||String(source.error));
  if(source.components) {
   result.components={};result.inferred={};result.componentDisplay={};
   for(const unit of ['hours','minutes','seconds']) {
    if(!Number.isFinite(source.components[unit]))continue;
    result.components[unit]=source.components[unit];
    result.inferred[unit]=source.inferred?.[unit]===true;
    result.componentDisplay[unit]=result.inferred[unit]?`[${source.components[unit]}]`:String(source.components[unit]);
   }
  }
  if(Array.isArray(source.entries))result.entries=source.entries.slice(-128).map(e=>({id:text(e.id),
   commandId:text(e.commandId),executionContext:text(e.executionContext),transcript:text(e.transcript),status:text(e.status),
   dependencyIds:Array.isArray(e.dependencyIds)?e.dependencyIds.slice(0,128).map(text):[]}));
  return result;
 }
 function context(doc) {
  return {mode:doc.querySelector('#scopeToggle')?.textContent?.trim(),
   microphone:doc.querySelector('speech-mic-bar')?.getAttribute('state'),
   dialogs:[...doc.querySelectorAll('dialog[open]')].map(e=>({id:e.id,title:text(e.querySelector('h1,h2,h3')?.textContent?.trim())}))};
 }
 const attached=new WeakMap();
 globalThis.WMOFDropInSpeechDebug={
  attachPublisher(source,stream,doc=document) {
   if(!source||attached.get(source)===stream)return;
   attached.set(source,stream);
   let sequence=0,timer,pending=new Map();
   const active=()=>stream.publishing&&stream.speechDebugEnabled&&!doc.querySelector('#loginDialog[open]');
   const flush=()=>{clearTimeout(timer);timer=undefined;const records=[...pending.values()].sort((a,b)=>a.sequence-b.sequence);pending.clear();
    if(active())for(const record of records)stream.broadcast('speech.debug',record);};
   for(const name of events)source.addEventListener(name,event=>{
    if(!active()){pending.clear();return;}
    const record={sequence:++sequence,timestamp:new Date().toISOString(),event:name,
     detail:detail(event.detail),view:context(doc)};
    if(['speechRecognizerTranscript','speechTranscriptScoped'].includes(name)&&!event.detail?.isFinal){pending.set(name,record);timer??=setTimeout(flush,100);}
    else {flush();stream.broadcast('speech.debug',record);}
   });
   stream.addEventListener('speechDebugChanged',()=>{if(!active()){clearTimeout(timer);timer=undefined;pending.clear();}});
  },
  log(record,{targetUserId,console:output=console}={}) {
   if(!record||!events.includes(record.event))return;
   output.log('[Drop-In speech]',{targetUserId,sequence:record.sequence,timestamp:record.timestamp,
    event:record.event,detail:detail(record.detail),view:record.view});
  }
 };
})();
