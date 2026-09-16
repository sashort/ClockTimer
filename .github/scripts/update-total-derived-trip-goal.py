from pathlib import Path

clock_path = Path("ClockTimer.js")
clock = clock_path.read_text()

public_marker = '''        calculateTotalGoalRequirements() {
            return {
                ...this.#calculateTotalGoalRequirements()
            };
        }
'''

public_insert = '''        calculateTripGoalFromTotal(
            standardTime = this.#standardTime
        ) {
            let standardDuration =
                this.#standardDuration;

            if (
                standardTime !== this.#standardTime ||
                !Number.isFinite(standardDuration)
            ) {
                try {
                    standardDuration =
                        this.#validateDurationTime(
                            standardTime,
                            "standardTime"
                        ).total;
                }
                catch {
                    return null;
                }
            }

            const result =
                this.#calculateTripGoalFromTotalDuration(
                    standardDuration
                );

            return Number.isFinite(result.tripGoal)
                ? result.tripGoal
                : null;
        }

''' + public_marker

if clock.count(public_marker) != 1:
    raise SystemExit(f"Expected one public calculateTotalGoalRequirements block, found {clock.count(public_marker)}")
clock = clock.replace(public_marker, public_insert, 1)

private_start = clock.index("        #calculateTotalGoalRequirements() {")
private_end = clock.index("\n\n        #calculateGoalRequirements() {", private_start)
private_block = '''        #calculateTripGoalFromTotalDuration(
            standardDuration = this.#standardDuration
        ) {
            const empty = {
                tripGoal: null,
                adjustedTimeElapsed: null
            };

            const totalGoal =
                this.#getTotalGoal();

            const totals =
                this.#tripTotals;

            if (
                !this.hasAttribute("total-goal") ||
                !Number.isFinite(totalGoal) ||
                totalGoal <= 0 ||
                !totals ||
                !Number.isFinite(
                    totals.standardTimeMilliseconds
                ) ||
                !Number.isFinite(
                    totals.actualTimeMilliseconds
                ) ||
                !Number.isFinite(standardDuration) ||
                standardDuration <= 0
            ) {
                return empty;
            }

            const combinedStandard =
                totals.standardTimeMilliseconds +
                standardDuration;

            const targetCombinedActual =
                combinedStandard /
                totalGoal;

            const targetAdjustedTimeElapsed =
                targetCombinedActual -
                totals.actualTimeMilliseconds;

            if (
                !Number.isFinite(targetAdjustedTimeElapsed) ||
                targetAdjustedTimeElapsed <= 0
            ) {
                return empty;
            }

            const rawTripGoal =
                standardDuration /
                targetAdjustedTimeElapsed;

            if (
                !Number.isFinite(rawTripGoal) ||
                rawTripGoal <= 0
            ) {
                return empty;
            }

            const tripGoal =
                Math.ceil(
                    rawTripGoal * 100 - 1e-9
                ) / 100;

            const adjustedTimeElapsed =
                standardDuration /
                tripGoal;

            if (
                !Number.isFinite(adjustedTimeElapsed) ||
                adjustedTimeElapsed <= 0
            ) {
                return empty;
            }

            return {
                tripGoal,
                adjustedTimeElapsed
            };
        }

        #calculateTotalGoalRequirements() {
            const empty =
                this.#emptyGoalRequirements();

            if (
                !Number.isFinite(
                    this.#scheduledStartMilliseconds
                )
            ) {
                return empty;
            }

            const calculated =
                this.#calculateTripGoalFromTotalDuration();

            if (
                !Number.isFinite(calculated.tripGoal) ||
                calculated.tripGoal <= 0 ||
                !Number.isFinite(
                    calculated.adjustedTimeElapsed
                ) ||
                calculated.adjustedTimeElapsed <= 0
            ) {
                return empty;
            }

            const requirements =
                this.#requirementsFromAdjustedTime(
                    calculated.adjustedTimeElapsed,
                    calculated.tripGoal
                );

            if (
                !Number.isFinite(
                    requirements.tripGoal
                )
            ) {
                return empty;
            }

            const adjustedEndTimeline =
                this.#calculateAdjustedEndTimeline(
                    calculated.adjustedTimeElapsed
                );

            const now =
                this.#started
                    ? this.#getCurrentTimelineTime()
                    : undefined;

            if (
                Number.isFinite(now) &&
                Number.isFinite(adjustedEndTimeline) &&
                adjustedEndTimeline < now
            ) {
                return empty;
            }

            return requirements;
        }'''
clock = clock[:private_start] + private_block + clock[private_end:]
clock_path.write_text(clock)

app_path = Path("app.js")
app = app_path.read_text()

refresh_marker = '''    function refreshTripSettingsValues() {
'''
helper = '''    function getTripSettingsDerivedTotalGoalPercent(values) {
        if (clockTimer.hasAggregateData !== true) return undefined;
        const standardTime = String(values?.standardTime || "").trim();
        if (!standardTime) return undefined;
        const goal = Number(
            clockTimer.calculateTripGoalFromTotal?.(
                standardTime
            )
        );
        if (!Number.isFinite(goal) || goal <= 0) return undefined;
        return Math.round(goal * 100);
    }

'''
if app.count(refresh_marker) != 1:
    raise SystemExit(f"Expected one refreshTripSettingsValues marker, found {app.count(refresh_marker)}")
app = app.replace(refresh_marker, helper + refresh_marker, 1)

old_status = '''        const aggregateGoalAvailable = clockTimer.hasAggregateData === true;
        const selectedGoalSync = settingsValues
            ? Boolean(settingsValues.matchTripGoalToTotal)
            : Boolean(getTripPreferences().matchTripGoalToTotal);
        autoSyncTripGoal.disabled = !aggregateGoalAvailable || !preferencesVisible;
        autoSyncTripGoal.checked = selectedGoalSync;
        tripGoalSyncOption.classList.toggle("is-unavailable", !aggregateGoalAvailable);
        tripGoalSyncNoData.hidden = aggregateGoalAvailable;
'''
new_status = '''        const aggregateGoalAvailable = clockTimer.hasAggregateData === true;
        const derivedTotalGoalPercent =
            getTripSettingsDerivedTotalGoalPercent(
                settingsValues
            );
        const selectedGoalSync = settingsValues
            ? Boolean(settingsValues.matchTripGoalToTotal)
            : Boolean(getTripPreferences().matchTripGoalToTotal);
        autoSyncTripGoal.disabled = !aggregateGoalAvailable || !preferencesVisible;
        autoSyncTripGoal.checked = selectedGoalSync;
        tripGoalSyncOption.classList.toggle("is-unavailable", !aggregateGoalAvailable);
        if (!aggregateGoalAvailable) {
            tripGoalSyncNoData.textContent = "(No Data)";
            tripGoalSyncNoData.hidden = false;
        }
        else if (Number.isFinite(derivedTotalGoalPercent)) {
            tripGoalSyncNoData.textContent = `(${derivedTotalGoalPercent}%)`;
            tripGoalSyncNoData.hidden = false;
        }
        else {
            tripGoalSyncNoData.textContent = "";
            tripGoalSyncNoData.hidden = true;
        }
'''
if app.count(old_status) != 1:
    raise SystemExit(f"Expected one aggregate status block, found {app.count(old_status)}")
app = app.replace(old_status, new_status, 1)

replacements = {
'''                    values.creationTime = value;
                    values.creationDate = state.pendingDate;
                    return true;
''': '''                    values.creationTime = value;
                    values.creationDate = state.pendingDate;
                    refreshTripSettingsValues();
                    return true;
''',
'''                    values.scheduledStart = value;
                    return true;
''': '''                    values.scheduledStart = value;
                    refreshTripSettingsValues();
                    return true;
''',
'''                values.startTime = value;
                return true;
''': '''                values.startTime = value;
                refreshTripSettingsValues();
                return true;
''',
'''            tripSettingsSession.values.standardTime = formatted;
            return true;
''': '''            tripSettingsSession.values.standardTime = formatted;
            refreshTripSettingsValues();
            return true;
'''
}
for old, new in replacements.items():
    count = app.count(old)
    if count != 1:
        raise SystemExit(f"Expected one staged value block, found {count} for {old!r}")
    app = app.replace(old, new, 1)

app_path.write_text(app)
