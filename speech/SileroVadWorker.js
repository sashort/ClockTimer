let runtimeBase = "";
let vad;
let initialized = false;
let loading = false;
let detected = false;
let sampleIndex = 0;
let maxProcessingMilliseconds = 0;
let config = {
    threshold: 0.5,
    minSilenceDuration: 0.35,
    minSpeechDuration: 0.15,
    maxSpeechDuration: 20,
    windowSize: 512
};

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
            createDetector();

            self.postMessage({
                type: "ready",
                config
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
    fatal = false
) {
    self.postMessage({
        type: "error",
        fatal,
        error:
            error?.name ||
            "SileroVadError",
        message:
            error?.message ||
            String(error)
    });
}

function createDetector() {
    if (!initialized) {
        return;
    }

    if (vad) {
        try {
            vad.free();
        }
        catch {}
    }

    vad =
        createVad(
            Module,
            {
                sileroVad: {
                    model:
                        "./silero_vad.onnx",
                    threshold:
                        config.threshold,
                    minSilenceDuration:
                        config
                            .minSilenceDuration,
                    minSpeechDuration:
                        config
                            .minSpeechDuration,
                    maxSpeechDuration:
                        config
                            .maxSpeechDuration,
                    windowSize:
                        config.windowSize
                },
                tenVad: {
                    model: "",
                    threshold: 0.5,
                    minSilenceDuration: 0.5,
                    minSpeechDuration: 0.25,
                    maxSpeechDuration: 20,
                    windowSize: 256
                },
                sampleRate: 16000,
                numThreads: 1,
                provider: "cpu",
                debug: 0,
                bufferSizeInSeconds: 30
            }
        );

    detected = false;
    sampleIndex = 0;
    maxProcessingMilliseconds = 0;
}

function clearSegments() {
    if (!vad) {
        return;
    }

    while (
        !vad.isEmpty()
    ) {
        vad.pop();
    }
}

function resetDetector() {
    if (!vad) {
        return;
    }

    vad.reset();
    clearSegments();
    detected = false;
    sampleIndex = 0;
    maxProcessingMilliseconds = 0;
}

function processAudio(samples) {
    if (
        !vad ||
        !(samples instanceof Float32Array) ||
        samples.length === 0
    ) {
        return;
    }

    const startedAt =
        performance.now();

    vad.acceptWaveform(
        samples
    );

    sampleIndex +=
        samples.length;

    const nowDetected =
        vad.isDetected();

    const processMilliseconds =
        performance.now() -
        startedAt;

    maxProcessingMilliseconds =
        Math.max(
            maxProcessingMilliseconds,
            processMilliseconds
        );

    if (
        nowDetected !==
        detected
    ) {
        detected =
            nowDetected;

        self.postMessage({
            type:
                detected
                    ? "speechStart"
                    : "speechEnd",
            detected,
            sampleIndex,
            audioSeconds:
                sampleIndex /
                16000,
            processMilliseconds,
            maxProcessingMilliseconds
        });
    }

    if (!detected) {
        clearSegments();
    }
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

                    config = {
                        threshold:
                            Number(
                                message.threshold
                            ) || 0.5,
                        minSilenceDuration:
                            Number(
                                message
                                    .minSilenceDuration
                            ) || 0.35,
                        minSpeechDuration:
                            Number(
                                message
                                    .minSpeechDuration
                            ) || 0.15,
                        maxSpeechDuration:
                            Number(
                                message
                                    .maxSpeechDuration
                            ) || 20,
                        windowSize:
                            Math.max(
                                128,
                                Math.round(
                                    Number(
                                        message
                                            .windowSize
                                    ) ||
                                    512
                                )
                            )
                    };

                    importScripts(
                        new URL(
                            "sherpa-onnx-vad.js",
                            runtimeBase
                        ).href
                    );

                    importScripts(
                        new URL(
                            "sherpa-onnx-wasm-main-vad.js",
                            runtimeBase
                        ).href
                    );
                    break;

                case "audio":
                    processAudio(
                        message.samples
                    );
                    break;

                case "reset":
                    resetDetector();
                    break;

                case "close":
                    if (vad) {
                        vad.free();
                        vad =
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