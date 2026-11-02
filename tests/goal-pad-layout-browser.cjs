const fixture=require('./order-filler-master-fixture.cjs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const f=await fixture({input:'transcript'});try{const p=f.page;
 await p.evaluate(()=>window.padSetup=(async()=>{await clockTimer.connect('test','test');document.querySelector('#loginDialog').close();clockTimer.configure({goal_type:'total',total_goal:'115%'});})());
 for(const active of [false,true]){
  if(active)await p.evaluate(()=>clockTimer.start({standardTime:'0:30:00'}));
  for(const height of [844,640,560]){
   await p.setViewportSize({width:390,height});await p.evaluate(()=>WMOFActions.openGoalEditor({scope:'total'}));await p.waitForTimeout(2300);
   const bounds=await p.locator('#numberPadDialog').evaluate(e=>{const d=e.getBoundingClientRect(),parts=[e.querySelector('.number-pad-context'),e.querySelector('.number-pad-header'),e.querySelector('#numberPadConfirm'),e.querySelector('.number-pad-clear-reset')].map(x=>x.getBoundingClientRect());return {height:d.height,viewport:visualViewport.height,parts:parts.map(r=>({top:r.top,bottom:r.bottom})),inferred:!e.querySelector('[data-goal-detail=inferred]').hidden,mic:document.querySelector('#speechMicBar').dataset.surfaceSuppressed};});
   assert(Math.abs(bounds.height-bounds.viewport)<1,'touch pad fills visual viewport');
   assert(bounds.parts.every(r=>r.top>=-.5&&r.bottom<=bounds.viewport+.5),'header and bottom row remain inside editor '+JSON.stringify(bounds));
   assert.equal(bounds.inferred,active);assert.equal(bounds.mic,'true');
   await p.screenshot({path:path.resolve('../outputs/goal-pad-'+(active?'active':'idle')+'-'+height+'.png')});
   await p.locator('#numberPadCancel').click();await p.waitForTimeout(1100);assert.equal(await p.locator('#speechMicBar').getAttribute('data-surface-suppressed'),'false','mic returns on exit');
  }
 }
 await p.evaluate(()=>WMOFActions.openGoalEditor({scope:'trip'}));await p.waitForTimeout(1300);
 assert.equal(await p.locator('#numberPadContext [data-goal-detail=inferred]').isVisible(),false,'Trip uses a single line');
 const before=await p.evaluate(()=>WMOFInteractionState.state.editor.value);await f.say('one two okay');assert.equal(await p.evaluate(()=>WMOFInteractionState.state.editor.value),before,'touch pad ignores speech');
 await p.locator('#numberPadCancel').click();
 assert.deepEqual(f.errors,[]);console.log('PASS fullscreen touch numberpad, visible headers/bottom rows, idle/Trip single line, active aggregate two lines, mic restoration and speech suppression');
}finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1});
