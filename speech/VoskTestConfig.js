// Lightsail experiment default. A per-visit override keeps Sherpa available
// for comparisons without changing deployment or saved account settings.
(() => {
    const requested = new URL(document.URL).searchParams.get("speech-backend");
    globalThis.WMOF_SPEECH_BACKEND = requested === "sherpa" ? "sherpa" :
        (globalThis.WMOF_SPEECH_BACKEND || "vosk");
    globalThis.WMOF_VOSK_CONFIG = {
        runtimeUrl: new URL("speech/vosk/runtime/vosk-0.0.8.js", document.baseURI).href,
        modelUrl: new URL("speech/vosk/models/vosk-model-small-en-us-0.15.tar.gz", document.baseURI).href,
        overlapMilliseconds: 320,
        ...globalThis.WMOF_VOSK_CONFIG
    };
})();
