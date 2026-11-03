// Exhaustive interval placement around both DST transitions. All writes stay in memory.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const php=process.env.CLOCKTIMER_TEST_PHP||'php',root=path.resolve(__dirname,'..');
const run=cases=>JSON.parse(execFileSync(php,['tests/trip-editor-dst-fixture.php'],{cwd:root,input:JSON.stringify(cases),encoding:'utf8',maxBuffer:128*1024*1024}));
const instant=ms=>new Date(ms).toISOString(),epoch=value=>Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(value)?value:value.replace(' ','T')+'Z');
const choose=(a,n)=>n===0?[[]]:a.flatMap((v,i)=>choose(a.slice(i+1),n-1).map(rest=>[v,...rest]));
const placements=choose([-75,-45,-15,15,45,75],4).flatMap(bounds=>[false,true].map(reverse=>({start:-90,end:90,bounds,reverse})))
 .concat([{start:-180,end:-30,bounds:[-160,-140,-100,-60],reverse:false},{start:30,end:180,bounds:[60,90,120,150],reverse:true}]);
const edits=['none','delete-down','down-start','down-end','scheduled-start','trip-start','trip-end','standard','productive'];
(async()=>{const {Window}=await import('./LanguageWindow.mjs');const w=new Window();let total=0;try{
 w.eval('const NativeDate=Date;window.Date=class extends NativeDate{constructor(...a){super(...(a.length?a:[window.matrixNow]));}static now(){return window.matrixNow;}};');
 for(const name of ['TripAggregates','TripLog','TripEditor'])w.eval(fs.readFileSync(path.join(root,name+'.js'),'utf8'));
 for(const timezone of ['America/New_York','UTC'])for(const transition of ['2026-11-01T06:00:00Z','2027-03-14T07:00:00Z']){
  const edge=epoch(transition),bases=[];
  for(const placement of placements)for(const approval of ['pending','approved','unapproved']){
   const start=edge+placement.start*60000+125,end=edge+placement.end*60000+875,points=placement.bounds.map((v,i)=>edge+v*60000+250+i*125);
   const [downStart,downEnd,breakStart,breakEnd]=placement.reverse?[points[2],points[3],points[0],points[1]]:points;
   const downMs=downEnd-downStart,approved=approval==='approved'?Math.floor(downMs/2):null,standard=2838000;
   const events=[{id:1,event:'trip.started',timestamp:instant(start),scheduledStartTime:instant(start),value:{timelineVersion:2,creationOffsetMilliseconds:0,startOffsetMilliseconds:0,scheduledStartOffsetMilliseconds:0,standardTimeMilliseconds:standard,nonProduction:false}},
    {id:2,event:'interval.started',timestamp:instant(downStart),value:{type:'down',intervalKey:'down',approvalState:approval,approvedTime:approved}},
    {id:3,event:'interval.ended',timestamp:instant(downEnd),value:{intervalKey:'down'}},
    {id:4,event:'interval.started',timestamp:instant(breakStart),value:{type:'break',intervalKey:'break',length:breakEnd-breakStart-2000,startBuffer:1000,endBuffer:1000}},
    {id:5,event:'interval.ended',timestamp:instant(breakEnd),value:{intervalKey:'break'}},
    {id:6,event:'trip.stopped',timestamp:instant(end),value:{}}].sort((a,b)=>epoch(a.timestamp)-epoch(b.timestamp));
   bases.push({events,timezone,oracle:{start,end,downStart,downEnd,breakStart,breakEnd,approved,approval,standard}});
  }
  const originals=run(bases),requests=[],checks=[];
  for(let i=0;i<bases.length;i++)for(const editSide of [-1,1])for(const edit of edits){
   w.matrixNow=edge+editSide*7*86400000;const before=bases[i],data=originals[i],editor=new w.TripEditor(data.trip,data,{},{timezone});
   const expected={...before.oracle,scheduled:before.oracle.start,production:true},originalTimes=new Map(editor.events.map(e=>[e.id,epoch(e.timestamp)]));
   const down=editor.events.find(e=>e.id===2),downEnd=editor.events.find(e=>e.id===3);editor.changed=()=>{};
   if(edit==='delete-down')editor.events=editor.events.filter(e=>e.value.intervalKey!=='down');
   if(edit==='down-start')down.timestamp=instant(expected.downStart+=1000);
   if(edit==='down-end')downEnd.timestamp=instant(expected.downEnd-=1000);
   if(edit==='scheduled-start')editor.settings.instants.scheduledStart=instant(expected.scheduled-=1000);
   if(edit==='trip-start')editor.events.find(e=>e.id===1).timestamp=instant(expected.start-=1000);
   if(edit==='trip-end')editor.events.find(e=>e.id===6).timestamp=instant(expected.end+=1000);
   if(edit==='standard')editor.settings.standardTimeMilliseconds=expected.standard+=60000;
   if(edit==='productive'){editor.settings.nonProduction=true;expected.production=false;}
   assert(!editor.hasInvalid(),`${timezone} ${transition} ${edit} should be valid`);
   const change=editor.payload();requests.push({events:before.events,timezone,change});checks.push({expected,edit,originalTimes,side:editSide});
  }
  const results=run(requests);
  for(let i=0;i<results.length;i++){
   const result=results[i],{expected:e,edit,originalTimes,side}=checks[i],label=`${timezone} ${transition} edit ${edit} ${side<0?'before':'after'} transition`;
   assert.equal(epoch(result.settings.instants.scheduledStart),e.scheduled,label+' scheduled anchor');
   for(const event of result.events){if(event.id===null){assert.equal(event.event,'interval.approval-changed');assert.equal(epoch(event.timestamp),e.downEnd,label+' approval timestamp');continue;}let expected=originalTimes.get(event.id);if(event.id===1)expected=e.start;if(event.id===6)expected=e.end;if(event.id===2)expected=e.downStart;if(event.id===3)expected=e.downEnd;assert.equal(epoch(event.timestamp),expected,label+' factual instant');}
   const down=edit==='delete-down'?0:e.approval==='pending'?e.downEnd-e.downStart:e.approval==='approved'?e.approved:0;
   const counted=e.end-Math.min(e.start,e.scheduled)-(e.breakEnd-e.breakStart)-down;
   assert.equal(result.trip.countedTimeMilliseconds,counted,label+' physical counted duration');
   const percent=e.standard/counted*100;assert(Math.abs(w.TripAggregates.performance(result.trip)*100-percent)<1e-8,label+' performance');
   w.matrixNow=edge-side*7*86400000;const reopened=new w.TripEditor(result.trip,result,{},{timezone});
   assert(!reopened.hasInvalid(),label+' reload validation');assert.equal(reopened.payload().changes.length,0,label+' reload must not generate edits');assert(!reopened.payload().settings,label+' reload must not rewrite the anchor');
   assert.equal(w.TripLog.percent([result.trip]),percent.toFixed(2)+'%',label+' log rendering');total++;
  }
  console.log(`PASS ${timezone} ${transition}: ${results.length} editing combinations`);
 }
 console.log(`PASS ${total} DST editing combinations: trip/Down/break placements, before/after editing, approval states, delete, boundaries, scheduled start, Standard, production and reload`);
}finally{await w.happyDOM.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
