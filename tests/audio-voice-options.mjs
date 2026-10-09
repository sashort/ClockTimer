import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const sandbox = { Object, String, encodeURIComponent, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../AudioVoiceOptions.js", import.meta.url), "utf8"), sandbox);
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.options=[];this.value="";this.dataset={};}
 append(child){this.children.push(child);if(child.tag==="option")this.options.push(child);else if(child.options)this.options.push(...child.options);}
 replaceChildren(fragment){this.children=fragment.children;this.options=[];for(const child of this.children){if(child.tag==="option")this.options.push(child);else this.options.push(...child.options);}}
}
const documentRef={createDocumentFragment:()=>new Element("fragment"),createElement:tag=>new Element(tag)};
const select=new Element("select");
await sandbox.WMOFAudioVoiceOptions.populate({
 select,documentRef,language:"en-US",selected:{provider:"local",voice:"alice"},
 encode:(p,v)=>p+"|"+v,
 catalogLoader:async()=>({providers:[{id:"local",label:"Local",voices:[{id:"alice",name:"Alice",language:"en-US"},{id:"bob",name:"Bob",language:"fr-FR"}]}]}),
 text:key=>key
});
assert.equal(select.value,"local|alice");
assert.equal(select.options.length,3);
assert.equal(select.options[2].textContent,"Bob (fr-FR)");
const unavailable=new Element("select");
await sandbox.WMOFAudioVoiceOptions.populate({select:unavailable,documentRef,language:"en-US",selected:{provider:"old",voice:"gone"},encode:(p,v)=>p+"|"+v,catalogLoader:async()=>({providers:[]}),text:key=>key});
assert.equal(unavailable.options.length,2);
assert.equal(unavailable.options[1].disabled,true);
assert.equal(unavailable.value,"old|gone");
console.log("PASS audio voice option population and unavailable saved voice");
