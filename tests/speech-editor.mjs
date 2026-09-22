import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window} from 'happy-dom';

const window = new Window({url:'https://wmof.example/'});
window.document.body.innerHTML = '<button id="breakButton">Break</button><speech-command hidden data-speech-editor-id="builtin:breakStart:page" data-speech-target="#breakButton" speech-pattern="^break start$" speech-function="WMOFSpeechCommands.breakStart" speech-modal="top-level"></speech-command>';
let refreshes = 0;
window.SpeechMenu = {refresh(){refreshes++;}};
window.fetch = async () => ({ok:true,json:async () => ({entries:[]})});
window.eval(fs.readFileSync(new URL('../SpeechEditorRuntime.js',import.meta.url),'utf8'));
await new Promise(resolve => setTimeout(resolve, 0));

const entries = [
    {id:'builtin:breakStart:page',kind:'existing',target:'#breakButton',attrs:{'speech-pattern':'^take a break$','speech-function':'WMOFSpeechCommands.breakStart','speech-modal':'top-level'}},
    {id:'edit:group:1',kind:'modal',target:'#breakButton',attrs:{'speech-modal':'top-level'}},
    {id:'edit:command:1',kind:'command',target:'#breakButton',parentId:'edit:group:1',attrs:{'speech-pattern':'^pause$','speech-function':'WMOFSpeechCommands.breakStart'}},
    {id:'edit:attribute:1',kind:'attribute',target:'#breakButton',attrs:{'speech-pattern':'^break$','speech-function':'WMOFSpeechCommands.breakStart','speech-modal':''}}
];
window.WMOFSpeechEditorRuntime.apply(entries);
assert.equal(window.document.querySelector('[data-speech-editor-id="builtin:breakStart:page"]').getAttribute('speech-pattern'),'^take a break$');
assert.equal(window.document.querySelector('#breakButton').getAttribute('speech-pattern'),'^break$');
assert.equal(window.document.querySelector('#breakButton').getAttribute('speech-modal'),'');
assert.equal(window.document.querySelector('speech-modal > speech-command').getAttribute('speech-pattern'),'^pause$');
assert.ok(refreshes >= 2);
window.WMOFSpeechEditorRuntime.apply([entries[0]]);
assert.equal(window.document.querySelectorAll('speech-modal').length,0);
assert.equal(window.document.querySelectorAll('[data-speech-editor-id="edit:command:1"]').length,0);
console.log('PASS saved speech attributes and new modal commands apply without duplicate elements');
