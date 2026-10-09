/* Service-worker cache registration for speech model assets. */
(function (root) {
    "use strict";

    async function register({
        scriptUrl,
        navigatorRef = root.navigator,
        secureContext = root.isSecureContext,
        logger = root.console
    } = {}) {
        if (!("serviceWorker" in (navigatorRef || {})) || !secureContext) return false;

        try {
            await navigatorRef.serviceWorker.register(scriptUrl, {
                scope: "./",
                updateViaCache: "all"
            });
            await navigatorRef.serviceWorker.ready;
            if (navigatorRef.serviceWorker.controller) return true;

            await new Promise(resolve => {
                const timeout = setTimeout(resolve, 1500);
                navigatorRef.serviceWorker.addEventListener("controllerchange", () => {
                    clearTimeout(timeout);
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
