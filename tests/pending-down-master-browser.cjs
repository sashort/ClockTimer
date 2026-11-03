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
if(process.env.PENDING_MENU_SCREENSHOT_DIR){
 const dir=process.env.PENDING_MENU_SCREENSHOT_DIR;fs.mkdirSync(dir,{recursive:true});await p.screenshot({path:path.join(dir,'show-pending-menu.png')});
 const onMask=await p.locator('#includePendingDownTimeButton').evaluate(e=>getComputedStyle(e,'::before').maskImage);
 await p.locator('#includePendingDownTimeButton').click();await p.waitForFunction(()=>!clockTimer.includePendingDownTime);await p.clock.runFor(800);
 const offMask=await p.locator('#includePendingDownTimeButton').evaluate(e=>getComputedStyle(e,'::before').maskImage);assert.notEqual(onMask,offMask,'check and X masks differ');
 const context=await p.context().browser().newContext(),preview=await context.newPage();await preview.setViewportSize({width:820,height:430});
 const css=fs.readFileSync(path.resolve(__dirname,'../styles/default/MenuIcons.css'),'utf8');
 await preview.setContent('<style>'+css+'body{margin:0;padding:22px;background:#12283b;color:#fff;font:16px Arial}main{display:flex;gap:20px}section{width:378px}h2{font-size:18px;margin:0 0 14px}.card{background:#001e60;border:1px solid #96a9c0;border-radius:12px;padding:18px}.row{display:flex;align-items:center;gap:0;min-height:58px;font-size:19px;font-weight:bold}.on{color:#a9ddf7}.off{color:#9da6b3}.large{font-size:96px;margin:26px 0 8px;text-align:center}.large:before{margin:0}.hint{font-size:12px;color:#bac8d6;text-align:center}</style><main><section><h2>On · check</h2><div class="card"><div class="row on" data-menu-icon="pending-down" aria-checked="true">Show Pending Down Time</div><div class="large on" data-menu-icon="pending-down" aria-checked="true"></div><p class="hint">Enlarged icon detail</p></div></section><section><h2>Off · X</h2><div class="card"><div class="row off" data-menu-icon="pending-down" aria-checked="false">Show Pending Down Time</div><div class="large off" data-menu-icon="pending-down" aria-checked="false"></div><p class="hint">Enlarged icon detail</p></div></section></main>');
 await preview.screenshot({path:path.join(dir,'pending-stopwatch-icons.png'),fullPage:true});await context.close();
}
console.log('PASS menu and Trip Log share one preference, display/calculation update together, and forced override restores saved value');
console.log('PASS shared pending master across Full/Compact and Classic/Bar, immediate readouts and physical Down state');
}finally{await f.close();}})().catch(error=>{console.error(error.stack);process.exitCode=1});
