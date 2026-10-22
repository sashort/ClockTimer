const assert=require('node:assert/strict');
const fixture=require('./order-filler-master-fixture.cjs');
(async()=>{
 const f=await fixture();const {page}=f;
 try{
  await page.evaluate(()=>{
   let fullscreen=false;
   Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>fullscreen?document.documentElement:null});
   document.documentElement.requestFullscreen=()=>new Promise(resolve=>{
    globalThis.completeLoginFullscreen=()=>{fullscreen=true;document.dispatchEvent(new Event('fullscreenchange'));resolve();};
   });
   screen.orientation.lock=async()=>{};
  });
  for(let i=0;i<4;i++)await page.locator(`[data-login-digit="id"][data-digit-index="${i}"]`).fill('0042'[i]);
  await page.locator('#loginButton').tap();
  await page.waitForFunction(()=>!document.querySelector('#loginPinRow').hidden);
  for(let i=0;i<2;i++)await page.locator(`[data-login-digit="pin"][data-digit-index="${i}"]`).fill('12'[i]);
  await page.evaluate(()=>completeLoginFullscreen());
  await page.waitForFunction(()=>document.activeElement?.matches('[data-login-digit="pin"][data-digit-index="2"]'));
  assert.deepEqual(await page.evaluate(()=>({id:document.querySelector('#loginIdRow').hidden,pin:document.querySelector('#loginPinRow').hidden})),{id:true,pin:false},'fullscreen preserves the PIN stage');
  assert.equal(await page.locator('#loginPassword').inputValue(),'12','fullscreen preserves entered PIN digits');
  for(let i=2;i<4;i++)await page.locator(`[data-login-digit="pin"][data-digit-index="${i}"]`).fill('1234'[i]);
  await page.locator('#loginButton').tap();
  await page.waitForFunction(()=>!document.querySelector('#loginDialog').open);
  assert.deepEqual(f.errors,[]);
  console.log('PASS delayed fullscreen preserves login stage, entered PIN and next-digit focus');
 }finally{await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
