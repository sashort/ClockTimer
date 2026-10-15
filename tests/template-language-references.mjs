import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const load=name=>JSON.parse(fs.readFileSync(path.join(root,'lang/en-US',name+'.json'),'utf8'));
const associations=load('associations'), texts=load('ui-text').texts;
const patterns=load('speech-patterns');
function check(directory) {
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
        const file=path.join(directory,entry.name);
        if(entry.isDirectory()) {check(file);continue;}
        if(!entry.name.endsWith('.html')) continue;
        const template=fs.readFileSync(file,'utf8');
        for(const [,kind,id,slot] of template.matchAll(/\{\{(text|speech|options):([a-f0-9-]+)(?::([A-Za-z0-9_-]+))?\}\}/g)) {
            const element=associations.elements[id];
            if(kind==='text') {
                const textId=element?.texts?.[slot] || element?.attributes?.[slot];
                assert.equal(typeof texts[textId]?.text,'string',`${file}: unresolved text ${id}:${slot}`);
            } else if(kind==='speech') {
                assert(element,`${file}: unknown speech element ${id}`);
                if(element.patternId) assert(patterns.patterns[element.patternId],`${file}: missing speech pattern`);
                if(element.preprocessorId) assert(patterns.preprocessors[element.preprocessorId],`${file}: missing preprocessor`);
            } else {
                assert(Array.isArray(associations.selects[id]),`${file}: missing select options`);
                for(const option of associations.selects[id]) assert.equal(typeof texts[option.textId]?.text,'string');
            }
        }
    }
}
check(path.join(root,'templates'));
console.log('PASS all page template language references resolve through element associations');
