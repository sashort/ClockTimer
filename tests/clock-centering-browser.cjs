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
    return {offset:(clock.top+clock.bottom-above-below)/2,clockHeight:clock.height,space:below-above};
   });
   assert(Math.abs(geometry.offset)<1, label+': '+JSON.stringify(geometry));
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
  console.log('PASS clock centered between controls and Log/Mic/content boundary in both displays, short screens and active intervals');
 } finally {await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

