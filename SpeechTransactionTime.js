/* Resolves the speech utterance timestamp used by clock state transactions. */
(function (root) {
    "use strict";

    function fromExecutionContext(context) {
        const value = context?.utteranceStartedAt;
        if (!value) return undefined;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? undefined : date;
    }

    root.ClockTimerSpeechTransactionTime = Object.freeze({fromExecutionContext});
})(globalThis);
