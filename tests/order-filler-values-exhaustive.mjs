import assert from 'node:assert/strict';
import fs from 'node:fs';
import reporter from './diagnostics-reporter.cjs';
export async function runExhaustiveValues({window:w,timer,settle,errors,consoleErrors}){
 const kind=process.argv.find(s=>s.startsWith('--values='))?.split('=')[1];
 assert(['time','duration'].includes(kind),'choose --values=time or --values=duration');
 await timer.connect('test','test');w.document.querySelector('#loginDialog').close();
 w.SpeechMenu.testBegin();await w.WMOFActions.handleSpeechRuntimeStarted();w.document.querySelector('#speechMicBar').isOpen=true;await settle();
 await w.WMOFVoiceEntry.open({mode:kind==='time'?'absolute':'duration',source:'value-regression',initialValue:'',confirmTarget:'home',cancelTarget:'home',onConfirm:()=>true});
 const locale=w.WMOFLanguagePack.locale;
 if(process.env.CLOCKTIMER_TEST_LOCALE)assert.equal(process.env.CLOCKTIMER_TEST_LOCALE.toLowerCase(),locale.toLowerCase(),'numeric corpus must match the tested language/region');
 const corpus=(await import('./languages/'+locale+'/values.cjs')).default;
 assert.equal(corpus.locale,locale,'locale-specific corpus is explicit');
 const generate=corpus[kind];let totalTests=0;const plannedPaths={};
 for(const test of generate()){totalTests++;plannedPaths[test.path]=(plannedPaths[test.path]||0)+1;}
 const run=await reporter.beginValueRun({suite:kind,locale,totalTests});
 const a=new Proxy({}, {get:(_,name)=>w.WMOFActionFunctions.getImplementation(name)});
 const counts={voice:0,numberpad:0},paths={},failures=[];let completed=0,fatal=0;
 try{
  for(const test of generate()){
   a.clearNumberPadValue();let accepted;
   if(test.channel==='voice')accepted=a.handleVoiceEntrySpeech(test.input);
   else {for(const digit of test.input)a.enterNumberPadDigit(digit);if(test.meridiem)a.setNumberPadMeridiem(test.meridiem);accepted=true;}
   const observed=w.testValueSnapshot();
   let passed=test.reject?accepted===false&&!observed.valid:accepted===true&&observed.valid&&observed.value===test.expected;
   if(passed&&test.day){const date=new w.Date();if(test.day==='tomorrow')date.setDate(date.getDate()+1);const expected=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');passed=observed.date===expected;}
   const label=test.path+' | '+test.channel+': '+test.input+' => '+test.expected;
   if(!passed)failures.push({path:test.path,input:test.input,expected:test.expected,accepted,actual:observed.value,valid:observed.valid,date:observed.date});
   run.record({label,status:passed?'passed':'failed'});counts[test.channel]++;
   const group=paths[test.path] ||= {tested:0,failed:0};group.tested++;if(!passed)group.failed++;
   completed++;if(completed%200===0)await run.flush();if(completed%10000===0)console.log(kind+' paths: '+completed+'/'+totalTests);
  }
  assert.equal(completed,totalTests,'generated and executed counts agree');
  assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
  const folder=new URL('./artifacts/language-tests/'+locale.toLowerCase()+'/',import.meta.url);fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(new URL(kind+'-summary.json',folder),JSON.stringify({kind,locale,totalTests,counts,plannedPaths,paths,failures,layer:'Voicepad value implementation / Numberpad digit controller; no acoustic decoder'},null,2));
  assert.equal(failures.length,0,JSON.stringify(failures.slice(0,15)));
  console.log('PASS exhaustive '+kind+': '+JSON.stringify(counts)+' across '+Object.keys(paths).length+' paths');
 }catch(error){fatal++;throw error;}finally{await run.end({failures:fatal+failures.length});}
}
