import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
const window=new Window({url:'https://clock.example/'});
Object.assign(globalThis,{window,document:window.document,Element:window.Element,
    HTMLElement:window.HTMLElement,EventTarget:window.EventTarget,CustomEvent:window.CustomEvent,
    getComputedStyle:window.getComputedStyle.bind(window),requestAnimationFrame:cb=>queueMicrotask(()=>cb(performance.now()))});
globalThis.ParameterParser=Function(fs.readFileSync(new URL('../ParameterParser.js',import.meta.url),'utf8')+'\nreturn ParameterParser;')();
const parserSource=['DurationParser','SpokenTimeParser','PercentParser','SpeechValuePreprocessor'].map(name=>
    fs.readFileSync(new URL(`../lang/en-US/${name}.js`,import.meta.url),'utf8')).join('\n');
const Values=Function(parserSource+'\nreturn EnglishSpeechValuePreprocessor;')();
for(const name of ['SpeechGrammarContext','VoskPhraseListCompiler','VoskGrammarRouter'])
    Function(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8'))();
let source=fs.readFileSync(process.env.CLOCKTIMER_SPEECH_SOURCE || new URL('../SpeechMenu.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
if(process.env.SPEECH_INDEX_BASELINE) source=source.replace('static #indexedMatching = true','static #indexedMatching = false');
source=source.replace('\n}\n\nglobalThis.SpeechMenu = SpeechMenu;', `
    static testBegin() {
        SpeechMenu.#stopped=false;
        SpeechMenu.#recognizer={beginUtterance(){},setHotwords(){},abortUtterance(id){globalThis.__testAborts.push(id);},finishUtterance(){}};
        SpeechMenu.#beginUtterance(performance.now());
        return SpeechMenu.#utterance;
    }
    static testResult(u,text,final=false){SpeechMenu.#onSherpaTranscript({detail:{utteranceId:u.id,transcript:text,isFinal:final}});return SpeechMenu.#utterance;}
    static testTranscript(u,text,final=false){return SpeechMenu.#handleLiveTranscript(u,text,final);}
    static testFinish(reason="candidate-silence",recognize=true){SpeechMenu.#finishUtterance(reason,recognize);}
    static testFinal(u,text){return SpeechMenu.#handleCompletedTranscript(u,text);}
    static testInvalidate(){return SpeechMenu.#invalidateRecognitionContext("surface-context-change");}
    static testAvailable(){return SpeechMenu.#availableCandidates();}
    static testVoskContext(id,text){return SpeechMenu.#voskContext(id,text);}
    static testScope(text){return SpeechMenu.#scopeTranscriptToCommands(text);}
    static testBackend(name){SpeechMenu.#recognizerBackend=name;}
    static testPause(u){u.continuationPauseStartedAt=performance.now()-220;return SpeechMenu.#armContinuationPauseDeadline(u);}
    static testResume(u){SpeechMenu.#cancelContinuationPause(u);}
    static testActive(){return SpeechMenu.#utterance;}
    static testReset(){SpeechMenu.#clearPrimed();SpeechMenu.#finishedUtterances.clear();SpeechMenu.#utterance=undefined;}
    static testPrepare(element){return SpeechMenu.#prepare(element,true);}
}\n\nglobalThis.SpeechMenu = SpeechMenu;`);
Function(source)();
const speech=globalThis.SpeechMenu;
window.SpeechMenu=speech;
const calls=[],errors=[],aborts=[],skipped=[];
globalThis.__testAborts=aborts;
speech.events.addEventListener('utteranceUnrecognized',e=>errors.push(e.detail));
let readyOutcome=()=>Promise.resolve(true);
globalThis.TestChain=window.TestChain={
    readyAt(spokenTime){calls.push(['ready',spokenTime]);return readyOutcome();},
    standard(timeValue){assert.equal(speech.executionContext.chain,true);assert.equal(speech.executionContext.chainContext,'scheduled-start');calls.push(['standard',timeValue]);return true;},
    showLog(){calls.push(['log']);return true;},
    breakStart(){calls.push(['break']);return true;},
    choice(breakChoice){calls.push(['choice',breakChoice]);return true;},
    okay(){calls.push(['okay']);return true;},
    permitted(){return false;},
    sync(syncAction){calls.push(['sync',syncAction]);return true;},
    sleep(){calls.push(['sleep']);return true;},
    collect(value){calls.push(['collect',value]);return true;}

};
const preprocessorCalls=[];
globalThis.TestPreprocessors=window.TestPreprocessors={
    async first(text){preprocessorCalls.push('first');return text+' first';},
    second(text){preprocessorCalls.push('second:'+text);return text+' second';},
    reject(){preprocessorCalls.push('reject');return false;},
    shouldNotRun(){preprocessorCalls.push('should-not-run');return 'unexpected';},
    invalid(){return 42;}
};
globalThis.TestValues=window.TestValues={normalize(text,{pattern,kind,field,provisional}){
    const match=new RegExp(pattern,'i').exec(text);
    if(!match?.groups?.[field]) return text;
    const value=match.groups[field];
    const normalized=Values.normalize(value,kind);
    if(normalized === undefined) return provisional ? false : text;
    return text.replace(value,normalized);
}};
const make=(host,id,pattern,action,attrs={})=>{
    const element=document.createElement('speech-command');
    element.dataset.speechEditorId=id;
    if(attrs['speech-preproc']) element.setAttribute('speech-collect','');
    element.setAttribute('speech-pattern',pattern);
    element.setAttribute('speech-function',`TestChain.${action}`);
    for(const [key,value] of Object.entries(attrs)) element.setAttribute(key,value);
    host.append(element);return element;
};
const ready=make(document.body,'ready','^ready at (?<spokenTime>.+)$','readyAt',{
    'speech-modal':'top-level','speech-chain-next':'scheduled-start','speech-preproc':'TestValues.normalize',
    'speech-preproc-context':'clock','speech-preproc-field':'spokenTime'});
const future=document.createElement('dialog');document.body.append(future);
const standard=make(future,'standard','^standard(?: time)? (?<timeValue>.+)$','standard',{
    'speech-chain-context':'scheduled-start','data-speech-target':'#future-standard',
    'speech-preproc':'TestValues.normalize','speech-preproc-context':'duration','speech-preproc-field':'timeValue'});
standard.id='future-standard';
const log=make(document.body,'log','^show log$','showLog',{'speech-modal':'top-level'});

speech.events.addEventListener('speechSegmentSkipped',e=>skipped.push(e.detail));
const fresh=()=>{speech.testReset();calls.length=0;errors.length=0;aborts.length=0;skipped.length=0;return speech.testBegin();};
const hear=async(u,text,final=false)=>{await speech.testTranscript(u,text,final);await u.digestQueue;await u.segmentBarrier;await new Promise(setImmediate);};
try {
 let headed=fresh();await hear(headed,'background chatter show log');
 assert.deepEqual(calls,[['log']]);assert.equal(headed.digestTranscript,'show log','consumed head excludes discarded leading noise');
 await hear(headed,'different background words show log show log',true);
 assert.deepEqual(calls,[['log'],['log']],'revised leading junk cannot cancel or repeat the valid command head');assert.equal(errors.length,0);
 headed=fresh();await speech.testFinal(headed,'background chatter show log');await headed.digestQueue;
 assert.deepEqual(calls,[['log']]);assert.equal(headed.digestTranscript,'show log','completed decoder uses the same head boundary');
 headed=fresh();await hear(headed,'junk show log');await speech.testFinal(headed,'revised junk show log show log');await headed.digestQueue;
 assert.deepEqual(calls,[['log'],['log']],'completed results also re-anchor past revised junk');assert.equal(errors.length,0);
 headed=fresh();speech.testBackend('vosk');speech.testResult(headed,'background chatter ready at four twelve standard time twenty minutes',true);
 await new Promise(setImmediate);await headed.digestQueue;await new Promise(setImmediate);
 assert.deepEqual(calls,[['ready','4:12'],['standard','0:20:00']],'Vosk decoder events find the valid head without changing values');assert.equal(errors.length,0);
 speech.testBackend('sherpa');
 let u=fresh();await hear(u,'nonsense',true);
 assert.equal(speech.testActive(),undefined,'invalid only segment closes capture immediately');
 assert.deepEqual(aborts,[u.id]);assert.equal(errors.length,1);assert.equal(errors[0].fast,true);assert.deepEqual(calls,[]);
 u=fresh();speech.testResult(u,'nonsense',true);await new Promise(setImmediate);
 assert.equal(speech.testActive(),undefined,'scoped-out final decoder events also close the stream');assert.deepEqual(aborts,[u.id]);assert.equal(errors.length,1);
 u=fresh();speech.testResult(u,'',true);await new Promise(setImmediate);
 assert.equal(speech.testActive(),undefined,'empty final decoder events release the stream');assert.deepEqual(aborts,[u.id]);assert.equal(errors.length,1);
 await speech.testFinal(u,'show log');assert.deepEqual(calls,[],'late decoder results cannot revive a rejected utterance');assert.equal(errors.length,1);
 u=fresh();await speech.testFinal(u,'nonsense');await u.digestQueue;
 assert.equal(speech.testActive(),undefined,'completed decode rejects an invalid only segment');assert.equal(errors.length,1);
 u=fresh();await hear(u,'show log rubbish',true);
 assert.equal(speech.testActive(),undefined,'invalid last segment closes the stream');assert.deepEqual(aborts,[u.id]);assert.equal(errors.length,1);
 assert.deepEqual(calls,[['log']],'a fully formed terminal command survives a malformed suffix in the same decoder result');
 u=fresh();await hear(u,'show log gibberish show log',true);
 assert.deepEqual(calls,[['log'],['log']]);assert.equal(errors.length,0);
 assert.equal(u.digestTranscript,'show log gibberish show log','skipped middle words remain consumed');
 assert.deepEqual(skipped.map(e=>e.transcript),['gibberish']);assert(skipped.every(e=>e.utteranceId===u.id));
 u=fresh();await hear(u,'ready at four bananas show log',true);
 assert.deepEqual(calls,[['log']],'malformed time is omitted entirely');assert.equal(errors.length,0);
 u=fresh();await hear(u,'ready at bananas standard time twenty minutes',true);
 assert.deepEqual(calls,[],'skipping a malformed state-changing command does not grant its next context');assert.equal(errors.length,1);assert.equal(speech.testActive(),undefined);
 u=fresh();await hear(u,'show log gibberish show log');
 await hear(u,'show log gibberish show log',true);
 assert.deepEqual(calls,[['log'],['log']],'final transcript does not duplicate commands or revise skipped words');assert.equal(errors.length,0);
 u=fresh();await hear(u,'ready at four tw');
 assert.equal(speech.testActive(),u,'an unfinished interim value stays open');assert.equal(errors.length,0);
 await hear(u,'ready at four twelve standard time twenty minutes',true);
 assert.deepEqual(calls,[['ready','4:12'],['standard','0:20:00']]);assert.equal(errors.length,0);
 u=fresh();await hear(u,'ready at four twelve standard time bananas standard time twenty minutes',true);
 assert.deepEqual(calls,[['ready','4:12'],['standard','0:20:00']],'valid state transition survives a later malformed duration');assert.equal(errors.length,0);
 u=fresh();await hear(u,'ready at four bananas',true);
 assert.deepEqual(calls,[],'invalid collector suffix must not execute a valid prefix');assert.equal(speech.testActive(),undefined);
 u=fresh();await hear(u,'ready at four tw');assert.equal(errors.length,0);assert.equal(speech.testActive(),u);
 await hear(u,'ready at four bananas');assert.equal(u.chainActive,false,'malformed continuation releases its logical stream immediately');
 assert(skipped.some(event=>event.reason==='malformed-continuation'&&event.fast));
 await hear(u,'ready at four bananas show log',true);assert.deepEqual(calls,[['log']],'speech after a malformed segment is still processed');
 u=fresh();await hear(u,'ready at');await hear(u,'ready at bananas');
 assert(skipped.some(event=>event.reason==='malformed-continuation'&&event.fast),'a pending value that never had a valid prefix still fails fast');
 await hear(u,'ready at bananas show log',true);assert.deepEqual(calls,[['log']]);
 u=fresh();await hear(u,'ready at');speech.testPause(u);await new Promise(resolve=>setTimeout(resolve,200));
 assert.equal(speech.testActive(),undefined,'incomplete continuation fails within the short silence window');assert.equal(errors.length,1);
 u=fresh();await hear(u,'ready at');speech.testPause(u);speech.testResume(u);await new Promise(resolve=>setTimeout(resolve,200));
 assert.equal(speech.testActive(),u,'resuming speech cancels the silence deadline');
 await hear(u,'ready at four twelve',true);assert.deepEqual(calls,[['ready','4:12']]);
 const sync=make(document.body,'sync','^sync (?<syncAction>on|off)$','sync',{'speech-modal':'top-level'});
 u=fresh();await hear(u,'ready at four thirty sync on');
 assert.deepEqual(calls,[['ready','4:30'],['sync','on']],'separate Sync command executes between the chain steps');
 assert.equal(u.completedStreams,1,'noncontinuable Sync commits immediately even inside a chain context');
 await hear(u,'ready at four thirty sync on standard time seventeen minutes');
 assert.equal(calls.length,2,'a duration collector can still extend with seconds');
 speech.testPause(u);await new Promise(resolve=>setTimeout(resolve,200));await u.digestQueue;
 assert.deepEqual(calls,[['ready','4:30'],['sync','on'],['standard','0:17:00']],'chain context survives intervening commands');
 assert.equal(errors.length,0,'silence completes a valid collector without waiting for decoder final');
 u=fresh();await hear(u,'ready at bananas sync on standard time seventeen minutes',true);
 assert(!calls.some(call=>call[0]==='ready'||call[0]==='standard'),'malformed Ready At cannot authorize the dependent Standard Time');
 const protectedHead=make(document.body,'protected','^break end$','showLog',{'speech-modal':'top-level','speech-reject-prefix':'short'});
 u=fresh();await hear(u,'short break end',true);assert.deepEqual(calls,[],'removed qualified command cannot recover its valid suffix');
 u=fresh();await hear(u,'sync on short break end show log',true);assert.deepEqual(calls,[['sync','on'],['log']],'removed command in the middle is omitted without dropping surrounding commands');
 protectedHead.remove();
 sync.remove();
 const short=make(document.body,'short-ready','^ready$','showLog',{'speech-modal':'top-level'});
 u=fresh();await hear(u,'ready');assert.deepEqual(calls,[],'Ready waits because Ready At can continue it');assert.equal(u.completedStreams,undefined);short.remove();
 Function(fs.readFileSync(new URL('../StateTransactions.js',import.meta.url),'utf8'))();
 const coordinator=globalThis.WMOFCoordinator;let committed=0,release;
 coordinator.register('test-state',{capture:()=>committed,restore:value=>{committed=value;}});
 TestChain.showLog=()=>coordinator.run('showLog',async()=>{committed++;await new Promise(resolve=>release=resolve);calls.push(['log']);return true;},
     {chain:true,owner:speech.executionContext.operation});
 u=fresh();await speech.testTranscript(u,'noise show log');
 await new Promise(setImmediate);assert.equal(coordinator.pending.length,1,'terminal stream is awaiting its actual operation');
 let planned=false;const grammar=speech.testVoskContext(u.id,'noise show log').then(result=>{planned=true;return result;});
 await new Promise(setImmediate);assert.equal(planned,false,'next grammar waits for the earlier operation to settle');
 release();await u.segmentBarrier;await grammar;
 assert.equal(coordinator.pending.length,0,'terminal operation commits before decoder final');assert.equal(u.completedStreams,1);
 assert.equal(speech.testActive(),u,'audio capture and utterance ID survive terminal command boundaries');assert.deepEqual(aborts,[],'command stream truncation keeps buffered audio');
 await hear(u,'different noise show log rubbish',true);
 assert.equal(committed,1,'an invalid later stream cannot restore the snapshot before the confirmed command');assert.equal(errors.length,1);
 console.log('PASS invalid terminal segments abort; malformed middle segments skip without granting projected state');
} finally {await window.happyDOM.close();}
