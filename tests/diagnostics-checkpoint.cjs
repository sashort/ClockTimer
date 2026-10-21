const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const reporter=require('./diagnostics-reporter.cjs');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'diagnostics-checkpoint-')),prefix=path.join(directory,'job');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){for(let i=0;i<100;i++){if(check())return;await sleep(50);}throw Error('Checkpoint fixture timed out');}
async function run(abort){
 fs.writeFileSync(prefix+'.pause','pause');
 const child=spawn(process.execPath,['-e',`const fs=require('node:fs');require(${JSON.stringify(require.resolve('./diagnostics-reporter.cjs'))}).checkpoint().then(()=>fs.writeFileSync(process.env.CLOCKTIMER_DIAGNOSTICS_JOB_PREFIX+'.continued','yes')).catch(()=>{process.exitCode=2;});`],{env:{...process.env,CLOCKTIMER_DIAGNOSTICS_JOB_PREFIX:prefix},stdio:'pipe'});
 const ended=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
 try{
  await until(()=>fs.existsSync(prefix+'.paused'));assert(!fs.existsSync(prefix+'.continued'),'stopped work must not advance');await sleep(300);assert(!fs.existsSync(prefix+'.continued'));
  if(abort)fs.writeFileSync(prefix+'.abort','abort');else fs.unlinkSync(prefix+'.pause');
  assert.equal(await ended,abort?2:0);assert.equal(fs.existsSync(prefix+'.continued'),!abort,'resume continues, abort never advances');
 }finally{child.kill();for(const suffix of ['.pause','.paused','.abort','.continued'])fs.rmSync(prefix+suffix,{force:true});}
}
(async()=>{try{await reporter.checkpoint();await run(false);await run(true);console.log('PASS checkpoint stop retains position, resume continues and abort cannot advance');}finally{fs.rmSync(directory,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
