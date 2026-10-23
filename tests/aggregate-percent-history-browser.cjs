const assert=require('node:assert/strict'),create=require('./order-filler-master-fixture.cjs');
(async()=>{const f=await create({input:'transcript'});try{
 const requests=[];
 const now=await f.page.evaluate(()=>Date.now());
 const trips=[0,1,3,6,10,17,35,100,200].map((days,i)=>{const start=new Date(now-days*86400000);start.setHours(1,0,0,0);return {id:100+i,startTime:start.toISOString(),endTime:new Date(+start+600000).toISOString(),standardTimeMilliseconds:600000+i*10000,actualTimeMilliseconds:600000,countedTimeMilliseconds:600000};});
 await f.page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());if(!/\/trips(?:\/|$)/.test(url.pathname)||route.request().method()!=='GET')return route.fallback();
  const params=Object.fromEntries(url.searchParams);requests.push(params);
  const start=Date.parse(params.startTime),end=Date.parse(params.endTime);
  const selected=trips.filter(t=>(!Number.isFinite(start)||Date.parse(t.startTime)>=start)&&(!Number.isFinite(end)||Date.parse(t.startTime)<end));
  const production=selected.reduce((a,t)=>({tripCount:a.tripCount+1,standardTimeMilliseconds:a.standardTimeMilliseconds+t.standardTimeMilliseconds,actualTimeMilliseconds:a.actualTimeMilliseconds+t.actualTimeMilliseconds,countedTimeMilliseconds:a.countedTimeMilliseconds+t.countedTimeMilliseconds}),{tripCount:0,standardTimeMilliseconds:0,actualTimeMilliseconds:0,countedTimeMilliseconds:0});
  await route.fulfill({json:{trips:selected,aggregateBreakdown:{production,nonProduction:{trips:[]}}}});
 });

 for(const [kind,value] of [['id','0042'],['pin','1234']]){for(let i=0;i<4;i++)await f.page.locator(`[data-login-digit="${kind}"][data-digit-index="${i}"]`).fill(value[i]);await f.page.evaluate(()=>document.querySelector('#loginButton').click());}
 await f.page.waitForFunction(()=>!document.querySelector('#loginDialog').open);
 await f.say('trip mode');await f.say('ready');await f.say('five minutes');await f.say('okay');await f.page.clock.runFor(3000);
 const read=()=>f.page.evaluate(()=>{const c=document.querySelector('#clockTimer'),s=c.getSummarySnapshot();return {text:document.querySelector('#currentPercentValue').textContent,ui:c.getUIState().current_percent_component,trip:s.trip.countedPercent,total:s.total?.countedPercent,totalStandard:s.total?.standardTimeMilliseconds,actual:s.total?.countedTimeElapsedMilliseconds,mode:c.percentMode,sync:c.autoSyncTripGoal,override:c.syncOverride,standard:document.querySelector('#standardTimeLabel').textContent};});
 const results=[];
 for(const scope of ['day','week','money','year']){
  await f.say('trip mode');
  const responseReady=f.page.waitForResponse(r=>/\/api\/trips(?:\/|$)/.test(new URL(r.url()).pathname)&&r.request().method()==='GET');
  await f.say(scope+' mode');
  const response=await responseReady,body=await response.json();
  const expected=body.aggregateBreakdown.production.standardTimeMilliseconds+300000;
  await f.page.waitForFunction(expected=>document.querySelector('#clockTimer').getSummarySnapshot().total?.standardTimeMilliseconds===expected,expected);
  await f.page.clock.runFor(1000);
  const samples=[];for(let tick=0;tick<=10;tick++){samples.push({tick,...await read()});if(tick<10)await f.page.clock.runFor(1000);}
  assert.notEqual(samples[0].text,samples.at(-1).text,scope+' visible actual percentage must change on ticks');
  assert(samples.at(-1).actual>samples[0].actual,scope+' counted elapsed must advance');
  assert.equal(samples.at(-1).totalStandard,expected,scope+' must retain its selected history');
  results.push({scope,expected,samples});console.log('PASS '+scope+' visible percentage advances with distinct server history');
 }
 assert.equal(new Set(results.map(r=>r.expected)).size,4,'Day, Week, Money, Year must use distinct aggregates');assert.deepEqual(f.errors,[]);

 }finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
