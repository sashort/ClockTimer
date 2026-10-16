const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const relative=pathname.slice(1).replace(/\.php$/,'.html');
 const file=path.resolve(root,relative);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'application/octet-stream');
 res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 try {
  const page=await browser.newPage();const errors=[],childRequests=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>{
   if(new URL(route.request().url()).pathname.endsWith('.js'))return route.continue();
   if(route.request().frame().parentFrame() && route.request().frame().url().includes('graphical-settings.'))childRequests.push(route.request().url());
   const url=new URL(route.request().url());
   if(url.pathname.includes('/users/'))return route.fulfill({status:401,json:{message:'Not signed in'}});
   return route.fulfill({json:{calendars:[],trips:[],instruments:[],voices:[]}});
  });
  const base=`http://127.0.0.1:${server.address().port}`;
  const metrics=()=>{
   const dialog=document.querySelector('#graphicalSettingsDialog'),outer=dialog.getBoundingClientRect();
   return Object.fromEntries(['#graphicalSettingsForm','.dialog-header','.graphical-settings-actions','.graphical-settings-grid','.settings-groups','.clock-preview','details summary'].map(selector=>{
    const e=dialog.querySelector(selector),r=e.getBoundingClientRect(),css=getComputedStyle(e);
    return [selector,{x:r.x-outer.x,y:r.y-outer.y,width:r.width,height:r.height,font:css.font,padding:css.padding,background:css.backgroundColor}];
   }));
  };
  for(const [width,height] of [[1280,900],[750,900],[390,844]]) {
   await page.setViewportSize({width,height});
   await page.goto(base+'/order-filler.php');
   await page.waitForFunction(()=>document.documentElement.dataset.clocktimerAppReady==='true');
   await page.evaluate(()=>{window.__settingsHostIdentity=WMOFCoordinator;});
   await page.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());const d=document.querySelector('#graphicalSettingsDialog');d.dispatchEvent(new Event('opening'));d.showModal();d.dispatchEvent(new Event('opened'));});
   await page.waitForTimeout(350);
   const original=await page.evaluate(metrics);
   await page.evaluate(()=>{document.querySelector('#graphicalSettingsDialog').close();document.querySelector('#openGraphicalSettingsFrame').click();});
   const frame=await page.waitForSelector('#clockTimerSettingsFrame');const child=await frame.contentFrame();
   await child.waitForFunction(()=>document.documentElement.dataset.settingsReady==='true');
   await page.waitForTimeout(350);
   const extracted=await child.evaluate(metrics);
   for(const selector of Object.keys(original))for(const property of Object.keys(original[selector])) {
    const expected=original[selector][property],actual=extracted[selector][property];
    if(typeof expected==='number')assert(Math.abs(actual-expected)<1.1,JSON.stringify({width,selector,property,actual,expected}));
    else assert.equal(actual,expected,`${width} ${selector} ${property}`);
   }
   assert.equal(await child.evaluate(()=>Boolean(globalThis.SpeechMenu||globalThis.WMOFActions||document.querySelector('#app'))),false,'iframe never boots Order Filler or speech');
   if(process.env.SETTINGS_SCREENSHOTS){fs.mkdirSync(process.env.SETTINGS_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.SETTINGS_SCREENSHOTS,`settings-${width}.png`)});}
   await child.locator('details > summary').first().click();
   const originalColor=await child.locator('[name=tripColor]').inputValue();
   await child.locator('[name=tripColor]').evaluate(e=>{e.value='#123456';e.dispatchEvent(new Event('input',{bubbles:true}));});
   await child.locator('[data-close-dialog]').last().click();
   await page.waitForFunction(()=>!document.querySelector('#clockTimerSettingsFrameDialog').open);
   assert.equal(await page.locator('#clockTimerSettingsFrame').getAttribute('src'),'about:blank');
   assert.equal(new URL(page.url()).pathname,'/order-filler.php','closing cannot navigate the base page');
   assert.equal(await page.locator('#app').count(),1,'only one Order Filler remains');
   assert.equal(await page.evaluate(()=>WMOFCoordinator===window.__settingsHostIdentity),true,'closing does not restart the parent');
   await page.evaluate(()=>document.querySelector('#openGraphicalSettingsFrame').click());
   const reopened=await page.locator('#clockTimerSettingsFrame').elementHandle();const next=await reopened.contentFrame();
   await next.waitForFunction(()=>document.documentElement.dataset.settingsReady==='true');
   assert.equal(await next.locator('[name=tripColor]').inputValue(),originalColor,'Cancel discards the draft');
   await next.locator('details > summary').first().click();
   await next.locator('[name=tripColor]').evaluate(e=>{e.value='#123456';e.dispatchEvent(new Event('input',{bubbles:true}));});
   await page.evaluate(()=>{window.__saveSettings=WMOFGraphicalSettingsHost.save;WMOFGraphicalSettingsHost.save=async()=>{throw Error('Fixture save rejected');};});
   await next.locator('button[value=save]').click();
   await next.locator('#graphicalSettingsError').filter({hasText:'Fixture save rejected'}).waitFor();
   assert.equal(await page.locator('#clockTimerSettingsFrameDialog').evaluate(e=>e.open),true,'failed save stays open for retry');
   await page.evaluate(()=>{WMOFGraphicalSettingsHost.save=window.__saveSettings;});
   await next.locator('button[value=save]').click();
   await page.waitForFunction(()=>!document.querySelector('#clockTimerSettingsFrameDialog').open);
   assert.equal(await page.evaluate(()=>JSON.parse(WMOFPersistence.peek('wmof.clock.graphicalSettings')).tripColor),'#123456','Save uses the host persistence');
   assert.equal(await page.evaluate(()=>WMOFCoordinator.lockCount),0,'Save releases its operation');
   await page.evaluate(()=>document.querySelector('#openGraphicalSettingsFrame').click());
   const escapeFrame=await(await page.locator('#clockTimerSettingsFrame').elementHandle()).contentFrame();
   await escapeFrame.waitForFunction(()=>document.documentElement.dataset.settingsReady==='true');
   await escapeFrame.locator('.dialog-close').focus();await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('#clockTimerSettingsFrameDialog').open);
   assert.equal(await page.evaluate(()=>WMOFCoordinator===window.__settingsHostIdentity),true,'Escape keeps the existing parent coordinator');
  }
  await page.goto(base+'/drop-in.php');
  await page.evaluate(()=>document.querySelector('#dropInClockSettingsButton').click());
  const drop=await(await page.locator('#clockTimerSettingsFrame').elementHandle()).contentFrame();
  await drop.waitForFunction(()=>document.documentElement.dataset.settingsReady==='true');
  await drop.locator('details > summary').first().click();
  await drop.locator('[name=tripColor]').evaluate(e=>{e.value='#abcdef';e.dispatchEvent(new Event('input',{bubbles:true}));});
  await drop.locator('button[value=save]').click();
  await page.waitForFunction(()=>!document.querySelector('#clockTimerSettingsFrameDialog').open);
  assert.equal(await page.evaluate(()=>JSON.parse(WMOFPersistence.peek('wmof.clock.graphicalSettings')).tripColor),'#abcdef','Drop-In saves through its own settings store');
  await page.evaluate(()=>document.querySelector('#dropInClockSettingsButton').click());
  const dropAgain=await(await page.locator('#clockTimerSettingsFrame').elementHandle()).contentFrame();
  await dropAgain.waitForFunction(()=>document.documentElement.dataset.settingsReady==='true');
  assert.equal(await dropAgain.locator('[name=tripColor]').inputValue(),'#abcdef');
  await dropAgain.locator('.dialog-close').click();
  await page.waitForFunction(()=>!document.querySelector('#clockTimerSettingsFrameDialog').open);
  assert.equal(new URL(page.url()).pathname,'/drop-in.php');
  await page.goto(base+'/graphical-settings.php');
  await page.waitForFunction(()=>document.documentElement.dataset.settingsReady==='true');
  assert.equal(await page.locator('#graphicalSettingsDialog').isVisible(),true,'standalone PHP entry works');
  assert.deepEqual(childRequests,[],'settings cannot start login/trip/API flows');
  assert.deepEqual(errors,[]);
  console.log('PASS desktop/mobile visual parity, standalone and both iframe hosts, draft cancellation, host save, clean close and no duplicate app/speech startup');
 } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
