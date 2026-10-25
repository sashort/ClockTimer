const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  for(const name of ['order-filler','drop-in']){
   const html=fs.readFileSync(path.join(root,name+'.html'),'utf8');
   const row=html.match(/<div class="percent-summary"[\s\S]*?<\/div>/)[0];
   await page.setContent(`<main class="app" style="display:block;padding:0;margin:0;width:100%;visibility:visible"><div class="scope-control" style="height:52px"><button class="scope-connection-button" aria-label="Connection"></button></div>${row}</main>`);
   await page.addStyleTag({path:path.join(root,'app.css')});
   await page.addScriptTag({path:path.join(root,'TimerSummaryView.js')});
   await page.evaluate(()=>{const badge=document.querySelector('.goal-sync-button');badge.hidden=false;badge.insertAdjacentHTML('beforeend','<span class="sync-offline-overlay"></span><span class="sync-pause-badge"></span>');});
   for(const width of [240,320,390,768]){
    await page.setViewportSize({width,height:400});
    for(const [actual,goal] of [['92.9%','100%'],['12345.6%','7%'],['-12345.6%','12345.6%']]){
     await page.evaluate(([actual,goal])=>WMOFTimerSummaryView.render(document,{current_percent_component:{text:actual},goal_component:{text:goal}}),[actual,goal]);
     await page.waitForTimeout(650);
     const layout=await page.evaluate(()=>{
      const cells=[...document.querySelector('.percent-summary').children];
      const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height};};
      return {row:rect(document.querySelector('.percent-summary')),tracks:getComputedStyle(document.querySelector('.percent-summary')).gridTemplateColumns.split(' ').map(parseFloat),alignment:cells.slice(0,3).map(e=>getComputedStyle(e).textAlign),fonts:cells.slice(0,3).map(e=>parseFloat(getComputedStyle(e).fontSize)),overlay:rect(document.querySelector('.sync-offline-overlay')),pause:rect(document.querySelector('.sync-pause-badge')),cells:cells.map(rect),cloud:rect(document.querySelector('.scope-connection-button')),overflow:cells.slice(0,3).map(e=>e.scrollWidth-e.clientWidth)};
     });
     const badge=layout.cells[3];
     assert.equal(layout.alignment[0],'right',name+' Actual hugs slash');
     assert.equal(layout.alignment[2],'left',name+' Goal hugs slash');
     if(actual.length!==goal.length)assert.ok(Math.abs(layout.cells[0].width-layout.cells[2].width)>1,name+' text tracks follow their own value lengths');
     assert.equal(badge.width,40,`${name} badge fixed width`);
     assert.equal(badge.height,40,`${name} badge fixed height`);
     assert.ok(Math.abs(layout.overlay.left+layout.overlay.width/2-badge.left-badge.width/2)<1,`${name} arrow overlay anchored to badge`);
     assert.ok(layout.pause.left>=badge.left&&layout.pause.right<=badge.right,`${name} pause overlay anchored to badge`);
     assert.ok(Math.abs((badge.left+badge.right-layout.cloud.left-layout.cloud.right)/2)<1,`${name} cloud alignment`);
     assert.ok(layout.fonts.every(size=>Math.abs(size-layout.fonts[0])<0.01),name+' both percentages and slash share the smaller font');
     assert.ok(Math.abs((layout.cells[0].left-layout.row.left)-(badge.left-layout.cells[2].right))<1,name+' whole expression has equal left indent and space before Sync');
     assert.ok(layout.overflow.every(v=>v<=1),`${name} ${width} text fits: ${layout.overflow}`);
     for(let i=1;i<4;i++)assert.ok(layout.cells[i].left>=layout.cells[i-1].right,`${name} columns cannot overlap`);
    }
   }
   await page.setViewportSize({width:320,height:400});
   await page.evaluate(()=>WMOFTimerSummaryView.render(document,{current_percent_component:{text:'1234.5%'},goal_component:{text:'1234.5%'}}));
   await page.waitForTimeout(650);
   const before=await page.locator('#goalPercentValue').evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
   await page.evaluate(()=>WMOFTimerSummaryView.render(document,{effective_goal_type:'total',current_percent_component:{text:'1234.5%'},goal_component:{text:'1234.5%'}}));
   await page.waitForTimeout(70);
   const fading=await page.locator('.goal-sync-button').evaluate(e=>Number(getComputedStyle(e).opacity));
   assert.ok(fading>0&&fading<1,name+' Sync opacity animates between states');
   const moving=await page.locator('.percent-summary').evaluate(e=>{const c=getComputedStyle(e).gridTemplateColumns.split(' ').map(parseFloat),r=e.getBoundingClientRect(),a=e.querySelector('#currentPercentValue').getBoundingClientRect(),g=e.querySelector('#goalPercentValue').getBoundingClientRect(),b=e.querySelector('.goal-sync-button').getBoundingClientRect();return {sync:c.at(-1),left:c[0],right:c[4],offset:(a.left+g.right-r.left-r.right)/2};});
   assert.ok(moving.sync>0&&moving.sync<40,name+' real Sync column animates out');
   assert.ok(Math.abs(moving.left-moving.right)<1,name+' expression remains centered in the animated available space');
   assert.ok(moving.offset<0&&moving.offset>-24,name+' expression moves toward full-row center');
   await page.waitForTimeout(650);
   assert.equal(await page.locator('.percent-summary').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').at(-1)),'0px',name+' hidden Sync column collapses');
   assert.ok(await page.locator('.percent-summary').evaluate(e=>{const r=e.getBoundingClientRect(),a=e.querySelector('#currentPercentValue').getBoundingClientRect(),g=e.querySelector('#goalPercentValue').getBoundingClientRect();return Math.abs(a.left+g.right-r.left-r.right)<2;}),name+' without Sync the whole expression centers in the full row');
   assert.equal(await page.locator('.goal-sync-button').evaluate(e=>getComputedStyle(e).opacity),'0',name+' hidden Sync fades out');
   assert.ok(await page.locator('#goalPercentValue').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))>before,name+' percentages expand into released space');
   await page.evaluate(()=>WMOFTimerSummaryView.render(document,{effective_goal_type:'trip',current_percent_component:{text:'1234.5%'},goal_component:{text:'1234.5%'}}));
   await page.waitForTimeout(650);
   assert.equal(await page.locator('.percent-summary').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').at(-1)),'40px',name+' Sync returns to fixed column');
  }
  console.log('PASS shared percentage layout: both pages, 4 widths, unequal/negative/large values, fixed badge and cloud alignment');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
