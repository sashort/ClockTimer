const fixture=require('./order-filler-master-fixture.cjs'),assert=require('assert/strict');
(async()=>{const f=await fixture({input:'transcript'});try{const p=f.page,op=require('./retained-page-operation.cjs')(p);
await op(async()=>{await clockTimer.connect('test','test');while(!WMOFAccountSettings.loaded)await new Promise(r=>setTimeout(r,10));document.querySelector('#loginDialog').close();});
const logs=await op(async()=>{handoffAudio=[];document.querySelector('#toggleSyncMenuButton').click();await testWaitForFeedback();return {audio:handoffAudio,pressed:document.querySelector('#toggleSyncMenuButton').getAttribute('aria-pressed')};});
assert(logs.audio.some(a=>a.startsWith('speech:')),'menu Sync Goals speaks its confirmation');assert(logs.audio.some(a=>a.startsWith('chime:')),'menu Sync Goals plays its setting cue');
console.log('PASS hamburger Sync Goals music and spoken confirmation');
}finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
