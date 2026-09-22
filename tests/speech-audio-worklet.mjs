import fs from "node:fs";
import assert from "node:assert/strict";

globalThis.sampleRate = 48000;

let WorkletConstructor;

globalThis.AudioWorkletProcessor =
    class {
        constructor() {
            this.port = {
                messages: [],
                postMessage:
                    message => {
                        this.port.messages.push(
                            message
                        );
                    }
            };
        }
    };

globalThis.registerProcessor =
    (name, Constructor) => {
        assert.equal(
            name,
            "speech-audio-worklet"
        );

        WorkletConstructor =
            Constructor;
    };

Function(
    fs.readFileSync(
        new URL(
            "../SpeechAudioWorklet.js",
            import.meta.url
        ),
        "utf8"
    )
)();

assert.equal(
    typeof WorkletConstructor,
    "function"
);

const processor =
    new WorkletConstructor();

for (
    let blockIndex = 0;
    blockIndex < 375;
    blockIndex++
) {
    const block =
        new Float32Array(128);

    block.fill(0.5);

    assert.equal(
        processor.process(
            [[block]]
        ),
        true
    );
}

assert.equal(
    processor.port.messages.length,
    50
);

let sampleCount = 0;

for (
    const message of
        processor.port.messages
) {
    assert.equal(
        message.type,
        "audio"
    );

    assert.equal(
        message.sampleRate,
        16000
    );

    assert.ok(
        Math.abs(
            message.level -
            0.5
        ) < 0.0001
    );

    const pcm =
        new Int16Array(
            message.pcm
        );

    assert.equal(
        pcm.length,
        320
    );

    sampleCount +=
        pcm.length;

    for (const sample of pcm) {
        assert.ok(
            Math.abs(
                sample -
                16384
            ) <= 1
        );
    }
}

assert.equal(
    sampleCount,
    16000
);

console.log(
    "PASS speech audio worklet resampling and packet cadence"
);
