import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = join(here, "..");

const live = readFileSync(join(root, "LiveTripStream.js"), "utf8");
const app = readFileSync(join(root, "app.js"), "utf8");
const accessPolicy = readFileSync(join(root, "AccessPolicyModel.js"), "utf8");
const html = readFileSync(join(root, "order-filler.html"), "utf8");
const audio = readFileSync(join(root, "api/audio/AudioEngine.js"), "utf8");
const speech = readFileSync(join(root, "SpeechMenu.js"), "utf8");
const endpoint = readFileSync(join(root, "api/live-stream/index.php"), "utf8");

assert.match(live, /new RTCPeerConnection/);
assert.match(live, /addTransceiver\(\s*"audio"/);
assert.match(live, /new WebSocket\(/);
assert.match(live, /"socket-token"/);
assert.match(live, /"presence\.start"/);
assert.match(live, /"peer\.join"/);
assert.doesNotMatch(live, /createDataChannel\(/);
assert.match(live, /audio\/opus/);
assert.match(live, /targetUserId:\s*target/);
assert.match(live, /type:\s*"peer\.candidate"/);
assert.match(live, /type:\s*"peer\.leave"/);
assert.match(live, /type:\s*"publisher\.event"/);
assert.match(live, /setViewerMuted\(/);
assert.match(live, /setViewerMasterVolume\(/);
assert.match(live, /setViewerMicrophoneVolume\(/);
assert.match(live, /setViewerProgramVolume\(/);

assert.match(accessPolicy, /const PERMISSION_VIEW_LIVE_STREAMS\s*=\s*64/);
assert.match(app, /ClockTimerAccessPolicyModel\.constants/);
assert.match(
    app,
    /syncAutomaticLivePublisher[\s\S]*startPublishing\(\{[\s\S]*requestMicrophone:\s*false/
);
assert.match(
    app,
    /\$\("#liveStreamButton"\)\.hidden\s*=\s*!\(\s*canViewLiveStreams\s*&&\s*canLookupUsers\s*\)/
);
assert.doesNotMatch(html, /id="liveStreamPublishButton"/);
assert.match(
    live,
    /async startPublishing\(\{[\s\S]*requestMicrophone[\s\S]*#acquirePublisherMedia\(\{[\s\S]*requestMicrophone/
);
assert.match(live, /async refreshPublisherMicrophone\(\)/);
assert.match(live, /async clearPublisherMicrophone\(\)/);
assert.match(live, /async sendToPublisher\(/);
assert.match(live, /#socketRequest\(\s*"trainer\.tts"/);
assert.match(live, /"publisherMessage"/);
assert.match(app, /liveTripStream[\s\S]{0,200}\.broadcast\(\s*"tts"/);
assert.match(app, /liveTripStream[\s\S]{0,200}\.broadcast\(\s*"speech\.command"/);
assert.match(app, /detail\.type !==\s*"trainer\.tts"/);
assert.match(app, /playSemanticSongThenSpeak\("observer-message",text,[\s\S]{0,120}broadcast:false/);
assert.match(app, /canViewLiveStreams\(\)[\s\S]{0,240}Live stream permission is required/);
assert.match(app, /identityContext[\s\S]{0,220}\.current/);
assert.match(app, /startViewing\(\s*targetUserId/);

for (const id of [
    "liveStreamMute",
    "liveStreamMasterVolume",
    "liveStreamMicVolume",
    "liveStreamProgramVolume",
    "liveStreamIdentityName",
    "liveStreamIdentityMeta",
    "liveStreamLookupButton",
    "liveStreamTrainerMessageText",
    "liveStreamTrainerMessageSend"
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
assert.match(endpoint, /\$action === 'socket-token'/);
assert.match(endpoint, /live_stream_socket_tokens/);
assert.match(endpoint, /PERMISSION_VIEW_LIVE_STREAMS/);

const websocketService = readFileSync(
    join(root, "services/live-stream-websocket.php"),
    "utf8"
);
assert.match(websocketService, /targets\.request/);
assert.match(websocketService, /peer\.join/);
assert.match(websocketService, /trainer\.tts/);
assert.match(websocketService, /LIVE_WS_PERMISSION_SWEEP_SECONDS\s*=\s*2/);
assert.match(websocketService, /live_ws_can_view/);
assert.match(websocketService, /live_ws_can_lookup/);
assert.doesNotMatch(websocketService, /viewerName|viewerUsername/);

console.log("PASS WebSocket signaling, permissioned trainer presence, Opus audio, and trainer TTS");
