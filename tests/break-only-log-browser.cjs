const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});try{
const page=await browser.newPage({viewport:{width:480,height:520},deviceScaleFactor:1});
await page.setContent('<html><head><style>'+fs.readFileSync(path.join(root,'app.css'),'utf8')+'</style><style>html,body{margin:0;width:100%;height:auto;min-height:100%;background:#333b44;color:white;font-family:Arial,sans-serif}#log{width:100%;height:auto;max-height:none;overflow:visible}.trip-log-settings,.trip-log-overview,.trip-log-column-header{display:none!important}.trip-log-trip{margin:16px}.trip-log-trip.is-active-trip>summary{animation-delay:-2100ms;animation-play-state:paused}</style></head><body><section id="log" class="trip-log-body trip-log-merged"></section></body></html>');
await page.evaluate(ui=>{globalThis.WMOFLanguagePack={text:id=>ui.texts[id]?.text||id};},JSON.parse(fs.readFileSync(path.join(root,'lang/en-US/ui-text.json'),'utf8')));
for(const name of ['CalendarRange.js','TripAggregates.js','TripLog.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,name),'utf8')});
await page.evaluate(()=>{
const events=[{event:'trip.started',timestamp:'2026-10-20T12:00:00Z',value:{breakOnly:true}},{event:'interval.started',timestamp:'2026-10-20T12:00:00Z',value:{type:'break',intervalKey:'b',length:900000}},{event:'interval.ended',timestamp:'2026-10-20T12:15:00Z',value:{intervalKey:'b'}},{event:'trip.stopped',timestamp:'2026-10-20T12:15:00Z',value:{}}];
const rows=[{id:1,startTime:'2026-10-20T12:00:00Z',endTime:'2026-10-20T12:15:00Z',breakOnly:true,standardTimeMilliseconds:null,nonProduction:false,events},{id:2,startTime:'2026-10-20T13:00:00Z',breakOnly:true,running:true,activeState:'break',standardTimeMilliseconds:null,events:events.slice(0,2)}];
globalThis.view=new TripLog(document.querySelector('#log'),{now:()=>Date.parse('2026-10-20T13:07:32Z'),range:()=> 'day',filter:()=> 'all',includeCurrent:()=>true,onIncludeCurrent(){},onFilter(){},onRange(){},onDate(){},numberPad:async()=>{},request:async()=>({}),refresh:async()=>{}});
view.render({trips:rows},{range:'day',timezone:'UTC',startTime:'2026-10-20T00:00:00Z',endTime:'2026-10-21T00:00:00Z',rules:{weekStartDay:6,cutoffTime:'00:00:00'}});
});
assert.equal(await page.locator('.trip-log-break-only-badge').count(),2);
assert.equal(await page.evaluate(()=>view.aggregation.tripCount),0);
assert.equal(await page.locator('.trip-log-trip .trip-log-actual').count(),0);
assert(await page.locator('.is-active-trip>summary').evaluate(el=>getComputedStyle(el).backgroundImage.includes('gradient')));
await page.locator('[data-trip-id="1"]').evaluate(el=>el.open=true);
const entryColors=await page.locator('.is-break-only .trip-log-entry').evaluateAll(rows=>rows.map(row=>getComputedStyle(row).color));
assert(entryColors.length>0,'expanded break-only rows have visible entries');
assert(entryColors.every(color=>color==='rgb(0, 30, 96)'),'break-only entry text contrasts with the light background');
const out=path.join(root,'tests/artifacts/break-sessions');fs.mkdirSync(out,{recursive:true});
await page.screenshot({path:path.join(out,'break-only-badge.png')});
await page.locator('[data-trip-id="2"]>summary').screenshot({path:path.join(out,'break-only-badge-row.png')});
for(const width of [320,390,480]){await page.setViewportSize({width,height:520});assert(await page.locator('#log').evaluate(el=>document.documentElement.scrollWidth<=innerWidth),'row fits '+width);}
console.log('PASS break-only badges, no performance data, selected navy streak and mobile widths');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
