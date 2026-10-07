import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

const window=new Window({url:'https://clock.example/'});
Object.assign(globalThis,{window,document:window.document,Element:window.Element,
    HTMLElement:window.HTMLElement,EventTarget:window.EventTarget,CustomEvent:window.CustomEvent,
    getComputedStyle:window.getComputedStyle.bind(window)});
globalThis.ParameterParser=Function(fs.readFileSync(new URL('../ParameterParser.js',import.meta.url),'utf8')+'\nreturn ParameterParser;')();
let source=fs.readFileSync(new URL('../SpeechMenu.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
// Expose the real live-transcript path only inside this test's loaded class.
source=source.replace('\n}\n\nglobalThis.SpeechMenu = SpeechMenu;', `
    static testBegin(aborted) {
        SpeechMenu.#stopped=false;
        SpeechMenu.#recognizer={beginUtterance(){},setHotwords(){},abortUtterance(id){aborted.push(id);}};
        SpeechMenu.#beginUtterance(performance.now());
        return SpeechMenu.#utterance;
    }
    static testTranscript(utterance,text,final=false) {
        return SpeechMenu.#handleLiveTranscript(utterance,text,final);
    }
    static testActive() {return SpeechMenu.#utterance;}
    static testContinuation(text,phrase) {return SpeechMenu.#phraseCanContinue(text,phrase);}
    static testReject(utterance,text,final=false) {return SpeechMenu.#shouldFailFast(utterance,text,final);}
}\n\nglobalThis.SpeechMenu = SpeechMenu;`);
Function(source)();
const menu=globalThis.SpeechMenu;
const aborted=[],rejections=[],finished=[];
menu.events.addEventListener('utteranceUnrecognized',e=>rejections.push(e.detail));
menu.events.addEventListener('utteranceFinished',e=>finished.push(e.detail));
try {
    const bad=menu.testBegin(aborted);
    await menu.testTranscript(bad,'selfast');
    assert.equal(menu.testActive(),bad,'one unconfirmed word can still revise');
    await menu.testTranscript(bad,'selfast no longer');
    assert.equal(menu.testActive(),undefined,'stable invalid prefix aborts before final decode');
    assert.deepEqual(aborted,[bad.id]);
    assert.equal(rejections[0].fast,true);
    assert.equal(rejections[0].reason,'no-candidates');
    assert.equal(finished[0].reason,'no-candidates');
    const revision=bad.transcriptRevision;
    await menu.testTranscript(bad,'selfast no longer works for some reason blah blah blah',true);
    assert.equal(bad.transcriptRevision,revision,'queued decodes cannot revive the aborted utterance');
    assert.equal(rejections.length,1);

    const sameFinal=menu.testBegin(aborted);
    await menu.testTranscript(sameFinal,'unrelated');
    assert.equal(menu.testActive(),sameFinal);
    await menu.testTranscript(sameFinal,'unrelated',true);
    assert.equal(menu.testActive(),undefined,'unchanged final decode must still reject');
    assert.equal(rejections.length,2);

    const revised=menu.testBegin(aborted);
    await menu.testTranscript(revised,'selfast');
    await menu.testTranscript(revised,'something different');
    assert.equal(menu.testActive(),revised,'a revised leading word gets a new confirmation');
    await menu.testTranscript(revised,'something different again');
    assert.equal(menu.testActive(),undefined);

    globalThis.TestActions={readyAt(time){return Boolean(time);}};
    const command=document.createElement('speech-command');
    command.setAttribute('speech-pattern','^ready at (?<time>.+)$');
    command.setAttribute('speech-function','TestActions.readyAt');
    document.body.append(command);
    const valid=menu.testBegin(aborted);
    await menu.testTranscript(valid,'reed');
    assert.equal(valid.noCandidateTranscript,'reed');
    await menu.testTranscript(valid,'ready at');
    assert.equal(menu.testActive(),valid,'a viable command can revise from an invalid first word');
    assert(valid.candidatePool.length,'real phrase matching keeps the command viable');
    assert.equal(valid.noCandidateTranscript,'','viability clears the rejection history');
    await menu.testTranscript(valid,'ready gar');
    await menu.testTranscript(valid,'ready garba');
    assert.equal(menu.testActive(),valid,'an invalid last word can revise while the stable prefix stays viable');
    await menu.testTranscript(valid,'ready at');
    assert.equal(valid.noCandidateTranscript,'');
    await menu.testTranscript(valid,'unrelated now');
    assert.equal(menu.testActive(),valid,'old rejection evidence is not reused after viability');
    await menu.testTranscript(valid,'unrelated now keeps growing');
    assert.equal(menu.testActive(),undefined);
    command.remove();

    menu.executionEnabled=false;
    const training=menu.testBegin(aborted);
    await menu.testTranscript(training,'selfast');
    await menu.testTranscript(training,'selfast no longer works');
    assert.equal(menu.testActive(),training,'capture-only training retains the whole mismatch');
    await menu.testTranscript(training,'selfast no longer works',true);
    assert.equal(menu.testActive(),undefined,'training still settles its final mismatch');
    menu.executionEnabled=true;

    for(const partial of ['re','read','ready at']) {
        assert.equal(menu.testContinuation(partial,'ready at <time>'),true,'valid partial remains viable');
    }
    const probe={};
    assert.equal(menu.testReject(probe,'read'),false);
    assert.equal(menu.testReject(probe,'ready at'),false,'revised first word does not inherit rejection');
    assert.equal(menu.testReject({},'anything',true),true);
    console.log('PASS streaming fail-fast, unfinished/revised words, identical final decode and queued stale results');
} finally {await window.happyDOM.close();}
