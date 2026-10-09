/* Pure calculations for rendering trip and total goal state. */
(function (root) {
    "use strict";

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

    function countedPercent(detail) {
        return Number(detail?.summary?.total?.countedPercent);
    }

    root.ClockTimerTripGoalModel = Object.freeze({
        selectGoal,
        labelDescriptor,
        remainingMilliseconds,
        remainingOutcome,
        countedPercent
    });
})(globalThis);
