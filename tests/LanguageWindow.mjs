import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {Window as NativeWindow} from 'happy-dom';
const resources=Object.fromEntries(['ui-text','speech-patterns','announcements','associations'].map(name=>[name,JSON.parse(fs.readFileSync(new URL(`../lang/en-US/${name}.json`,import.meta.url),'utf8'))]));
const source=fs.readFileSync(new URL('../LanguagePack.js',import.meta.url),'utf8');
export function installEnglishPack(window){
 Object.defineProperty(window,'WeakRef',{value:WeakRef,configurable:true});
 Object.defineProperty(window,'crypto',{value:webcrypto,configurable:true});
 const script=window.document.createElement('script');script.type='application/json';script.id='language-pack';script.textContent=JSON.stringify(resources);window.document.head.append(script);
 window.eval(source);
 window.eval(fs.readFileSync(new URL("../AnnouncementLanguage.js",import.meta.url),"utf8"));
 return window.WMOFLanguagePack;
}
export class Window extends NativeWindow{
 constructor(...args){super(...args);installEnglishPack(this);}
}
