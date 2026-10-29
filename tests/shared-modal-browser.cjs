const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(`<style>${fs.readFileSync(path.join(root,'styles/default/app.css'),'utf8')}</style><style>#a,#b{width:160px;height:120px;margin:0;bottom:auto}#a{left:8px;right:auto;top:100px}#b{left:auto;right:8px;top:300px}#background{position:fixed;top:10px;left:10px}#micControl{position:fixed;bottom:10px;left:10px;pointer-events:auto}button{width:130px;height:60px}</style><div id="app"><button id="background">Background</button><button id="micControl">Mic</button></div><div id="alreadyInert" inert></div><dialog class="app-dialog" id="a"><button id="first">First</button></dialog><dialog class="app-dialog" id="b"><button id="second">Second</button></dialog>`);
  await page.addScriptTag({content:fs.readFileSync(path.join(root,'SharedModal.js'),'utf8')});
  await page.evaluate(()=>{window.counts={first:0,second:0,background:0,micControl:0};for(const id of Object.keys(counts))document.getElementById(id).onclick=()=>counts[id]++;window.host=document.createElement('shared-modal-host');document.body.append(host);host.registerControl(document.getElementById('micControl'));document.getElementById('a').showModal();document.getElementById('b').showModal();});
  for(const id of ['first','second','micControl']){const r=await page.locator('#'+id).boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);}
  await page.touchscreen.tap(40,35);
  assert.deepEqual(await page.evaluate(()=>counts),{first:1,second:1,background:0,micControl:1},'both open dialogs and mic are interactive; background is inert');
  await page.locator('#first').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>counts.first),2,'keyboard works in an older open dialog');
  await page.evaluate(()=>document.getElementById('b').close());
  assert(await page.evaluate(()=>document.getElementById('app').inert),'closing one modal cannot unlock background');
  await page.locator('#first').click();
  await page.keyboard.press('Escape');await page.waitForTimeout(20);
  assert.equal(await page.evaluate(()=>host.openDialogs.length),0);
  assert.equal(await page.evaluate(()=>document.getElementById('app').inert),false);
  assert(await page.evaluate(()=>document.getElementById('alreadyInert').inert),'prior inert state is preserved');
  assert.equal(await page.evaluate(()=>document.getElementById('micControl').parentElement.id),'app');
  await page.locator('#background').click();assert.equal(await page.evaluate(()=>counts.background),1);
  await page.evaluate(()=>{const d=document.createElement('dialog');d.id='dynamic';d.textContent='Dynamic';document.body.append(d);d.showModal();});
  assert.equal(await page.evaluate(()=>host.openDialogs.at(-1).id),'dynamic','a dialog appended and opened in one turn is enrolled too');
  await page.evaluate(()=>document.getElementById('dynamic').remove());await page.waitForTimeout(20);
  assert.equal(await page.evaluate(()=>document.getElementById('app').inert),false,'removed dialogs release modal ownership');
  assert.deepEqual(errors,[]);console.log('PASS simultaneous modal pointer/keyboard access, persistent mic, background exclusion, independent close, Escape, dynamic enrollment and ownership cleanup');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
