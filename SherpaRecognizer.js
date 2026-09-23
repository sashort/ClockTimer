(() => {
    const currentScript =
        document.currentScript?.src ||
        location.href;
    const version = (() => {
        try {
            return new URL(currentScript).search;
        } catch {
            return "";
        }
    })();

    class SherpaRecognizer extends EventTarget {
        static sampleRate = 16000;
        static runtimeBase = "speech/sherpa/runtime";
        static workerSource = "speech/SherpaWorker.js";

        #worker;
        #readyPromise;
        #resolveReady;
        #rejectReady;
        #activeUtteranceId;
        #isReady = false;
        #closed = false;

        constructor({
            hotwords = [],
            hotwordsScore = 2.0,
            maxActivePaths = 4
        } = {}) {
            super();

            this.#readyPromise =
                new Promise((resolve, reject) => {
                    this.#resolveReady = resolve;
                    this.#rejectReady = reject;
                });

            const workerUrl =
                SherpaRecognizer.assetUrl(
                    SherpaRecognizer.workerSource
                );

            this.#worker =
                new Worker(workerUrl);

            this.#worker.addEventListener(
                "message",
                event =>
                    this.#handleMessage(
                        event.data
                    )
            );

            this.#worker.addEventListener(
                "error",
                event => {
                    const error =
                        new Error(
                            event.message ||
                            "Sherpa worker failed."
                        );

                    this.#rejectReady?.(
                        error
                    );

                    this.dispatchEvent(
                        new CustomEvent(
                            "error",
                            {
                                detail: {
                                    error:
                                        "SherpaWorkerError",
                                    message:
                                        error.message
                                }
                            }
                        )
                    );
                }
            );

            this.#worker.postMessage({
                type: "init",
                runtimeBase:
                    new URL(
                        SherpaRecognizer.runtimeBase + "/",
                        location.href
                    ).href,
                hotwords:
                    SherpaRecognizer
                        .normalizeHotwords(
                            hotwords
                        ),
                hotwordsScore,
                maxActivePaths
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

        static normalizeHotwords(values) {
            const result = [];
            const seen = new Set();

            for (
                const raw of
                    Array.isArray(values)
                        ? values
                        : []
            ) {
                const value =
                    String(raw || "")
                        .toLocaleUpperCase("en-US")
                        .replace(
                            /[^A-Z0-9' ]+/g,
                            " "
                        )
                        .replace(/\s+/g, " ")
                        .trim();

                if (
                    !value ||
                    seen.has(value)
                ) {
                    continue;
                }

                seen.add(value);
                result.push(value);
            }

            return result;
        }

        get ready() {
            return this.#readyPromise;
        }

        get activeUtteranceId() {
            return this.#activeUtteranceId;
        }

        beginUtterance(
            utteranceId
        ) {
            if (
                this.#closed ||
                !this.#isReady
            ) {
                return false;
            }

            this.#activeUtteranceId =
                utteranceId;

            this.#worker.postMessage({
                type: "begin",
                utteranceId
            });

            return true;
        }

        accept(
            utteranceId,
            samples
        ) {
            if (
                this.#closed ||
                this.#activeUtteranceId !==
                    utteranceId ||
                !(samples instanceof Float32Array) ||
                samples.length === 0
            ) {
                return false;
            }

            this.#worker.postMessage(
                {
                    type: "audio",
                    utteranceId,
                    samples
                },
                [
                    samples.buffer
                ]
            );

            return true;
        }

        finishUtterance(
            utteranceId
        ) {
            if (
                this.#closed ||
                this.#activeUtteranceId !==
                    utteranceId
            ) {
                return false;
            }

            this.#activeUtteranceId =
                undefined;

            this.#worker.postMessage({
                type: "finish",
                utteranceId
            });

            return true;
        }

        abortUtterance(
            utteranceId
        ) {
            if (
                this.#closed ||
                this.#activeUtteranceId !==
                    utteranceId
            ) {
                return false;
            }

            this.#activeUtteranceId =
                undefined;

            this.#worker.postMessage({
                type: "abort",
                utteranceId
            });

            return true;
        }

        setHotwords(values) {
            if (this.#closed) {
                return;
            }

            this.#worker.postMessage({
                type: "hotwords",
                hotwords:
                    SherpaRecognizer
                        .normalizeHotwords(
                            values
                        )
            });
        }

        close() {
            if (this.#closed) {
                return;
            }

            this.#closed = true;
            this.#activeUtteranceId =
                undefined;

            try {
                this.#worker.postMessage({
                    type: "close"
                });
            } catch {}

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
                this.#isReady = true;
                this.#resolveReady?.(
                    true
                );
                this.#resolveReady =
                    undefined;
                this.#rejectReady =
                    undefined;
            }

            if (message.type === "error") {
                const error =
                    new Error(
                        message.message ||
                        "Sherpa recognition failed."
                    );

                if (message.fatal) {
                    this.#rejectReady?.(
                        error
                    );
                }
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

    globalThis.SherpaRecognizer =
        SherpaRecognizer;
})();