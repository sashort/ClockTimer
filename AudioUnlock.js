/* User-gesture audio activation, isolated from application startup orchestration. */
(function (root) {
    "use strict";

    function install(documentRef = root.document, audio = root.WMOFAudio) {
        if (!documentRef?.addEventListener) return () => {};
        let activated = false;
        const activate = () => {
            if (activated) return;
            activated = true;
            void audio?.unlock?.();
            documentRef.removeEventListener("pointerdown", activate, true);
            documentRef.removeEventListener("keydown", activate, true);
        };
        documentRef.addEventListener("pointerdown", activate, true);
        documentRef.addEventListener("keydown", activate, true);
        return () => {
            documentRef.removeEventListener("pointerdown", activate, true);
            documentRef.removeEventListener("keydown", activate, true);
        };
    }

    root.ClockTimerAudioUnlock = Object.freeze({ install });
})(globalThis);
