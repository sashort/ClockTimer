/* Context contract shared by the dispatcher, resource loaders and nested templates. */
(function (root) {
    "use strict";

    const RESTRICTIVE_CAPABILITIES = [
        "speechMenu", "speechRecognition", "audioAnnouncements",
        "loginFlow", "calendarStartup", "liveStream"
    ];

    function infer() {
        const body = document.body;
        const params = new URLSearchParams(root.location?.search || "");
        const settingsPage = body?.classList.contains("settings-page") === true;
        const dropInPage = body?.classList.contains("drop-in-page") === true ||
            body?.querySelector("#liveStreamDialog") !== null;
        const surface = params.get("surface");
        return {
            host: dropInPage ? "drop-in" : (settingsPage ? "settings-frame" : "order-filler"),
            surface: surface || (settingsPage ? "settings" : "application"),
            presentation: settingsPage ? "graphical-settings" : "application",
            features: settingsPage ? ["settings"] : (dropInPage ? ["drop-in"] : ["application"]),
            capabilities: settingsPage
                ? { speechMenu: false, speechRecognition: false, audioAnnouncements: false, loginFlow: false, calendarStartup: false, liveStream: false }
                : {},
            options: {}
        };
    }

    function normalize(input, parent) {
        const base = parent ? parent : infer();
        const requested = input && typeof input === "object" ? input : {};
        const capabilities = { ...(base.capabilities || {}), ...(requested.capabilities || {}) };
        // A child may disable a capability, but cannot re-enable one disabled by its parent.
        if (parent) {
            for (const key of RESTRICTIVE_CAPABILITIES) {
                if (parent.capabilities?.[key] === false) capabilities[key] = false;
            }
        }
        return Object.freeze({
            ...base,
            ...requested,
            host: requested.host || base.host,
            surface: requested.surface || base.surface,
            presentation: requested.presentation || base.presentation,
            features: Object.freeze(
                requested.features
                    ? [...new Set(requested.features)].filter(feature =>
                        !parent || (base.features || []).includes("*") || (base.features || []).includes(feature))
                    : [...(base.features || [])]
            ),
            capabilities: Object.freeze(capabilities),
            options: Object.freeze({ ...(base.options || {}), ...(requested.options || {}) }),
            parent: parent || null
        });
    }

    function child(parent, overrides) {
        return normalize(overrides || {}, normalize(parent));
    }

    root.ClockTimerContext = Object.freeze({ infer, normalize, child });
    root.ClockTimerPageContext = normalize(infer());
})(globalThis);
