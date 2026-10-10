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
    static testActive(){return SpeechMenu.#utterance;}
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
const hear=async(...args)=>{await speech.testTranscript(...args);await new Promise(setImmediate);};
const fresh=()=>{speech.testReset();calls.length=0;errors.length=0;return speech.testBegin();};
try {
    const chain=make(document.body,'preprocessor-chain','^chain test','okay',{
        'speech-preproc':'TestPreprocessors.first,TestPreprocessors.second'
    });
    speech.testPrepare(chain);
    assert.equal(await chain.speechPreprocFunc('input',{}),'input first second');
    assert.deepEqual(preprocessorCalls,['first','second:input first'],'preprocessors run sequentially');
    preprocessorCalls.length=0;
    chain.setAttribute('speech-preproc','TestPreprocessors.first,TestPreprocessors.reject,TestPreprocessors.shouldNotRun');
    speech.testPrepare(chain);
    assert.equal(await chain.speechPreprocFunc('input',{}),false,'false explicitly rejects the candidate');
    assert.deepEqual(preprocessorCalls,['first','reject'],'rejection stops subsequent stages');
    chain.setAttribute('speech-preproc','TestPreprocessors.invalid');
    speech.testPrepare(chain);
    await assert.rejects(chain.speechPreprocFunc('input',{}),TypeError,'non-string results are rejected');
    chain.setAttribute('speech-preproc','TestPreprocessors.first,TestPreprocessors.second');
    speech.testPrepare(chain);
    const controller=new AbortController();controller.abort();
    assert.equal(await chain.speechPreprocFunc('input',{signal:controller.signal}),'input','aborted chains do not start a stage');
    chain.remove();
    preprocessorCalls.length=0;
    // The scheduled dialog accepts a bare duration as well as "standard time".
    standard.setAttribute('speech-pattern', '^(?:standard(?: time)? )?(?<timeValue>.+)$');
    const editor=make(future,'scheduled-editor','^standard(?: time)?$','showLog',{
        'speech-chain-context':'scheduled-start'});
    for (const words of [['ready at four','ready at four tw','ready at four twenty','ready at four twenty t','ready at four twenty two'],
        ['ready at four twenty two standard','ready at four twenty two standard time',
         'ready at four twenty two standard time eleven','ready at four twenty two standard time eleven twenty',
         'ready at four twenty two standard time eleven twenty six'],
        ['ready at four twenty two eleven','ready at four twenty two eleven twenty',
         'ready at four twenty two eleven twenty six']]) {
        const collecting=fresh();
        for (const text of words) {
            await hear(collecting,text);await collecting.digestQueue;
            assert(!calls.some(call=>call[0]==='standard' || call[0]==='log'),
                `An unfinished scheduled parameter must not execute or open its editor: ${text}`);
        }
        await hear(collecting,words.at(-1),true);await collecting.digestQueue;
        assert.equal(errors.length,0,JSON.stringify(errors));
        assert.deepEqual(calls, words.at(-1).includes('eleven')
            ? [['ready','4:22'],['standard','0:11:26']] : [['ready','4:22']]);
    }
    future.open=true;
    for (const words of [['standard','standard time','standard time elev','standard time eleven','standard time eleven tw','standard time eleven twenty','standard time eleven twenty s','standard time eleven twenty six'],
        ['eleven','eleven tw','eleven twenty','eleven twenty s','eleven twenty six']]) {
        const collecting=fresh();collecting.digestContext='scheduled-start';
        for (const text of words) {
            await hear(collecting,text);await collecting.digestQueue;
            assert.equal(calls.length,0,`Scheduled-dialog interim must stay pending: ${text}`);
        }
        await hear(collecting,words.at(-1),true);await collecting.digestQueue;
        assert.deepEqual(calls,[['standard','0:11:26']]);
    }
    const units=fresh();units.digestContext='scheduled-start';
    for (const text of ['eleven minutes','eleven minutes twenty','eleven minutes twenty s','eleven minutes twenty six seconds']) {
        await hear(units,text);await units.digestQueue;
        assert.equal(calls.length,0,`Unit continuation must stay in one value: ${text}`);
    }
    await hear(units,'eleven minutes twenty six seconds',true);await units.digestQueue;
    assert.deepEqual(calls,[['standard','0:11:26']]);
    const editorOnly=fresh();editorOnly.digestContext='scheduled-start';
    await hear(editorOnly,'standard time',true);await editorOnly.digestQueue;
    assert.deepEqual(calls,[['log']],'a final editor-only command still opens duration entry');
    future.open=false;
    editor.remove();
    standard.setAttribute('speech-pattern','^standard(?: time)? (?<timeValue>.+)$');
    // Recognizer-name preferences are intentionally not speech-command prefixes.
    const ordinary=fresh();
    await hear(ordinary,'show log Beatrice show log',true);
    await ordinary.digestQueue;
    assert.deepEqual(calls,[['log'],['log']],'recognizer name is ordinary transcript text, not a stream boundary');
    // Independent command groups compete for the same unconsumed words.
    const syncGroup=document.createElement('section');document.body.append(syncGroup);
    const sleepGroup=document.createElement('section');document.body.append(sleepGroup);
    const sync=make(syncGroup,'sync','^sync(?: (?<syncAction>on|off))?$','sync');
    const sleep=make(sleepGroup,'sleep','^off$','sleep');
    const competing=fresh();
    await hear(competing,'sync');
    assert.equal(calls.length,0,'sync yields while a valid continuation can form');
    await hear(competing,'sync off');await competing.digestQueue;
    assert.deepEqual(calls,[['sync','off']],'completed continuation wins across groups immediately');
    await hear(competing,'sync off',true);await competing.digestQueue;
    assert.deepEqual(calls,[['sync','off']],'final decode does not replay a winning attempt');
    const chained=fresh();
    await hear(chained,'sync off show log',true);await chained.digestQueue;
    assert.deepEqual(calls,[['sync','off'],['log']],'losing group cannot consume the winning continuation');
    const intentional=fresh();
    await hear(intentional,'show log off',true);await intentional.digestQueue;
    assert.deepEqual(calls,[['log'],['sleep']],'independent nonoverlapping commands still chain');
    sync.remove();
    const short=make(sleepGroup,'short','^sync$','sleep');
    const longer=make(syncGroup,'longer','^sync off$','showLog');
    const sibling=fresh();await hear(sibling,'sync');
    assert.equal(calls.length,0,'short match yields to another group');
    await hear(sibling,'sync off');await sibling.digestQueue;
    assert.deepEqual(calls,[['log']],'other group replaces the yielded match');
    longer.setAttribute('disabled','');
    const unavailable=fresh();await hear(unavailable,'sync');await unavailable.digestQueue;
    assert.deepEqual(calls,[['sleep']],'unavailable continuations do not delay execution');
    longer.removeAttribute('disabled');
    const enabled=fresh();await hear(enabled,'sync');
    assert.equal(calls.length,0,'availability is reevaluated for every attempt');
    await hear(enabled,'sync',true);await enabled.digestQueue;
    assert.deepEqual(calls,[['sleep']],'final boundary releases the yielded short command');
    short.remove();longer.remove();sleep.remove();syncGroup.remove();sleepGroup.remove();

    let releasePreparation;
    let preparationCount=0;
    window.TestPreparation=globalThis.TestPreparation={async prepare(text){
        if(++preparationCount===2) await new Promise(resolve=>releasePreparation=resolve);
        return text;
    }};
    const deferred=make(document.body,'deferred','^deferred$','sleep',{'speech-preproc':'TestPreparation.prepare'});
    deferred.removeAttribute('speech-collect');
    const aborted=fresh();await hear(aborted,'deferred');
    assert.equal(typeof releasePreparation,'function','action preparation is waiting');
    speech.testFinish('muted',false);
    releasePreparation();await aborted.digestQueue;
    assert.equal(calls.length,0,'cancelled asynchronous preparation cannot commit an action');
    deferred.remove();
    const value=make(document.body,'value','^(?<timeValue>.+)$','showLog',{
        'speech-open-ended':'','speech-preproc':'TestValues.normalize',
        'speech-preproc-context':'duration','speech-preproc-field':'timeValue'});
    const duration=fresh();
    await hear(duration,'twenty two');
    await hear(duration,'twenty two fifty');
    assert.equal(calls.length,0,'interim number groups remain one growing value');
    assert.equal(duration.valueCollectors.get(value).value,'0:22:50');
    await hear(duration,'twenty three fifty six');
    assert.equal(duration.valueCollectors.get(value).value,'0:23:56','unconsumed recognition revisions replace collected values');
    await hear(duration,'twenty two fifty six',true);
    await duration.digestQueue;
    assert.equal(duration.digestSteps.length,1,'a free-form value is one command, not a chain of number fragments');
    assert.equal(duration.digestSteps[0].transcript,'0:22:56');
    assert.equal(duration.valueCollectors.size,0,'final completion clears collectors');
    const interruptedValue=fresh();
    await hear(interruptedValue,'twenty two');
    assert(interruptedValue.valueCollectors.size > 0);
    speech.testFinish('muted',false);
    assert.equal(interruptedValue.valueCollectors.size,0,'invalidation clears collectors');
    const followedValue=fresh();
    await hear(followedValue,'twenty two fifty six show log',true);
    await followedValue.digestQueue;
    assert.equal(followedValue.digestSteps[0].transcript,'0:22:56','a following command releases the collected duration');
    assert.deepEqual(calls,[['log'],['log']]);
    value.remove();
    const sequence=make(document.body,'sequence','^(?<label>rouge(?: pomme)?)$','showLog',{'speech-collect':''});
    const sequencePlan=await speech.planCommandChain('rouge');
    assert(sequencePlan.continuation && !sequencePlan.terminal,'Every collecting parameter stays open in stream classification');
    const opaque=fresh();
    await hear(opaque,'rouge');
    await hear(opaque,'rouge pomme');
    assert.equal(calls.length,0,'opaque sequences remain pending without a boundary');
    assert.equal(opaque.valueCollectors.get(sequence).value,'rouge pomme');
    await hear(opaque,'rouge pomme show log',true);
    await opaque.digestQueue;
    assert.equal(opaque.digestSteps[0].segmentTranscript,'rouge pomme');
    assert.deepEqual(calls,[['log'],['log']],'language-independent collector releases at the next command');
    assert.equal(opaque.valueCollectors.size,0);
    sequence.remove();
    const tripLogSurface=document.createElement('section');tripLogSurface.id='test-trip-log';tripLogSurface.setAttribute('speech-scope','');document.body.append(tripLogSurface);
    future.id='test-scheduled-trip';
    const logNoun=make(document.body,'logNoun','^(?:trip )?log$','showLog',{'speech-modal':'top-level','speech-noun':'log|trip log','speech-chain-surface':'#test-trip-log'});
    const rootClose=make(document.body,'rootClose','^close$','showLog',{'speech-modal':'system','speech-chain-surface':'pop'});
    rootClose.setAttribute('speech-function','SpeechMenu.close');
    const rootCancel=make(document.body,'rootCancel','^cancel$','showLog',{'speech-modal':'system','speech-chain-surface':'pop'});
    rootCancel.setAttribute('speech-function','SpeechMenu.cancel');
    let closeSucceeds=true;
    const unregister=speech.registerSurface(tripLogSurface,{isOpen:()=>true,
        close(){calls.push(['close']);return closeSucceeds;},cancel(){calls.push(['cancel']);return closeSucceeds;}});
    readyOutcome=()=>Promise.resolve(true);
    const returned=fresh();
    await hear(returned,'ready at 4:15 log close',true);await returned.digestQueue;
    assert.deepEqual(calls,[['ready','4:15'],['log'],['close']]);
    assert.equal(returned.digestSurfaceStack.at(-1).surface,future,'close restores the scheduled-trip surface');
    assert.equal(returned.digestContext,'scheduled-start');
    const resumed=fresh();
    await hear(resumed,'ready at 4:15 trip log close standard time one hour',true);await resumed.digestQueue;
    assert.deepEqual(calls,[['ready','4:15'],['log'],['close'],['standard','1:00:00']],
        'follow-up consumes the restored tree even while the log DOM remains open');
    closeSucceeds=false;
    const refused=fresh();
    await hear(refused,'ready at 4:15 log cancel standard time one hour',true);await refused.digestQueue;
    assert.deepEqual(calls,[['ready','4:15'],['log'],['cancel']],'failed cancellation prevents restored-scope actions');
    assert.equal(document.querySelectorAll('[primed]').length,0);
    assert.equal(refused.valueCollectors.size,0);
    assert.equal(refused.digestSurfaceStack.at(-1).surface,tripLogSurface,'failed cancellation keeps the current surface');
    unregister();tripLogSurface.remove();logNoun.remove();rootClose.remove();rootCancel.remove();
    let release;
    readyOutcome=()=>new Promise(resolve=>release=resolve);
    const u=fresh();
    await hear(u,'ready at four');
    assert.equal(calls.length,0,'a clock parameter must be allowed to grow');
    await hear(u,'ready at four fifteen standard');
    assert.deepEqual(calls,[['ready','4:15']]);
    assert.equal(u.digestTranscript,'ready at four fifteen');
    assert(standard.hasAttribute('primed'),'follow-up is primed while its prerequisite is pending');
    assert(speech.testAvailable().includes(standard),'closed-dialog follow-up is available when primed');
    assert.equal(future.open,false,'test deliberately never opens the future dialog');
    speech.testInvalidate();
    assert.equal(speech.testActive(),u,'surface lag does not restart the utterance');
    await hear(u,'please login via voice ready at four fifteen standard time one hour');
    assert.equal(calls.length,1,'revised leading noise is discarded without replaying the consumed command');
    await hear(u,'ready at four fifteen standard time one hour',true);
    assert.equal(standard.hasAttribute('primed'),false,'utterance completion removes priming even while queue waits');
    release(true);await u.digestQueue;
    assert.deepEqual(calls,[['ready','4:15'],['standard','1:00:00']]);
    assert.equal(future.open,false,'actions complete independently of dialog availability');
    await speech.testFinal(u,'ready at four fifteen standard time one hour');
    await u.digestQueue;
    assert.equal(calls.length,2,'identical/stale final decode never executes consumed commands twice');

    readyOutcome=()=>Promise.resolve(true);
    let unrelatedRelease;
    readyOutcome=()=>new Promise(resolve=>unrelatedRelease=resolve);
    const modalInterrupted=fresh();
    await hear(modalInterrupted,'ready at four fifteen standard');
    const unrelated=document.createElement('dialog');unrelated.setAttribute('open','');document.body.append(unrelated);
    speech.testInvalidate();
    assert(modalInterrupted.chainCanceled,'an unrelated modal cancels pending commands');
    assert.equal(modalInterrupted.valueCollectors.size,0);
    assert.equal(document.querySelectorAll('[primed]').length,0);
    unrelatedRelease(true);await modalInterrupted.digestQueue;
    assert.deepEqual(calls,[['ready','4:15']]);
    unrelated.remove();
    readyOutcome=()=>Promise.resolve(true);
    const paused=fresh();
    await hear(paused,'ready at four fifteen standard');
    speech.testFinish();
    assert.equal(document.querySelectorAll('[primed]').length,0,'VAD closure clears temporary markers');
    speech.testInvalidate();
    await speech.testFinal(paused,'ready at four fifteen standard time one hour');
    await paused.digestQueue;
    assert.deepEqual(calls,[['ready','4:15'],['standard','1:00:00']],'final tail still uses projected context after VAD cleanup');

    const three=fresh();
    const paintFrames=[];
    const normalRAF=globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame=callback=>paintFrames.push(callback);
    await hear(three,'ready at four fifteen standard time one hour show log',true);
    await three.digestQueue;
    assert.deepEqual(calls,[['ready','4:15'],['standard','1:00:00'],['log']],
        'the next action does not wait for a previous response to paint');
    assert(paintFrames.length>0,'the test leaves presentation paint deliberately pending');
    globalThis.requestAnimationFrame=normalRAF;
    for(const callback of paintFrames) callback(performance.now());

    const bad=fresh();
    await hear(bad,'ready at four fifteen standard time one hour nonsense again',true);
    await bad.digestQueue;
    assert.deepEqual(calls,[['ready','4:15'],['standard','1:00:00']],'valid prefix still executes before an invalid remainder');
    assert.equal(errors.at(-1)?.transcript,'nonsense again');
    assert.equal(standard.hasAttribute('primed'),false);

    readyOutcome=()=>Promise.resolve(false);
    const rejected=fresh();
    await hear(rejected,'ready at four fifteen standard time one hour',true);
    await rejected.digestQueue;
    assert.deepEqual(calls,[['ready','4:15']],'failed prerequisite blocks dependent actions');
    assert.equal(standard.hasAttribute('primed'),false);
    readyOutcome=()=>Promise.resolve(true);

    standard.setAttribute('disabled','');
    const disabled=fresh();
    await hear(disabled,'ready at four fifteen standard time one hour',true);
    await disabled.digestQueue;
    assert.equal(calls.some(call=>call[0]==='standard'),false,'priming cannot bypass a disabled item');
    assert.equal(standard.hasAttribute('primed'),false);
    standard.removeAttribute('disabled');

    standard.setAttribute('speech-authorized','TestChain.permitted');
    const denied=fresh();
    await hear(denied,'ready at four fifteen standard time one hour',true);
    await denied.digestQueue;
    assert.equal(calls.some(call=>call[0]==='standard'),false,'priming cannot bypass authorization');
    standard.removeAttribute('speech-authorized');

    readyOutcome=()=>new Promise(resolve=>release=resolve);
    const canceled=fresh();
    await hear(canceled,'ready at four fifteen standard');
    speech.testFinish('muted',false);
    assert.equal(standard.hasAttribute('primed'),false);
    release(true);await canceled.digestQueue;
    assert.equal(calls.some(call=>call[0]==='standard'),false);

    readyOutcome=()=>Promise.resolve(true);
    const revised=fresh();
    await hear(revised,'ready at four fifteen standard');
    await hear(revised,'ready at five thirty standard time one hour',true);
    await revised.digestQueue;
    assert.equal(calls.length,1,'revising an already consumed prefix stops rather than replaying it');
    assert.equal(errors.at(-1)?.reason,'consumed-prefix-revised');
    assert.equal(document.querySelectorAll('[primed]').length,0);

    const longChain=fresh();
    await hear(longChain,Array(12).fill('show log').join(' '),true);
    await longChain.digestQueue;
    assert.equal(calls.length,12,'chains are not limited by the former eight-step depth');

    const breakRoot=make(document.body,'break','^break start$','breakStart',{'speech-chain-next':'break-choice'});
    const choice=make(future,'choice','^(?<breakChoice>long|short|lunch)$','choice',{
        'speech-chain-context':'break-choice','speech-chain-next':'break-confirm'});
    const okay=make(future,'okay','^ok(?:ay)?$','okay',{'speech-chain-context':'break-confirm'});
    const b=fresh();
    await hear(b,'break start lunch ok',true);await b.digestQueue;
    assert.deepEqual(calls,[['break'],['choice','lunch'],['okay']]);
    assert.equal(document.querySelectorAll('[primed]').length,0);
    breakRoot.remove();choice.remove();okay.remove();
    let persistenceIntent;
    globalThis.TestChain.capturePersist=()=>{persistenceIntent=speech.executionContext.persist;return true;};
    const intent=make(document.body,'persist-intent','^save example$','capturePersist');
    let intentAttempt=fresh();await hear(intentAttempt,'save example',true);await intentAttempt.digestQueue;
    assert.equal(persistenceIntent,false,'unmarked commands stay client-only');
    intent.setAttribute('speech-persist','');
    intentAttempt=fresh();await hear(intentAttempt,'save example',true);await intentAttempt.digestQueue;
    assert.equal(persistenceIntent,true,'speech-persist explicitly allows server work');
    intent.setAttribute('speech-persist','false');
    intentAttempt=fresh();await hear(intentAttempt,'save example',true);await intentAttempt.digestQueue;
    assert.equal(persistenceIntent,false,'false explicitly disables server work');
    intent.remove();

    Function(fs.readFileSync(new URL('../StateTransactions.js',import.meta.url),'utf8'))();
    Function(fs.readFileSync(new URL('../ActionFunctions.js',import.meta.url),'utf8'))();
    window.WMOFActions=globalThis.WMOFActions;
    const transactionStates=[];
    const appState={breakType:'lunch',selection:undefined};
    const transactions=globalThis.WMOFStateTransactions;
    transactions.register('app',{capture:()=>({...appState}),restore:snapshot=>Object.assign(appState,snapshot)});
    transactions.addEventListener('state',event=>transactionStates.push(event.detail.state));
    globalThis.WMOFActionFunctions.define('openBreak',()=>false);
    globalThis.WMOFActionFunctions.define('chooseLunch',()=>{calls.push(['choose-lunch']);appState.selection='lunch';return true;});
    globalThis.WMOFActionFunctions.define('confirmLunch',()=>{calls.push(['confirm-lunch']);return true;});
    const attemptRoot=make(document.body,'attempt-break','^break start$','showLog',{
        'speech-chain-next':'attempt-choice','speech-available':'TestChain.permitted','data-speech-state-command':''});
    attemptRoot.setAttribute('speech-function','WMOFActions.openBreak');
    const attemptChoice=make(future,'attempt-choice','^lunch$','showLog',{
        'speech-chain-context':'attempt-choice','speech-chain-next':'attempt-confirm','data-speech-state-command':''});
    attemptChoice.setAttribute('speech-function','WMOFActions.chooseLunch');
    const attemptConfirm=make(future,'attempt-confirm','^ok$','showLog',{
        'speech-chain-context':'attempt-confirm','data-speech-state-command':''});
    attemptConfirm.setAttribute('speech-function','WMOFActions.confirmLunch');
    const invalidState=fresh();
    await hear(invalidState,'break start lunch ok',true);await invalidState.digestQueue;
    assert.deepEqual(transactionStates,['pending','reverted'],'invalid-state utterance is accepted, then reverted');
    assert.deepEqual(calls,[],'Lunch and OK never execute after the root validation fails');
    assert.equal(appState.breakType,'lunch','an existing break is preserved');
    assert(invalidState.digestExecutionFailed);
    attemptRoot.setAttribute('speech-authorized','TestChain.permitted');
    const forbidden=fresh();await hear(forbidden,'break start lunch ok',true);await forbidden.digestQueue;
    assert.equal(transactionStates.length,2,'optimistic attempts do not bypass authorization');
    attemptRoot.remove();attemptChoice.remove();attemptConfirm.remove();
    delete globalThis.WMOFStateTransactions;
    // Leading recognition junk is slid off the stream without preventing a
    // command or its chained tail from being recognized.
    // A free-form parameter must not swallow a valid command at the tail.
    const catchAll=make(document.body,'catchAll','^(?<textValue>.+)$','sleep',{'speech-open-ended':''});
    const swallowed=fresh();
    await hear(swallowed,'um nonsense show log',true);await swallowed.digestQueue;
    assert.deepEqual(calls,[['log']],'a catch-all parameter must not swallow a valid command at the tail');
    catchAll.remove();

    // A digit collector must retain the full sequence after announcement noise.
    const loginDigits=make(document.body,'loginDigits','^(?<digits>1 2 3 4|4)$','collect',{'speech-collect':''});
    const loginNoise=fresh();
    await hear(loginNoise,'please login via voice 1 2 3 4',true);await loginNoise.digestQueue;
    assert.deepEqual(calls,[['collect','1 2 3 4']],
        'leading announcement text must not reduce a valid digit sequence to its final digit');
    loginDigits.remove();

    const noisy=fresh();
    await hear(noisy,'um nonsense show log',true);await noisy.digestQueue;
    assert.deepEqual(calls,[['log']],'leading junk is discarded before a valid command');
    const noisyChain=fresh();
    await hear(noisyChain,'uh random ready at four fifteen standard time one hour',true);
    await noisyChain.digestQueue;
    assert.deepEqual(calls,[['ready','4:15'],['standard','1:00:00']],
        'leading junk is discarded while the remaining command chain stays intact');
    console.log('PASS incremental command digestion, priming, UI lag, parameter boundaries, ordered actions, invalid tails, failure, cancellation and hard gates');
} finally {speech.testReset();await window.happyDOM.close();}
