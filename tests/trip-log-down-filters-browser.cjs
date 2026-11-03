const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true});try{
const page=await browser.newPage({viewport:{width:840,height:760},deviceScaleFactor:1});
await page.setContent('<style>'+fs.readFileSync(path.join(root,'styles/default/app.css'),'utf8')+'</style><style>html,body{margin:0;max-width:none;width:100%;height:auto;background:#12283b;color:#fff;font-family:Arial,sans-serif}body{padding:20px;box-sizing:border-box}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}article{min-width:0}h2{font-size:16px;margin:0 0 12px}.sample{border:2px solid #718392;border-radius:14px;background:#424e59;padding:10px 0;overflow:hidden}.trip-log-down-section{margin-bottom:0}.trip-log-settings{display:block!important;grid-template-rows:1fr!important}.trip-log-settings-content{overflow:visible!important}.trip-log-settings-divider{display:none}.trip-log-controls{padding:12px}.trip-log-controls label{grid-template-columns:minmax(120px,1fr) minmax(0,1fr)}.trip-log-controls label.trip-log-include-current{grid-template-columns:1fr 24px}.hint{font-size:12px;color:#c1d1df;margin:10px 4px 0;line-height:1.4}#runtime{display:none}</style><main id="samples"></main><div id="runtime"></div>');
await page.evaluate(ui=>{globalThis.WMOFLanguagePack={text:id=>ui.texts[id]?.text||id};},JSON.parse(fs.readFileSync(path.join(root,'lang/en-US/ui-text.json'),'utf8')));
for(const name of ['CalendarRange.js','TripAggregates.js','TripLog.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,name),'utf8')});
await page.evaluate(()=>{
const interval=(key,start,end,approvedTime,state)=>[{event:'interval.started',timestamp:'2026-11-03T'+start+'Z',value:{type:'down',intervalKey:key,...(approvedTime===undefined?{}:{approvedTime})}},...(state?[{event:'interval.approval-changed',value:{intervalKey:key,state,value:approvedTime||0}}]:[]),{event:'interval.ended',timestamp:'2026-11-03T'+end+'Z',value:{intervalKey:key}}];
const events=[{event:'trip.started',timestamp:'2026-11-03T06:00:00Z',value:{}},...interval('p','06:02:00','06:10:00.125',undefined,'pending'),...interval('a','06:12:00','06:24:00.250',720250,'approved'),...interval('u','06:28:00','06:32:00.375',undefined,'unapproved'),{event:'trip.stopped',timestamp:'2026-11-03T07:00:00Z',value:{}}];
const trip={id:1,startTime:'2026-11-03T06:00:00Z',endTime:'2026-11-03T07:00:00Z',standardTimeMilliseconds:3600000,productiveTimeMilliseconds:2160000,allowanceCreditMilliseconds:0,countedTimeMilliseconds:2160000,events};
const adjusted={...trip,id:2,startTime:'2026-11-03T08:00:00Z',events:[...events,{event:'trip.official-percent-set',value:{percentTenths:1100}}]};
const cleared={...adjusted,id:3,events:[...adjusted.events,{event:'trip.official-percent-cleared',value:{}}]};
const noDown={...trip,id:4,events:events.filter(e=>e.event.startsWith('trip.'))};
globalThis.rows=[trip,adjusted,cleared,noDown];globalThis.calendar={range:'day',timezone:'UTC',startTime:'2026-11-03T00:00:00Z',endTime:'2026-11-04T00:00:00Z',rules:{weekStartDay:6,cutoffTime:'00:00:00'}};
globalThis.includePending=true;
globalThis.view=new TripLog(document.querySelector('#runtime'),{range:()=> 'day',filter:()=> 'all',includeCurrent:()=>true,includePendingDownTime:()=>includePending,showPendingDownTime:()=>includePending,onShowPendingDownTime:value=>{includePending=value;view.rerender();},onIncludeCurrent(){},onFilter(){},onRange(){},onDate(){}});
view.render({trips:rows},calendar);
const sample=(title,element,hint)=>{const article=document.createElement('article'),h=document.createElement('h2'),box=document.createElement('div');h.textContent=title;box.className='sample';box.append(element);article.append(h,box);if(hint){const p=document.createElement('p');p.className='hint';p.textContent=hint;article.append(p);}document.querySelector('#samples').append(article);};
view.downTimeExpanded=true;sample('1 · Expanded',view.downTimeSection([trip]),'Pending is included by the master setting.');
view.downTimeExpanded=false;sample('2 · Collapsed · pending included',view.downTimeSection([trip]),'Only the applicable total remains. Expand to access the filter.');
includePending=false;sample('3 · Collapsed · pending excluded',view.downTimeSection([trip]),'The total switches to Approved alone.');
sample('4 · Trip Log settings',view.controls(calendar),'The two filters work together: both checked means a trip must match both.');
includePending=true;
});
assert.equal(await page.locator('#samples article').nth(0).locator('.trip-log-down-grid').isVisible(),true);
assert.equal(await page.locator('#samples article').nth(1).locator('.trip-log-down-grid').isVisible(),false);
assert.equal(await page.locator('#samples article').nth(1).locator('.trip-log-down-filter').isVisible(),false);
assert.match(await page.locator('#samples article').nth(1).locator('summary').innerText(),/Approved \+ Pending\s+0:20:00/);
assert.match(await page.locator('#samples article').nth(2).locator('summary').innerText(),/Approved\s+0:12:00/);
assert.equal(await page.locator('#samples article').nth(0).locator('.trip-log-down-pending .trip-log-down-milliseconds').innerText(),'(125 ms)');
assert.equal(await page.locator('#samples article').nth(1).locator('summary .trip-log-down-milliseconds').innerText(),'.375');
await page.evaluate(()=>{
const set=(selector,value)=>{const check=document.querySelector('#runtime '+selector);check.checked=value;check.dispatchEvent(new Event('change'));};
set('[data-show-pending]',false);if(view.showPending!==false)throw Error('explicit pending preference not retained');
set('[data-down-time-only]',true);if(document.querySelector('#runtime [data-show-pending]').checked||!document.querySelector('#runtime [data-show-pending]').disabled||!document.querySelector('#runtime [data-show-pending]').closest('label').classList.contains('is-unavailable'))throw Error('Pending override must retain the saved check value, disable and strike through');
if(!document.querySelector('#runtime .trip-log-down-pending'))throw Error('effective override must still show Pending');
if(document.querySelectorAll('#runtime .trip-log-trip').length!==3)throw Error('Down-only filter failed');
set('[data-adjusted-only]',true);if(document.querySelectorAll('#runtime .trip-log-trip').length!==1)throw Error('Filters must intersect and ignore cleared overrides');
set('[data-down-time-only]',false);if(document.querySelector('#runtime [data-show-pending]').checked||document.querySelector('#runtime [data-show-pending]').disabled)throw Error('original Pending visibility must be restored');
set('[data-show-pending]',true);set('[data-adjusted-only]',false);if(document.querySelectorAll('#runtime .trip-log-trip').length!==4)throw Error('Unfilter must restore original rows');
view.downTimeExpanded=false;view.rerender();view.rerender();if(document.querySelector('#runtime .trip-log-down-breakdown').open)throw Error('Collapsed state lost on rerender');
view.downTimeOnly=true;view.render({trips:[rows[3]]},calendar);
if(document.querySelector('#runtime .trip-log-down-section'))throw Error('zero Down section must be hidden');
const emptyFilter=document.querySelector('#runtime [data-down-time-filter-fallback]');if(!emptyFilter.disabled||!emptyFilter.checked||!view.downTimeOnly||!emptyFilter.closest('label').classList.contains('is-unavailable'))throw Error('zero Down must disable and strike through while retaining its check value');
view.render({trips:rows},calendar);if(!document.querySelector('#runtime [data-down-time-only]').checked||!document.querySelector('#runtime [data-show-pending]').disabled)throw Error('saved filter and Pending override must return when Down returns');

});
const styles=await page.evaluate(()=>{const cell=document.querySelector('#samples .trip-log-down-pending'),ms=document.querySelector('#samples .trip-log-down-logged .trip-log-down-milliseconds');return {align:getComputedStyle(cell).textAlign,ms:getComputedStyle(ms).fontSize,whole:getComputedStyle(ms.previousElementSibling).fontSize};});
assert.equal(styles.align,'left');assert.equal(styles.ms,styles.whole,'Logged milliseconds use the same size');
await page.waitForTimeout(100);
if(process.env.TRIP_LOG_SCREENSHOT_DIR){fs.mkdirSync(process.env.TRIP_LOG_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.TRIP_LOG_SCREENSHOT_DIR,'down-time-expanded-collapsed-settings.png'),fullPage:true});}
for(const width of [320,360,480]){await page.setViewportSize({width,height:1600});await page.addStyleTag({content:'main{grid-template-columns:1fr}'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'layout must fit '+width);}
console.log('PASS collapsible Down summary, master-based totals, intersecting filters, cleared override exclusion, and mobile layout');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
