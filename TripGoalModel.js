/* Pure calculations for rendering trip and total goal state. */
(function (root) {
    "use strict";

    const percentModes = Object.freeze(["trip", "total", "auto"]);

    function selectGoal(detail) {
        const summary = detail?.summary;
        const scope = String(summary?.scope || "").toLowerCase();
        const selected = summary?.selected || (scope === "total" ? summary?.total : summary?.trip);
        return { scope, selected };
    }

    function labelDescriptor(detail) {
        const { scope, selected } = selectGoal(detail);
        const percentGoal = Number(selected?.percentGoal);
        const roundedPercent = Number.isFinite(percentGoal)
            ? Math.round(percentGoal * 100)
            : undefined;

        if (scope === "standard" || roundedPercent === 100) {
            return { kind: "standard", scope, percent: roundedPercent };
        }
        if (!Number.isFinite(roundedPercent)) {
            return { kind: "empty", scope, percent: undefined };
        }
        return { kind: "percent", scope, percent: roundedPercent };
    }

    function remainingMilliseconds(detail) {
        const { selected } = selectGoal(detail);
        const standard = Number(selected?.standardTimeMilliseconds);
        const counted = Number(selected?.countedTimeElapsedMilliseconds);
        const percentGoal = Number(selected?.percentGoal);
        const allowanceCredit = Number(selected?.allowanceCreditMilliseconds ?? 0);

        if (!Number.isFinite(standard) || !Number.isFinite(counted)
            || !Number.isFinite(percentGoal) || percentGoal <= 0) {
            return undefined;
        }

        return Math.round(standard / percentGoal
            + (Number.isFinite(allowanceCredit) ? allowanceCredit : 0)
            - counted);
    }

    function remainingOutcome(remaining) {
        if (!Number.isFinite(remaining)) return "unknown";
        if (remaining > 0) return "banked";
        if (remaining < 0) return "over";
        return "on-target";
    }

    function remainingDescriptor(detail) {
        const remaining = remainingMilliseconds(detail);
        const outcome = remainingOutcome(remaining);
        return {
            remaining,
            outcome,
            magnitude: Number.isFinite(remaining) ? Math.abs(remaining) : undefined
        };
    }

    function normalizePercentMode(value) {
        const normalized = String(value || "trip").trim().toLowerCase();
        return percentModes.includes(normalized) ? normalized : "trip";
    }

    function fallbackScope(percentMode) {
        return percentMode === "total" ? "total" : percentMode === "auto" ? "standard" : "trip";
    }

    function syncRuntimeState({ connectionStatus, syncGoalsEnabled, tripLive, requirements } = {}) {
        if (connectionStatus === "offline") return "offline";
        if (!syncGoalsEnabled) return "off";
        if (!tripLive) return "ready";

        const tripGoal = Number(requirements?.tripGoal);
        const adjustedTimeElapsed = Number(requirements?.adjustedTimeElapsed);
        return Number.isFinite(tripGoal) && tripGoal > 0
            && Number.isFinite(adjustedTimeElapsed) && adjustedTimeElapsed > 0
            ? "active"
            : "time-blocked";
    }

    function currentCalculatedSyncGoal(requirements, calculatedTripGoal) {
        const requiredGoal = Number(requirements?.tripGoal);
        if (Number.isFinite(requiredGoal) && requiredGoal > 0) return requiredGoal;

        const calculatedGoal = Number(calculatedTripGoal);
        return Number.isFinite(calculatedGoal) && calculatedGoal > 0
            ? calculatedGoal
            : undefined;
    }

    function syncGoalMatches(left, right) {
        return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 1e-9;
    }

    function countedPercent(detail) {
        return Number(detail?.summary?.total?.countedPercent);
    }

    function formatSummaryPercent(value, fallback = "---") {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? `${Math.round(numeric * 100)}%` : fallback;
    }

    function formatActualPercent(value, fallback = "---") {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? `${(numeric * 100).toFixed(2)}%` : fallback;
    }

    root.ClockTimerTripGoalModel = Object.freeze({
        percentModes,
        selectGoal,
        labelDescriptor,
        remainingMilliseconds,
        remainingOutcome,
        remainingDescriptor,
        countedPercent,
        normalizePercentMode,
        fallbackScope,
        syncRuntimeState,
        currentCalculatedSyncGoal,
        syncGoalMatches,
        formatSummaryPercent,
        formatActualPercent
    });
})(globalThis);
