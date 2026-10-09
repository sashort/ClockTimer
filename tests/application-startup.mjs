import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const events = [];
const sandbox = { Promise, Object, Error, document: { body: { classList: { contains: () => false } } } };
sandbox.globalThis = sandbox;
sandbox.ClockTimerStartupAnnouncement = {
    create(options) {
        events.push(["create", options.settingsOnlyPage, options.context.host]);
        return {
            pending: true,
            finish() { events.push(["finish"]); },
            finished: Promise.resolve(),
            start() { events.push(["announce"]); }
        };
    }
};
sandbox.ClockTimerPersistenceStartup = {
    async initialize(options) {
        events.push(["persistence", options.marker]);
        return { ok: true };
    }
};
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL("../ApplicationStartup.js", import.meta.url), "utf8"), sandbox);

const context = { host: "order-filler", capabilities: {} };
const result = await sandbox.ClockTimerApplicationStartup.initialize({
    context,
    settingsOnlyPage: false,
    audio: { speak() {} },
    text: key => key,
    persistenceOptions: { marker: "legacy-migration" }
});
assert.deepEqual(events, [
    ["create", false, "order-filler"],
    ["announce"],
    ["persistence", "legacy-migration"]
]);
assert.equal(result.pending, true);
assert.equal(typeof result.finish, "function");

events.length = 0;
await sandbox.ClockTimerApplicationStartup.initialize({
    context: { host: "settings-frame", capabilities: { speechMenu: false } },
    audio: null,
    text: key => key
});
assert.deepEqual(events, [
    ["create", true, "settings-frame"],
    ["announce"],
    ["persistence", undefined]
]);
console.log("PASS application startup ordering, context policy, and persistence handoff");
