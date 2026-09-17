from pathlib import Path
import sys


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 occurrence, found {count}")
    return text.replace(old, new, 1)


def replace_in_region(text, start_marker, end_marker, old, new, label):
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f"{label}: start marker not found")
    end = text.find(end_marker, start + len(start_marker))
    if end < 0:
        raise SystemExit(f"{label}: end marker not found")
    region = text[start:end]
    count = region.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 occurrence in region, found {count}")
    region = region.replace(old, new, 1)
    return text[:start] + region + text[end:]


def patch_ui():
    app_path = Path("app.js")
    css_path = Path("app.css")
    app = app_path.read_text()
    css = css_path.read_text()

    app = replace_once(
        app,
        "    const tripFieldAttentionAnimations = new WeakMap();\n    const settingsHelpRevealTimers = new WeakMap();",
        "    const tripFieldAttentionAnimations = new WeakMap();\n    const dialogCloseTimers = new WeakMap();\n    const settingsHelpRevealTimers = new WeakMap();",
        "dialog close timer state"
    )

    old_dialogs = '''    function openDialogElement(dialog, { duration = 250, reason = "user" } = {}) {
        if (!dialog || dialog.open) return false;
        const proceed = emitUIEvent(dialog, "opening", { reason, duration }, true);
        if (!proceed) return false;
        dialog.style.setProperty("--app-dialog-transition-duration", `${duration}ms`);
        dialog.showModal();
        setTimeout(() => {
            if (!dialog.open) return;
            dialog.style.setProperty("--app-dialog-transition-duration", "250ms");
            emitUIEvent(dialog, "opened", { reason, duration });
        }, duration);
        return true;
    }

    function closeDialog(dialog, { reason = "user", immediate = false } = {}) {
        if (!dialog?.open) return false;
        const proceed = emitUIEvent(dialog, "closing", { reason, immediate }, true);
        if (!proceed) return false;
        if (immediate) dialog.style.setProperty("--app-dialog-transition-duration", "0ms");
        dialog.close();
        const duration = immediate ? 0 : 250;
        setTimeout(() => {
            dialog.style.setProperty("--app-dialog-transition-duration", "250ms");
            emitUIEvent(dialog, "closed", { reason, immediate });
        }, duration);
        return true;
    }
'''
    new_dialogs = '''    function openDialogElement(dialog, { duration = 250, reason = "user" } = {}) {
        if (
            !dialog ||
            dialog.open ||
            dialog.classList.contains("dialog-closing")
        ) return false;
        const proceed = emitUIEvent(dialog, "opening", { reason, duration }, true);
        if (!proceed) return false;
        dialog.style.setProperty("--app-dialog-transition-duration", `${duration}ms`);
        dialog.showModal();
        setTimeout(() => {
            if (!dialog.open || dialog.classList.contains("dialog-closing")) return;
            dialog.style.setProperty("--app-dialog-transition-duration", "250ms");
            emitUIEvent(dialog, "opened", { reason, duration });
        }, duration);
        return true;
    }

    function closeDialog(dialog, { reason = "user", immediate = false } = {}) {
        if (
            !dialog?.open ||
            dialog.classList.contains("dialog-closing")
        ) return false;
        const proceed = emitUIEvent(dialog, "closing", { reason, immediate }, true);
        if (!proceed) return false;

        const duration = immediate ? 0 : 250;

        const finishClose = () => {
            dialogCloseTimers.delete(dialog);
            dialog.style.setProperty("--app-dialog-transition-duration", "0ms");
            if (dialog.open) dialog.close();
            dialog.classList.remove("dialog-closing");
            requestAnimationFrame(() => {
                dialog.style.setProperty("--app-dialog-transition-duration", "250ms");
            });
            emitUIEvent(dialog, "closed", { reason, immediate });
        };

        if (duration === 0) {
            finishClose();
            return true;
        }

        dialog.style.setProperty("--app-dialog-transition-duration", `${duration}ms`);
        dialog.classList.add("dialog-closing");
        dialogCloseTimers.set(
            dialog,
            setTimeout(finishClose, duration)
        );
        return true;
    }
'''
    app = replace_once(app, old_dialogs, new_dialogs, "dialog close lifecycle")

    css = replace_once(
        css,
        '''.main-menu {
    width: min(430px, 74vw);''',
        '''.main-menu {
    position: fixed;
    inset: 60px auto auto 0;
    width: min(430px, 74vw);''',
        "stable main menu position"
    )

    css = replace_once(
        css,
        '''.main-menu:popover-open {
    position: fixed;
    inset: 60px auto auto 0;
}

''',
        "",
        "remove open-only main menu position"
    )

    css = replace_once(
        css,
        '''.app-dialog[open]::backdrop {
    opacity: 1;
}

@starting-style {''',
        '''.app-dialog[open]::backdrop {
    opacity: 1;
}

.app-dialog.dialog-closing,
.app-dialog.dialog-closing::backdrop {
    opacity: 0;
}

@starting-style {''',
        "dialog closing fade rule"
    )

    app_path.write_text(app)
    css_path.write_text(css.rstrip() + "\n")


def patch_goals():
    clock_path = Path("ClockTimer.js")
    app_path = Path("app.js")
    index_path = Path("index.html")
    clock = clock_path.read_text()
    app = app_path.read_text()
    index = index_path.read_text()

    clock = replace_once(
        clock,
        '''        #autoSyncTripGoal =
            false;

        #tripGoalMissedState =''',
        '''        #autoSyncTripGoal =
            false;

        #matchedTripGoal;

        #tripGoalMissedState =''',
        "matched trip goal field"
    )

    clock = replace_once(
        clock,
        '''            if (
                !this.hasAttribute(
                    "trip-goal"
                )
            ) {
                this.setAttribute(
                    "trip-goal",
                    "100%"
                );
            }

''',
        "",
        "do not materialize default trip goal attribute"
    )

    clock = replace_once(
        clock,
        '''        #getTripGoal() {
            return this.#parseGoalValue(
                this.getAttribute(
                    "trip-goal"
                ),
                1
            );
        }

        #getTotalGoal() {
            if (
                !this.hasAttribute(
                    "total-goal"
                )
            ) {
                return undefined;
            }

            return this.#parseGoalValue(
                this.getAttribute(
                    "total-goal"
                ),
                1
            );
        }
''',
        '''        #getUserTripGoal() {
            return this.#parseGoalValue(
                this.getAttribute(
                    "trip-goal"
                ),
                1
            );
        }

        #getTripGoal() {
            if (
                this.#autoSyncTripGoal &&
                Number.isFinite(this.#matchedTripGoal) &&
                this.#matchedTripGoal > 0
            ) {
                return this.#matchedTripGoal;
            }

            return this.#getUserTripGoal();
        }

        #getTotalGoal() {
            return this.#parseGoalValue(
                this.getAttribute(
                    "total-goal"
                ),
                1
            );
        }
''',
        "separate user and matched goals"
    )

    clock = replace_once(
        clock,
        '''        set autoSyncTripGoal(value) {
            if (typeof value !== "boolean") {
                throw new TypeError(
                    "autoSyncTripGoal must be a boolean."
                );
            }

            this.#autoSyncTripGoal =
                value;
        }
''',
        '''        set autoSyncTripGoal(value) {
            if (typeof value !== "boolean") {
                throw new TypeError(
                    "autoSyncTripGoal must be a boolean."
                );
            }

            if (value === this.#autoSyncTripGoal) {
                return;
            }

            this.#autoSyncTripGoal =
                value;

            if (!value) {
                this.#matchedTripGoal =
                    undefined;
            }

            if (this.#hasStartProperties()) {
                this.#handleTripGoalChange(
                    "user"
                );
            }
        }
''',
        "auto sync setter recalculation"
    )

    old_set_match = '''        setTripGoalToTotalGoal() {
            const reason =
                this.#getTotalGoalRequirementFailureReason();

            if (reason) {
                return this.#goalChangeFailure(reason);
            }

            const requirements =
                this.#calculateTotalGoalRequirements();

            if (
                !Number.isFinite(requirements.tripGoal) ||
                requirements.tripGoal <= 0
            ) {
                return this.#goalChangeFailure("insufficient-time");
            }

            const previousSemanticGoalSetSource =
                this.#semanticGoalSetSource;

            this.#semanticGoalSetSource =
                this.#renderedPercentGoalSourceOverride === "start"
                    ? "start"
                    : "automatic-total";

            try {
                this.setAttribute(
                    "trip-goal",
                    `${requirements.tripGoal * 100}%`
                );
            }
            finally {
                this.#semanticGoalSetSource =
                    previousSemanticGoalSetSource;
            }

            return {
                applied: true,
                connected:
                    this.#connectionState ===
                        "connected",
                ...requirements,
                reason: null
            };
        }
'''
    new_set_match = '''        setTripGoalToTotalGoal() {
            const reason =
                this.#getTotalGoalRequirementFailureReason();

            if (reason) {
                return this.#goalChangeFailure(reason);
            }

            const requirements =
                this.#calculateTotalGoalRequirements({
                    allowMissed: true
                });

            if (
                !Number.isFinite(requirements.tripGoal) ||
                requirements.tripGoal <= 0
            ) {
                return this.#goalChangeFailure("insufficient-time");
            }

            const previousMatchedTripGoal =
                this.#matchedTripGoal;

            this.#matchedTripGoal =
                requirements.tripGoal;

            this.#handleTripGoalChange(
                this.#renderedPercentGoalSourceOverride === "start"
                    ? "start"
                    : "automatic"
            );

            if (
                previousMatchedTripGoal !==
                    this.#matchedTripGoal
            ) {
                this.#emitClockTimerEvent(
                    "tripGoalAutomaticallySet",
                    {
                        previousValue:
                            Number.isFinite(previousMatchedTripGoal)
                                ? `${previousMatchedTripGoal * 100}%`
                                : null,
                        value:
                            `${this.#matchedTripGoal * 100}%`,
                        tripGoal:
                            this.#getTripGoal(),
                        userTripGoal:
                            this.#getUserTripGoal(),
                        matchedTripGoal:
                            this.#matchedTripGoal,
                        totalGoal:
                            this.#getTotalGoal(),
                        source:
                            "automatic-total",
                        userInitiated:
                            false
                    }
                );
            }

            return {
                applied: true,
                connected:
                    this.#connectionState ===
                        "connected",
                ...requirements,
                reason: null
            };
        }
'''
    clock = replace_once(clock, old_set_match, new_set_match, "temporary match setter")

    # The matched value belongs only to a running trip. Recalculate it before
    # choosing the rendered goal so interval/standard/total-goal changes stay live.
    handle_marker = '''        #handleTripGoalChange(
            source =
                this.#renderedPercentGoalSourceOverride ??
                "automatic"
        ) {

            const goal ='''
    handle_replacement = '''        #refreshMatchedTripGoal() {
            const previous =
                this.#matchedTripGoal;

            let next;

            if (
                this.#autoSyncTripGoal &&
                this.#started &&
                this.#hasStartProperties()
            ) {
                const requirements =
                    this.#calculateTotalGoalRequirements({
                        allowMissed: true
                    });

                if (
                    Number.isFinite(requirements.tripGoal) &&
                    requirements.tripGoal > 0
                ) {
                    next =
                        requirements.tripGoal;
                }
            }

            this.#matchedTripGoal =
                next;

            return previous !== next;
        }

        #handleTripGoalChange(
            source =
                this.#renderedPercentGoalSourceOverride ??
                "automatic"
        ) {

            this.#refreshMatchedTripGoal();

            const goal ='''
    clock = replace_once(clock, handle_marker, handle_replacement, "refresh matched goal before render")

    # Keep explicit Trip/Total modes on their selected goal after its deadline.
    clock = replace_once(
        clock,
        "        #calculateTripGoalRequirements() {",
        "        #calculateTripGoalRequirements({ allowMissed = false } = {}) {",
        "trip requirements options"
    )
    clock = replace_in_region(
        clock,
        "        #calculateTripGoalRequirements({ allowMissed = false } = {}) {",
        "        #getTotalGoalRequirementFailureReason() {",
        "            if (this.#started) {",
        "            if (this.#started && !allowMissed) {",
        "trip missed-goal behavior"
    )

    clock = replace_once(
        clock,
        "        #calculateTotalGoalRequirements() {",
        "        #calculateTotalGoalRequirements({ allowMissed = false } = {}) {",
        "total requirements options"
    )
    clock = replace_in_region(
        clock,
        "        #calculateTotalGoalRequirements({ allowMissed = false } = {}) {",
        "        #getAutoGoalSelection() {",
        '''            if (
                Number.isFinite(now) &&
                Number.isFinite(adjustedEndTimeline) &&
                adjustedEndTimeline < now
            ) {''',
        '''            if (
                !allowMissed &&
                Number.isFinite(now) &&
                Number.isFinite(adjustedEndTimeline) &&
                adjustedEndTimeline < now
            ) {''',
        "total missed-goal behavior"
    )

    clock = replace_once(
        clock,
        '''            if (
                !this.hasAttribute("total-goal") ||
                !Number.isFinite(totalGoal) ||
                totalGoal <= 0
            ) {
                return "missing-total-goal";
            }
''',
        '''            if (
                !Number.isFinite(totalGoal) ||
                totalGoal <= 0
            ) {
                return "missing-total-goal";
            }
''',
        "default total goal requirement"
    )

    clock = replace_once(
        clock,
        '''                !this.hasAttribute("total-goal") ||
                !Number.isFinite(totalGoal) ||''',
        '''                !Number.isFinite(totalGoal) ||''',
        "default total goal calculation"
    )

    clock = replace_once(
        clock,
        '''                !this.hasAttribute(
                    "total-goal"
                ) ||
                !Number.isFinite(totalGoal) ||''',
        '''                !Number.isFinite(totalGoal) ||''',
        "default total goal impossibility"
    )

    clock = replace_once(
        clock,
        '''            const totalMissed = this.hasAttribute("total-goal") &&
                Number.isFinite(totalDeadline) && now > totalDeadline;''',
        '''            const totalGoalActive =
                this.#percentMode === "total" ||
                this.#autoSyncTripGoal ||
                this.hasAttribute("total-goal");

            const totalMissed = totalGoalActive &&
                Number.isFinite(totalDeadline) && now > totalDeadline;''',
        "default total goal miss state"
    )

    clock = replace_once(
        clock,
        '''        #canSelectTotalMode() {
            return (
                this.hasAttribute(
                    "total-goal"
                ) &&
                this.#hasUsableAggregateSnapshot()
            );
        }
''',
        '''        #canSelectTotalMode() {
            return this.#hasUsableAggregateSnapshot();
        }
''',
        "total mode default availability"
    )

    clock = replace_in_region(
        clock,
        "        #getAutoGoalSelection() {",
        "        #calculateGoalRequirements() {",
        '''            const totalRequirements =
                this.#calculateTotalGoalRequirements();''',
        '''            const totalRequirements =
                this.hasAttribute("total-goal")
                    ? this.#calculateTotalGoalRequirements()
                    : this.#emptyGoalRequirements();''',
        "auto ignores unspecified total default"
    )
    clock = replace_in_region(
        clock,
        "        #getAutoGoalSelection() {",
        "        #calculateGoalRequirements() {",
        '''            const tripScope =
                this.hasAttribute("trip-goal")
                    ? "trip"
                    : "standard";''',
        '''            const tripScope =
                (
                    this.#autoSyncTripGoal &&
                    Number.isFinite(this.#matchedTripGoal) &&
                    this.#matchedTripGoal > 0
                ) ||
                this.hasAttribute("trip-goal")
                    ? "trip"
                    : "standard";''',
        "auto standard versus matched trip scope"
    )

    clock = replace_in_region(
        clock,
        "        #calculateRenderedPercentGoal() {",
        "        #parseInsertDateTime(",
        '''                requirements =
                    this.#calculateTripGoalRequirements();''',
        '''                requirements =
                    this.#calculateTripGoalRequirements({
                        allowMissed: true
                    });''',
        "manual trip rendering"
    )
    clock = replace_in_region(
        clock,
        "        #calculateRenderedPercentGoal() {",
        "        #parseInsertDateTime(",
        '''                requirements =
                    this.#calculateTotalGoalRequirements();''',
        '''                requirements =
                    this.#calculateTotalGoalRequirements({
                        allowMissed: true
                    });''',
        "manual total rendering"
    )

    # Stop and clear only discard the temporary match, never the user's attribute.
    clock = replace_once(
        clock,
        '''            const localResult = this.#stopLocal(stopTime);
            if (!localResult || !persistedEnd) {
                throw new Error("The trip could not be stopped.");
            }
            this.#pendingIntervalRecord = undefined;''',
        '''            const localResult = this.#stopLocal(stopTime);
            if (!localResult || !persistedEnd) {
                throw new Error("The trip could not be stopped.");
            }
            this.#matchedTripGoal = undefined;
            this.#handleTripGoalChange("automatic");
            this.#pendingIntervalRecord = undefined;''',
        "discard matched goal on trip end"
    )

    clock = replace_once(
        clock,
        '''            this.#started =
                false;

            if (!this.#preserveInsertedOnClear) {''',
        '''            this.#started =
                false;

            this.#matchedTripGoal =
                undefined;

            if (!this.#preserveInsertedOnClear) {''',
        "discard matched goal on clear"
    )

    # User-facing goal values are always defined; absence means the 100% default.
    app = replace_once(
        app,
        '''        if (!clockTimer.hasAttribute(attribute)) {
            return "Not set";
        }

        return formatSummaryPercent(
            parsePercentGoalAttribute(
                clockTimer.getAttribute(attribute)
            ),
            "Not set"
        );''',
        '''        if (!clockTimer.hasAttribute(attribute)) {
            return "100%";
        }

        return formatSummaryPercent(
            parsePercentGoalAttribute(
                clockTimer.getAttribute(attribute)
            ),
            "100%"
        );''',
        "default goal popup display"
    )

    # Auto's plain standard fallback is still the current trip's standard time.
    app = replace_once(
        app,
        '''        if (selectedScope === "standard") {
            standardLabel.textContent =
                "Standard Time";''',
        '''        if (selectedScope === "standard") {
            standardLabel.textContent =
                "Trip Standard Time";''',
        "auto standard label scope"
    )

    old_standard_value = '''        const standard =
            selected?.standardTime ||
            (
                scope !== "total"
                    ? (
                        clockTimer.standardTime ||
                        stagedStandardTime
                    )
                    : undefined
            );'''
    new_standard_value = '''        const standard =
            scope === "standard"
                ? (
                    snapshot?.trip?.standardTime ||
                    clockTimer.standardTime ||
                    stagedStandardTime
                )
                : selected?.standardTime ||
                    (
                        scope !== "total"
                            ? (
                                clockTimer.standardTime ||
                                stagedStandardTime
                            )
                            : undefined
                    );'''
    app = replace_once(app, old_standard_value, new_standard_value, "auto standard value uses trip")

    index = replace_once(
        index,
        '<strong id="autoTripGoalValue">Not set</strong>',
        '<strong id="autoTripGoalValue">100%</strong>',
        "trip goal initial default"
    )
    index = replace_once(
        index,
        '<strong id="autoTotalGoalValue">Not set</strong>',
        '<strong id="autoTotalGoalValue">100%</strong>',
        "total goal initial default"
    )

    clock_path.write_text(clock)
    app_path.write_text(app)
    index_path.write_text(index)


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in {"ui", "goals"}:
        raise SystemExit("usage: apply_pending_fixes.py ui|goals")
    if sys.argv[1] == "ui":
        patch_ui()
    else:
        patch_goals()
