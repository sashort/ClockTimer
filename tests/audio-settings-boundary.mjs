import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const sandbox={Object,Math,Number,String};sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../AudioSettingsBoundary.js",import.meta.url),"utf8"),sandbox);
const makeDialog=()=>({style:{values:{},setProperty(k,v){this.values[k]=v;}}});
const settings=makeDialog(),announcements=makeDialog();
assert.equal(sandbox.WMOFAudioSettingsBoundary.refresh({settingsDialog:settings,announcementsDialog:announcements,viewport:{offsetTop:12},safeBottom:500}),true);
assert.equal(settings.style.values["--audio-settings-safe-top"],"12px");
assert.equal(settings.style.values["--audio-settings-safe-height"],"488px");
assert.equal(announcements.style.values["--audio-settings-safe-height"],"488px");
assert.equal(sandbox.WMOFAudioSettingsBoundary.refresh({}),false);
const listeners={}, observed=[];
const speech={addEventListener:(k,fn)=>listeners["speech:"+k]=fn};
class RO{constructor(fn){this.fn=fn;}observe(el){observed.push(el);}}
const win={visualViewport:{addEventListener:(k,fn)=>listeners["viewport:"+k]=fn},addEventListener:(k,fn)=>listeners["window:"+k]=fn};
const observer=sandbox.WMOFAudioSettingsBoundary.bind({speechMicBar:speech,refreshCallback:()=>{},windowRef:win,ResizeObserverCtor:RO});
assert.ok(observer);assert.deepEqual(observed,[speech]);assert.ok(listeners["window:resize"]);assert.ok(listeners["viewport:scroll"]);
console.log("PASS audio settings viewport boundary sizing and listeners");
