import { englishLanguage } from './announcement-language-fixture.mjs';
const language = await englishLanguage();
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const ctx=vm.createContext({announcementLanguage:language, announcementText:language.text,queueMicrotask,console,Date,ANNOUNCEMENT_SPEECH_PAUSE_AT_1X:300,audioAnnouncementOutput:()=>({speechDelayMs:0}),waitForAnnouncementDelay:async()=>{}, consumeAnnouncementAction:()=>({perform:true}), announcementSongName:name=>name});
vm.runInContext(source.slice(source.indexOf('    const semanticAnnouncementQueue'),source.indexOf('    function waitForAnnouncementDelay'))+source.slice(source.indexOf('    function speakSemanticAndWait('),source.indexOf('    function playSemanticSongThenSpeak('))+'\nglobalThis.enqueue=runSemanticAnnouncement;globalThis.components=announcementComponents;globalThis.song=playSemanticSong;globalThis.batch=beginAnnouncementBatch;globalThis.cancel=cancelQueuedAnnouncement;globalThis.queue=semanticAnnouncementQueue;',ctx);
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
const order=[];let finishSpeech;
const audio={speak(text,options){order.push(text);finishSpeech=options.onEnd;return true;}};
const parts=(speech)=>ctx.components(audio,'song',false,speech,{speechDelayMs:0});
const release=ctx.batch('trip-start');
const trip=ctx.enqueue('trip-started',parts(['Trip Started','Time Remaining']));
const sync=ctx.enqueue('syncTry',parts('Sync outcome'));
release();await flush();assert.deepEqual(order,['Trip Started']);
finishSpeech();await flush();assert.deepEqual(order,['Trip Started','Sync outcome']);
finishSpeech();await flush();assert.deepEqual(order,['Trip Started','Sync outcome','Time Remaining']);
finishSpeech();await Promise.all([trip,sync]);await flush();assert.equal(ctx.queue.length,0);
// Arrival during speech waits for that component; no completed component replays.
order.length=0;
const regular=ctx.enqueue('regular',parts(['Summary','Details']),{phasePriorities:{summary:80,details:10}});
await flush();const urgent=ctx.enqueue('urgent',parts('Urgent'),{priority:90});
await flush();assert.deepEqual(order,['Summary']);finishSpeech();await flush();assert.deepEqual(order,['Summary','Urgent']);
finishSpeech();await flush();assert.deepEqual(order,['Summary','Urgent','Details']);finishSpeech();await Promise.all([regular,urgent]);await flush();
// Cancellation finishes an active component and suppresses the rest.
order.length=0;
const canceled=ctx.enqueue('cancel-active',parts(['First','Canceled details']));
await flush();assert.equal(ctx.cancel('cancel-active'),true);assert.deepEqual(order,['First']);
finishSpeech();assert.equal(await canceled,false);await flush();assert.deepEqual(order,['First']);
assert.equal(await ctx.enqueue('cancel-active',async()=>true),true);await flush();
// Priorities override internal order, including putting details before summary and chime.
order.length=0;
const reordered=ctx.enqueue('reordered',[
 {phase:'chime',play:async()=>{order.push('Chime');return true;}},
 ...parts(['Summary','Details'])
],{phasePriorities:{chime:10,summary:20,details:30}});
await flush();assert.deepEqual(order,['Details']);finishSpeech();await flush();assert.deepEqual(order,['Details','Summary']);
finishSpeech();await reordered;await flush();assert.deepEqual(order,['Details','Summary','Chime']);
// A gated real chime cannot be cut off by arriving speech.
order.length=0;let finishChime;const gate=new Promise(resolve=>finishChime=resolve);
const chimeAudio={...audio,startSong:async()=>{order.push('Chime');return {hasChime:true,finished:gate};}};
const chimed=ctx.enqueue('chimed',ctx.components(chimeAudio,'song',true,'Chimed summary',{}));
await flush();const intervening=ctx.enqueue('intervening',parts('Intervening'),{priority:20});
await flush();assert.deepEqual(order,['Chime']);finishChime();await flush();assert.deepEqual(order,['Chime','Intervening']);
finishSpeech();await flush();assert.deepEqual(order,['Chime','Intervening','Chimed summary']);finishSpeech();await Promise.all([chimed,intervening]);await flush();
// Disabling the summary retains the remaining component's details identity.
assert.equal(parts([{phase:'details',text:'Remaining'}])[0].phase,'details');
assert.equal(parts(['','Remaining'])[0].phase,'details');
assert.equal(ctx.queue.pointer,0);assert.equal(ctx.queue.length,0);assert.equal(ctx.queue.announced.size,0);
// Catalog speech is dispatched separately from the chime rather than embedded in it.
order.length=0;let catalogFinish;const catalogGate=new Promise(resolve=>catalogFinish=resolve);
ctx.WMOFAudio={...audio,load:async()=>{throw Error('Speech must not be read from the music catalog');},
 startSong:async(name,options)=>{assert.equal(options.includeSpeech,false);order.push('Catalog chime');return {hasChime:true,finished:catalogGate};}};
const catalogSong=ctx.song('break-started');await flush();assert.deepEqual(order,['Catalog chime']);
const catalogUrgent=ctx.enqueue('catalog-urgent',parts('Catalog urgent'),{priority:20});
await flush();assert.deepEqual(order,['Catalog chime']);catalogFinish();await flush();assert.deepEqual(order,['Catalog chime','Catalog urgent']);
finishSpeech();await flush();assert.deepEqual(order,['Catalog chime','Catalog urgent','Break Started. Say end break to end your break.']);
finishSpeech();await Promise.all([catalogSong,catalogUrgent]);await flush();
console.log('PASS independent component priorities, sync interleaving, internal reordering, boundary-only interruption, cancellation and disabled summaries');
