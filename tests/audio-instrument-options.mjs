import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const sandbox = { Object, String, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../AudioInstrumentOptions.js", import.meta.url), "utf8"), sandbox);
class Element { constructor(tag){this.tag=tag;this.children=[];this.options=[];this.value="";} append(child){this.children.push(child);if(child.tag==="option")this.options.push(child);} replaceChildren(f){this.children=f.children;this.options=f.children.filter(x=>x.tag==="option");} }
const doc={createDocumentFragment:()=>new Element("fragment"),createElement:tag=>new Element(tag)};
const select=new Element("select");
await sandbox.WMOFAudioInstrumentOptions.populate({select,documentRef:doc,selectedInstrument:"bell",catalogLoader:async()=>({instruments:{bell:{displayName:"Bell"},hidden:{selectable:false},wood:{}}}),text:()=> "Default"});
assert.equal(select.options.length,3);
assert.equal(select.options[1].textContent,"Bell");
assert.equal(select.value,"bell");
const missing=new Element("select");
await sandbox.WMOFAudioInstrumentOptions.populate({select:missing,documentRef:doc,selectedInstrument:"absent",catalogLoader:async()=>({instruments:{}}),text:()=> "Default"});
assert.equal(missing.value,"");
console.log("PASS audio instrument option population and selection fallback");
