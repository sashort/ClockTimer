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

events.length = 0;
await sandbox.ClockTimerApplicationStartup.initialize({
    context: { host: "settings-frame", capabilities: { calendarStartup: false } },
    text: key => key
});
assert.equal(events[0][1], true, "settings host suppresses the application announcement even without an explicit flag");
assert.equal(events[0][2], "settings-frame", "resolved context reaches the announcement module");

events.length = 0;
sandbox.document.documentElement = {lang: "fr-FR"};
sandbox.ClockTimerAudioSettingsStartup = {
    async ensureModel(options) { events.push(["audio-model", options.context.host]); }
};
sandbox.ClockTimerAudioUnlock = {
    install(documentRef, audio) { events.push(["audio-unlock", documentRef.documentElement.lang, Boolean(audio)]); }
};
sandbox.WMOFAnnouncementLanguage = {
    async load(locale) { events.push(["language-load", locale]); },
    text(key) { return key; }
};
const pageStartup = await sandbox.ClockTimerApplicationStartup.initializePage({
    context: {host: "order-filler", capabilities: {}},
    settingsOnlyPage: false,
    audio: {speak() {}},
    documentRef: sandbox.document
});
assert.deepEqual(events, [
    ["audio-model", "order-filler"],
    ["audio-unlock", "fr-FR", true],
    ["language-load", "fr-FR"],
    ["create", false, "order-filler"],
    ["announce"],
    ["persistence", undefined]
], "page initializer owns ordered audio, language, announcement, and persistence setup");
assert.equal(typeof pageStartup.text, "function");
assert.equal(typeof pageStartup.startupAnnouncement.finish, "function");
console.log("PASS application startup ordering, context policy, page orchestration, and persistence handoff");
