/* Vosk owns continuous capture; Web Speech remains an explicit comparison backend. */
(() => {
    const requested=Number(new URL(document.URL).searchParams.get("speech-alternatives")||10);
    const backend = new URL(document.URL).searchParams.get("speech-backend");
    globalThis.WMOF_SPEECH_BACKEND = ["vosk", "vosk-server", "web-speech", "sherpa"].includes(backend) ? backend : "vosk";
    globalThis.WMOF_WEB_SPEECH_CONFIG={
        maxAlternatives:Number.isInteger(requested)&&requested>=1&&requested<=30?requested:10,
        maxCandidates:50,processLocally:false,
        ...globalThis.WMOF_WEB_SPEECH_CONFIG
    };
})();
