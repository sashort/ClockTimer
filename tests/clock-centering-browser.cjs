const assert = require('node:assert/strict');
const fixture = require('./order-filler-master-fixture.cjs');
(async () => {
 const f = await fixture({input:'transcript'});
 try {
  const p = f.page;
  await p.evaluate(() => window.centeringSetup = (async () => {
   await document.querySelector('#clockTimer').connect('test','test');
   document.querySelector('#loginDialog').close();
  })());
  async function centered(label) {
   await p.waitForTimeout(2300);
   const geometry = await p.evaluate(() => {
    const app = document.querySelector('#app'), clock = document.querySelector('#clockTimer').getBoundingClientRect();
    const above = document.querySelector('.trip-action-controls').getBoundingClientRect().bottom;
    const below = app.dataset.tripLogPinned === 'true'
     ? document.querySelector('#tripLogButton').getBoundingClientRect().top
     : app.dataset.speechActive === 'true' ? document.querySelector('#speechMicBar').getSafeTop()
     : app.getBoundingClientRect().bottom - parseFloat(getComputedStyle(app).paddingBottom);
    const row=app.querySelector('.percent-summary'),bar=row.querySelector('.goal-bar-svg'),mode=app.dataset.percentageDisplay;
    const top=Math.max(...[...app.querySelectorAll('#standardTimeLabel,#standardTimeValue,#renderedTimeLabel,#renderedTimeValue')].map(e=>e.getBoundingClientRect().bottom));
    const svg=bar?.getBoundingClientRect(),controls=app.querySelector('.trip-action-controls').getBoundingClientRect();
    return {mode,offset:(clock.top+clock.bottom-above-below)/2,clockHeight:clock.height,space:below-above,horizontal:(clock.left+clock.right)/2-(app.getBoundingClientRect().left+app.getBoundingClientRect().right)/2,topGap:mode==='bar'?svg.top+Number(bar.dataset.visibleTop)-top:null,bottomGap:mode==='bar'?controls.top-svg.top-Number(bar.dataset.visibleBottom):null};
   });
   assert(Math.abs(geometry.horizontal)<1,label+' horizontal center');if(geometry.mode==='classic')assert(Math.abs(geometry.offset)<1,label+': '+JSON.stringify(geometry));else {assert(Math.abs(geometry.topGap-geometry.bottomGap)<1,label+' balanced visible gaps: '+JSON.stringify(geometry));assert(geometry.topGap>=2,label+' no readout/control overlap');assert(geometry.clockHeight<=geometry.space+1,label+' clock fits reserved region');}
  }
  for (const height of [844,667]) {
   await p.setViewportSize({width:390,height});
   for (const mode of ['classic','bar']) {
    await p.evaluate(mode => document.querySelector(mode==='bar'?'#percentageDisplayBar':'#percentageDisplayClassic').click(),mode);
    for (const mic of [false,true]) {
     await p.evaluate(async mic => {
      if (mic) {SpeechMenu.testActivate();await WMOFActions.handleSpeechRuntimeStarted();}
      else await WMOFActions.handleSpeechRuntimeStopped();
     },mic);
     for (const pinned of [true,false]) {
      await p.evaluate(pinned => document.querySelector('#app').dataset.tripLogPinned=String(pinned),pinned);
      await centered(`idle ${height} ${mode} mic=${mic} pinned=${pinned}`);
     }
    }
   }
  }
  await p.setViewportSize({width:390,height:844});
  await p.evaluate(async()=>{document.querySelector('#app').dataset.tripLogPinned='true';await WMOFActions.handleSpeechRuntimeStopped();await document.querySelector('#clockTimer').start({standardTime:'0:30:00'});});
  for (const interval of [null,'down','lunch']) {
   await p.evaluate(async interval=>{const t=document.querySelector('#clockTimer');if(interval==='lunch')await t.endInterval();if(interval)await t.startInterval(interval);},interval);
   if(interval==='down')assert.equal(await p.locator('.clock-region').isVisible(),false,'Full Down hides the clock');
   else await centered('active '+(interval||'production'));
  }
  assert.deepEqual(f.errors,[]);
  console.log('PASS Classic clock centering and balanced Bar gaps, horizontal centering, short screens and active intervals');
 } finally {await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

