// Local Vosk is the default. Explicit per-visit backend overrides support comparisons.
(() => {
    const requested = new URL(document.URL).searchParams.get("speech-backend");
    globalThis.WMOF_SPEECH_BACKEND = ["sherpa","vosk","vosk-server","web-speech"].includes(requested) ? requested :
        (globalThis.WMOF_SPEECH_BACKEND || "vosk");
    const alternatives=Number(new URL(document.URL).searchParams.get("speech-alternatives")||10);
    globalThis.WMOF_VOSK_CONFIG = {
        requireAlternatives:true,
        contextHandoff:new URL(document.URL).searchParams.get("speech-handoff")!=="off",
        maxAlternatives:Number.isInteger(alternatives)&&alternatives>=1&&alternatives<=30?alternatives:10,
        runtimeUrl: new URL("speech/vosk/runtime/vosk-alternatives-607b5c3e.js", document.baseURI).href,
        modelUrl: new URL("speech/vosk/models/vosk-model-small-en-us-0.15.tar.gz", document.baseURI).href,
        ...globalThis.WMOF_VOSK_CONFIG
    };
    globalThis.WMOF_VOSK_SERVER_CONFIG={sessionUrl:new URL("api/speech/session/",document.baseURI).href,
        ...globalThis.WMOF_VOSK_SERVER_CONFIG};
    globalThis.WMOF_WEB_SPEECH_CONFIG={maxAlternatives:Number.isInteger(alternatives)&&alternatives>=1&&alternatives<=30?alternatives:10,
        maxCandidates:50,processLocally:false,...globalThis.WMOF_WEB_SPEECH_CONFIG};
})();
