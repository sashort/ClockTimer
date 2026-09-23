import assert from "node:assert/strict";

import {
    whisperServerArgs
} from "../speech/whisper-service.js";

const args =
    whisperServerArgs({
        host: "127.0.0.1",
        port: 8766,
        model: "/models/base.en.bin",
        threads: 4,
        tmpDir: "/tmp/speech"
    });

assert.deepEqual(
    args,
    [
        "--host",
        "127.0.0.1",
        "--port",
        "8766",
        "-m",
        "/models/base.en.bin",
        "-t",
        "4",
        "--tmp-dir",
        "/tmp/speech",
        "-nt"
    ]
);

assert.equal(
    args.includes("-nc"),
    false
);

console.log(
    "PASS whisper-server startup arguments"
);
