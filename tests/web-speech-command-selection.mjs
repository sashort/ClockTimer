import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {installSpeechLifecycle} from './speech-lifecycle-fixture.mjs';
installSpeechLifecycle();
const window=new Window({url:'https://clock.example/'});
Object.assign(globalThis,{window,document:window.document,Element:window.Element,
    HTMLElement:window.HTMLElement,EventTarget:window.EventTarget,CustomEvent:window.CustomEvent,
    getComputedStyle:window.getComputedStyle.bind(window),requestAnimationFrame:cb=>queueMicrotask(()=>cb(performance.now()))});
globalThis.ParameterParser=Function(fs.readFileSync(new URL('../ParameterParser.js',import.meta.url),'utf8')+'\nreturn ParameterParser;')();
let source=fs.readFileSync(new URL('../SpeechMenu.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const anchor='\n}\n\nglobalThis.SpeechMenu = SpeechMenu;';
assert(source.includes(anchor));
source=source.replace(anchor,`
    static testBegin(){
        SpeechMenu.#stopped=false;SpeechMenu.#recognizerBackend='web-speech';
        SpeechMenu.#recognizer={beginUtterance(){},setHotwords(){},abortUtterance(){},finishUtterance(){}};
        SpeechMenu.#beginUtterance(performance.now());return SpeechMenu.#utterance;
    }
    static testSelect(u,values){return SpeechMenu.#selectWebSpeechHypothesis(u.id,values,{isFinal:true});}
    static testReset(){SpeechMenu.#clearPrimed();SpeechMenu.#finishedUtterances.clear();SpeechMenu.#utterance=undefined;}
}\n\nglobalThis.SpeechMenu = SpeechMenu;`);
Function(source)();
const speech=globalThis.SpeechMenu;window.SpeechMenu=speech;
let executed=0;
globalThis.Actions=window.Actions={sync(){executed++;return true;}};
const sync=document.createElement('speech-command');
sync.id='sync-command';sync.setAttribute('speech-pattern','^sync (?<syncAction>on|off)$');
sync.setAttribute('speech-function','Actions.sync');sync.setAttribute('speech-modal','top-level');
document.body.append(sync);
const hypotheses=['sink on','sync on','sink gone'].map((text,rank)=>({text,rank,maxRank:rank,confidence:1-rank*.1}));
const fresh=()=>{speech.testReset();return speech.testBegin();};
try {
    let u=fresh();
    assert.equal((await speech.testSelect(u,hypotheses))?.text,'sync on','selects an actual valid secondary command');
    assert.equal(await speech.testSelect(u,[hypotheses[0]]),undefined,'does not invent a sync alias');
    assert.equal((await speech.testSelect(u,[{text:'sync',rank:0,maxRank:0},hypotheses[1]]))?.text,'sync on','a final incomplete primary must not hide a complete secondary command');
    assert.equal(executed,0,'selection cannot execute business actions');
    assert.equal(u.valueCollectors.size,0,'selection cannot mutate live collectors');
    // Historical per-command knobs must no longer change selection.
    sync.setAttribute('speech-max-alternatives','1');
    globalThis.WMOF_WEB_SPEECH_CONFIG={maxAlternatives:10,commandAlternatives:{'sync-command':1}};
    assert.equal((await speech.testSelect(u,hypotheses))?.text,'sync on','no per-command tuning remains');
    u.chainCanceled=true;
    assert.equal(await speech.testSelect(u,hypotheses),undefined,'canceled session cannot select a command');
    await speech.sleep();
    u=fresh();
    assert.equal(await speech.testSelect(u,hypotheses),undefined,'sleeping cannot select ordinary commands');
    console.log('PASS Web Speech command selection, unavailable guesses, no aliases, no per-command tuning and side-effect-free probes');
} finally {
    speech.testReset();delete globalThis.WMOF_WEB_SPEECH_CONFIG;await window.happyDOM.close();
}
