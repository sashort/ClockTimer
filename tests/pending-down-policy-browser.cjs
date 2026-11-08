const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),php=process.env.CLOCKTIMER_TEST_PHP||'php';
const responses=JSON.parse(execFileSync(php,['-r',`require 'api/_core/trip_time_bank.php';$t=json_decode(file_get_contents('tests/fixtures/pending-down-late-lunch.json'),true)['trip'];$r=[];foreach([true,false] as $p){$b=trip_time_bank_projection($t,$t['events'],$p);$r[$p?'included':'excluded']=array_merge($t,$b??[],['pendingDownIncluded'=>$p]);}echo json_encode($r);`],{cwd:root,encoding:'utf8'}));
(async()=>{const b=await chromium.launch({headless:true});try{const p=await b.newPage({viewport:{width:390,height:844}});await p.setContent('<section id="log"></section>');await p.evaluate(ui=>globalThis.WMOFLanguagePack={text:id=>ui.texts[id]?.text||id},JSON.parse(fs.readFileSync(root+'/lang/en-US/ui-text.json','utf8')));for(const f of ['CalendarRange.js','TripAggregates.js','TripLog.js'])await p.addScriptTag({path:root+'/'+f});await p.evaluate(data=>{
 window.responses=data;window.pending=true;window.samples=[];window.failures=[];
 window.calendar={range:'day',timezone:'UTC',startTime:'2026-11-03T00:00:00Z',endTime:'2026-11-04T00:00:00Z',rules:{weekStartDay:6,cutoffTime:'00:00:00'}};
 window.view=new TripLog(document.querySelector('#log'),{range:()=> 'day',filter:()=> 'all',showPendingDownTime:()=>pending,onShowPendingDownTime:v=>{pending=v;view.rerender();}});
 view.render({trips:[data.included]},calendar);
 const observer=new MutationObserver(()=>{const text=document.querySelector('.trip-log-trip .trip-log-actual')?.textContent;const aggregate=document.querySelector('.trip-log-overview .trip-log-actual')?.textContent;samples.push({text,aggregate});for(const value of [text,aggregate])if(value&&value!==(pending?'98.45%':'61.44%'))failures.push(value);});observer.observe(document.querySelector('#log'),{childList:true,subtree:true,characterData:true});window.observer=observer;
},responses);
for(let i=0;i<4;i++)for(const include of [false,true]){
 await p.evaluate(async include=>{pending=include;view.rerender();await new Promise(r=>setTimeout(r,50));view.render({trips:[responses[include?'included':'excluded']]},calendar);await new Promise(r=>setTimeout(r,50));},include);
 assert.equal(await p.locator('.trip-log-trip .trip-log-actual').innerText(),include?'98.45%':'61.44%');
 assert.equal(await p.locator('.trip-log-trip .trip-log-downtime.is-not-applied').count(),include?0:1,'trip ledger reflects pending accounting');
 assert.equal(await p.locator('.trip-log-aggregate-pane .trip-log-downtime.is-not-applied').count(),include?0:1,'Day aggregate ledger reflects the same pending accounting');
}
assert.deepEqual(await p.evaluate(()=>failures),[],'cached and PHP response renders never flash a partial or inflated percentage');
await p.evaluate(()=>{observer.disconnect();pending=false;view.hasVisibleDownTime=false;view.downTimeOnly=true;view.render({trips:[responses.excluded]},calendar);view.setSettingsVisible(true);});
assert.equal(await p.locator('.trip-log-trip .trip-log-actual').innerText(),'61.44%','Down-only never overrides pending accounting');
const check=p.locator('[data-show-pending]');assert.equal(await check.isDisabled(),false);await check.click();assert.equal(await p.locator('.trip-log-trip .trip-log-actual').innerText(),'98.45%');assert.equal(await check.evaluate(e=>e.closest('label').classList.contains('is-overridden')),false);
console.log('PASS PHP/client policy parity, two pending intervals with late Lunch, stable trip/aggregate rendering, independent Down-only filtering, editable preferences and inactive ledger styling');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
