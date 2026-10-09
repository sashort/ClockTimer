/* Load the audio settings model before app.js reads or binds its state. */
(function (root) {
    "use strict";

    async function ensureModel({
        context = root.ClockTimerPageContext,
        documentRef = root.document,
        resources = root.ClockTimerResources,
        modelUrl = "AudioSettingsModel.js?build=audio-settings-model-3"
    } = {}) {
        if (root.WMOFAudioSettingsModel) return root.WMOFAudioSettingsModel;
        if (resources?.loadScript) {
            await resources.loadScript(modelUrl, context, { async: true });
        } else {
            await new Promise((resolve, reject) => {
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
                script.src = modelUrl;
                script.onload = () => resolve(script);
                script.onerror = () => reject(new Error("Unable to load AudioSettingsModel.js."));
                documentRef.head.append(script);
            });
        }
        return root.WMOFAudioSettingsModel || null;
    }

    root.ClockTimerAudioSettingsStartup = Object.freeze({ ensureModel });
})(globalThis);
