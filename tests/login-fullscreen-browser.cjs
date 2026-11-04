const assert=require('node:assert/strict');
const fixture=require('./order-filler-master-fixture.cjs');
(async()=>{const f=await fixture();const {page}=f;
try{
 await page.evaluate(()=>{
  globalThis.loginFullscreenCalls=0;globalThis.loginKeyboardVisible=true;let fullscreen=false;
  Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>fullscreen?document.documentElement:null});
  Object.defineProperty(visualViewport,'height',{configurable:true,get:()=>innerHeight-(loginKeyboardVisible?300:0)});
  document.documentElement.requestFullscreen=async()=>{
   loginFullscreenCalls++;
   if(loginKeyboardVisible)throw Error('Fullscreen requested before keyboard closed');
   fullscreen=true;document.dispatchEvent(new Event('fullscreenchange'));
  };
  screen.orientation.lock=async()=>{};
 });
 for(let i=0;i<4;i++)await page.locator(`[data-login-digit="id"][data-digit-index="${i}"]`).fill('0042'[i]);
 await page.locator('#loginButton').tap();
 await page.waitForFunction(()=>!document.querySelector('#loginPinRow').hidden);
 assert.equal(await page.evaluate(()=>loginFullscreenCalls),0,'no fullscreen between ID and PIN');
 for(let i=0;i<2;i++)await page.locator(`[data-login-digit="pin"][data-digit-index="${i}"]`).fill('12'[i]);
 assert.equal(await page.locator('#loginPassword').inputValue(),'12','waiting for fullscreen preserves PIN');
 for(let i=2;i<4;i++)await page.locator(`[data-login-digit="pin"][data-digit-index="${i}"]`).fill('1234'[i]);
 await page.locator('#loginButton').tap();
 await page.waitForFunction(()=>!document.querySelector('#loginDialog').open);
 assert.equal(await page.evaluate(()=>loginFullscreenCalls),0,'successful auth still waits for IME');
 await page.evaluate(()=>{loginKeyboardVisible=false;visualViewport.dispatchEvent(new Event('resize'));});
 await page.waitForFunction(()=>loginFullscreenCalls===1&&document.fullscreenElement);
 assert.deepEqual(f.errors,[]);
 console.log('PASS fullscreen waits for successful ID/PIN login and keyboard dismissal; pending request preserves PIN');
}finally{await f.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
