/* Pure connection-status normalization for connection/cloud UI. */
(function (root) {
    "use strict";

    function normalize(status) {
        return status === "online" ? "online" : "offline";
    }

    function visualStatus(status, cloudPhase) {
        if (cloudPhase === "retry" || cloudPhase === "awaiting-login" || status === "pending") {
            return "pending";
        }
        return normalize(status);
    }

    root.ClockTimerConnectionStatusModel = Object.freeze({normalize, visualStatus});
})(globalThis);
