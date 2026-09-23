let runtimeBase = "";
let hotwords = [];
let hotwordsScore = 2.0;
let maxActivePaths = 4;
let recognizer;
let stream;
let activeUtteranceId;
let lastText = "";
let pendingHotwords;
let loading = false;
let initialized = false;

var Module = {
    locateFile(path) {
        return new URL(
            path,
            runtimeBase
        ).href;
    },

    setStatus(status) {
        self.postMessage({
            type: "status",
            status:
                String(
                    status || ""
                )
        });
    },

    onRuntimeInitialized() {
        try {
            initialized = true;
            rebuildRecognizer();
            self.postMessage({
                type: "ready"
            });
        }
        catch (error) {
            fail(
                error,
                true
            );
        }
    }
};

function fail(
    error,
    fatal = false,
    utteranceId =
        activeUtteranceId
) {
    self.postMessage({
        type: "error",
        utteranceId,
        fatal,
        error:
            error?.name ||
            "SherpaError",
        message:
            error?.message ||
            String(error)
    });
}

function hotwordsText() {
    return hotwords.join("\n");
}

function recognizerConfig() {
    const hotwordsBuf =
        hotwordsText();

    return {
        featConfig: {
            sampleRate: 16000,
            featureDim: 80
        },

        modelConfig: {
            transducer: {
                encoder:
                    "./encoder.onnx",
                decoder:
                    "./decoder.onnx",
                joiner:
                    "./joiner.onnx"
            },
            paraformer: {
                encoder: "",
                decoder: ""
            },
            zipformer2Ctc: {
                model: ""
            },
            nemoCtc: {
                model: ""
            },
            toneCtc: {
                model: ""
            },
            tokens:
                "./tokens.txt",
            numThreads: 1,
            provider: "cpu",
            debug: 0,
            modelType: "",
            modelingUnit:
                "cjkchar",
            bpeVocab: ""
        },

        decodingMethod:
            "modified_beam_search",
        maxActivePaths,
        enableEndpoint: 0,
        rule1MinTrailingSilence:
            2.4,
        rule2MinTrailingSilence:
            1.2,
        rule3MinUtteranceLength:
            20,
        hotwordsFile: "",
        hotwordsBuf,
        hotwordsBufSize:
            new TextEncoder()
                .encode(
                    hotwordsBuf
                )
                .length,
        hotwordsScore,
        blankPenalty: 0,
        ctcFstDecoderConfig: {
            graph: "",
            maxActive: 3000
        },
        ruleFsts: "",
        ruleFars: ""
    };
}

function rebuildRecognizer() {
    if (
        !initialized ||
        stream
    ) {
        return;
    }

    if (recognizer) {
        recognizer.free();
    }

    recognizer =
        createOnlineRecognizer(
            Module,
            recognizerConfig()
        );
}

function applyPendingHotwords() {
    if (!pendingHotwords) {
        return;
    }

    hotwords =
        pendingHotwords;
    pendingHotwords =
        undefined;

    rebuildRecognizer();
}

function destroyStream() {
    if (!stream) {
        return;
    }

    try {
        stream.free();
    }
    catch {}

    stream =
        undefined;
    activeUtteranceId =
        undefined;
    lastText = "";

    applyPendingHotwords();
}

function decodeAvailable(
    utteranceId,
    isFinal = false
) {
    if (
        !recognizer ||
        !stream ||
        activeUtteranceId !==
            utteranceId
    ) {
        return;
    }

    const startedAt =
        performance.now();

    while (
        recognizer.isReady(
            stream
        )
    ) {
        recognizer.decode(
            stream
        );
    }

    const result =
        recognizer.getResult(
            stream
        );

    const text =
        String(
            result?.text ||
            ""
        ).trim();

    if (
        text &&
        (
            text !== lastText ||
            isFinal
        )
    ) {
        lastText =
            text;

        self.postMessage({
            type: "transcript",
            utteranceId,
            transcript:
                text,
            isFinal:
                Boolean(
                    isFinal
                ),
            decodeMilliseconds:
                performance.now() -
                startedAt
        });
    }
}

function begin(
    utteranceId
) {
    if (!recognizer) {
        throw new Error(
            "Sherpa recognizer is not ready."
        );
    }

    destroyStream();

    stream =
        recognizer.createStream();

    activeUtteranceId =
        utteranceId;

    lastText = "";
}

function acceptAudio(
    utteranceId,
    samples
) {
    if (
        utteranceId !==
            activeUtteranceId ||
        !stream
    ) {
        return;
    }

    const audio =
        samples instanceof
            Float32Array
            ? samples
            : new Float32Array(
                samples
            );

    stream.acceptWaveform(
        16000,
        audio
    );

    decodeAvailable(
        utteranceId,
        false
    );
}

function finish(
    utteranceId
) {
    if (
        utteranceId !==
            activeUtteranceId ||
        !stream
    ) {
        return;
    }

    stream.acceptWaveform(
        16000,
        new Float32Array(
            6400
        )
    );

    stream.inputFinished();

    decodeAvailable(
        utteranceId,
        true
    );

    destroyStream();
}

self.addEventListener(
    "message",
    event => {
        const message =
            event.data;

        if (
            !message ||
            typeof message !==
                "object"
        ) {
            return;
        }

        try {
            switch (
                message.type
            ) {
                case "init":
                    if (loading) {
                        return;
                    }

                    loading = true;
                    runtimeBase =
                        String(
                            message.runtimeBase ||
                            ""
                        );
                    hotwords =
                        Array.isArray(
                            message.hotwords
                        )
                            ? message.hotwords
                            : [];
                    hotwordsScore =
                        Number.isFinite(
                            Number(
                                message.hotwordsScore
                            )
                        )
                            ? Number(
                                message.hotwordsScore
                            )
                            : 2.0;
                    maxActivePaths =
                        Math.max(
                            1,
                            Math.round(
                                Number(
                                    message.maxActivePaths
                                ) ||
                                4
                            )
                        );

                    importScripts(
                        new URL(
                            "sherpa-onnx-asr.js",
                            runtimeBase
                        ).href
                    );

                    importScripts(
                        new URL(
                            "sherpa-onnx-wasm-main-asr.js",
                            runtimeBase
                        ).href
                    );
                    break;

                case "begin":
                    begin(
                        message.utteranceId
                    );
                    break;

                case "audio":
                    acceptAudio(
                        message.utteranceId,
                        message.samples
                    );
                    break;

                case "finish":
                    finish(
                        message.utteranceId
                    );
                    break;

                case "abort":
                    if (
                        message.utteranceId ===
                        activeUtteranceId
                    ) {
                        destroyStream();
                    }
                    break;

                case "hotwords":
                    if (
                        Array.isArray(
                            message.hotwords
                        )
                    ) {
                        if (stream) {
                            pendingHotwords =
                                message.hotwords;
                        }
                        else {
                            hotwords =
                                message.hotwords;
                            rebuildRecognizer();
                        }
                    }
                    break;

                case "close":
                    destroyStream();

                    if (recognizer) {
                        recognizer.free();
                        recognizer =
                            undefined;
                    }

                    self.close();
                    break;
            }
        }
        catch (error) {
            fail(
                error,
                message.type ===
                    "init"
            );
        }
    }
);