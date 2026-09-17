from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


def sub_once(text, pattern, replacement, label, flags=0):
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return updated


root = Path('.')

# ClockTimer: keep explicit Trip/Total modes fixed, and expose the effective
# source used by Auto in summary snapshots.
clock_path = root / 'ClockTimer.js'
clock = clock_path.read_text()

auto_switch_pattern = re.compile(
    r'''\n\s*if\s*\(\s*this\.\#percentMode\s*===\s*"total"'''
    r'''(?:\s*&&\s*!this\.\#canSelectTotalMode\(\))?\s*\)\s*\{'''
    r'''\s*this\.\#setPercentModeAutomatically\(\s*"trip"\s*,'''
    r'''\s*"total-aggregate-unavailable"'''
    r'''(?:\s*,\s*\{\s*recalculate:\s*false\s*\})?\s*\);'''
    r'''\s*(?:return;\s*)?\}''',
    re.S
)
clock, removed_switches = auto_switch_pattern.subn('', clock)
if removed_switches != 4:
    raise SystemExit(
        f"explicit percent modes: expected 4 automatic switches, found {removed_switches}"
    )

clock = sub_once(
    clock,
    r'''        #calculateGoalRequirements\(\) \{.*?\n        \}\n\n        #normalizePercentMode''',
    '''        #getAutoGoalSelection() {
            const tripRequirements =
                this.#calculateTripGoalRequirements();

            const totalRequirements =
                this.#calculateTotalGoalRequirements();

            const tripTime =
                Number(
                    tripRequirements.adjustedTimeElapsed
                );

            const totalTime =
                Number(
                    totalRequirements.adjustedTimeElapsed
                );

            const tripValid =
                Number.isFinite(tripTime) &&
                tripTime > 0;

            const totalValid =
                Number.isFinite(totalTime) &&
                totalTime > 0;

            const tripScope =
                this.hasAttribute("trip-goal")
                    ? "trip"
                    : "standard";

            if (!tripValid) {
                return totalValid
                    ? {
                        scope: "total",
                        requirements: totalRequirements
                    }
                    : {
                        scope: "standard",
                        requirements:
                            this.#emptyGoalRequirements()
                    };
            }

            if (!totalValid) {
                return {
                    scope: tripScope,
                    requirements: tripRequirements
                };
            }

            if (totalTime < tripTime) {
                return {
                    scope: "total",
                    requirements: totalRequirements
                };
            }

            return {
                scope: tripScope,
                requirements: tripRequirements
            };
        }

        #calculateGoalRequirements() {
            return this.#getAutoGoalSelection()
                .requirements;
        }

        #getRenderedPercentScope() {
            if (this.#percentMode === "trip") {
                return "trip";
            }

            if (this.#percentMode === "total") {
                return "total";
            }

            return this.#getAutoGoalSelection()
                .scope;
        }

        #normalizePercentMode''',
    'auto goal selection',
    flags=re.S
)

clock = replace_once(
    clock,
    '''        get renderedPercentGoal() {
            return this.#renderedPercentGoal;
        }

        get renderedTimeMode() {''',
    '''        get renderedPercentGoal() {
            return this.#renderedPercentGoal;
        }

        get renderedPercentGoalScope() {
            return this.#getRenderedPercentScope();
        }

        get renderedTimeMode() {''',
    'rendered percent goal scope getter'
)

clock = replace_once(
    clock,
    '''            const total = this.#getTotalSummary(timelineNow, validNow);
            if (total) total.available = true;
            const scope = this.#percentMode === "total" && total ? "total" : "trip";

            return {
                now: new Date(validNow.getTime()),
                timestamp: validNow.getTime(),
                timelineMilliseconds: timelineNow,
                scope,
                renderedTimeMode: this.#renderedTimeMode,
                trip,
                total,
                selected: scope === "total" ? total : trip
            };''',
    '''            const total = this.#getTotalSummary(timelineNow, validNow);
            if (total) total.available = true;

            const scope =
                this.#getRenderedPercentScope();

            let selected;

            if (scope === "total") {
                selected = total;
            }
            else if (scope === "standard") {
                selected = {
                    ...trip,
                    percentGoal: 1
                };
            }
            else {
                selected = trip;
            }

            return {
                now: new Date(validNow.getTime()),
                timestamp: validNow.getTime(),
                timelineMilliseconds: timelineNow,
                scope,
                renderedTimeMode: this.#renderedTimeMode,
                trip,
                total,
                selected
            };''',
    'summary effective scope'
)

clock = replace_once(
    clock,
    '''                percentMode:
                    this.#percentMode
            };''',
    '''                percentMode:
                    this.#percentMode,
                renderedPercentGoalScope:
                    this.#getRenderedPercentScope()
            };''',
    'rendered goal event scope'
)

if 'this.#setPercentModeAutomatically(' in clock:
    raise SystemExit('automatic percent-mode switch call remains')

clock_path.write_text(clock.rstrip() + '\n')

# App: three-state mode button, Auto-aware summaries, and the goal chooser.
app_path = root / 'app.js'
app = app_path.read_text()

app = replace_once(
    app,
    '''    const RENDERED_TIME_MODES = ["remaining", "calculated-end", "elapsed"];
''',
    '''    const RENDERED_TIME_MODES = ["remaining", "calculated-end", "elapsed"];
    const PERCENT_MODES = ["trip", "total", "auto"];
''',
    'percent mode constants'
)

app = replace_once(
    app,
    '''    const tripLogButton = $("#tripLogButton");
    const activeTripControls = $("#activeTripControls");''',
    '''    const tripLogButton = $("#tripLogButton");
    const autoGoalDialog = $("#autoGoalDialog");
    const autoTripGoalValue = $("#autoTripGoalValue");
    const autoTotalGoalValue = $("#autoTotalGoalValue");
    const activeTripControls = $("#activeTripControls");''',
    'auto goal dialog refs'
)

app = sub_once(
    app,
    r'''    function syncScopeUI\(persist = false\) \{.*?\n    \}\n\n    function applyScope\(mode, persist = true\) \{.*?\n    \}''',
    '''    function normalizePercentMode(value) {
        const normalized =
            String(value || "trip")
                .trim()
                .toLowerCase();

        return PERCENT_MODES.includes(normalized)
            ? normalized
            : "trip";
    }

    function syncScopeUI(persist = false) {
        const actual =
            normalizePercentMode(
                clockTimer.percentMode
            );

        const label =
            actual === "total"
                ? "Total"
                : actual === "auto"
                    ? "Auto"
                    : "Trip";

        const button = $("#scopeToggle");
        button.textContent = label;
        button.dataset.percentMode = actual;
        button.setAttribute(
            "aria-label",
            `Percent mode: ${label}`
        );

        updateSummaryValues();

        if (persist) {
            safeStorageSet(
                STORAGE.percentMode,
                actual
            );
        }

        return actual;
    }

    function applyScope(mode, persist = true) {
        const requested =
            normalizePercentMode(mode);

        clockTimer.percentMode =
            requested;

        return syncScopeUI(persist);
    }''',
    'three-state scope UI',
    flags=re.S
)

app = replace_once(
    app,
    '''    function updateSummaryLabels() {
        const scope = clockTimer.percentMode === "total" ? "Total" : "Trip";
        const mode = clockTimer.renderedTimeMode;
        const suffix = mode === "elapsed" ? "Time Elapsed" : mode === "calculated-end" ? "End Time" : "Time Remaining";
        $("#standardTimeLabel").textContent = `${scope} Standard Time`;
        $("#renderedTimeLabel").textContent = `${scope} ${suffix}`;
    }
''',
    '''    function updateSummaryLabels(summary) {
        let snapshot = summary;

        if (!snapshot?.scope) {
            try {
                snapshot =
                    clockTimer.getSummarySnapshot?.(
                        new Date()
                    );
            }
            catch {
                snapshot = undefined;
            }
        }

        const mode =
            clockTimer.renderedTimeMode;

        const suffix =
            mode === "elapsed"
                ? "Time Elapsed"
                : mode === "calculated-end"
                    ? "End Time"
                    : "Time Remaining";

        const selectedScope =
            clockTimer.percentMode === "auto"
                ? snapshot?.scope ?? "standard"
                : clockTimer.percentMode === "total"
                    ? "total"
                    : "trip";

        const standardLabel =
            $("#standardTimeLabel");

        const renderedLabel =
            $("#renderedTimeLabel");

        standardLabel.classList.remove(
            "summary-label-responsive"
        );
        renderedLabel.classList.remove(
            "summary-label-responsive"
        );

        if (selectedScope === "standard") {
            standardLabel.textContent =
                "Standard Time";

            const full =
                document.createElement(
                    "span"
                );

            full.className =
                "summary-label-full";

            full.textContent =
                `Standard ${suffix}`;

            const short =
                document.createElement(
                    "span"
                );

            short.className =
                "summary-label-short";

            short.textContent =
                `Std. ${suffix}`;

            renderedLabel.classList.add(
                "summary-label-responsive"
            );

            renderedLabel.replaceChildren(
                full,
                short
            );

            return;
        }

        const scopeLabel =
            selectedScope === "total"
                ? "Total"
                : "Trip";

        standardLabel.textContent =
            `${scopeLabel} Standard Time`;

        renderedLabel.textContent =
            `${scopeLabel} ${suffix}`;
    }
''',
    'auto-aware summary labels'
)

app = sub_once(
    app,
    r'''    function updateSummaryValues\(summary\) \{.*?\n    \}\n\n    function queueSummaryRefresh\(\) \{.*?\n    \}''',
    '''    function updateSummaryValues(summary) {
        let snapshot = summary;

        if (!snapshot?.selected) {
            try {
                snapshot =
                    clockTimer.getSummarySnapshot?.(
                        new Date()
                    );
            }
            catch {
                snapshot = undefined;
            }
        }

        updateSummaryLabels(snapshot);

        const selected =
            snapshot?.selected;

        const scope =
            snapshot?.scope ??
            (
                clockTimer.percentMode === "total"
                    ? "total"
                    : "trip"
            );

        const standard =
            selected?.standardTime ||
            (
                scope !== "total"
                    ? (
                        clockTimer.standardTime ||
                        stagedStandardTime
                    )
                    : undefined
            );

        $("#standardTimeValue").textContent =
            typeof standard === "string" && standard
                ? standard
                : "---";

        const mainRenderedTime =
            getMainRenderedTimeValue(
                selected
            );

        $("#renderedTimeValue").textContent =
            mainRenderedTime || "---";

        $("#currentPercentValue").textContent =
            selected?.available === false
                ? "---"
                : formatSummaryPercent(
                    selected?.countedPercent
                );

        const goalButton =
            $("#goalPercentValue");

        goalButton.textContent =
            formatSummaryPercent(
                selected?.percentGoal,
                "100%"
            );

        goalButton.setAttribute(
            "aria-label",
            clockTimer.percentMode === "auto"
                ? "Choose Trip or Total goal"
                : clockTimer.percentMode === "total"
                    ? "Edit Total goal"
                    : "Edit Trip goal"
        );
    }

    function queueSummaryRefresh() {
        queueMicrotask(() => {
            updateSummaryValues();
            refreshAutoGoalDialog();
        });
    }''',
    'summary values use component selection',
    flags=re.S
)

app = replace_once(
    app,
    '''    function getPercentGoalValue() {
        const attribute = clockTimer.percentMode === "total" ? "total-goal" : "trip-goal";
        const raw = clockTimer.getAttribute(attribute);
        if (raw) return raw;
        const goal = Number(clockTimer.renderedPercentGoal);
        return Number.isFinite(goal) && goal > 0 ? `${Math.round(goal * 100)}%` : "100%";
    }
''',
    '''    function getPercentGoalAttribute(scope) {
        return scope === "total"
            ? "total-goal"
            : "trip-goal";
    }

    function parsePercentGoalAttribute(raw) {
        if (typeof raw !== "string") {
            return undefined;
        }

        let text =
            raw.trim();

        if (!text) {
            return undefined;
        }

        const percent =
            text.endsWith("%");

        if (percent) {
            text = text.slice(0, -1).trim();
        }

        let value =
            Number(text);

        if (!Number.isFinite(value) || value <= 0) {
            return undefined;
        }

        if (percent) {
            value /= 100;
        }
        else if (value > 1.5) {
            value /= 100;
        }

        return Number.isFinite(value) && value > 0
            ? value
            : undefined;
    }

    function getConfiguredGoalDisplay(scope) {
        const attribute =
            getPercentGoalAttribute(scope);

        if (!clockTimer.hasAttribute(attribute)) {
            return "Not set";
        }

        return formatSummaryPercent(
            parsePercentGoalAttribute(
                clockTimer.getAttribute(attribute)
            ),
            "Not set"
        );
    }

    function getPercentGoalValue(scope) {
        const attribute =
            getPercentGoalAttribute(scope);

        const raw =
            clockTimer.getAttribute(attribute);

        return raw && raw.trim()
            ? raw
            : "100%";
    }

    function refreshAutoGoalDialog() {
        if (!autoGoalDialog) {
            return;
        }

        if (autoTripGoalValue) {
            autoTripGoalValue.textContent =
                getConfiguredGoalDisplay("trip");
        }

        if (autoTotalGoalValue) {
            autoTotalGoalValue.textContent =
                getConfiguredGoalDisplay("total");
        }
    }

    function openAutoGoalDialog() {
        if (!autoGoalDialog) {
            return false;
        }

        refreshAutoGoalDialog();

        return openDialogElement(
            autoGoalDialog,
            {
                duration: 250,
                reason: "auto-goal"
            }
        );
    }

    function openPercentGoalNumberPad(scope) {
        const normalizedScope =
            scope === "total"
                ? "total"
                : "trip";

        return openNumberPad({
            mode: "percent",
            source:
                `${normalizedScope}-goal`,
            initialValue:
                getPercentGoalValue(
                    normalizedScope
                ),
            role: "root",
            workflow:
                tripIsLive()
                    ? "edit-trip"
                    : null,
            cancelTarget: "home",
            confirmTarget: "home"
        });
    }
''',
    'percent goal helpers'
)

app = replace_once(
    app,
    '''        if (source === "percent-goal") {
            return clockTimer.percentMode === "total" ? "Total Percent" : "Trip Percent";
        }
        return titles[source] || "Number Pad";''',
    '''        if (source === "trip-goal") {
            return "Trip Percent";
        }
        if (source === "total-goal") {
            return "Total Percent";
        }
        return titles[source] || "Number Pad";''',
    'number pad percent titles'
)

app = replace_once(
    app,
    '''        if (state.mode === "percent") {
            const percent = Number(state.pending);
            const attribute = clockTimer.percentMode === "total" ? "total-goal" : "trip-goal";
            clockTimer.setAttribute(attribute, `${percent}%`);
            return true;
        }''',
    '''        if (state.mode === "percent") {
            const percent =
                Number(state.pending);

            const attribute =
                state.source === "total-goal"
                    ? "total-goal"
                    : "trip-goal";

            clockTimer.setAttribute(
                attribute,
                `${percent}%`
            );

            return true;
        }''',
    'number pad percent target'
)

app = replace_once(
    app,
    '''    $("#scopeToggle").addEventListener("pointerup", () => {
        clockTimer.percentMode = clockTimer.percentMode === "total" ? "trip" : "total";
    });''',
    '''    $("#scopeToggle").addEventListener("pointerup", () => {
        const current =
            PERCENT_MODES.indexOf(
                normalizePercentMode(
                    clockTimer.percentMode
                )
            );

        clockTimer.percentMode =
            PERCENT_MODES[
                (current + 1) %
                PERCENT_MODES.length
            ];
    });''',
    'three-state scope toggle'
)

app = replace_once(
    app,
    '''    $("#standardTimeButton").addEventListener("pointerup", () => {
        if (!tripIsLive() || clockTimer.percentMode === "total") return;
        resetTripSettingsNavigation();
        openTripSettingsDialog("summary-standard-time", {
            focusField: "standard-time"
        });
    });''',
    '''    $("#standardTimeButton").addEventListener("pointerup", () => {
        let summary;
        try {
            summary =
                clockTimer.getSummarySnapshot?.(
                    new Date()
                );
        }
        catch {}

        if (
            !tripIsLive() ||
            summary?.scope === "total"
        ) {
            return;
        }

        resetTripSettingsNavigation();
        openTripSettingsDialog("summary-standard-time", {
            focusField: "standard-time"
        });
    });''',
    'standard time effective scope click'
)

app = sub_once(
    app,
    r'''    \$\("#goalPercentValue"\)\.addEventListener\("pointerup", \(\) => \{.*?\n    \}\);''',
    '''    $("#goalPercentValue").addEventListener("pointerup", () => {
        if (clockTimer.percentMode === "auto") {
            openAutoGoalDialog();
            return;
        }

        void openPercentGoalNumberPad(
            clockTimer.percentMode === "total"
                ? "total"
                : "trip"
        ).catch(() => {});
    });''',
    'auto goal chooser trigger',
    flags=re.S
)

# Bind both chooser buttons. Put this immediately after the percent goal trigger.
chooser_anchor = '''    $("#goalPercentValue").addEventListener("pointerup", () => {
        if (clockTimer.percentMode === "auto") {
            openAutoGoalDialog();
            return;
        }

        void openPercentGoalNumberPad(
            clockTimer.percentMode === "total"
                ? "total"
                : "trip"
        ).catch(() => {});
    });
'''
chooser_block = chooser_anchor + '''
    autoGoalDialog
        ?.querySelectorAll(
            "[data-auto-goal-scope]"
        )
        .forEach(button => {
            button.addEventListener(
                "pointerup",
                () => {
                    const scope =
                        button.dataset.autoGoalScope ===
                            "total"
                            ? "total"
                            : "trip";

                    closeDialog(
                        autoGoalDialog,
                        {
                            reason:
                                "auto-goal-selected",
                            immediate: true
                        }
                    );

                    void openPercentGoalNumberPad(
                        scope
                    ).catch(() => {});
                }
            );
        });
'''
app = replace_once(
    app,
    chooser_anchor,
    chooser_block,
    'auto goal chooser buttons'
)

app_path.write_text(app.rstrip() + '\n')

# Markup: centered chooser showing both configured goal values.
index_path = root / 'index.html'
index = index_path.read_text()
index = replace_once(
    index,
    '''    </dialog>

    <dialog id="profileDialog" class="app-dialog settings-dialog">''',
    '''    </dialog>

    <dialog id="autoGoalDialog" class="app-dialog auto-goal-dialog">
        <form method="dialog">
            <header class="dialog-header">
                <h2>Choose Your Goal</h2>
                <button class="dialog-close" type="button" data-close-dialog aria-label="Close">×</button>
            </header>
            <p class="auto-goal-copy">Choose which goal you want to edit.</p>
            <div class="auto-goal-options">
                <button class="auto-goal-option" type="button" data-auto-goal-scope="trip">
                    <span>Your Trip Goal</span>
                    <strong id="autoTripGoalValue">Not set</strong>
                </button>
                <button class="auto-goal-option" type="button" data-auto-goal-scope="total">
                    <span>Your Total Goal</span>
                    <strong id="autoTotalGoalValue">Not set</strong>
                </button>
            </div>
        </form>
    </dialog>

    <dialog id="profileDialog" class="app-dialog settings-dialog">''',
    'auto goal dialog markup'
)
index_path.write_text(index.rstrip() + '\n')

# Styling: responsive Standard/Std. header and centered goal chooser.
css_path = root / 'app.css'
css = css_path.read_text()
css = replace_once(
    css,
    '''.summary-cell {
    appearance: none;
    border: 0;''',
    '''.summary-cell {
    appearance: none;
    container-type: inline-size;
    border: 0;''',
    'summary cell container'
)

css = replace_once(
    css,
    '''.summary-label { font-size: 16px; font-weight: 700; }
.summary-cell strong { font-size: 28px; line-height: 1; }
''',
    '''.summary-label { font-size: 16px; font-weight: 700; }
.summary-label-short { display: none; }

@container (max-width: 190px) {
    .summary-label-responsive .summary-label-full { display: none; }
    .summary-label-responsive .summary-label-short { display: inline; }
}

.summary-cell strong { font-size: 28px; line-height: 1; }
''',
    'responsive standard label'
)

css = replace_once(
    css,
    '''.login-dialog { width: min(420px, 88vw); }
.settings-dialog { width: min(940px, 94vw); max-height: 90dvh; overflow: auto; }
''',
    '''.login-dialog { width: min(420px, 88vw); }
.auto-goal-dialog { width: min(460px, calc(100vw - 32px)); }
.settings-dialog { width: min(940px, 94vw); max-height: 90dvh; overflow: auto; }

.auto-goal-dialog form {
    min-width: 0;
}

.auto-goal-copy {
    margin-block: 0;
    text-align: center;
    line-height: 1.4;
}

.auto-goal-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
}

.auto-goal-option {
    min-width: 0;
    min-height: 96px;
    padding: 14px 10px;
    display: grid;
    place-items: center;
    gap: 8px;
    border: 1px solid rgb(255 255 255 / 72%);
    border-radius: 12px;
    color: var(--wm-white);
    background: color-mix(in srgb, var(--wm-blue-dark) 78%, var(--wm-blue) 22%);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 12%);
}

.auto-goal-option span {
    min-width: 0;
    text-align: center;
    font-size: 16px;
}

.auto-goal-option strong {
    font-size: 28px;
    line-height: 1;
}
''',
    'auto goal dialog styles'
)

css_path.write_text(css.rstrip() + '\n')
