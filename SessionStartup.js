/* Owns landing-session restoration and its login-dialog follow-up. */
(function (root) {
    "use strict";

    function start({
        pending,
        clockTimer,
        isLoginConfirmed = () => false,
        onLoginConfirmed = () => {},
        onDeliberatelyLoggedOut = () => {},
        onPendingComplete = () => {},
        persistDeliberatelyLoggedOut = () => {},
        showInitialLoginDialog = () => {},
        syncNetworkStatusUI = () => {},
        isSpeechTimingRequested = () => false,
        openSpeechTiming = () => Promise.resolve(),
        logger = console
    } = {}) {
        if (!pending) {
            showInitialLoginDialog();
            return Promise.resolve(false);
        }
        if (!clockTimer || typeof clockTimer.resumeConnection !== "function") {
            throw new TypeError("Landing-session startup requires a connection-capable clock timer.");
        }

        return (async () => {
            try {
                if (await clockTimer.resumeConnection()) {
                    onLoginConfirmed();
                    onDeliberatelyLoggedOut();
                    persistDeliberatelyLoggedOut();
                }
            } catch (error) {
                logger.warn("Existing session could not be resumed:", error);
            } finally {
                onPendingComplete();
                if (!isLoginConfirmed()) {
                    showInitialLoginDialog();
                } else {
                    syncNetworkStatusUI();
                    if (isSpeechTimingRequested()) {
                        void openSpeechTiming().catch(error => logger.error(error));
                    }
                }
            }
            return Boolean(isLoginConfirmed());
        })();
    }

    root.ClockTimerSessionStartup = Object.freeze({start});
})(globalThis);
