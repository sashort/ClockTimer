/* Orchestrates the settling/finalized phases of the connection cloud transition. */
(function (root) {
    "use strict";

    function settle({
        status, token, sequence, currentSequence,
        previousTimer, clearTimer = root.clearTimeout,
        schedule = root.setTimeout, duration = 750,
        normalize = value => value,
        setPhase = () => {}, updateNumberPad = () => {},
        getNumberPadState = () => undefined,
        syncTripSettings = () => {}, syncScope = () => {},
        syncNetwork = () => {}, setTimer = () => {}
    } = {}) {
        if (previousTimer !== undefined) clearTimer(previousTimer);
        setTimer(undefined);
        if (sequence !== currentSequence()) return undefined;
        const normalized = normalize(status);
        setPhase("settling");
        if (token) updateNumberPad(token, normalized, { presentation: "cloud-fade" });
        syncTripSettings(normalized);
        syncScope(normalized);
        syncNetwork();
        return schedule(() => {
            if (sequence !== currentSequence()) return;
            setTimer(undefined);
            setPhase("settled");
            const state = getNumberPadState();
            if (state && state.connectionStatusToken === token
                && state.connectionPresentation === "cloud-fade") {
                updateNumberPad(token, normalized, { presentation: "settled" });
            }
            syncTripSettings(normalized);
            syncScope(normalized);
        }, duration);
    }

    root.ClockTimerConnectionCloudSettlement = Object.freeze({ settle });
})(globalThis);
