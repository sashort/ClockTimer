/* Speech runtime startup composition. app.js supplies its live configuration; this module owns loader orchestration. */
(function (root) {
    "use strict";

    function create({
        context = root.ClockTimerPageContext,
        enabled = true,
        documentRef = document,
        navigatorRef = navigator,
        secureContext = root.isSecureContext,
        version = "",
        apiBase,
        getPipeline = () => "raw",
        getDiagnosticsEnabled = () => false
    } = {}) {
        const speechEnabled = enabled && context?.capabilities?.speechRecognition !== false
            && context?.host !== "settings-frame";
        const assetCacheReady = !speechEnabled
            ? Promise.resolve(false)
            : (async () => {
                try {
                    if (!root.ClockTimerSpeechAssetCache && root.ClockTimerResources) {
                        await root.ClockTimerResources.loadScript(
                            "SpeechAssetCache.js?build=speech-asset-cache-2",
                            context,
                            { async: true }
                        );
                    }
                    if (!root.ClockTimerSpeechAssetCache) return false;
                    return await root.ClockTimerSpeechAssetCache.register({
                        scriptUrl: "SpeechAssetCacheWorker.js" + version,
                        navigatorRef,
                        secureContext,
                        enabled: true
                    });
                } catch (error) {
                    console.warn("Sherpa asset cache unavailable:", error);
                    return false;
                }
            })();

        const classicScriptLoader = root.ClockTimerClassicScriptLoader?.create({
            documentRef,
            context,
            version
        });

        const loadClassicScript = source => {
            if (classicScriptLoader) return classicScriptLoader.load(source);
            if (root.ClockTimerResources) {
                return root.ClockTimerResources.loadScript(source + version, context, { async: true });
            }
            return new Promise((resolve, reject) => {
                const script = documentRef.createElement("script");
                const effectiveContext = context || {};
                script.dataset.clocktimerContext = effectiveContext.host || "order-filler";
                script.dataset.clocktimerContextData = JSON.stringify({
                    host: effectiveContext.host || "order-filler",
                    surface: effectiveContext.surface || "application",
                    presentation: effectiveContext.presentation || "application",
                    features: effectiveContext.features || [],
                    capabilities: effectiveContext.capabilities || {},
                    options: effectiveContext.options || {}
                });
                script.src = source + version;
                script.onload = () => resolve(script);
                script.onerror = () => reject(new Error("Unable to load " + source + "."));
                documentRef.head.append(script);
            });
        };

        let runtimeLoader;
        let runtimeLoaderPromise;
        function ensureRuntime() {
            if (!speechEnabled) return Promise.resolve(false);
            const initialize = () => {
                if (!runtimeLoader) {
                    const loader = root.ClockTimerSpeechRuntimeLoader;
                    if (!loader) throw new Error("SpeechRuntimeLoader.js did not register its factory.");
                    runtimeLoader = loader.create({
                        assetCacheReady,
                        getPipeline,
                        getDiagnosticsEnabled,
                        apiBase,
                        loadScript: loadClassicScript
                    });
                }
                return runtimeLoader.ensure();
            };

            if (runtimeLoader) return runtimeLoader.ensure();
            if (root.ClockTimerSpeechRuntimeLoader) return initialize();
            if (!runtimeLoaderPromise) {
                runtimeLoaderPromise = loadClassicScript("SpeechRuntimeLoader.js").then(initialize);
                runtimeLoaderPromise.catch(() => { runtimeLoaderPromise = null; });
            }
            return runtimeLoaderPromise;
        }

        return Object.freeze({ ensureRuntime, loadClassicScript, assetCacheReady });
    }

    root.ClockTimerSpeechStartup = Object.freeze({ create });
})(globalThis);
