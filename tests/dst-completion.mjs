import fs from 'node:fs';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
if(!process.argv[2]){
 for(const transition of ['2026-11-01T06:00:00Z','2027-03-14T07:00:00Z'])for(const phase of ['running','down','break'])process.stdout.write(execFileSync(process.execPath,['--max-old-space-size=512',fileURLToPath(import.meta.url),transition,phase],{encoding:'utf8',timeout:45000}));
}else{
 process.env.TZ='America/New_York';const {Window}=await import('happy-dom'),w=new Window({url:'https://clock.example/'}),edge=Date.parse(process.argv[2]),phase=process.argv[3],start=edge-60000;
 w.matrixNow=start;w.eval('const NativeDate=Date;window.Date=class extends NativeDate{constructor(...a){super(...(a.length?a:[window.matrixNow]));}static now(){return window.matrixNow;}};');
 const css=w.CSS;css.registerProperty=()=>{};Object.defineProperty(w,'CSS',{value:css});Object.defineProperty(w,'AbortController',{value:globalThis.AbortController});Object.defineProperty(w,'AbortSignal',{value:globalThis.AbortSignal});Object.defineProperty(w,'structuredClone',{value:globalThis.structuredClone});
 w.Element.prototype.animate=()=>({finished:Promise.resolve(),cancel(){},finish(){},play(){},pause(){},effect:{getComputedTiming(){return{progress:1}}}});
 for(const name of ['TemporalFormat','RingContainer','TimeRangeModel','TimeRangeElement','ClockTimer'])w.eval(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8'));
 let events=[],writes=[],id=1;w.fetch=async(url,options={})=>{if(options.body)writes.push(JSON.parse(options.body));const pathname=new URL(url,'https://clock.example/').pathname,data=pathname.endsWith('/users/')?{csrfToken:'a'.repeat(64),user:{id:2},tripStorageVersion:2}:pathname.endsWith('/trip-events/')?{events,eventId:id++}:{tripId:99};return{ok:true,status:200,json:async()=>({...data,accepted:true}),clone(){return this;}};};
 const make=async()=>{const c=w.document.createElement('clock-timer');w.document.body.append(c);c.configure({goal_type:'trip',trip_goal:'100%',goal_bounding:false});await c.connect('test','test');return c;};let live,restored;
 try{
  live=await make();await live.start({standardTime:'0:30:00'});await live.persistCurrentTrip();w.matrixNow=edge-30000;if(phase!=='running')await live.startInterval(phase,phase==='break'?60000:undefined,{});
  events=structuredClone(live.captureState().events).map((e,i)=>({...e,id:i+1}));const first=events.find(e=>e.event==='trip.started');first.value.creationAnchor=process.argv[2].slice(0,10)+'T00:00:00Z';first.value.creationTime=first.value.scheduledStart=first.value.startTime=first.timestamp.slice(11,23);live.remove();
  w.matrixNow=edge+30000;restored=await make();await restored.loadTrip(99);if(phase!=='running')await restored.endInterval();w.matrixNow=edge+60000;const from=writes.length;await restored.stop();
  const stop=writes.slice(from).find(e=>e.event==='trip.stopped'),aggregate=writes.slice(from).find(e=>e.action==='stop');assert(stop);assert(aggregate);assert.equal(stop.scheduledStartTime,new Date(start).toISOString());assert.equal(aggregate.scheduledStartTime,stop.scheduledStartTime);assert.equal(stop.value.countedTimeMilliseconds,phase==='running'?120000:60000);assert.equal(aggregate.countedTimeMilliseconds,stop.value.countedTimeMilliseconds);
  console.log(`PASS ${process.argv[2]} ${phase}: cross-DST reload and completion preserve UTC anchor and physical counted time`);
 }finally{live?.remove();restored?.remove();await w.happyDOM.close();}
}
