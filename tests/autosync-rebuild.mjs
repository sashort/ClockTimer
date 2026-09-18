import { Window } from 'happy-dom';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
if(process.env.CLOCKTIMER_LIVE_TEST !== '1') throw Error('Set CLOCKTIMER_LIVE_TEST=1 to authorize creating mock trips.');
const username=process.env.CLOCKTIMER_TEST_USERNAME;
const password=process.env.CLOCKTIMER_TEST_PASSWORD;
if(!username||!password)throw Error('Test account credentials are required in environment variables.');
const base=process.env.CLOCKTIMER_BASE_URL || 'https://wmof.sashort-apps.com/';
const outputDirectory=path.resolve(process.env.CLOCKTIMER_TEST_OUTPUT || 'work/trip-sync-results');
fs.mkdirSync(outputDirectory,{recursive:true});
const window=new Window({url:base});
Object.defineProperty(window,'AbortController',{value:globalThis.AbortController});
Object.defineProperty(window,'AbortSignal',{value:globalThis.AbortSignal});
const css=window.CSS; css.registerProperty=()=>{}; Object.defineProperty(window,'CSS',{value:css});
window.Element.prototype.animate=()=>({finished:Promise.resolve(),cancel(){},finish(){},play(){},pause(){},effect:{getComputedTiming(){return {progress:1}}}});
window.__testTime=Date.parse('2026-09-17T16:00:00Z');
window.eval(`const TestRealDate=Date; window.Date=class extends TestRealDate { constructor(...args){super(...(args.length?args:[window.__testTime]));} static now(){return window.__testTime;} };`);
let offline=false, interruptStopPatch=false, cookies=new Map(), csrf;
const requests=[];
window.fetch=async (url,options={})=>{
  if(offline) throw new TypeError('Simulated network interruption');
  if(interruptStopPatch&&options.method==='PATCH'&&JSON.parse(options.body||'{}').action==='stop'){
    interruptStopPatch=false;
    throw new TypeError('Simulated connection loss after stop event upload');
  }
  const headers={...options.headers,Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')};
  let response;
  try { response=await fetch(new URL(url,base),{...options,headers}); }
  catch(e){console.log('FETCHFAILED',String(url),e.message,e.cause?.message);throw e;}
  for(const cookie of response.headers.getSetCookie()){const [part]=cookie.split(';');const i=part.indexOf('=');cookies.set(part.slice(0,i),part.slice(i+1));}
  const data=await response.clone().json().catch(()=>({}));
  if(data.csrfToken) csrf=data.csrfToken;
  requests.push({url:String(url),method:options.method||'GET',status:response.status});
  return response;
};
const report={environment:'DOM simulation using real ClockTimer code and live HTTPS APIs; CSS registration and animation are stubbed',results:[],trips:[]};
const normalize=value=>JSON.parse(JSON.stringify(value));
function check(name,fn){fn();report.results.push({test:name,passed:true});console.log('PASS',name);}
function advance(minutes){window.__testTime+=minutes*60000;}
function clock(){const d=new window.Date();return [d.getHours(),d.getMinutes(),d.getSeconds()].map(x=>String(x).padStart(2,'0')).join(':');}
async function api(endpoint,body){const r=await window.fetch('api/'+endpoint+'/',{method:body?'POST':'GET',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw Error(JSON.stringify(d));return d;}
async function events(id,view='log'){const r=await window.fetch(`api/trip-events/?tripId=${id}&view=${view}`);assert.equal(r.status,200);return r.json();}
async function fresh(){const c=window.document.createElement('clock-timer');c.addEventListener('networkStatusChanged',e=>console.log('NETWORKCHANGE',JSON.stringify(e.detail)));window.document.body.append(c);await c.connect(username,password);return c;}
async function rebuild(c,id,label){
  const before=normalize(c.toJSON());
  const expectedSummary=normalize(c.getSummarySnapshot());
  const log=await events(id);
  const recon=await events(id,'reconstruction');
  const writesBefore=requests.filter(x=>x.method!=='GET').length;
  const copy=window.document.createElement('clock-timer');window.document.body.append(copy);
  await copy.resumeConnection();
  const loaded=await copy.loadTrip(id);
  const after=normalize(copy.toJSON());
  const response=await window.fetch('api/trips/?result=list&minDateTime=2026-09-17T00:00:00Z&maxDateTime=2026-09-18T00:00:00Z&nonProductionFilter=all&verbose=true&limit=100');
  const saved=(await response.json()).trips.find(t=>t.id===id);
  check(label+' stored actual duration matches rebuilt trip',()=>assert.equal(saved.actualTimeMilliseconds,loaded.summary.trip.actualTimeElapsedMilliseconds));
  check(label+' stored standard duration matches rebuilt trip',()=>assert.equal(saved.standardTimeMilliseconds,loaded.summary.trip.standardTimeMilliseconds));
  check(label+' stored counted duration matches rebuilt trip',()=>assert.equal(saved.countedTimeMilliseconds,loaded.summary.trip.countedTimeElapsedMilliseconds));
  check(label+' rebuilt timing summary matches original',()=>{
    for(const key of ['standardTimeMilliseconds','actualTimeElapsedMilliseconds','countedTimeElapsedMilliseconds','countedPercent'])assert.equal(loaded.summary.trip[key],expectedSummary.trip[key]);
  });
  check(label+' rebuild matches original JSON',()=>assert.deepEqual(after,before));
  check(label+' replay creates no new writes',()=>assert.equal(requests.filter(x=>x.method!=='GET').length,writesBefore));
  check(label+' exactly one trip start and stop',()=>{assert.equal(log.events.filter(x=>x.event==='trip.started').length,1);assert.equal(log.events.filter(x=>x.event==='trip.stopped').length,1);});
  report.trips.push({scenario:label,tripId:id,original:before,rebuilt:after,loadResult:normalize(loaded),log:log.events,reconstruction:recon.events});
  copy.remove();c.remove();
}
try{
  for(const name of ['TemporalFormat','RingContainer','TimeRange','ClockTimer'])window.eval(fs.readFileSync(new URL(`../${name}.js`,import.meta.url),'utf8'));
  let c=await fresh();
  const prepared=await c.prepareTrip({at:new window.Date()});
  console.log('PREPARED',JSON.stringify(prepared),'NETWORK',c.networkStatus);
  check('prepare returns pending database trip',()=>assert.equal(prepared.pending,true));
  report.createdTripIds=[prepared.tripId];
  const started=await c.start({standardTime:'00:20:00'});
  console.log('STARTED',JSON.stringify(started),'REQUESTS',JSON.stringify(requests));
  check('online start autosyncs',()=>assert.equal(started.synced,true));
  advance(2);
  const interval=await c.startInterval('break','2:00',{'mock-label':'autosync-online'});
  check('online interval receives event database ID',()=>assert.ok(interval.synced&&interval.intervalId>0));
  advance(1);await c.endInterval();
  c.standardTime='00:21:00';
  let log;
  for(let attempt=0;attempt<30;attempt++){log=await events(started.tripId);if(log.events.some(e=>e.event==='trip.standard-time-changed'))break;await new Promise(r=>setTimeout(r,100));}
  check('property change autosyncs without explicit sync',()=>assert.ok(log.events.some(e=>e.event==='trip.standard-time-changed'&&e.value.value===c.standardTime)));
  advance(5);
  const stopped=await c.stop(clock());
  check('online stop autosyncs',()=>assert.equal(stopped.synced,true));
  await rebuild(c,started.tripId,'online');
  window.__testTime=Date.parse('2026-09-17T18:00:00Z');
  c=await fresh();
  const pending=await c.prepareTrip({at:new window.Date()});report.createdTripIds.push(pending.tripId);
  offline=true;
  const localStart=await c.start({standardTime:'00:20:00'});
  check('offline start remains locally usable',()=>assert.equal(localStart.synced,false));
  advance(2);const localInterval=await c.startInterval('break','2:00',{'mock-label':'autosync-offline'});
  check('offline interval queues without database ID',()=>assert.equal(localInterval.synced,false));
  advance(1);await c.endInterval();
  advance(5);const localStop=await c.stop(clock());
  check('offline stop queues',()=>assert.equal(localStop.synced,false));
  offline=false;
  const resumed=await c.resumeConnection();
  check('reconnection flushes queued changes',()=>assert.equal(resumed,true));
  const flushed=await events(pending.tripId);
  check('queued lifecycle events reach server',()=>assert.deepEqual(flushed.events.map(x=>x.event),['trip.started','interval.started','interval.ended','trip.stopped']));
  const eventCount=flushed.events.length;
  await c.resumeConnection();
  const retried=await events(pending.tripId);
  check('reconnect retry does not duplicate events',()=>assert.equal(retried.events.length,eventCount));
  await rebuild(c,pending.tripId,'offline-then-reconnected');
  window.__testTime=Date.parse('2026-09-17T20:00:00Z');
  c=await fresh();
  const retryPrepared=await c.prepareTrip({at:new window.Date()});report.createdTripIds.push(retryPrepared.tripId);
  await c.start({standardTime:'00:20:00'});
  advance(8);interruptStopPatch=true;
  const partialStop=await c.stop(clock());
  check('interrupted stop remains unsynced',()=>assert.equal(partialStop.synced,false));
  const retryConnected=await c.resumeConnection();
  check('retry finishes interrupted stop update',()=>assert.equal(retryConnected,true));
  const retryEvents=await events(retryPrepared.tripId);
  check('retry does not duplicate accepted stop event',()=>assert.equal(retryEvents.events.filter(e=>e.event==='trip.stopped').length,1));
  await rebuild(c,retryPrepared.tripId,'interrupted-stop-retry');
}catch(error){report.results.push({test:'execution',passed:false,error:error.message,stack:error.stack});console.error(error);process.exitCode=1;}
finally{
  offline=false;
  try{
    const r=await window.fetch('api/trips/?result=list&minDateTime=2026-09-17T00:00:00Z&maxDateTime=2026-09-18T00:00:00Z&nonProductionFilter=all&verbose=true&limit=100');
    const data=await r.json();
    fs.writeFileSync(path.join(outputDirectory,'mock-trip-data.json'),JSON.stringify(data,null,2));
    report.returnedData=data;
  }catch(e){report.fetchError=e.message;}
  report.passed=report.results.filter(x=>x.passed).length;
  report.failed=report.results.filter(x=>!x.passed).length;
  fs.writeFileSync(path.join(outputDirectory,'trip-autosync-test-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:report.passed,failed:report.failed,createdTripIds:report.createdTripIds}));
  await window.happyDOM.close();
}
