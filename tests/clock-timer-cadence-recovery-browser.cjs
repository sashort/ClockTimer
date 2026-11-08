const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const scenario of process.argv.slice(2).length?process.argv.slice(2):['display','model']){
  assert(['display','model'].includes(scenario),'Only general cadence recovery scenarios are supported');
  const p=await browser.newPage({timezoneId:'America/New_York'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.clock.install({time:new Date('2026-11-07T16:15:38.099Z')});
   await p.setContent('<!doctype html><style>clock-timer{display:block;width:360px;height:360px}</style>');
   await p.evaluate(()=>{window.shadows=new WeakMap();const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(o){const s=attach.call(this,o);shadows.set(this,s);return s;};window.fetch=async()=>new Response('{}',{status:401});});
   for(const name of ['TemporalFormat','RingContainer','TimeRangeModel','TimeRangeElement','ClockTimer'])await p.addScriptTag({content:fs.readFileSync(path.join(root,name+'.js'),'utf8')});
   await p.evaluate(()=>{window.clock=document.createElement('clock-timer');clock.setAttribute('time-format','HH:mm:ss');document.body.append(clock);});
   if(scenario!=='display')await p.evaluate(()=>clock.start({standardTimeMilliseconds:120000}));
    await p.clock.runFor(1200);
    await p.evaluate(kind=>{
     window.injected=0;
     if(kind==='display'){
      const original=TemporalFormat.formatTime;TemporalFormat.formatTime=function(...args){if(!injected&&args[1]==='HH:mm:ss'){injected++;throw Error('transient display fixture failure');}return original.apply(this,args);};
     }else{
      const original=TimeRangeGroup.prototype.tick;TimeRangeGroup.prototype.tick=function(...args){if(!injected){injected++;throw Error('transient model fixture failure');}return original.apply(this,args);};
     }
    },scenario);
    try{await p.clock.runFor(3500);}catch(error){
     const expected=`transient ${scenario} fixture failure`;assert(error.message.includes(expected));errors.push(expected);
     await p.clock.runFor(3500);
    }
    assert.equal(await p.evaluate(()=>injected),1);
   const read=()=>p.evaluate(()=>({wall:shadows.get(clock).querySelector('#time').textContent,expected:TemporalFormat.formatTime(new Date(),'HH:mm:ss'),stamp:clock.getUIState().timestamp}));
   const before=await read();await p.clock.runFor(3000);const after=await read();
   assert.notEqual(after.wall,before.wall,scenario+': wall clock must keep advancing');
   assert.equal(after.wall,after.expected,scenario+': wall clock catches up without reload');
   if(scenario!=='display')assert.notEqual(after.stamp,before.stamp,scenario+': productive cadence advances too');
   assert.deepEqual([...new Set(errors)],[`transient ${scenario} fixture failure`],'original error remains observable');
   console.log('PASS '+scenario+': recurring clock cadence survives a transient error without reloading');
  }finally{await p.close();}
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
