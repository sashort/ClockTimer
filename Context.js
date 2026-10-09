/* Context contract shared by the dispatcher, resource loaders and nested templates. */
(function (root) {
    "use strict";

    const RESTRICTIVE_CAPABILITIES = root.ClockTimerPageManifest?.restrictiveCapabilities || [
        "speechMenu", "speechRecognition", "audioAnnouncements",
        "loginFlow", "calendarStartup", "liveStream"
    ];

    function infer() {
        const body = document.body;
        const params = new URLSearchParams(root.location?.search || "");
        const settingsPage = body?.classList.contains("settings-page") === true;
        const dropInPage = body?.classList.contains("drop-in-page") === true ||
            Boolean(body?.querySelector("#liveStreamDialog"));
        const surface = params.get("surface");
        const requestedParentHost = params.get("parentHost");
        const parentHost = ["order-filler", "drop-in"].includes(requestedParentHost)
            ? requestedParentHost
            : null;
        const host = dropInPage ? "drop-in" : (settingsPage ? "settings-frame" : "order-filler");
        const policy = root.ClockTimerPageManifest?.resolve(host) || {
            host,
            presentation: settingsPage ? "graphical-settings" : "application",
            features: settingsPage ? ["settings"] : (dropInPage ? ["drop-in", "settings"] : ["application", "settings", "calendarStartup"]),
            capabilities: settingsPage
                ? { speechMenu: false, speechRecognition: false, audioAnnouncements: false, loginFlow: false, calendarStartup: false, liveStream: false }
                : {},
            options: {}
        };
        return {
            ...policy,
            host,
            surface: surface || (settingsPage ? "settings" : "application"),
            options: parentHost ? { ...(policy.options || {}), parentHost } : { ...(policy.options || {}) }
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

    // Dynamically loaded scripts can inspect the exact context assigned by the
    // resource loader without changing the page-wide context for other scripts.
    function forCurrentScript() {
        const script = document.currentScript;
        if (script?.dataset?.clocktimerContextData) {
            try {
                return normalize(JSON.parse(script.dataset.clocktimerContextData), root.ClockTimerPageContext);
            } catch (error) {
                console.warn("Invalid ClockTimer resource context; using page context.", error);
            }
        }
        return root.ClockTimerPageContext || normalize(infer());
    }

    function startupPolicy() {
        const context = forCurrentScript() || root.ClockTimerPageContext || null;
        const settingsOnlyPage = context?.host === "settings-frame"
            || document.body?.classList.contains("settings-page") === true;
        return Object.freeze({
            context,
            settingsOnlyPage,
            capabilityEnabled: name => context?.capabilities?.[name] !== false
        });
    }

    root.ClockTimerContext = Object.freeze({ infer, normalize, child, forCurrentScript, startupPolicy });
    root.ClockTimerPageContext = normalize(infer());
})(globalThis);
