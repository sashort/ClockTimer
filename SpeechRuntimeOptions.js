/* Parses speech runtime URL flags and assembles the cache-busting revision. */
(function (root) {
    "use strict";

    function read(search, assetVersion, runtimeRevision) {
        const params = new URLSearchParams(search || "");
        return Object.freeze({
            version: "?sherpa=" + encodeURIComponent(String(assetVersion ?? ""))
                + "&runtime=" + encodeURIComponent(String(runtimeRevision ?? "")),
            diagnosticsEnabled: params.has("speech-diagnostics"),
            pipeline: params.get("speech-pipeline") === "silero" ? "silero" : "raw"
        });
    }

    root.ClockTimerSpeechRuntimeOptions = Object.freeze({read});
})(globalThis);
