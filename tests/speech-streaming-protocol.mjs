import fs from "node:fs";
import assert from "node:assert/strict";

import {
    decodeAudioPacket,
    parseControlMessage,
    transcriptMessage
} from "../speech/protocol.js";

class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    static instances = [];

    #listeners = new Map();

    constructor(url) {
        this.url = url;
        this.readyState = FakeWebSocket.CONNECTING;
        this.sent = [];
        FakeWebSocket.instances.push(this);

        queueMicrotask(() => {
            this.readyState = FakeWebSocket.OPEN;
            this.#emit("open", {});
        });
    }

    addEventListener(type, listener, options = {}) {
        const listeners =
            this.#listeners.get(type) || [];

        listeners.push({
            listener,
            once: Boolean(options.once)
        });

        this.#listeners.set(type, listeners);
    }

    send(value) {
        this.sent.push(value);
    }

    close(code = 1000, reason = "") {
        this.readyState = FakeWebSocket.CLOSED;
        this.#emit(
            "close",
            {code, reason}
        );
    }

    message(value) {
        this.#emit(
            "message",
            {data: value}
        );
    }

    #emit(type, event) {
        const listeners =
            this.#listeners.get(type) || [];

        this.#listeners.set(
            type,
            listeners.filter(
                entry => !entry.once
            )
        );

        for (const {listener} of listeners) {
            listener(event);
        }
    }
}

globalThis.WebSocket = FakeWebSocket;
globalThis.location =
    new URL("https://wmof.sashort-apps.com/");

Function(
    fs.readFileSync(
        new URL(
            "../SpeechRecognitionProviders.js",
            import.meta.url
        ),
        "utf8"
    )
)();

const provider =
    new globalThis.StreamingSpeechProvider();

assert.equal(provider.kind, "streaming");
assert.equal(provider.supported, true);

await provider.start({
    language: "en-US",
    sessionId: "session-test",
    recognitionContext: {
        vocabulary: ["start", "stop"],
        options: {
            mode: ["elapsed", "remaining"]
        },
        phrases: ["start at <time>"],
        numbers: {output: "digits"}
    }
});

const socket =
    FakeWebSocket.instances.at(-1);

assert.equal(
    socket.url,
    "wss://wmof.sashort-apps.com/api/speech/stream"
);

const sessionStart =
    JSON.parse(socket.sent[0]);

assert.deepEqual(
    sessionStart,
    {
        type: "session-start",
        sessionId: "session-test",
        language: "en-US",
        context: {
            vocabulary: ["start", "stop"],
            options: {
                mode: ["elapsed", "remaining"]
            },
            phrases: ["start at <time>"],
            numbers: {output: "digits"}
        },
        audio: {
            encoding: "pcm_s16le",
            sampleRate: 16000,
            channels: 1
        }
    }
);

provider.setRecognitionContext({
    vocabulary: ["start", "stop", "pause"],
    options: {
        mode: ["elapsed", "remaining"]
    },
    phrases: ["start at <time>"],
    numbers: {output: "digits"}
});

const contextUpdate =
    JSON.parse(socket.sent.at(-1));

assert.equal(
    contextUpdate.type,
    "context-update"
);
assert.deepEqual(
    contextUpdate.context.vocabulary,
    ["start", "stop", "pause"]
);

const transcripts = [];
const errors = [];

assert.equal(
    provider.startUtterance({
        id: 42,
        onTranscript:
            value => transcripts.push(value),
        onError:
            value => errors.push(value)
    }),
    true
);

provider.pushAudio({
    id: 42,
    pcm:
        new Int16Array([
            123,
            -456,
            789
        ])
});

const packet =
    socket.sent.find(
        value =>
            value instanceof ArrayBuffer
    );

assert.ok(packet);

const view =
    new DataView(packet);

assert.equal(
    view.getUint32(0, true),
    42
);

assert.equal(
    view.getUint32(4, true),
    0
);

const decoded =
    decodeAudioPacket(
        Buffer.from(packet)
    );

assert.equal(
    decoded.utteranceId,
    42
);
assert.equal(
    decoded.sequence,
    0
);
assert.deepEqual(
    [...new Int16Array(
        decoded.pcm.buffer,
        decoded.pcm.byteOffset,
        decoded.pcm.byteLength / 2
    )],
    [123, -456, 789]
);

socket.message(
    JSON.stringify(
        transcriptMessage(
            "partial",
            42,
            "start at five"
        )
    )
);

socket.message(
    JSON.stringify(
        transcriptMessage(
            "final",
            42,
            "start at five thirty"
        )
    )
);

assert.deepEqual(
    transcripts,
    [
        {
            id: 42,
            text: "start at five",
            isFinal: false
        },
        {
            id: 42,
            text: "start at five thirty",
            isFinal: true
        }
    ]
);

assert.deepEqual(errors, []);

provider.endUtterance(
    42,
    "silence"
);

assert.deepEqual(
    parseControlMessage(
        JSON.stringify({
            type: "ping",
            at: 123
        })
    ),
    {
        type: "ping",
        at: 123
    }
);

assert.throws(
    () =>
        parseControlMessage(
            JSON.stringify({
                type: "unknown"
            })
        ),
    /Unsupported speech control message/
);

await provider.stop();

console.log(
    "PASS streaming speech protocol and provider framing"
);
