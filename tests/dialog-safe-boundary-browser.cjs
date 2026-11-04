const fixture=require('./order-filler-master-fixture.cjs'),assert=require('assert/strict');
(async()=>{const f=await fixture({input:'transcript',clockTime:'2026-11-04T17:00:00Z'});try{const p=f.page,op=require('./retained-page-operation.cjs')(p);
await op(async()=>{await clockTimer.connect('test','test');while(!WMOFAccountSettings.loaded)await new Promise(r=>setTimeout(r,10));document.querySelector('#loginDialog').close();const bar=document.querySelector('#speechMicBar');bar.hidden=false;bar.promoteTopLayer();bar.refreshLayout();});
for(const theme of ['default','halloween'])for(const height of [844,600]){
await p.setViewportSize({width:390,height});await op(theme=>WMOFSeasonalTheme.setPreference(theme,{persist:false}),theme);await p.clock.runFor(1300);
const ids=await p.locator('dialog[id]').evaluateAll(ds=>ds.map(d=>d.id).filter(id=>!['numberPadDialog','voiceEntryDialog'].includes(id)));
const measurements=[];for(const id of ids){await op(id=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();document.getElementById(id).showModal();},id);await p.clock.runFor(450);measurements.push(await p.evaluate(id=>{const d=document.getElementById(id),r=d.getBoundingClientRect(),bar=document.querySelector('#speechMicBar');return {id,top:r.top,bottom:r.bottom,safe:bar.getSafeTop(),height:r.height};},id));}
const overlaps=measurements.filter(m=>m.height>0&&(m.bottom>m.safe+1||m.top< -1));assert.deepEqual(overlaps,[],'dialogs respect Mic Bar boundary '+theme+' '+height+' '+JSON.stringify(overlaps));
console.log('PASS '+measurements.length+' Order Filler dialogs above Mic Bar '+theme+' '+height);
}
await op(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();document.querySelector('#profileDialog').showModal();});await p.clock.runFor(400);
const focused=await p.evaluate(()=>{const bar=document.querySelector('#speechMicBar'),before=bar.getBoundingClientRect().bottom;document.querySelector('#profileUsername').focus();const bodyBounds=document.body.getBoundingClientRect.bind(document.body);document.body.getBoundingClientRect=()=>{const r=bodyBounds();return {left:r.left,right:r.right,top:r.top-160,bottom:r.bottom-160,width:r.width,height:r.height};};bar.refreshLayout();const after=bar.getBoundingClientRect().bottom;return {before,after};});assert(Math.abs(focused.before-focused.after)<1,'Profile focus/document pan cannot float the Mic Bar '+JSON.stringify(focused));
console.log('PASS Profile focus keeps Mic Bar anchored despite document pan');
}finally{await f.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
