/* Service-worker cache registration for speech model assets. */
(function (root) {
    "use strict";

    async function register({
        scriptUrl,
        navigatorRef = root.navigator,
        secureContext = root.isSecureContext,
        enabled = true,
        timeoutMs = 1500,
        setTimeoutRef = root.setTimeout,
        clearTimeoutRef = root.clearTimeout,
        logger = root.console
    } = {}) {
        if (!enabled || !("serviceWorker" in (navigatorRef || {})) || !secureContext) return false;

        try {
            await navigatorRef.serviceWorker.register(scriptUrl, {
                scope: "./",
                updateViaCache: "all"
            });
            await navigatorRef.serviceWorker.ready;
            if (navigatorRef.serviceWorker.controller) return true;

            await new Promise(resolve => {
                const timeout = setTimeoutRef(resolve, timeoutMs);
                navigatorRef.serviceWorker.addEventListener("controllerchange", () => {
                    clearTimeoutRef(timeout);
                    resolve();
                }, { once: true });
            });
            return Boolean(navigatorRef.serviceWorker.controller);
        } catch (error) {
            logger?.warn?.("Sherpa asset cache unavailable:", error);
            return false;
        }
    }

    root.ClockTimerSpeechAssetCache = Object.freeze({ register });
})(globalThis);
