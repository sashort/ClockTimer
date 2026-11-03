const assert=require('node:assert/strict'),fixture=require('./order-filler-master-fixture.cjs');
(async()=>{const f=await fixture({input:'transcript'});try{const p=f.page,op=require('./retained-page-operation.cjs')(p);
await p.route('**/api/settings/',async r=>r.fulfill({json:{userId:2,settings:{version:1}}}));
await op(async()=>{await clockTimer.connect('test','test');document.querySelector('#loginDialog').close();while(!WMOFAccountSettings.loaded)await new Promise(r=>setTimeout(r,20));const d=new Date(Date.now()-600000),time=[d.getHours(),String(d.getMinutes()).padStart(2,'0'),String(d.getSeconds()).padStart(2,'0')].join(':');await clockTimer.start({standardTime:'0:30:00',creationTime:time,startTime:time,scheduledStart:time});await clockTimer.startInterval('down',undefined,{},undefined,undefined,new Date(Date.now()-120000));});
for(const compact of [false,true])for(const bar of [false,true]){
await op(async({compact,bar})=>{document.querySelector(compact?'#actionDisplayCompact':'#actionDisplayFull').click();document.querySelector(bar?'#percentageDisplayBar':'#percentageDisplayClassic').click();await WMOFLayoutMotion.whenSettled();},{compact,bar});
const before=await p.evaluate(()=>clockTimer.getSummarySnapshot().trip.productiveTimeMilliseconds);
assert.equal(await p.locator('#includePendingDownTimeButton').getAttribute('hidden'),null);
await p.evaluate(()=>document.querySelector('#includePendingDownTimeButton').click());await p.waitForFunction(()=>clockTimer.includePendingDownTime===false);
const after=await p.evaluate(()=>clockTimer.getSummarySnapshot().trip.productiveTimeMilliseconds);assert(after-before>=120000,'all Pending is counted in '+JSON.stringify({compact,bar}));
assert.equal(await p.evaluate(()=>clockTimer.getActiveIntervalState().intervalType),'down');
await p.evaluate(()=>document.querySelector('#includePendingDownTimeButton').click());await p.waitForFunction(()=>clockTimer.includePendingDownTime===true);
}
console.log('PASS shared pending master across Full/Compact and Classic/Bar, immediate readouts and physical Down state');
}finally{await f.close();}})().catch(error=>{console.error(error.stack);process.exitCode=1});
