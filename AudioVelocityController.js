/* Applies a master-velocity adjustment while constraining speech velocity. */
(function (root) {
    "use strict";

    function shift(settings, value, {
        masterMinimum = 0.5,
        masterMaximum = 4,
        speechMinimum = 0.5,
        speechMaximum = 2.8
    } = {}) {
        const next = Math.max(masterMinimum, Math.min(masterMaximum, Number(value)));
        if (!Number.isFinite(next)) return false;
        const delta = next - settings.masterVelocity;
        settings.masterVelocity = next;
        settings.speechVelocity = Math.max(
            speechMinimum,
            Math.min(speechMaximum, settings.speechVelocity + delta)
        );
        return true;
    }

    root.WMOFAudioVelocityController = Object.freeze({ shift });
})(globalThis);
