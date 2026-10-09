/* Preserves the minimum visible duration of initial connection status. */
(function (root) {
    "use strict";

    async function settle(state, preparationPromise, {
        minimumDuration = 1000,
        now = () => root.performance.now(),
        wait = milliseconds => new Promise(resolve => root.setTimeout(resolve, milliseconds)),
        updateStatus = () => {},
        normalizedStatus = () => "offline"
    } = {}) {
        const startedAt = Number.isFinite(state?.connectionAnimationStartedAt)
            ? state.connectionAnimationStartedAt : now();
        void Promise.resolve(preparationPromise).catch(() => {});
        const remaining = minimumDuration - (now() - startedAt);
        if (remaining > 0) await wait(remaining);
        updateStatus(
            state?.connectionStatusToken,
            normalizedStatus(),
            { presentation: "initial-cloud" }
        );
    }

    root.ClockTimerConnectionNumberPadSettlement = Object.freeze({ settle });
})(globalThis);
