import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = join(here, "..");

const live = readFileSync(join(root, "LiveTripStream.js"), "utf8");
const app = readFileSync(join(root, "app.js"), "utf8");
const html = readFileSync(join(root, "index.html"), "utf8");
const audio = readFileSync(join(root, "api/audio/AudioEngine.js"), "utf8");
const speech = readFileSync(join(root, "SpeechMenu.js"), "utf8");
const endpoint = readFileSync(join(root, "api/live-stream/index.php"), "utf8");

assert.match(live, /new RTCPeerConnection/);
assert.match(live, /addTransceiver\(\s*"audio"/);
assert.match(live, /createDataChannel\(\s*"clocktimer-live"/);
assert.match(live, /targetUserId:\s*target/);
assert.match(live, /action:\s*"candidate"[\s\S]*targetUserId/);
assert.match(live, /action:\s*"heartbeat"[\s\S]*targetUserId/);
assert.match(live, /action:\s*"leave"[\s\S]*targetUserId/);
assert.match(live, /setViewerMuted\(/);
assert.match(live, /setViewerMasterVolume\(/);
assert.match(live, /setViewerMicrophoneVolume\(/);
assert.match(live, /setViewerProgramVolume\(/);

assert.match(app, /const PERMISSION_VIEW_LIVE_STREAMS\s*=\s*64/);
assert.match(app, /liveTripStream[\s\S]{0,200}\.broadcast\(\s*"tts"/);
assert.match(app, /liveTripStream[\s\S]{0,200}\.broadcast\(\s*"speech\.command"/);

for (const id of [
    "liveStreamMute",
    "liveStreamMasterVolume",
    "liveStreamMicVolume",
    "liveStreamProgramVolume",
    "liveStreamTarget"
]) {
    assert.match(html, new RegExp(`id="${id}"`));
}
assert.match(html, /id="liveStreamMasterVolume"[^>]*min="0"[^>]*max="100"/);
assert.match(html, /id="liveStreamMicVolume"[^>]*min="0"[^>]*max="100"/);
assert.match(html, /id="liveStreamProgramVolume"[^>]*min="0"[^>]*max="100"/);

assert.match(audio, /async createProgramStream\(\)/);
assert.match(audio, /"wmof-audio-speak"/);
assert.match(speech, /static createMicrophoneStream\(\)/);
assert.match(speech, /utteranceStartedAt:/);

assert.match(endpoint, /PERMISSION_VIEW_LIVE_STREAMS/);
assert.match(endpoint, /require_positive_int\(\$input, 'targetUserId'\)/);
assert.match(endpoint, /require_positive_int\(\$_GET, 'targetUserId'\)/);

console.log("PASS WebRTC live stream target scoping, audio routing, and viewer volume controls");
