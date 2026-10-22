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
   await page.evaluate(()=>{document.querySelector('.goal-sync-button').hidden=false;});
   for(const width of [240,320,390,768]){
    await page.setViewportSize({width,height:400});
    for(const [actual,goal] of [['92.9%','100%'],['12345.6%','7%'],['-12345.6%','12345.6%']]){
     await page.evaluate(([actual,goal])=>WMOFTimerSummaryView.render(document,{current_percent_component:{text:actual},goal_component:{text:goal}}),[actual,goal]);
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     const layout=await page.evaluate(()=>{
      const cells=[...document.querySelector('.percent-summary').children];
      const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height};};
      return {cells:cells.map(rect),cloud:rect(document.querySelector('.scope-connection-button')),overflow:cells.slice(0,3).map(e=>e.scrollWidth-e.clientWidth)};
     });
     const badge=layout.cells[3];
     assert.equal(badge.width,40,`${name} badge fixed width`);
     assert.equal(badge.height,40,`${name} badge fixed height`);
     assert.ok(Math.abs((badge.left+badge.right-layout.cloud.left-layout.cloud.right)/2)<1,`${name} cloud alignment`);
     assert.ok(layout.overflow.every(v=>v<=1),`${name} ${width} text fits: ${layout.overflow}`);
     for(let i=1;i<4;i++)assert.ok(layout.cells[i].left>=layout.cells[i-1].right,`${name} columns cannot overlap`);
    }
   }
  }
  console.log('PASS shared percentage layout: both pages, 4 widths, unequal/negative/large values, fixed badge and cloud alignment');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
