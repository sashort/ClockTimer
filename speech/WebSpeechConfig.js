/* This experiment uses the browser's recognition service, with no local model. */
(() => {
    const requested=Number(new URL(document.URL).searchParams.get("speech-alternatives")||10);
    globalThis.WMOF_SPEECH_BACKEND="web-speech";
    globalThis.WMOF_WEB_SPEECH_CONFIG={
        maxAlternatives:Number.isInteger(requested)&&requested>=1&&requested<=30?requested:10,
        maxCandidates:50,processLocally:false,
        ...globalThis.WMOF_WEB_SPEECH_CONFIG
    };
})();
