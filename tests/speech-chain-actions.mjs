import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
const window=new Window();
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const speechMenuSource=fs.readFileSync(new URL('../SpeechMenu.js',import.meta.url),'utf8');
assert.match(
    speechMenuSource,
    /if \(result === false\)\s*\{\s*return false;\s*\}/,
    'speech preprocessor chains must preserve explicit candidate rejection'
);
const valuesSource=['DurationParser','SpokenTimeParser','PercentParser','SpeechValuePreprocessor'].map(name=>
    fs.readFileSync(new URL(`../lang/en-US/${name}.js`,import.meta.url),'utf8')).join('\n');
const Values=Function(valuesSource+'\nreturn EnglishSpeechValuePreprocessor;')();
const Duration=Function(valuesSource+'\nreturn EnglishDurationParser;')();
const normalizerStart=source.indexOf('            "normalizeSpeechValue",');
const normalizerEnd=source.indexOf('    let pendingSpeechReady;',normalizerStart);
const normalizerBlock=source.slice(normalizerStart,normalizerEnd);
const normalizerFunction=normalizerBlock.slice(normalizerBlock.indexOf('            (')).replace(/\s*\);\s*$/, '');
const normalize=new Function('EnglishSpeechValuePreprocessor','numberPadDialog','voiceEntryState','numberPadState',`return ${normalizerFunction};`)(Values,undefined,undefined,undefined);
const options={field:'timeValue',kind:'duration',pattern:'^standard time (?<timeValue>.+)$',provisional:true};
assert.equal(normalize('standard time one hour',options),'standard time 1:00:00');
assert.equal(normalize('standard time one hour show trip log',options),false,'a typed parameter cannot absorb the next command');
assert.equal(normalize('standard time nonsense',{...options,provisional:false}),'standard time nonsense');
assert.equal(
    normalize('five thirty and five thirty',{
        field:'spokenTime',kind:'clock',
        pattern:'^(?<spokenTime>five thirty) and five thirty',provisional:false
    }),
    '5:30 and five thirty',
    'normalization must replace the named capture, not a later duplicate phrase'
);
const standard=window.document.createElement('button');
const breakDialog=window.document.createElement('dialog');
for(const kind of ['short-break','break','lunch']) {
    const button=window.document.createElement('button');button.dataset.breakType=kind;breakDialog.append(button);
}
const draft={};const message={hidden:false};const started=[];let autoStarts=0;
const boundary=new Date('2026-10-01T10:00:00Z');
const bindings={announcementText:key=>key,EnglishSpeechValuePreprocessor:Values,EnglishDurationParser:Duration,
    scheduledStartDialog:{open:false},scheduledStartStandard:standard,tripDraft:draft,
    scheduledStartMessage:message,cancelScheduledStartSpeechPrompt(){},
    armScheduledStartAutoFromVoice(){autoStarts++;},updateScheduledStartDialog(){},
    scheduleScheduledStartSpeechPrompt(){},confirmSettingChange(){return true;},
    formatGoalFailureDuration(){return '';},tripSettingsDialog:{open:false,querySelector(){return null;}},
    tripSettingsSession:undefined,beginTripSettingsSession(){return undefined;},refreshTripSettingsValues(){},
    breakDialog,speechTransactionDate:()=>boundary,setOkAllowed(dialog,value){dialog.allowOk=value;},
    closeDialog(){},startBreakInterval(kind,date){started.push({kind,date});return true;}
};
const field=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end));
const actions=new Function(...Object.keys(bindings),`return ({
    ${field('            changeStandardTime(', '            handleVoiceEntrySpeech(')}
    ${field('            chooseBreakType(', '            async startBreak(')}
});`)(...Object.values(bindings));
const previousSpeech=globalThis.SpeechMenu;
globalThis.SpeechMenu={executionContext:{chain:true,chainContext:'scheduled-start'}};
try {
    assert.equal(actions.changeStandardTime('one hour'),true);
    assert.equal(draft.standardTimeMilliseconds,3600000,'actual action writes workflow state before the dialog opens');
    assert.equal(bindings.scheduledStartDialog.open,false);
    assert.equal(autoStarts,1);
    assert.equal(message.hidden,true);
    standard.disabled=true;
    assert.equal(actions.changeStandardTime('two hours'),false,'disabled actions remain blocked');
    standard.disabled=false;
    globalThis.SpeechMenu.executionContext=undefined;
    assert.equal(actions.changeStandardTime('two hours'),false,'ordinary calls still require a visible workflow');
    globalThis.SpeechMenu.executionContext={chain:true,chainContext:'scheduled-start'};
    assert.equal(actions.changeStandardTime('nonsense'),false);
    globalThis.SpeechMenu.executionContext={chain:true,chainContext:'break-choice'};
    assert.equal(actions.chooseBreakType('lunch'),true,'choice uses the established chain context');
    assert.equal(breakDialog.open,false);
    globalThis.SpeechMenu.executionContext={chain:true,chainContext:'break-confirm'};
    assert.equal(await actions.confirmBreakType(),true);
    assert.equal(started[0].kind,'lunch');
    assert.equal(started[0].date,boundary);
    const selected=breakDialog.querySelector('[data-break-type="lunch"]');selected.disabled=true;
    assert.equal(await actions.confirmBreakType(),false);
    globalThis.SpeechMenu.executionContext=undefined;
    assert.equal(actions.chooseBreakType('short'),false);
    assert.equal(await actions.confirmBreakType(),false);
    console.log('PASS actual Standard Time and Break follow-up actions use chain context independently of dialog readiness');
} finally {globalThis.SpeechMenu=previousSpeech;await window.happyDOM.close();}
,provisional:false
    }),
    '5:30 and five thirty',
    'normalization must replace the named capture, not a later duplicate phrase'
);
const standard=window.document.createElement('button');
const breakDialog=window.document.createElement('dialog');
for(const kind of ['short-break','break','lunch']) {
    const button=window.document.createElement('button');button.dataset.breakType=kind;breakDialog.append(button);
}
const draft={};const message={hidden:false};const started=[];let autoStarts=0;
const boundary=new Date('2026-10-01T10:00:00Z');
const bindings={announcementText:key=>key,EnglishSpeechValuePreprocessor:Values,EnglishDurationParser:Duration,
    scheduledStartDialog:{open:false},scheduledStartStandard:standard,tripDraft:draft,
    scheduledStartMessage:message,cancelScheduledStartSpeechPrompt(){},
    armScheduledStartAutoFromVoice(){autoStarts++;},updateScheduledStartDialog(){},
    scheduleScheduledStartSpeechPrompt(){},confirmSettingChange(){return true;},
    formatGoalFailureDuration(){return '';},tripSettingsDialog:{open:false,querySelector(){return null;}},
    tripSettingsSession:undefined,beginTripSettingsSession(){return undefined;},refreshTripSettingsValues(){},
    breakDialog,speechTransactionDate:()=>boundary,setOkAllowed(dialog,value){dialog.allowOk=value;},
    closeDialog(){},startBreakInterval(kind,date){started.push({kind,date});return true;}
};
const field=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end));
const actions=new Function(...Object.keys(bindings),`return ({
    ${field('            changeStandardTime(', '            handleVoiceEntrySpeech(')}
    ${field('            chooseBreakType(', '            async startBreak(')}
});`)(...Object.values(bindings));
const previousSpeech=globalThis.SpeechMenu;
globalThis.SpeechMenu={executionContext:{chain:true,chainContext:'scheduled-start'}};
try {
    assert.equal(actions.changeStandardTime('one hour'),true);
    assert.equal(draft.standardTimeMilliseconds,3600000,'actual action writes workflow state before the dialog opens');
    assert.equal(bindings.scheduledStartDialog.open,false);
    assert.equal(autoStarts,1);
    assert.equal(message.hidden,true);
    standard.disabled=true;
    assert.equal(actions.changeStandardTime('two hours'),false,'disabled actions remain blocked');
    standard.disabled=false;
    globalThis.SpeechMenu.executionContext=undefined;
    assert.equal(actions.changeStandardTime('two hours'),false,'ordinary calls still require a visible workflow');
    globalThis.SpeechMenu.executionContext={chain:true,chainContext:'scheduled-start'};
    assert.equal(actions.changeStandardTime('nonsense'),false);
    globalThis.SpeechMenu.executionContext={chain:true,chainContext:'break-choice'};
    assert.equal(actions.chooseBreakType('lunch'),true,'choice uses the established chain context');
    assert.equal(breakDialog.open,false);
    globalThis.SpeechMenu.executionContext={chain:true,chainContext:'break-confirm'};
    assert.equal(await actions.confirmBreakType(),true);
    assert.equal(started[0].kind,'lunch');
    assert.equal(started[0].date,boundary);
    const selected=breakDialog.querySelector('[data-break-type="lunch"]');selected.disabled=true;
    assert.equal(await actions.confirmBreakType(),false);
    globalThis.SpeechMenu.executionContext=undefined;
    assert.equal(actions.chooseBreakType('short'),false);
    assert.equal(await actions.confirmBreakType(),false);
    console.log('PASS actual Standard Time and Break follow-up actions use chain context independently of dialog readiness');
} finally {globalThis.SpeechMenu=previousSpeech;await window.happyDOM.close();}
