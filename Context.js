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
        // The shared Order-Filler dialogs also contain #liveStreamDialog, so use
        // the Drop-In-specific page marker rather than that shared dialog as a detector.
        const dropInPage = !settingsPage && (
            body?.classList.contains("drop-in-page") === true ||
            Boolean(body?.querySelector("#dropInPageStatus"))
        );
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
        const requested = input && typeof input === "object" ? input : {};
        const parentContext = parent ? normalize(parent) : null;
        const inferred = parentContext || infer();
        const host = requested.host || inferred.host;
        const hostPolicy = root.ClockTimerPageManifest?.resolve(host) || {
            host,
            presentation: inferred.presentation || "application",
            features: inferred.features || [],
            capabilities: inferred.capabilities || {},
            options: inferred.options || {}
        };
        const base = parentContext || (requested.host ? hostPolicy : inferred);
        const capabilities = {
            ...(hostPolicy.capabilities || {}),
            ...(base.capabilities || {}),
            ...(requested.capabilities || {})
        };
        // Neither an explicit top-level override nor a nested resource may
        // enable capabilities forbidden by its resolved host or its parent.
        for (const key of RESTRICTIVE_CAPABILITIES) {
            if (hostPolicy.capabilities?.[key] === false
                || base.capabilities?.[key] === false
                || parentContext?.capabilities?.[key] === false) {
                capabilities[key] = false;
            }
        }

        const requestedFeatures = requested.features
            ? [...new Set(requested.features)]
            : [...(base.features || hostPolicy.features || [])];
        const parentFeatures = parentContext?.features || null;
        const allowedHostFeatures = hostPolicy.features || [];
        const features = requestedFeatures.filter(feature =>
            (allowedHostFeatures.includes("*") || allowedHostFeatures.includes(feature))
            && (!parentFeatures || parentFeatures.includes("*") || parentFeatures.includes(feature))
        );

        return Object.freeze({
            ...hostPolicy,
            ...base,
            ...requested,
            host,
            surface: requested.surface || base.surface || (host === "settings-frame" ? "settings" : "application"),
            presentation: requested.presentation || base.presentation || hostPolicy.presentation || "application",
            features: Object.freeze(features),
            capabilities: Object.freeze(capabilities),
            options: Object.freeze({ ...(hostPolicy.options || {}), ...(base.options || {}), ...(requested.options || {}) }),
            parent: parentContext
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
