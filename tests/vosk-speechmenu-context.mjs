import fs from 'node:fs';
import {installSpeechLifecycle} from './speech-lifecycle-fixture.mjs';
installSpeechLifecycle();
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
let source=fs.readFileSync(process.env.CLOCKTIMER_SPEECH_SOURCE || new URL('../SpeechMenu.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
if(process.env.SPEECH_INDEX_BASELINE) source=source.replace('static #indexedMatching = true','static #indexedMatching = false');
source=source.replace('\n}\n\nglobalThis.SpeechMenu = SpeechMenu;', `
    static testBegin() {
        SpeechMenu.#stopped=false;
        SpeechMenu.#recognizer={beginUtterance(){},setHotwords(){},abortUtterance(){},finishUtterance(){}};
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
    static testActive(){return SpeechMenu.#utterance;}
    static testTranscriptMode(mode){SpeechMenu.#recognizer.transcriptMode=mode;}
    static testBackend(value){SpeechMenu.#recognizerBackend=value;}
    static testRecover(u,text){return SpeechMenu.#recoverOpenContinuationTranscript(u,text);}
    static testReset(){SpeechMenu.#clearPrimed();SpeechMenu.#finishedUtterances.clear();SpeechMenu.#utterance=undefined;}
    static testPrepare(element){return SpeechMenu.#prepare(element,true);}
}\n\nglobalThis.SpeechMenu = SpeechMenu;`);
Function(source)();
const speech=globalThis.SpeechMenu;
window.SpeechMenu=speech;
const calls=[],errors=[];
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
    assert.equal(speech.testScope('please login via voice ready at four twenty two'),
        'ready at four twenty two',
        'transcription removes leading tokens outside registered command scope');
    assert.equal(speech.testScope('ready at four twenty two'),
        'ready at four twenty two',
        'transcription preserves command parameters intact');
    assert.equal(speech.testScope('show log'),
        'show log',
        'transcription preserves another registered command');
    assert.equal(speech.testScope('please login via voice rea'), 'rea',
        'transcription preserves a partial command-start token');
    assert.equal(speech.testScope('please login via voice'), '',
        'transcription discards a transcript with no in-scope command token');
const hear=async(...args)=>{await speech.testTranscript(...args);await new Promise(setImmediate);};
const fresh=()=>{speech.testReset();calls.length=0;errors.length=0;return speech.testBegin();};
try {
    speech.testBackend('vosk');
    const provisional=fresh();
    await hear(provisional,'show log');await provisional.digestQueue;
    assert.deepEqual(calls,[],'a provisional terminal Vosk command has no UI effects');
    await hear(provisional,'show log',true);await provisional.digestQueue;
    assert.deepEqual(calls,[['log']],'the final terminal command executes once');
    await speech.sleep();
    const wake=make(document.body,'wake-test','^wake$','wake',{'speech-function':'SpeechMenu.wake','speech-modal':'system'});
    const sleeping=fresh();
    await hear(sleeping,'wake');assert(speech.muted,'a partial wake word cannot cross the sleep boundary');
    await hear(sleeping,'wake',true);await sleeping.digestQueue;
    assert.equal(speech.muted,false,'a final wake word can activate recognition');
    wake.remove();speech.testBackend('sherpa');speech.testReset();
    const revision=fresh();
    revision.streamStack=[{source:'speech',baseTranscript:'three',status:'pending'}];
    speech.testTranscriptMode('cumulative');
    assert.equal(speech.testRecover(revision,'trip goal'),'trip goal','cumulative partial revisions replace an earlier misheard command head');
    revision.streamStack[0].baseTranscript='trip goal one hundred';
    assert.equal(speech.testRecover(revision,'trip goal one hundred ten percent'),'trip goal one hundred ten percent','cumulative values are not appended twice across continuation streams');
    speech.testTranscriptMode('segment');
    assert.equal(speech.testRecover(revision,'ten percent'),'trip goal one hundred ten percent','segment-local adapters retain continuation recovery');
    speech.testReset();
    // Vosk obtains both initial availability and future chain surfaces from
    // SpeechMenu, without running actions or changing the live collector state.
    const recognition=fresh();
    const activeGrammar=await speech.testVoskContext(recognition.id);
    assert(activeGrammar.records.some(record=>record.pattern===ready.getAttribute('speech-pattern')));
    assert(!activeGrammar.records.some(record=>record.id==='future-standard'), 'closed modal commands are not in the initial grammar');
    const projectedGrammar=await speech.testVoskContext(recognition.id,'ready at four twelve');
    assert(projectedGrammar.records.some(record=>record.id==='future-standard' && record.expect==='duration'));
    assert.deepEqual(calls,[], 'grammar projection never executes actions');
    assert.equal(recognition.valueCollectors.size,0, 'grammar probes leave live collectors untouched');
    future.open=true;
    const modalRecognition=fresh();
    const modalGrammar=await speech.testVoskContext(modalRecognition.id);
    assert.deepEqual(modalGrammar.records.map(record=>record.pattern), speech.testAvailable().map(element=>element.getAttribute('speech-pattern')),
        'modal grammar exactly follows SpeechMenu availability, including its permitted global commands');
    future.open=false;
    speech.testReset();

    for (const name of ['SpeechGrammarContext','VoskPhraseListCompiler','VoskGrammarRouter'])
        Function(fs.readFileSync(new URL(`../${name}.js`,import.meta.url),'utf8'))();
    for (const value of ['four twelve','four thirteen','four twenty two']) {
        const u=fresh();
        const context=await speech.testVoskContext(u.id);
        const router=new globalThis.VoskGrammarRouter({...context,
            valuePhrases:{time:[value],duration:['twenty minutes']},
            nextRecords:async text=>(await speech.testVoskContext(u.id,text)).records});
        assert.equal((await router.update('ready at')).grammar,'time');
        assert(router.phrases.includes('standard time'));
        assert.equal((await router.update(value+' standard time')).grammar,'duration');
        const routed=await router.update('twenty minutes');
        assert.equal(routed.transcript,`ready at ${value} standard time twenty minutes`);
        await hear(u,routed.transcript,true);await u.digestQueue;
        assert.deepEqual(calls,[['ready',Values.normalize(value,'clock')],['standard','0:20:00']],
            'SpeechMenu validates and executes the routed command chain');
    }
    speech.testReset();
    TestChain.goal=(percent,goalScope)=>{calls.push(['goal',percent,goalScope]);return true;};
    const goal=make(document.body,'goal','^(?<percent>.+?)(?: percent)? (?<goalScope>day|trip|total|week|money|month|year)$','goal',{
        'speech-modal':'top-level','speech-preproc':'TestValues.normalize',
        'speech-preproc-context':'percent','speech-preproc-field':'percent'});
    const u=fresh();
    assert.equal(speech.testScope('one hundred ten percent trip'),'one hundred ten percent trip',
        'root pruning preserves a declared value-first command');
    assert.equal(speech.testScope('background chatter one hundred ten percent trip'),'one hundred ten percent trip',
        'leading junk is still removed before a value-first command');
    const goalRouter=new globalThis.VoskGrammarRouter({...await speech.testVoskContext(u.id),
        valuePhrases:globalThis.VoskGrammarRouter.valuePhrases(),
        nextRecords:async text=>(await speech.testVoskContext(u.id,text)).records});
    assert(goalRouter.phrases.includes('percent trip'),'initial vocabulary includes the value-first command suffix');
    await goalRouter.update('one hundred');
    const routedGoal=await goalRouter.update('one hundred ten percent trip');
    assert.equal(routedGoal.transcript,'one hundred ten percent trip');
    await hear(u,routedGoal.transcript,true);await u.digestQueue;
    assert.deepEqual(calls,[['goal','110','trip']]);
    goal.remove();speech.testReset();

    console.log('PASS Vosk SpeechMenu availability, projection, planner execution, teen values and value-first goals');
} finally {speech.testReset();await window.happyDOM.close();}
