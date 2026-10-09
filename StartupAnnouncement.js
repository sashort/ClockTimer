/* Owns the startup announcement and its completion signal. */
(function (root) {
    "use strict";

    function create({ settingsOnlyPage = false, audio = root.WMOFAudio, text }) {
        let pending = true;
        let started = false;
        let finished = false;
        let resolveFinished;
        const finishedPromise = new Promise(resolve => { resolveFinished = resolve; });

        function finish() {
            if (finished) return;
            finished = true;
            pending = false;
            resolveFinished();
        }

        function start() {
            if (started) return;
            started = true;
            if (settingsOnlyPage) {
                finish();
                return;
            }
            try {
                const spoken = audio?.speak?.(text("messages.voiceLogin.applicationStarting"), {
                    onEnd: finish,
                    onError: finish
                });
                if (!spoken) finish();
            } catch (error) {
                finish();
            }
            if (!audio?.speak) finish();
        }

        return Object.freeze({
            start,
            finish,
            finished: finishedPromise,
            get pending() { return pending; }
        });
    }

    root.ClockTimerStartupAnnouncement = Object.freeze({ create });
})(globalThis);
