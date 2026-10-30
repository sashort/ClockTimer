const assert=require('node:assert/strict');
module.exports=async(page,operation)=>{
 const original=await page.evaluate(()=>({actions:app.dataset.actionDisplay,percent:app.dataset.percentageDisplay}));
 const delay=async route=>{if(route.request().method()==='POST')await new Promise(r=>setTimeout(r,120));await route.fallback();};
 const patterns=['**/api/trips/**','**/api/trip-events/**'];for(const pattern of patterns)await page.route(pattern,delay);
 try{
  for(const [actions,percent]of [['Full','Classic'],['Full','Bar'],['Compact','Classic'],['Compact','Bar']]){
   await operation(async({actions,percent})=>{document.querySelector('#actionDisplay'+actions).click();document.querySelector('#percentageDisplay'+percent).click();await WMOFLayoutMotion.whenSettled();},{actions,percent});
   for(const kind of ['break','short-break','lunch']){
    await page.evaluate(()=>{
     globalThis.breakEntryProbe={active:true,frames:0,bad:[],modelBad:[]};
     const probe=breakEntryProbe,invalid=['breakButton','downButton','breakDownButton','downResumeButton','downBreakButton','downCancelButton','downDetailsButton'];
     probe.listener=event=>{const s=event.detail;if(s.break_only&&!s.interval_state&&s.trip_active&&(s.controls.break_visible||s.controls.down_visible||s.controls.primary_action.visible))probe.modelBad.push(s.controls);};
     clockTimer.addEventListener('uiStateChanged',probe.listener);
     const frame=()=>{if(!probe.active)return;probe.frames++;
      for(const id of [...invalid,'endTripButton']){const e=document.getElementById(id);if(!e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})||Number(getComputedStyle(e).opacity)<.01)continue;
       if(id!=='endTripButton'||/^End Trip/.test(e.getAttribute('aria-label')||e.textContent))probe.bad.push({id,interval:clockTimer.getActiveIntervalState()?.intervalType||null,breakOnly:clockTimer.breakOnly});
      }
      probe.frame=requestAnimationFrame(frame);
     };probe.frame=requestAnimationFrame(frame);
    });
    await operation(kind=>WMOFActions.startBreak(kind),kind);await page.waitForTimeout(400);
    const result=await page.evaluate(()=>{const p=breakEntryProbe;p.active=false;cancelAnimationFrame(p.frame);clockTimer.removeEventListener('uiStateChanged',p.listener);return{frames:p.frames,bad:p.bad,modelBad:p.modelBad,breakOnly:clockTimer.breakOnly,interval:clockTimer.getActiveIntervalState()?.intervalType};});
    assert(result.frames>0,'entry animation sampled frames');assert(result.breakOnly);assert(result.interval==='break'||result.interval==='lunch');
    assert.deepEqual(result.modelBad,[],actions+'/'+percent+'/'+kind+' intermediate model must not offer productive controls');
    assert.deepEqual(result.bad,[],actions+'/'+percent+'/'+kind+' unrelated buttons must never paint during entry');
    await operation(()=>clockTimer.endInterval());await page.waitForTimeout(400);
   }
  }
 }finally{
  for(const pattern of patterns)await page.unroute(pattern,delay);
  await operation(async original=>{document.querySelector('#actionDisplay'+(original.actions==='compact'?'Compact':'Full')).click();document.querySelector('#percentageDisplay'+(original.percent==='bar'?'Bar':'Classic')).click();await WMOFLayoutMotion.whenSettled();},original);
 }
 console.log('PASS frame-sampled standalone Break/Short Break/Lunch entry in all four layouts without productive-button flashes');
};
