const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,'.'+pathname.replace(/\.php$/,'.html'));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const user={id:2,username:'Preview user',permissions:4};let signedIn=true;
  await page.route('**/api/**',route=>{
   if(new URL(route.request().url()).pathname.endsWith('.js'))return route.continue();
   const body=route.request().postDataJSON();
   if(body?.action==='disconnect'){signedIn=false;return route.fulfill({json:{user:null}});}
   if(body?.action==='connect')signedIn=true;
   return route.fulfill({status:signedIn?200:401,json:signedIn?{user,csrfToken:'a'.repeat(64)}:{message:'Not signed in'}});
  });
  await page.route('**/build-version.json',route=>route.fulfill({json:{version:'E4GUFA',builtAt:'2026-10-23T16:30:00Z'}}));
  const base=`http://127.0.0.1:${server.address().port}/index.html`;
  const waitView=name=>page.waitForFunction(name=>document.querySelector('#homePane').activeView.dataset.paneView===name&&!document.querySelector('#homePane').dataset.paneTransitioning,name);
  const out=path.join(__dirname,'artifacts/main-page');fs.mkdirSync(out,{recursive:true});
  for(const [width,height] of [[1280,900],[390,844],[360,420],[844,390]]){
   await page.setViewportSize({width,height});await page.goto(base);await page.locator('#signedInActions').waitFor({state:'visible'});
   assert.equal(await page.locator('hamburger-menu').count(),0);
   assert.equal(await page.locator('.order-filler-link').getAttribute('href'),'order-filler.php?session=existing');
   for(const id of ['homeAdmin','homeTrainer','homeDev']){
    await page.locator('#'+id).click();await waitView(id==='homeAdmin'?'admin':id==='homeTrainer'?'trainer':'dev');
    assert.equal(await page.locator('#homePane [data-pane-view]:not([hidden])').count(),1);
    assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-home-back')),true);
    await page.locator('#homePane [data-pane-view]:not([hidden]) [data-home-back]').click();await waitView('home');
    assert.equal(await page.evaluate(()=>document.activeElement.id),id);
   }
   if(width===390){
    const version=page.locator('#appVersion');await version.click();
    await page.waitForFunction(()=>document.querySelector('#versionDetails').matches(':popover-open')&&document.querySelector('#versionDetailsTime').dateTime);
    assert.equal(await page.locator('#versionDetailsId').textContent(),await version.textContent());
    assert.equal(await page.locator('#versionDetailsTime').getAttribute('datetime'),'2026-10-23T16:30:00.000Z');
    assert.equal(await version.getAttribute('aria-expanded'),'true');
    await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#appVersion').getAttribute('aria-expanded')==='false'&&!document.querySelector('#versionDetails').matches(':popover-open'));
    await version.focus();await page.keyboard.press('Enter');await page.locator('#versionDetails').waitFor({state:'visible'});
    await page.keyboard.press('Escape');
    await page.screenshot({path:path.join(out,'home.png')});
   }
   await page.locator('#homeDev').click();await waitView('dev');
   const before=await page.locator('#homeDevSubmenu .home-pane-header').boundingBox();
   const metrics=await page.locator('#homeDevSubmenu').evaluate(el=>({height:el.clientHeight,content:el.scrollHeight}));
   if(height<=420){
    assert(metrics.content>metrics.height,'short viewport must overflow inside the pane');
    await page.locator('#homeDevSubmenu').hover();await page.mouse.wheel(0,700);
    await page.waitForFunction(()=>document.querySelector('#homeDevSubmenu').scrollTop>0);
    const after=await page.locator('#homeDevSubmenu .home-pane-header').boundingBox();assert(Math.abs(before.y-after.y)<1,'Back header stays visible while contents scroll');
    await page.locator('#homeDiagnostics').scrollIntoViewIfNeeded();const last=await page.locator('#homeDiagnostics').boundingBox();assert(last.y>=0&&last.y+last.height<=height,'last action can be reached by scrolling');
   }
   if(width===390)await page.screenshot({path:path.join(out,'dev.png')});
   await page.keyboard.press('Escape');await waitView('home');
   const size=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,viewportWidth:innerWidth,viewportHeight:innerHeight}));
   assert(size.width<=size.viewportWidth&&size.height<=size.viewportHeight,'document stays inside viewport');
  }
  // Preview, Trainer and Admin accounts see only their permitted groups/actions.
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const [permissions,visible] of [[0,[]],[64,['homeTrainer']],[8,['homeDev']],[16,['homeDev']],[1,['homeAdmin']]]){
   user.permissions=permissions;await page.goto(base);await page.locator('#signedInActions').waitFor({state:'visible'});
   for(const id of ['homeAdmin','homeTrainer','homeDev'])assert.equal(await page.locator('#'+id).isVisible(),visible.includes(id));
   if(visible.includes('homeDev')){await page.locator('#homeDev').click();await waitView('dev');assert.equal(await page.locator('#homeDiagnostics').isVisible(),permissions===16);assert.equal(await page.locator('#homeDevSubmenu a[href="api/docs/"]').isVisible(),permissions===16);await page.keyboard.press('Escape');await waitView('home');}
   if(permissions===1){await page.locator('#homeAdmin').click();await waitView('admin');assert(await page.locator('#homeAdminSubmenu a[href="api/admin/new-user/"]').isVisible());assert.equal(await page.locator('#homeEditProfileButton').isVisible(),false);await page.keyboard.press('Escape');await waitView('home');}
  }
  await page.locator('#homeProfileButton').click();await page.locator('#userLookupDialog').waitFor({state:'visible'});await page.locator('#userLookupDialog [data-close-dialog]').click();
  await page.locator('#homeLogoutButton').click();await page.locator('#signedOutActions').waitFor({state:'visible'});
  await page.locator('#mainLoginButton').click();await page.locator('#mainUsername').fill('preview');await page.locator('#mainPassword').fill('fixture');await page.locator('#mainLoginOK').click();await page.locator('#signedInActions').waitFor({state:'visible'});await waitView('home');
  assert.deepEqual(errors,[]);
  console.log('PASS homepage panes, desktop/mobile scrolling, sticky Back, Escape/focus, role visibility, Profile and login/logout');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
