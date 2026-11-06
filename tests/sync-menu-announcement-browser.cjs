const fixture=require('./order-filler-master-fixture.cjs'),assert=require('assert/strict');
(async()=>{const f=await fixture({input:'transcript'});try{const p=f.page,op=require('./retained-page-operation.cjs')(p);
await p.route('**/api/trips/**',async r=>{const u=new URL(r.request().url());if(r.request().method()==='GET'&&u.searchParams.has('startTime'))return r.fulfill({json:{aggregateBreakdown:{production:{tripCount:0,standardTimeMilliseconds:0,actualTimeMilliseconds:0,countedTimeMilliseconds:0},nonProduction:{trips:[]}}}});return r.fallback();});
await op(async()=>{await clockTimer.connect('test','test');while(!WMOFAccountSettings.loaded)await new Promise(r=>setTimeout(r,10));document.querySelector('#loginDialog').close();});
await op(()=>document.querySelector('#toggleSyncMenuButton').click());await p.waitForFunction(()=>document.querySelector('#syncAggregateDialog').open);
const logs=await op(async()=>{handoffAudio=[];await WMOFActions.selectSyncAggregate('day');await testWaitForFeedback();return {audio:handoffAudio,pressed:document.querySelector('#toggleSyncMenuButton').getAttribute('aria-pressed')};});
assert(logs.audio.some(a=>a.startsWith('speech:')),'menu Sync Goals speaks its confirmation');assert(logs.audio.some(a=>a.startsWith('chime:')),'menu Sync Goals plays its setting cue');
console.log('PASS hamburger Sync Goals music and spoken confirmation');
}finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
