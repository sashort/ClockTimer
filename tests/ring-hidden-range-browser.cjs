const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:360,height:360}});
 await page.setContent('<style>body{margin:0;background:#0053e2}ring-container{display:block;width:320px;height:320px}time-range[type="down"]{background:#5f6772}</style><ring-container id="ring" width="20px"></ring-container>');
 for(const name of ['TemporalFormat','RingContainer','TimeRangeModel','TimeRangeElement'])await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'..',name+'.js'),'utf8')});
 await page.evaluate(()=>{
  globalThis.downView=TimeRangeElement.create(TimeRange.create({type:'Fixed',start:new Date('2026-10-25T14:00:00Z'),end:new Date('2026-10-25T14:28:00Z')}).ranges[0]);
  downView.setAttribute('type','down');ring.append(downView);
 });
 await page.waitForTimeout(250);
 assert.notEqual(await page.evaluate(()=>getComputedStyle(downView).display),'none');
 await page.evaluate(()=>downView.model.group.remove(downView.rangeId));
 const removed=await page.evaluate(()=>({hidden:downView.hidden,display:getComputedStyle(downView).display,clip:getComputedStyle(downView).clipPath,ranges:downView.ranges.length}));
 assert.equal(removed.hidden,true);assert.equal(removed.ranges,0);
 assert.equal(removed.display,'none','removed Down geometry must not paint an unclipped gray disk');
 console.log('PASS removed/hidden time-range views cannot paint after their model interval disappears');
 await page.evaluate(()=>{
  globalThis.redView=TimeRangeElement.create(TimeRange.create({type:'Fixed',start:new Date('2026-10-25T14:18:00Z'),end:new Date('2026-10-25T14:20:00Z')}).ranges[0]);
  redView.setAttribute('type','overtime');redView.style.background='#ff5c5c';ring.append(redView);
 });
 await page.waitForTimeout(300);
 await page.evaluate(()=>ring.removeRangeAnimated(redView));
 await page.waitForTimeout(80);
 assert.equal(await page.evaluate(()=>redView.isConnected),true,'removal should begin as an animation');
 await page.evaluate(()=>{const container=ring;container.remove();document.body.append(container);});
 await page.waitForTimeout(650);
 assert.equal(await page.evaluate(()=>redView.isConnected),false,'interrupting an exit animation must not strand a red notch when the ring reconnects');
 console.log('PASS interrupted overtime exit removes its obsolete arc before the ring reconnects');
 for(const interrupted of [false,true]){
  await page.evaluate(()=>{
   globalThis.exitView=TimeRangeElement.create(TimeRange.create({type:'Fixed',start:new Date('2026-10-25T14:18:00Z'),end:new Date('2026-10-25T14:20:00Z')}).ranges[0]);
   exitView.setAttribute('type','overtime');ring.append(exitView);
  });
  await page.waitForTimeout(150);
  await page.evaluate(()=>ring.removeRangeAnimated(exitView));
  await page.waitForTimeout(65);
  if(interrupted)await page.evaluate(()=>ring.snapRangeGeometry(exitView));
  await page.waitForTimeout(650);
  assert.equal(await page.evaluate(()=>exitView.isConnected),false,interrupted?'geometry refresh must complete pending structural removal':'normal animated exits must still complete');
 }
 console.log('PASS normal and geometry-interrupted exits both remove obsolete arcs');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

