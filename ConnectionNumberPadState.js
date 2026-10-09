/* Reads connection-state tokens from a number-pad's current UI state. */
(function (root) {
    "use strict";

    function state(currentState, returnFrames) {
        return currentState ?? returnFrames?.find?.(frame => frame?.type === "number-pad")?.state;
    }

    function token(currentState, returnFrames) {
        return state(currentState, returnFrames)?.connectionStatusToken;
    }

    root.ClockTimerConnectionNumberPadState = Object.freeze({ state, token });
})(globalThis);
