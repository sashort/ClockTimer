/* Reads connection-state tokens from a number-pad's current UI state. */
(function (root) {
    "use strict";

    function state(currentState, returnFrame) {
        return currentState ?? returnFrame?.state;
    }

    function token(currentState, returnFrame) {
        return state(currentState, returnFrame)?.connectionStatusToken;
    }

    root.ClockTimerConnectionNumberPadState = Object.freeze({ state, token });
})(globalThis);
