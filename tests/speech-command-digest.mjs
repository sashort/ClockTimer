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
let source=fs.readFileSync(new URL('../SpeechMenu.js',import.meta.url),'utf8');
source=source.replace('\n}\n\nglobalThis.SpeechMenu = SpeechMenu;', `
    static testBegin() {
        SpeechMenu.#stopped=false;
        SpeechMenu.#recognizer={beginUtterance(){},setHotwords(){},abortUtterance(){},finishUtterance(){}};
        SpeechMenu.#beginUtterance(performance.now());
        return SpeechMenu.#utterance;
    }
    static testTranscript(u,text,final=false){return SpeechMenu.#handleLiveTranscript(u,text,final);}
    static testFinish(reason="candidate-silence",recognize=true){SpeechMenu.#finishUtterance(reason,recognize);}
    static testFinal(u,text){return SpeechMenu.#handleCompletedTranscript(u,text);}
    static testInvalidate(){return SpeechMenu.#invalidateRecognitionContext("surface-context-change");}
    static testAvailable(){return SpeechMenu.#availableCandidates();}
    static testActive(){return SpeechMenu.#utterance;}
    static testReset(){SpeechMenu.#clearPrimed();SpeechMenu.#finishedUtterances.clear();SpeechMenu.#utterance=undefined;}
}\n\nglobalThis.SpeechMenu = SpeechMenu;`);
Function(source)();
const speech=globalThis.SpeechMenu;
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
    permitted(){return false;}
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
    element.setAttribute('speech-pattern',pattern);
    element.setAttribute('speech-function',`TestChain.${action}`);
    for(const [key,value] of Object.entries(attrs)) element.setAttribute(key,value);
    host.append(element);return element;
};
const ready=make(document.body,'ready','^ready at (?<spokenTime>.+)$','readyAt',{
    'speech-chain-next':'scheduled-start','speech-preproc':'TestValues.normalize',
    'speech-preproc-context':'clock','speech-preproc-field':'spokenTime'});
const future=document.createElement('dialog');document.body.append(future);
const standard=make(future,'standard','^standard(?: time)? (?<timeValue>.+)$','standard',{
    'speech-chain-context':'scheduled-start','data-speech-target':'#future-standard',
    'speech-preproc':'TestValues.normalize','speech-preproc-context':'duration','speech-preproc-field':'timeValue'});
standard.id='future-standard';
const log=make(document.body,'log','^show log$','showLog');
const hear=async(...args)=>{await speech.testTranscript(...args);await new Promise(setImmediate);};
const fresh=()=>{speech.testReset();calls.length=0;errors.length=0;return speech.testBegin();};
try {
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
    await hear(u,'ready at four fifteen standard time one hour');
    assert.equal(calls.length,1,'dependent action waits for successful prerequisite');
    await hear(u,'ready at four fifteen standard time one hour',true);
    assert.equal(standard.hasAttribute('primed'),false,'utterance completion removes priming even while queue waits');
    release(true);await u.digestQueue;
    assert.deepEqual(calls,[['ready','4:15'],['standard','1:00:00']]);
    assert.equal(future.open,false,'actions complete independently of dialog availability');
    await speech.testFinal(u,'ready at four fifteen standard time one hour');
    await u.digestQueue;
    assert.equal(calls.length,2,'identical/stale final decode never executes consumed commands twice');

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
    console.log('PASS incremental command digestion, priming, UI lag, parameter boundaries, ordered actions, invalid tails, failure, cancellation and hard gates');
} finally {speech.testReset();await window.happyDOM.close();}
