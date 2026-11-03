const assert=require('node:assert/strict'),fixture=require('./order-filler-master-fixture.cjs');
(async()=>{for(const scheduled of [false,true]){const f=await fixture({input:'transcript'});try{const p=f.page,op=require('./retained-page-operation.cjs')(p);
await op(async()=>{await clockTimer.connect('test','test');document.querySelector('#loginDialog').close();});
if(scheduled){
 await op(()=>WMOFActions.scheduleStartAt('11:59 PM'));await p.waitForSelector('#scheduledStartDialog[open]');
 assert.equal(await p.locator('#scheduledStartInDown').isChecked(),false);await p.locator('#scheduledStartInDown').check();
 await op(()=>WMOFActions.openScheduledStandardTimeEditor());
}else await op(()=>WMOFActions.openStandardTimeSettings({tripScope:true}));
await p.waitForSelector('#numberPadDialog[open]');for(const digit of '3000')await p.locator('#numberPadGrid [data-number="'+digit+'"]').click();
if(scheduled){await p.locator('#numberPadConfirm').click();await p.waitForSelector('#scheduledStartDialog[open]');assert(await p.locator('#scheduledStartInDown').isChecked());await op(()=>WMOFActions.startScheduledTrip('now'));}
else{await op(()=>WMOFActions.openNumberPadSettings());await p.waitForSelector('#tripSettingsDialog[open]');assert.equal(await p.locator('#tripStartInDown').isChecked(),false);await p.locator('#tripStartInDown').check();await op(()=>WMOFActions.saveTripSettings());}
await p.waitForFunction(()=>clockTimer.getActiveIntervalState()?.intervalType==='down');
const state=await p.evaluate(()=>({interval:clockTimer.getActiveIntervalState().intervalType,events:clockTimer.captureState().events.map(e=>({event:e.event,timestamp:e.timestamp}))}));assert.equal(state.interval,'down');assert.equal(state.events.find(e=>e.event==='interval.started').timestamp,state.events.find(e=>e.event==='trip.started').timestamp);
assert.deepEqual(f.errors,[]);console.log('PASS '+(scheduled?'scheduled':'new-trip settings')+' starts directly in Down with matching first-entry timestamp');
}finally{await f.close()}}})().catch(e=>{console.error(e.stack);process.exitCode=1});
