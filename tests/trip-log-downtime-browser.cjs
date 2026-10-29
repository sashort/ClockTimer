const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});try{
for(const width of [360,480,900]){
const page=await browser.newPage({viewport:{width,height:1200},deviceScaleFactor:1});
await page.setContent('<html><head><style>'+fs.readFileSync(path.join(root,'styles/default/app.css'),'utf8')+'</style><style>html,body{margin:0;width:100%;max-width:none;min-height:100%;background:#333b44;color:white;font-family:Arial,sans-serif}#log{height:auto;max-height:none;width:100%;max-width:none;box-sizing:border-box;overflow:visible}.trip-log-settings{display:none!important}</style></head><body><section id="log" class="trip-log-body trip-log-merged"></section></body></html>');
await page.evaluate(ui=>{globalThis.WMOFLanguagePack={text:id=>ui.texts[id]?.text||id};},JSON.parse(fs.readFileSync(path.join(root,'lang/en-US/ui-text.json'),'utf8')));
for(const name of ['CalendarRange.js','TripAggregates.js','TripLog.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,name),'utf8')});
await page.evaluate(()=>{
const events=[{event:'interval.started',timestamp:'2026-10-18T08:05:00Z',value:{type:'down',intervalKey:'d',approvedTime:360000}},{event:'interval.ended',timestamp:'2026-10-18T08:13:00Z',value:{intervalKey:'d'}}];
const rows=[{id:1,startTime:'2026-10-18T08:00:00Z',standardTimeMilliseconds:1800000,actualTimeMilliseconds:1800000,events},{id:2,startTime:'2026-10-18T09:00:00Z',standardTimeMilliseconds:1800000,actualTimeMilliseconds:1800000,events:[]}];
globalThis.logView=new TripLog(document.querySelector('#log'),{range:()=> 'custom',filter:()=> 'all',includeCurrent:()=>false,onIncludeCurrent(){},onFilter(){},onRange(){},onDate(){},numberPad:async()=>{},request:async()=>({}),refresh:async()=>{}});
logView.render({trips:rows},{range:'custom',timezone:'UTC',startTime:'2026-10-01T00:00:00Z',endTime:'2026-11-30T00:00:00Z',rules:{weekStartDay:6,cutoffTime:'00:00:00'}});
});
assert.equal(await page.locator('.trip-log-group').count(),3);
assert.equal(await page.locator('[data-trip-id="2"] .trip-log-downtime').count(),0);
assert.equal(await page.locator('.trip-log-overview .trip-log-downtime').count(),1);
const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,guides:[...document.querySelectorAll('.trip-log-group')].map(group=>{
const summary=group.querySelector(':scope>summary'),child=group.querySelector(':scope>.trip-log-group-children'),marker=getComputedStyle(summary,'::before'),connector=getComputedStyle(summary,'::after'),box=summary.getBoundingClientRect(),r=child.getBoundingClientRect();return {arrow:box.left+parseFloat(marker.left)+parseFloat(marker.width)/2,line:r.left+parseFloat(getComputedStyle(child).borderLeftWidth)/2,arrowBottom:box.top+parseFloat(marker.top)+parseFloat(marker.height),connectorTop:box.top+parseFloat(connector.top),connectorBottom:box.top+parseFloat(connector.top)+parseFloat(connector.height),childTop:r.top};}),ledger:getComputedStyle(document.querySelector('.trip-log-downtime')).backgroundColor}));
assert(geometry.scroll<=geometry.width+1,'nested layout must fit '+JSON.stringify(geometry));
assert.equal(geometry.ledger,'rgb(9, 11, 13)');
const overlaps=await page.evaluate(()=>[...document.querySelectorAll('.trip-log-trip>summary')].flatMap(summary=>{
 const cells=[...summary.children].filter(e=>!e.classList.contains('trip-log-menu')&&!e.classList.contains('trip-log-downtime')).slice(0,4);
 const rects=cells.map(cell=>{const r=document.createRange();r.selectNodeContents(cell);return r.getBoundingClientRect();});
 return rects.slice(1).filter((r,i)=>rects[i].right>r.left+1).map(r=>({x:r.x,width:r.width}));
}));assert.deepEqual(overlaps,[],'trip time/performance columns remain readable');
for(const g of geometry.guides){assert(Math.abs(g.arrow-g.line)<=1,'guide aligned beneath its own arrow '+JSON.stringify(g));assert(Math.abs(g.arrowBottom-g.connectorTop)<=1,'guide starts directly below the arrow');assert(Math.abs(g.connectorBottom-g.childTop)<=1,'no gap between header guide and children '+JSON.stringify(g));}
const group=page.locator('.trip-log-group').first();await group.locator(':scope>summary').click();assert.equal(await group.locator(':scope>.trip-log-group-children').isVisible(),false);await group.locator(':scope>summary').click();
if(process.env.TRIP_LOG_SCREENSHOT_DIR){fs.mkdirSync(process.env.TRIP_LOG_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.TRIP_LOG_SCREENSHOT_DIR,'downtime-'+width+'.png'),fullPage:true});}
await page.close();console.log('PASS downtime mobile layout, black ledgers, zero omission and arrow-aligned guides at '+width+'px');
}
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
