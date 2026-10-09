/* Dependency-injected speech runtime loader extracted from app.js. */
(function (root) {
    "use strict";

    function create({
        documentRef = document,
        customElementsRef = customElements,
        assetCacheReady = Promise.resolve(),
        getPipeline = () => "sherpa",
        getDiagnosticsEnabled = () => false,
        apiBase,
        loadScript
    } = {}) {
        if (typeof loadScript !== "function") {
            throw new TypeError("Speech runtime loader requires loadScript.");
        }
        let promise;
        let readyEventDispatched = false;

        function dispatchReady() {
            if (readyEventDispatched) return;
            readyEventDispatched = true;
            documentRef.dispatchEvent(new CustomEvent("speech-runtime-ready"));
        }

        function ensure() {
            if (root.SpeechMenu && customElementsRef.get("speech-mic-bar")) {
                dispatchReady();
                return Promise.resolve();
            }
            if (!promise) {
                promise = Promise.resolve().then(async () => {
                    await assetCacheReady;
                    if (!root.AdaptiveSpeechTiming) await loadScript("AdaptiveSpeechTiming.js");
                    if (!root.SherpaRecognizer) await loadScript("SherpaRecognizer.js");

                    const pipeline = getPipeline();
                    if (pipeline === "silero" && !root.SileroVad) await loadScript("SileroVad.js");
                    if (!root.SpeechMenu) await loadScript("SpeechMenu.js");

                    if (!root.SpeechMenu.started && root.SpeechMenu.pipeline !== getPipeline()) {
                        root.SpeechMenu.pipeline = getPipeline();
                    }
                    void root.SpeechMenu.loadCorrections(
                        new URL("api/speech-corrections/?language=en-US", apiBase).href
                    ).catch(() => {});

                    if (!customElementsRef.get("speech-mic-bar")) {
                        await loadScript("SpeechMicBar.js?v=language-pack-20261001");
                    }
                    if (getDiagnosticsEnabled() && !customElementsRef.get("speech-diagnostics")) {
                        await loadScript("SpeechDiagnostics.js?v=language-pack-20261001");
                    }
                    if (getDiagnosticsEnabled() && !documentRef.querySelector("speech-diagnostics")) {
                        documentRef.body.append(documentRef.createElement("speech-diagnostics"));
                    }
                    dispatchReady();
                });
            }
            return promise;
        }

        return Object.freeze({ ensure });
    }

    root.ClockTimerSpeechRuntimeLoader = Object.freeze({ create });
})(globalThis);
