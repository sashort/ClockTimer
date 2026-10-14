import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {Window} from 'happy-dom';
const php=process.env.CLOCK_TIMER_PHP || 'php';
const root=fileURLToPath(new URL('..',import.meta.url));
const invoke=lang=>execFileSync(php,['-n','-r',`$_GET['lang']=${JSON.stringify(lang)}; include ${JSON.stringify(root+'/order-filler.php')};`],{encoding:'utf8'});
const original=fs.readFileSync(root+'/order-filler.html','utf8');
const defaultPage=execFileSync(php,['-n',root+'/order-filler.php'],{encoding:'utf8'});
for(const lang of ['','absent-language','../en-US','en-US']) assert.equal(invoke(lang),defaultPage);
assert.ok(!defaultPage.includes('{{text:'));assert.ok(defaultPage.includes('id="language-pack"'));
const old=new Window(),rendered=new Window();old.document.write(original);rendered.document.write(defaultPage);
const texts=doc=>[...doc.querySelectorAll('body *')].filter(el=>!['SCRIPT','STYLE'].includes(el.tagName)).flatMap(el=>[...el.childNodes].filter(node=>node.nodeType===3).map(node=>node.textContent.trim()).filter(Boolean));
assert.deepEqual(texts(rendered.document),texts(old.document));
for(const selector of ['[id]','[speech-pattern]','select option']){
 const a=[...old.document.querySelectorAll(selector)].filter(el=>el.id!=='language-pack');
 const b=[...rendered.document.querySelectorAll(selector)].filter(el=>el.id!=='language-pack');
 assert.equal(a.length,b.length,selector);
 if(selector==='[speech-pattern]')assert.deepEqual(a.map(el=>el.getAttribute('speech-pattern')),b.map(el=>el.getAttribute('speech-pattern')));
 if(selector==='select option')assert.deepEqual(a.map(el=>[el.value,el.textContent.trim(),el.selected,el.disabled]),b.map(el=>[el.value,el.textContent.trim(),el.selected,el.disabled]));
}
const data=JSON.parse(rendered.document.getElementById('language-pack').textContent);
const allIds=[];
for(const records of [data['ui-text'].texts,data['speech-patterns'].patterns,data['speech-patterns'].preprocessors,data['speech-patterns'].customRules,data.announcements.announcements]) allIds.push(...Object.values(records).map(record=>record.id));
assert.equal(new Set(allIds).size,allIds.length);
const elementIds=[...rendered.document.querySelectorAll('[data-language-id]')].map(el=>el.dataset.languageId);
assert.equal(new Set(elementIds).size,elementIds.length);
await old.happyDOM.close();await rendered.happyDOM.close();
console.log('PASS PHP default/invalid-language fallback, exact English text/options/speech patterns, resolved substitutions and globally unique definition IDs');
// A real alternate folder changes texts, pattern UUIDs, rules and select options.
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'clocktimer-language-'));
try{
 fs.mkdirSync(fixture+'/templates',{recursive:true});fs.mkdirSync(fixture+'/lang/en-US',{recursive:true});fs.mkdirSync(fixture+'/lang/xx-XX',{recursive:true});
 fs.cpSync(root+'/templates',fixture+'/templates',{recursive:true});
 const alternate=structuredClone(data);const idMap=new Map();
 for(const name of ['speech-patterns'])for(const collection of ['patterns','preprocessors','customRules']){
  const changed={};for(const [id,record]of Object.entries(alternate[name][collection])){
   const next=crypto.randomUUID();idMap.set(id,next);changed[next]={...record,id:next};
  }alternate[name][collection]=changed;
 }
 for(const resource of Object.values(alternate))resource.locale='xx-XX';
 alternate['speech-patterns'].language.code='xx-XX';alternate['speech-patterns'].language.speechRecognitionLanguage='xx-XX';
 for(const [key,id]of Object.entries(alternate['speech-patterns'].language.speech.commands))alternate['speech-patterns'].language.speech.commands[key]=idMap.get(id);
 for(const key of ['wakePhrase','sleepPhrase','offPhrase'])alternate['speech-patterns'].language.speech[key]=idMap.get(alternate['speech-patterns'].language.speech[key]);
 for(const [key,id]of Object.entries(alternate['speech-patterns'].sourceKeys))alternate['speech-patterns'].sourceKeys[key]=idMap.get(id);
 for(const record of Object.values(alternate['speech-patterns'].patterns))if(record.preprocessorId)record.preprocessorId=idMap.get(record.preprocessorId);
 for(const association of Object.values(alternate.associations.elements)){
  if(association.patternId)association.patternId=idMap.get(association.patternId);
  if(association.preprocessorId)association.preprocessorId=idMap.get(association.preprocessorId);
 }
 const selectId=Object.keys(alternate.associations.selects)[0];const optionText=crypto.randomUUID();
 alternate['ui-text'].texts[optionText]={id:optionText,text:'Localized <script>alert(1)</script> & "label"'};
 alternate.associations.selects[selectId]=[{elementId:crypto.randomUUID(),value:'stable-option-value',textId:optionText,selected:true}];
 for(const [name,resource]of Object.entries(data))fs.writeFileSync(`${fixture}/lang/en-US/${name}.json`,JSON.stringify(resource));
 for(const rule of Object.values(data['speech-patterns'].customRules)){
  fs.copyFileSync(root+'/'+rule.implementation,fixture+'/'+rule.implementation);
 }
 for(const rule of Object.values(alternate['speech-patterns'].customRules)){
  const original=rule.implementation;rule.implementation=original.replace('/en-US/','/xx-XX/');fs.copyFileSync(root+'/'+original,fixture+'/'+rule.implementation);
 }
 for(const [name,resource]of Object.entries(alternate))fs.writeFileSync(`${fixture}/lang/xx-XX/${name}.json`,JSON.stringify(resource));
 const page=execFileSync(php,['-n','-r',`require ${JSON.stringify(root+'/lib/LanguageTemplate.php')}; $language = new LanguageTemplate(${JSON.stringify(fixture)}, 'xx-XX'); echo $language->render(file_get_contents(${JSON.stringify(fixture+'/templates/order-filler.html')}));`],{encoding:'utf8'});
 const window=new Window();window.document.write(page);assert.equal(window.document.documentElement.lang,'xx-XX');
 const select=window.document.querySelector(`[data-language-id="${selectId}"]`);assert.equal(select.options.length,1);assert.equal(select.value,'stable-option-value');
 assert.equal(select.options[0].textContent,'Localized <script>alert(1)</script> & "label"');
 assert.ok(!page.includes('<script>alert(1)</script>'));assert.ok(page.includes('lang/xx-XX/SpokenTimeParser.js'));
 const embedded=JSON.parse(window.document.getElementById('language-pack').textContent);assert.equal(embedded['ui-text'].locale,'xx-XX');
 assert.ok(Object.keys(embedded['speech-patterns'].patterns).every(id=>!data['speech-patterns'].patterns[id]));
 await window.happyDOM.close();
}finally{fs.rmSync(fixture,{recursive:true,force:true});}
console.log('PASS selected language folder, different select options, distinct pattern UUIDs, custom rule files and HTML/embedded-JSON escaping');
