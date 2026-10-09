/* Page/feature policy manifest. Context inference consumes this contract instead of hardcoding host behavior. */
(function (root) {
    "use strict";

    const restrictiveCapabilities = Object.freeze([
        "speechMenu", "speechRecognition", "audioAnnouncements",
        "loginFlow", "calendarStartup", "liveStream"
    ]);
    const hosts = Object.freeze({
        "order-filler": Object.freeze({
            presentation: "application",
            features: Object.freeze(["application", "settings", "calendarStartup"]),
            capabilities: Object.freeze({})
        }),
        "drop-in": Object.freeze({
            presentation: "application",
            features: Object.freeze(["drop-in", "settings"]),
            capabilities: Object.freeze({})
        }),
        "settings-frame": Object.freeze({
            presentation: "graphical-settings",
            features: Object.freeze(["settings"]),
            capabilities: Object.freeze({
                speechMenu: false,
                speechRecognition: false,
                audioAnnouncements: false,
                loginFlow: false,
                calendarStartup: false,
                liveStream: false
            })
        })
    });

    function resolve(host) {
        const key = Object.prototype.hasOwnProperty.call(hosts, host) ? host : "order-filler";
        const policy = hosts[key];
        return {
            host: key,
            presentation: policy.presentation,
            features: [...policy.features],
            capabilities: { ...policy.capabilities },
            options: {}
        };
    }

    function permitsFeature(context, feature) {
        return Array.isArray(context?.features) && context.features.includes(feature);
    }

    function permitsCapability(context, capability) {
        return context?.capabilities?.[capability] !== false;
    }

    root.ClockTimerPageManifest = Object.freeze({
        hosts,
        restrictiveCapabilities,
        resolve,
        permitsFeature,
        permitsCapability
    });
})(globalThis);
