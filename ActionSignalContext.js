/* Resolves the active cancellation signal across action and state transactions. */
(function (root) {
    "use strict";

    function currentSignal(actionFunctions, stateTransactions) {
        return actionFunctions?.invocationContext?.signal
            || stateTransactions?.current?.signal;
    }

    root.ClockTimerActionSignalContext = Object.freeze({currentSignal});
})(globalThis);
