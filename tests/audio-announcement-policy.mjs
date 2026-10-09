import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const sandbox={Object,Boolean};sandbox.globalThis=sandbox;vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../AudioAnnouncementPolicy.js",import.meta.url),"utf8"),sandbox);
const calls=[];
const model={
 audioCellUserEnabled:(...args)=>(calls.push(["enabled",...args]),true),
 audioAnnouncementOutput:args=>(calls.push(["output",args]),{lang:args.language,volume:args.settings.volume})
};
const settings={volume:.6};
assert.equal(sandbox.WMOFAudioAnnouncementPolicy.cellEnabled({model,settings,announcement:"trip.start",layer:"summary",options:{ignoreMaster:true},overridesMaster:()=>true}),true);
assert.equal(calls[0][1],settings);assert.equal(calls[0][4].ignoreMaster,true);
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.WMOFAudioAnnouncementPolicy.output({model,settings,announcement:"trip.start",rowOverride:{},language:"en-US",speechStart:"Start",speechPauseAt1x:300}))),{lang:"en-US",volume:.6});
console.log("PASS audio announcement policy delegation and context");
