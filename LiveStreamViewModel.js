/* Pure projection from a live-stream snapshot to the remote status labels. */
(function (root) {
    "use strict";

    function text(value, fallback = "—") {
        return value === null || value === undefined || value === ""
            ? fallback
            : String(value);
    }

    function project(snapshot) {
        const state = snapshot?.uiState || snapshot || {};
        const current = state.current_percent_component?.text
            || state.currentPercentComponent?.text;
        const goal = state.goal_component?.text || state.goalComponent?.text;
        return Object.freeze({
            state: text(state.state).replaceAll("_", " "),
            time: text(state.time_component?.text || state.timeComponent?.text),
            goal: current && goal ? String(current) + " / " + String(goal)
                : text(current || goal)
        });
    }

    root.ClockTimerLiveStreamViewModel = Object.freeze({ project });
})(globalThis);
