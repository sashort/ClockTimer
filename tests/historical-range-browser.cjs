const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),fixture=require('./order-filler-master-fixture.cjs');
(async()=>{const f=await fixture({input:'transcript'});try{const p=f.page,op=require('./retained-page-operation.cjs')(p),queries=[];
await p.clock.setFixedTime(new Date('2026-11-03T17:00:00Z'));
const rules={weekStartDay:6,cutoffTime:'04:00:00',payPeriodDays:14,payPeriodAnchorBasis:'fiscal-year-start',recurring:true,effectiveFrom:'1970-01-01',effectiveThrough:null};
await p.route('**/api/users/',r=>r.fulfill({json:{csrfToken:'a'.repeat(64),user:{id:2,username:'test',permissions:4},calendars:[2025,2026].map(year=>({profile:'walmart-us',searchedYear:year,timezone:'America/New_York',provenance:'manual',rules:{...rules,payPeriodAnchorDate:year===2025?'2025-02-01':'2026-01-31'}}))}}));
let settings={version:1,orderFiller:{'wmof.clock.tripLogView':JSON.stringify({downTimeExpanded:false})}};await p.route('**/api/settings/',r=>{if(r.request().method()==='PATCH'){const b=r.request().postDataJSON();settings[b.namespace]={...settings[b.namespace],...b.changes};}return r.fulfill({json:{userId:2,settings}});});
const totals={tripCount:1,standardTimeMilliseconds:1800000,countedTimeMilliseconds:1200000,productiveTimeMilliseconds:1200000,allowanceCreditMilliseconds:0,actualTimeMilliseconds:1200000};
await p.route('**/api/trips/**',r=>{const q=new URL(r.request().url());queries.push(Object.fromEntries(q.searchParams));if(q.searchParams.get('result')==='list'){
 const begin=Date.parse(q.searchParams.get('minDateTime'))+3600000,at=offset=>new Date(begin+offset).toISOString();
 const trip={id:9,startTime:at(0),endTime:at(1800000),...totals,events:[{id:1,event:'trip.started',timestamp:at(0),value:{}},{id:2,event:'interval.started',timestamp:at(600000),value:{type:'down',approvalState:'pending',intervalKey:'p'}},{id:3,event:'interval.ended',timestamp:at(1200000),value:{intervalKey:'p'}},{id:4,event:'trip.stopped',timestamp:at(1800000),value:{}}]};
 return r.fulfill({json:{trips:[trip],verbose:true}});
}return r.fulfill({json:{tripId:41,...totals,aggregateBreakdown:{production:totals,nonProduction:{trips:[]}}}});});
await op(async()=>{await clockTimer.connect('test','test');document.querySelector('#loginDialog').close();while(!WMOFAccountSettings.loaded)await new Promise(r=>setTimeout(r,20));const d=new Date(Date.now()-600000),time=[d.getHours(),String(d.getMinutes()).padStart(2,'0'),String(d.getSeconds()).padStart(2,'0')].join(':');await clockTimer.start({standardTime:'1:00:00',creationTime:time,startTime:time,scheduledStart:time});});
const start=await p.evaluate(()=>clockTimer.captureState().events.find(e=>e.event==='trip.started').timestamp);
for(const [range,date,expectedStart,expectedEnd] of [['week','2026-10-14','2026-10-10','2026-10-17'],['pay-period','2026-10-14','2026-10-10','2026-10-24'],['day','2026-10-14','2026-10-14','2026-10-15'],['year','2025-08-14','2025-01-01','2026-01-01']]){
await op(({range})=>{const select=document.querySelector('#tripLogRangeSelect');select.value=range;select.dispatchEvent(new Event('change'));},{range});
await op(({date})=>{const input=document.querySelector('#tripLogStartDate');if(input.disabled)throw Error('existing Start must be editable');input.value=date;input.dispatchEvent(new Event('change'));},{date});
await p.waitForFunction(({expectedStart,expectedEnd})=>document.querySelector('#tripLogStartDate').value===expectedStart&&document.querySelector('#tripLogEndDate').value===expectedEnd,{expectedStart,expectedEnd});
await p.waitForFunction(()=>!document.querySelector('#tripLogHistoricalRange').hidden);
await op(async()=>{clockTimer.percentMode='total';clockTimer.renderedTimeMode='remaining';document.querySelector('#percentageDisplayBar').click();await WMOFLayoutMotion.whenSettled();});
await p.waitForFunction(()=>!document.querySelector('#historicalRangeBanner').hidden);await p.clock.runFor(1000);
const state=await p.evaluate(()=>({total:clockTimer.getSummarySnapshot().total,trip:clockTimer.uiState.trip_active,standard:clockTimer.uiState.standard_time_component.value,time:clockTimer.uiState.time_component.text,label:clockTimer.uiState.time_header_text}));
assert.equal(await p.evaluate(()=>clockTimer.getGoalBarSnapshot().nodes.find(node=>node.current)?.percent),150,'historical bar shows historical performance');
assert.equal(state.total.standardTimeMilliseconds,1800000,'past total excludes running trip');assert.equal(state.standard,1800000);assert.equal(state.label,'Banked');assert.equal(state.time,'0:10:00');assert(state.trip,'history must not end the live trip');
console.log('PASS historical '+range+': Start/End aligned, main totals isolated, live trip retained');
if(process.env.HISTORICAL_RANGE_SCREENSHOT_DIR&&range==='week'){
 fs.mkdirSync(process.env.HISTORICAL_RANGE_SCREENSHOT_DIR,{recursive:true});await p.screenshot({path:path.join(process.env.HISTORICAL_RANGE_SCREENSHOT_DIR,'historical-main.png')});
}

}
await op(()=>WMOFActions.openTripLog('pointer'));await p.waitForSelector('.trip-log-range-status');await op(()=>document.querySelector('#tripLogSettingsButton').click());await p.clock.runFor(500);
assert.equal(await p.locator('.trip-log-settings-dialog input[type="date"]').first().isDisabled(),false);assert.equal(await p.locator('.trip-log-settings-dialog input[type="date"]').nth(1).isDisabled(),true);
if(process.env.HISTORICAL_RANGE_SCREENSHOT_DIR){
 await p.screenshot({path:path.join(process.env.HISTORICAL_RANGE_SCREENSHOT_DIR,'historical-trip-log.png')});
 const previewContext=await p.context().browser().newContext(),preview=await previewContext.newPage(),dir=process.env.HISTORICAL_RANGE_SCREENSHOT_DIR;
 const main=fs.readFileSync(path.join(dir,'historical-main.png')).toString('base64'),log=fs.readFileSync(path.join(dir,'historical-trip-log.png')).toString('base64');
 await preview.setViewportSize({width:830,height:906});await preview.setContent('<style>body{margin:0;padding:16px;background:#12283b;color:white;font:16px Arial}main{display:flex;gap:18px}section{width:390px}h2{margin:0 0 12px;font-size:16px}img{width:390px;border:1px solid #758494;border-radius:8px}</style><main><section><h2>Main view · historical week</h2><img src="data:image/png;base64,'+main+'"></section><section><h2>Trip Log · historical year</h2><img src="data:image/png;base64,'+log+'"></section></main>');
 await preview.screenshot({path:path.join(dir,'historical-range-preview.png'),fullPage:true});await previewContext.close();
}
await op(()=>document.querySelector('#tripLogBody [data-return-current-range]').click());await p.waitForFunction(()=>document.querySelector('#tripLogHistoricalRange').hidden&&document.querySelector('#historicalRangeBanner').hidden);
assert.equal(await p.locator('#tripLogStartDate').inputValue(),'2026-01-01');assert.equal(await p.locator('#tripLogEndDate').inputValue(),'2027-01-01');
assert.equal(await p.evaluate(()=>clockTimer.captureState().events.find(e=>e.event==='trip.started').timestamp),start,'range browsing never rewrites start');
assert(queries.some(q=>q.startTime?.startsWith('2025-01-01')),'historical dates reach totals API');assert(queries.some(q=>q.minDateTime?.startsWith('2025-01-01')),'Trip Log receives the same historical window');
console.log('PASS shared historical Trip Log indicator, calculated End, and Return to Active without another date picker');
}finally{await f.close();}})().catch(error=>{console.error(error.stack);process.exitCode=1});
