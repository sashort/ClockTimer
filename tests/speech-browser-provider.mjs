import fs from "node:fs";
import assert from "node:assert/strict";

class FakeRecognition {
    static instances = [];

    constructor() {
        FakeRecognition.instances.push(
            this
        );
    }

    start(track) {
        this.track = track;
    }

    abort() {
        this.aborted = true;
    }

    result(text, isFinal = false) {
        const result = {
            0: {transcript: text},
            isFinal
        };

        this.onresult?.({
            results: [result]
        });
    }

    end() {
        this.onend?.();
    }
}

globalThis.SpeechRecognition =
    FakeRecognition;

Function(
    fs.readFileSync(
        new URL(
            "../SpeechRecognitionProviders.js",
            import.meta.url
        ),
        "utf8"
    )
)();

const micTrack =
    {kind: "audio"};

const provider =
    new globalThis.BrowserSpeechProvider();

await provider.start({
    language: "en-US",
    micTrack
});

const transcripts = [];

assert.ok(
    provider.startUtterance({
        id: 7,
        onTranscript:
            value =>
                transcripts.push(
                    value.text
                )
    })
);

const first =
    FakeRecognition.instances[0];

assert.equal(
    first.track,
    micTrack
);

first.result("start");
first.result("start at");

assert.deepEqual(
    transcripts,
    [
        "start",
        "start at"
    ]
);

first.end();
await Promise.resolve();

const second =
    FakeRecognition.instances[1];

assert.ok(second);

second.result("five");

assert.deepEqual(
    transcripts,
    [
        "start",
        "start at",
        "start at five"
    ]
);

provider.endUtterance(7);

assert.equal(
    second.aborted,
    true
);

await provider.stop();

console.log(
    "PASS browser speech provider interim prefix handling"
);
