import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = { Object, TypeError };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../AudioSettingsPersistence.js", import.meta.url), "utf8"), sandbox);
const persistence = sandbox.WMOFAudioSettingsPersistence;
const values = new Map([["audio", '{"volume":0.4}']]);
const model = { read: value => value ? JSON.parse(value) : { volume: 1 }, serialize: value => JSON.stringify(value) };
assert.deepEqual(JSON.parse(JSON.stringify(persistence.load({
    readStorage: key => values.get(key), storageKey: "audio", settingsModel: model
}))), { volume: 0.4 });
let saved;
persistence.save({ writeStorage: (key, value) => saved = [key, value], storageKey: "audio", settingsModel: model, settings: { volume: 0.7 } });
assert.deepEqual(saved, ["audio", '{"volume":0.7}']);
assert.throws(() => persistence.load({}), /reader and model are required/);
assert.throws(() => persistence.save({}), /writer and model are required/);
console.log("PASS audio settings persistence boundary read/write delegation");
