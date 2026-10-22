// Lightsail experiment default. A per-visit override keeps Sherpa available
// for comparisons without changing deployment or saved account settings.
(() => {
    const requested = new URL(document.URL).searchParams.get("speech-backend");
    globalThis.WMOF_SPEECH_BACKEND = ["sherpa","vosk","vosk-server","web-speech"].includes(requested) ? requested :
        (globalThis.WMOF_SPEECH_BACKEND || "vosk");
    globalThis.WMOF_VOSK_CONFIG = {
        runtimeUrl: new URL("speech/vosk/runtime/vosk-0.0.8.js", document.baseURI).href,
        modelUrl: new URL("speech/vosk/models/vosk-model-small-en-us-0.15.tar.gz", document.baseURI).href,
        ...globalThis.WMOF_VOSK_CONFIG
    };
    globalThis.WMOF_VOSK_SERVER_CONFIG={sessionUrl:new URL("api/speech/session/",document.baseURI).href,
        ...globalThis.WMOF_VOSK_SERVER_CONFIG};
    const alternatives=Number(new URL(document.URL).searchParams.get("speech-alternatives")||10);
    globalThis.WMOF_WEB_SPEECH_CONFIG={maxAlternatives:Number.isInteger(alternatives)&&alternatives>=1&&alternatives<=30?alternatives:10,
        maxCandidates:50,processLocally:false,commandAlternatives:{},...globalThis.WMOF_WEB_SPEECH_CONFIG};
})();
