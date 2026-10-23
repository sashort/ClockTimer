import {installSpeechLanguage} from './speech-language-fixture.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

// Baseline: e51d88cc, immediately before the first Vosk compiler commit.
// The existing parser tests remain the authority for meanings and invalid input.
const context={};context.globalThis=context;
for(const name of ['SpeechGrammarContext','VoskPhraseListCompiler','VoskGrammarRouter'])
    vm.runInNewContext(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8'),context);
installSpeechLanguage(context,source=>vm.runInNewContext(source,context));
const {VoskGrammarRouter:Router,VoskPhraseListCompiler:Compiler,SpeechGrammarContext:Grammar}=context;
const values=Router.valuePhrases();
for(const [kind,file] of [['duration','spoken-duration'],['time','spoken-time']]) {
    const parserName=kind==='duration'?'DurationParser':'SpokenTimeParser';
    const Parser=context['English'+parserName];
    const oldTests=fs.readFileSync(new URL('./'+file+'.mjs',import.meta.url),'utf8');
    const inputs=[...oldTests.matchAll(/(?:parse|parts)\(\s*"([^"]+)"/g)].map(match=>match[1]);
    const vocabulary=new Set(values[kind].flatMap(phrase=>phrase.split(' ')));
    for(const phrase of inputs) {
        if(!Parser.parse(phrase) || /\d/.test(phrase)) continue;
        for(const word of Grammar.normalize(phrase).split(' '))
            assert(vocabulary.has(word),kind+' lost baseline word '+word+' in '+phrase);
    }
}

const duration=context.EnglishDurationParser;
assert.equal(duration.parse('an hour and five'),3900000);
assert.equal(duration.parse('a minute and five'),65000);
assert.equal(duration.parse('an hour and five minutes and thirty seconds'),3930000);
const record={id:'voice-duration',pattern:'^(?<spokenValue>.+)$',capture:'spokenValue',expect:'duration'};
const confirm={id:'confirm',pattern:'^okay$'};
const router=new Router({records:[record],valuePhrases:values,nextRecords:async()=>[record,confirm]});
for(const phrase of ['an','an hour','an hour and','an hour and five','an hour and five minutes and thirty seconds']) {
    const result=await router.update(phrase);
    assert.equal(result.transcript,phrase);
    assert.equal(router.prefix,'','compound values must stay in their original collector');
    assert.equal(result.grammar,'duration');
}
assert.equal((await router.update('an hour and five minutes and thirty seconds okay')).transcript,
    'an hour and five minutes and thirty seconds okay');
for(const kind of ['duration','time']) {
    const compiled=Compiler.compileStages([{pattern:'^(?<spokenValue>.+)$',capture:'spokenValue',expect:kind}],{valuePhrases:values});
    assert.equal(compiled.unsupported.length,0);
    assert(values[kind].length<50000,'recognition vocabulary remains bounded');
}
assert(!values.duration.includes('nonsense'));
console.log('PASS pre-Vosk spoken value vocabulary, compound collector routing and finite grammar bounds');
