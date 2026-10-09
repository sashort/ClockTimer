import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function load(audio) {
    const sandbox = { WMOFAudio: audio, Object, Promise, Error };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(readFileSync(new URL("../StartupAnnouncement.js", import.meta.url), "utf8"), sandbox);
    return sandbox.ClockTimerStartupAnnouncement;
}

{
    let speakCalls = 0;
    const module = load({ speak() { speakCalls++; return true; } });
    const announcement = module.create({
        settingsOnlyPage: true,
        audio: { speak() { speakCalls++; return true; } },
        text: key => key
    });
    announcement.start();
    announcement.start();
    assert.equal(speakCalls, 0, "settings page must not speak the startup announcement");
    assert.equal(announcement.pending, false);
    await announcement.finished;
}

{
    let callbacks;
    const module = load({ speak(_text, options) { callbacks = options; return true; } });
    const announcement = module.create({
        settingsOnlyPage: false,
        audio: { speak(_text, options) { callbacks = options; return true; } },
        text: key => key
    });
    announcement.start();
    announcement.start();
    assert.equal(announcement.pending, true);
    callbacks.onEnd();
    callbacks.onError();
    await announcement.finished;
    assert.equal(announcement.pending, false, "completion callback resolves the announcement exactly once");
}

{
    const module = load(undefined);
    const announcement = module.create({
        settingsOnlyPage: false,
        audio: {},
        text: key => key
    });
    announcement.start();
    await announcement.finished;
    assert.equal(announcement.pending, false, "missing speech support cannot block login announcements");
}
console.log("PASS startup announcement lifecycle, settings suppression, and completion signaling");
