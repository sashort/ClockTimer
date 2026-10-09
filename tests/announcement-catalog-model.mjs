import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../AnnouncementCatalogModel.js", import.meta.url), "utf8"), sandbox);
const model = sandbox.ClockTimerAnnouncementCatalogModel;
assert.ok(model, "announcement catalog model registers its API");

const catalog = {
    list: () => [{key: "start", label: "Start"}, {key: "finish", label: "Finish"}],
    get: key => ({
        start: {song: "opening-song", masterOverrides: ["summary"]},
        finish: {masterOverrides: ["details"]}
    })[key]
};
const policy = model.create(catalog);
assert.deepEqual(JSON.parse(JSON.stringify(policy.audioAnnouncements)), [["start", "Start"], ["finish", "Finish"]]);
assert.equal(policy.definition("start").song, "opening-song");
assert.equal(policy.songName("start"), "opening-song");
assert.equal(policy.songName("unknown"), "unknown");
assert.equal(policy.overridesMaster("start", "summary"), true);
assert.equal(policy.overridesMaster("start", "details"), false);
assert.equal(policy.speechIgnoresMaster("start"), true);
assert.equal(policy.speechIgnoresMaster("finish"), true);
assert.equal(policy.speechIgnoresMaster("unknown"), false);
assert.equal(policy.speechIgnoresMaster("unknown", {ignoreSummaryMaster: true}), true);
assert.deepEqual(JSON.parse(JSON.stringify(model.create(null).audioAnnouncements)), []);
console.log("PASS announcement catalog model");
