import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const resources = Object.fromEntries(['ui-text','speech-patterns','announcements','associations'].map(name => [name, JSON.parse(read('lang/en-US/' + name + '.json'))]));
const scratch = fileURLToPath(new URL('../work/', import.meta.url)); fs.mkdirSync(scratch, {recursive:true});
const profile = fs.mkdtempSync(path.join(scratch, 'response-browser-'));
const child = spawn(process.env.SPEECH_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--remote-debugging-pipe','--user-data-dir='+profile,'about:blank'],
    {windowsHide:true, stdio:['ignore','ignore','ignore','pipe','pipe']});
const browser = {async close() {try {await call('Browser.close');} catch {} child.kill();}};
let sessionId, nextId = 0, buffer = ''; const pending = new Map(), errors = [];
child.stdio[4].on('data', chunk => {
    buffer += chunk.toString(); let end;
    while ((end = buffer.indexOf('\0')) >= 0) {
        const message = JSON.parse(buffer.slice(0,end)); buffer = buffer.slice(end+1);
        if (message.id) {const request=pending.get(message.id);pending.delete(message.id);clearTimeout(request.timer);message.error?request.reject(message.error):request.resolve(message.result);}
        else if(message.method==='Runtime.exceptionThrown') errors.push(JSON.stringify(message.params.exceptionDetails));
    }
});
const call=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++nextId; const timer=setTimeout(()=>{pending.delete(id);reject(Error('Browser timed out: '+method));},10000);
    pending.set(id,{resolve,reject,timer});
    child.stdio[3].write(JSON.stringify({id,method,params,...(sessionId&&!method.startsWith('Target.')&&!method.startsWith('Browser.')?{sessionId}:{})})+'\0');
});
const page = {async setViewportSize(size) {await call('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:false});},
    async route() {await call('Network.enable');await call('Network.setBlockedURLs',{urls:['http://*','https://*']});},
    on() {}, async setContent(html) {const tree=await call('Page.getFrameTree');await call('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html});},
    async addScriptTag({content}) {return evaluate(content);}, evaluate: fn => evaluate(`(${fn.toString()})()`),
    waitForTimeout: ms => new Promise(resolve=>setTimeout(resolve,ms)),
    async screenshot({path: target}) {const result=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(target,Buffer.from(result.data,'base64'));}};
const evaluate = async expression => {const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
try {
    const targets=await call('Target.getTargets');
    sessionId=(await call('Target.attachToTarget',{targetId:targets.targetInfos.find(t=>t.type==='page').targetId,flatten:true})).sessionId;
    await call('Runtime.enable');
    await page.route('**/*', route => route.abort());
    for (const width of [1280, 390]) {
        await page.setViewportSize({width, height: 720});
        if (width === 1280) {
        await page.setContent(`<style>body{margin:24px;background:#172533;color:white;font:16px Arial}speech-mic-bar{margin-top:100px}</style><h2>Speech response chain</h2><p>New results dock on the left; each expires independently.</p><script id="language-pack" type="application/json">${JSON.stringify(resources).replace(/</g,'\\u003c')}</script>`);
        await page.addScriptTag({content: 'if(!crypto.randomUUID){let n=0;crypto.randomUUID=()=>"10000000-1000-4000-8000-"+String(++n).padStart(12,"0");}'});
        await page.addScriptTag({content: read('LanguagePack.js')});
        await page.addScriptTag({content: `window.SpeechMenu={events:new EventTarget(),started:true,muted:false,phraseGroups:[],refresh(){},isCommandImplemented(){return true}}; const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){const root=attach.call(this,options);window.testShadow=root;return root;};`});
        await page.addScriptTag({content: read('SpeechMicBar.js')});
        await page.evaluate(() => {
            window.bar = new SpeechMicBar(); document.body.append(bar); bar.isOpen = true;
            window.result = text => {const e = document.createElement('span');e.dataset.speechResponseSnapshot='';e.textContent=text;e.style.cssText='display:block;background:#0053e2;border:1px solid #a9ddf7;border-radius:6px;padding:7px;white-space:nowrap;color:white';return e;};
            bar.setResponse(result('Log opened'), {resultId:'old'});
        });
        } else {
            await page.evaluate(async () => {await bar.clearResponse();bar.setResponse(result('Log opened'), {resultId:'old'});});
        }
        await page.waitForTimeout(360);
        await page.evaluate(() => bar.setResponse(result('Sync on'), {resultId:'middle'}));
        await page.waitForTimeout(360);
        await page.evaluate(() => bar.setResponse(result('Ready 4:12'), {resultId:'new'}));
        const incoming = await page.evaluate(() => {
            const first = testShadow.querySelector('.response-result');
            return {z:first.style.zIndex, animations:first.getAnimations().length};
        });
        assert.equal(incoming.z, '0'); assert(incoming.animations > 0, 'arrival animates underneath existing columns');
        await page.waitForTimeout(360);
        const layout = await page.evaluate(() => {
            const lane = testShadow.querySelector('#response').getBoundingClientRect();
            return {left:lane.left,right:lane.right, items:[...testShadow.querySelectorAll('.response-result')].map(e=>({id:e.dataset.responseId,x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width}))};
        });
        assert.deepEqual(layout.items.map(e=>e.id), ['new','middle','old']);
        assert(layout.items[0].x < layout.items[1].x && layout.items[1].x < layout.items[2].x, 'newest column is on the left');
        assert(layout.items.every(e=>Math.abs(e.y-layout.items[0].y)<1), 'all results occupy one row');
        assert(layout.items[0].x >= layout.left-1 && layout.items[0].x+layout.items[0].width <= layout.right+1, 'newest result stays visible on narrow screens');
        if (process.env.SPEECH_RESPONSE_OUTPUT) {
            fs.mkdirSync(process.env.SPEECH_RESPONSE_OUTPUT, {recursive:true});
            await page.screenshot({path:path.join(process.env.SPEECH_RESPONSE_OUTPUT,`speech-results-${width}.png`)});
        }
        await page.evaluate(() => {window.expiring=bar.clearResponse({resultId:'old',duration:320});});
        await page.waitForTimeout(100);
        const movement = await page.evaluate(() => {
            const animation=testShadow.querySelector('#responseContent').getAnimations()[0];
            return animation?.effect.getKeyframes().at(-1).transform;
        });
        assert(movement?.startsWith('translateX('), 'TTL moves the entire result chain right');
        await page.evaluate(() => window.expiring);
        assert.deepEqual(await page.evaluate(() => [...testShadow.querySelectorAll('.response-result')].map(e=>e.dataset.responseId)),['new','middle']);
        await page.evaluate(() => bar.clearResponse({resultId:'new',duration:50}));
        const afterEarlyExpiry=await page.evaluate(() => ({
            x:testShadow.querySelector('.response-result').getBoundingClientRect().left,
            edge:testShadow.querySelector('#response').getBoundingClientRect().right
        }));
        assert(afterEarlyExpiry.x>=afterEarlyExpiry.edge-1,'an early-expiring left column pushes all surviving columns right without snapping them back');
    }
    assert.deepEqual(errors, []);
    console.log('PASS native browser response columns, arrival layering, newest-left geometry, narrow viewport and whole-chain expiry');
} finally {await browser.close();}
