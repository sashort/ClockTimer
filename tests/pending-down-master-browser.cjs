const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),fixture=require('./order-filler-master-fixture.cjs');
(async()=>{const f=await fixture({input:'transcript'});try{const p=f.page,op=require('./retained-page-operation.cjs')(p);
await p.route('**/api/trips/**',r=>{if(new URL(r.request().url()).searchParams.get('result')==='list')return r.fulfill({json:{trips:[],verbose:true}});const empty={tripCount:0,standardTimeMilliseconds:0,actualTimeMilliseconds:0,countedTimeMilliseconds:0};return r.fulfill({json:{tripId:41,...empty,aggregateBreakdown:{production:empty,nonProduction:{trips:[]}}}});});
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
await op(()=>WMOFActions.openTripLog('pointer'));await p.waitForSelector('[data-show-pending]',{state:'attached'});
await op(()=>document.querySelector('#tripLogSettingsButton').click());
await op(()=>{const check=document.querySelector('[data-show-pending]');check.checked=false;check.dispatchEvent(new Event('change'));});
await p.waitForFunction(()=>clockTimer.includePendingDownTime===false&&document.querySelector('#includePendingDownTimeButton').getAttribute('aria-checked')==='false');
await op(()=>{const check=document.querySelector('[data-down-time-only]');check.checked=true;check.dispatchEvent(new Event('change'));});
await p.waitForFunction(()=>clockTimer.includePendingDownTime===true&&document.querySelector('#includePendingDownTimeButton').disabled);
assert.equal(await p.locator('#includePendingDownTimeButton').getAttribute('aria-checked'),'false','overridden master retains saved Off state');
assert.equal(await p.locator('[data-show-pending]').isChecked(),false);assert.equal(await p.locator('[data-show-pending]').isDisabled(),true);
await op(()=>{const check=document.querySelector('[data-down-time-only]');check.checked=false;check.dispatchEvent(new Event('change'));});
await p.waitForFunction(()=>clockTimer.includePendingDownTime===false&&!document.querySelector('#includePendingDownTimeButton').disabled);
await op(()=>document.querySelector('#includePendingDownTimeButton').click());await p.waitForFunction(()=>clockTimer.includePendingDownTime===true&&document.querySelector('[data-show-pending]').checked);
await op(()=>WMOFActions.closeTripLog('pointer'));await p.locator('#menuButton').click();await p.waitForSelector('#includePendingDownTimeButton',{state:'visible'});await p.clock.runFor(800);
assert.equal(await p.locator('#includePendingDownTimeButton').textContent(),'Show Pending Down Time');
if(process.env.PENDING_MENU_SCREENSHOT_DIR){fs.mkdirSync(process.env.PENDING_MENU_SCREENSHOT_DIR,{recursive:true});await p.screenshot({path:path.join(process.env.PENDING_MENU_SCREENSHOT_DIR,'show-pending-menu.png')});}
console.log('PASS menu and Trip Log share one preference, display/calculation update together, and forced override restores saved value');
console.log('PASS shared pending master across Full/Compact and Classic/Bar, immediate readouts and physical Down state');
}finally{await f.close();}})().catch(error=>{console.error(error.stack);process.exitCode=1});
