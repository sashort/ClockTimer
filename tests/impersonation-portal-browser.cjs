const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'../admin');
 const server=http.createServer((request,response)=>{
  let name=new URL(request.url,'http://localhost').pathname.slice(1)||'impersonation.php';
  if(!['impersonation.php','impersonation.css','impersonation.js'].includes(name)){response.writeHead(404);return response.end();}
  let text=fs.readFileSync(path.join(root,name),'utf8');if(name.endsWith('.php'))text=text.slice(text.indexOf('?><!doctype')+2);
  response.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');response.end(text);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let user=null,impersonation=null,csrf='initial',sequence=0;const calls=[];
  await page.route('**/api/**',async route=>{
   const request=route.request(),body=request.postDataJSON(),endpoint=new URL(request.url()).pathname;calls.push({endpoint,body});
   if(request.method()==='POST'){
    if(endpoint.includes('/admin/impersonation/'))assert.equal(request.headers()['x-csrf-token'],csrf);
    if(body.action==='connect'){assert.equal(body.username,'operator');assert.equal(body.password,'test-password');user={id:1,username:'operator',permissions:4};}
    if(body.action==='start'){assert.equal(body.targetUsername,'target');user={id:2,username:'target',permissions:0};impersonation={id:'fixture',return_user_id:1};}
    if(body.action==='return'){user={id:1,username:'operator',permissions:4};impersonation=null;}
    if(body.action==='disconnect'){user=null;impersonation=null;}
    if(body.action==='connect-pin'){assert.equal(body.loginId,'0072');assert.equal(body.pin,'wmof_fixture-token');user={id:2,username:'target',permissions:0};impersonation={id:'token-fixture',return_user_id:null};}
    csrf='csrf-'+(++sequence);
   }
   await route.fulfill({json:{user,impersonation,csrfToken:csrf}});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/impersonation.php');
  await page.locator('#login').waitFor({state:'visible'});assert.equal(await page.locator('#login-type option').count(),2);
  await page.locator('#identity').fill('operator');await page.locator('#credential').fill('test-password');await page.locator('#login button').click();
  await page.locator('#target').waitFor({state:'visible'});assert.equal(await page.locator('#credential').inputValue(),'');
  await page.locator('#target-username').fill('target');await page.locator('#target button').click();
  await page.locator('#active').waitFor({state:'visible'});await page.locator('#return').click();await page.locator('#target').waitFor({state:'visible'});
  await page.locator('#logout').click();await page.locator('#login').waitFor({state:'visible'});
  await page.locator('#login-type').selectOption('pin');await page.locator('#identity').fill('0072');await page.locator('#credential').fill('wmof_fixture-token');await page.locator('#login button').click();
  await page.locator('#fresh-login').waitFor({state:'visible'});assert.equal(await page.locator('#return').isVisible(),false);assert.equal(await page.locator('#target').isVisible(),false);
  assert.equal(await page.locator('#credential').inputValue(),'');assert.deepEqual(errors,[]);
  assert(calls.some(call=>call.body?.action==='start')&&calls.some(call=>call.body?.action==='return'));
  console.log('PASS portal password/PIN modes, token field, CSRF changes, audited start/return controls and no anonymous return');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
