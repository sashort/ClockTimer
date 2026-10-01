(() => {
    const currentScript =
        document.currentScript?.src ||
        location.href;

    const version = (() => {
        try {
            return new URL(
                currentScript
            ).search;
        }
        catch {
            return "";
        }
    })();

    class SileroVad extends EventTarget {
        static sampleRate = 16000;
        static windowSize = 512;
        static runtimeBase =
            "speech/sherpa/vad";
        static workerSource =
            "speech/SileroVadWorker.js";

        #worker;
        #readyPromise;
        #resolveReady;
        #rejectReady;
        #pending =
            new Float32Array(
                SileroVad.windowSize * 4
            );
        #pendingLength = 0;
        #closed = false;
        #ready = false;

        constructor({
            threshold = 0.5,
            minSilenceDuration = 0.35,
            minSpeechDuration = 0.15,
            maxSpeechDuration = 20
        } = {}) {
            super();

            this.#readyPromise =
                new Promise(
                    (resolve, reject) => {
                        this.#resolveReady =
                            resolve;
                        this.#rejectReady =
                            reject;
                    }
                );

            this.#worker =
                new Worker(
                    SileroVad.assetUrl(
                        SileroVad.workerSource
                    )
                );

            this.#worker
                .addEventListener(
                    "message",
                    event =>
                        this.#handleMessage(
                            event.data
                        )
                );

            this.#worker
                .addEventListener(
                    "error",
                    event => {
                        const error =
                            new Error(
                                event.message ||
                                "Silero VAD worker failed."
                            );

                        this.#rejectReady?.(
                            error
                        );

                        this.dispatchEvent(
                            new CustomEvent(
                                "error",
                                {
                                    detail: {
                                        fatal: true,
                                        error:
                                            "SileroVadWorkerError",
                                        message:
                                            error.message
                                    }
                                }
                            )
                        );
                    }
                );

            this.#worker
                .postMessage({
                    type: "init",
                    runtimeBase:
                        new URL(
                            SileroVad
                                .runtimeBase +
                                "/",
                            location.href
                        ).href,
                    threshold,
                    minSilenceDuration,
                    minSpeechDuration,
                    maxSpeechDuration,
                    windowSize:
                        SileroVad.windowSize
                });
        }

        static assetUrl(path) {
            const url =
                new URL(
                    path,
                    location.href
                );

            if (
                version &&
                !url.search
            ) {
                url.search =
                    version;
            }

            return url.href;
        }

        get ready() {
            return this.#readyPromise;
        }

        accept(samples) {
            if (
                this.#closed ||
                !this.#ready ||
                !(samples instanceof Float32Array) ||
                samples.length === 0
            ) {
                return false;
            }

            let sourceOffset = 0;

            while (
                sourceOffset <
                samples.length
            ) {
                const available =
                    this.#pending.length -
                    this.#pendingLength;

                const count =
                    Math.min(
                        available,
                        samples.length -
                            sourceOffset
                    );

                this.#pending.set(
                    samples.subarray(
                        sourceOffset,
                        sourceOffset + count
                    ),
                    this.#pendingLength
                );

                this.#pendingLength +=
                    count;

                sourceOffset +=
                    count;

                while (
                    this.#pendingLength >=
                    SileroVad.windowSize
                ) {
                    const frame =
                        this.#pending.slice(
                            0,
                            SileroVad.windowSize
                        );

                    this.#worker
                        .postMessage(
                            {
                                type: "audio",
                                samples:
                                    frame
                            },
                            [
                                frame.buffer
                            ]
                        );

                    this.#pending
                        .copyWithin(
                            0,
                            SileroVad.windowSize,
                            this.#pendingLength
                        );

                    this.#pendingLength -=
                        SileroVad.windowSize;
                }
            }

            return true;
        }

        reset() {
            this.#pendingLength = 0;

            if (
                this.#closed ||
                !this.#ready
            ) {
                return;
            }

            this.#worker.postMessage({
                type: "reset"
            });
        }

        close() {
            if (this.#closed) {
                return;
            }

            this.#closed = true;
            this.#pendingLength = 0;

            try {
                this.#worker.postMessage({
                    type: "close"
                });
            }
            catch {}

            this.#worker.terminate();
        }

        #handleMessage(message) {
            if (
                !message ||
                typeof message !== "object"
            ) {
                return;
            }

            if (message.type === "ready") {
                this.#ready = true;

                this.#resolveReady?.(
                    true
                );

                this.#resolveReady =
                    undefined;

                this.#rejectReady =
                    undefined;
            }

            if (
                message.type === "error" &&
                message.fatal
            ) {
                this.#rejectReady?.(
                    new Error(
                        message.message ||
                        "Silero VAD failed."
                    )
                );
            }

            this.dispatchEvent(
                new CustomEvent(
                    message.type,
                    {
                        detail:
                            message
                    }
                )
            );
        }
    }

    globalThis.SileroVad =
        SileroVad;
})();