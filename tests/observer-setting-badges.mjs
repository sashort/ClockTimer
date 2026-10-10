import assert from 'node:assert/strict';import fs from 'node:fs';import {Window} from './LanguageWindow.mjs';
const w=new Window();w.eval(fs.readFileSync(new URL('../ObserverSettingBadge.js',import.meta.url),'utf8'));
const badge=w.WMOFObserverSettingBadge,defaults={mode:'trip'},record={custom:{view:{mode:'week'}},sources:{view:{mode:'custom'}}};
const host=w.document.createElement('button');w.document.body.append(host);
for(const [value,publisher,expected] of [['trip','day','default'],['week','day','custom'],['day','day','user'],['trip','trip','default-user'],['week','week','custom-user']]){
 const source=badge.match('mode',value,record,defaults,{mode:publisher});assert.equal(source,expected);badge.render(host,source);assert.equal(host.querySelectorAll('.observer-source-badge').length,1);assert(host.querySelector('[role=img]').getAttribute('aria-label'));
}
record.custom.view.mode='trip';assert.equal(badge.match('mode','trip',record,defaults,{mode:'trip'}),'default-user','Default and Custom never coexist');
badge.render(host,null);assert.equal(host.children.length,0);
await w.happyDOM.close();console.log('PASS five unified source badges, accessible labels and mutually exclusive Default/Custom');
