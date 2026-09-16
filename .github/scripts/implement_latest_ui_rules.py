from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 anchor, found {count}")
    return text.replace(old, new, 1)


# -----------------------------------------------------------------------------
# ClockTimer: finalized main-UI duration precision rules.
# -----------------------------------------------------------------------------
path = Path("ClockTimer.js")
clock = path.read_text()

old = '''        #formatElapsedRenderedDuration(
            milliseconds
        ) {
            return this.#formatSignedRenderedDuration(
                milliseconds
            );
        }

        #formatSignedRenderedDuration(
            milliseconds
        ) {
            if (!Number.isSafeInteger(milliseconds)) {
                return undefined;
            }

            const formatted =
                TemporalFormat.formatDuration(
                    Math.abs(
                        milliseconds
                    )
                );

            if (formatted === undefined) {
                return undefined;
            }

            return milliseconds < 0
                ? `-${formatted}`
                : formatted;
        }

        #formatRemainingRenderedDuration(
            milliseconds
        ) {
            if (!Number.isSafeInteger(milliseconds)) {
                return undefined;
            }

            const formatted =
                TemporalFormat.formatDuration(
                    Math.abs(
                        milliseconds
                    )
                );

            if (formatted === undefined) {
                return undefined;
            }

            if (milliseconds < 0) {
                return `-${formatted}`;
            }

            if (milliseconds > 0) {
                return `⁺${formatted}`;
            }

            return formatted;
        }
'''
new = '''        #formatElapsedRenderedDuration(
            milliseconds
        ) {
            if (!Number.isSafeInteger(milliseconds)) {
                return undefined;
            }

            const displayMilliseconds =
                milliseconds % 1000 === 0
                    ? milliseconds
                    : Math.ceil(
                        milliseconds /
                        1000
                    ) * 1000;

            return TemporalFormat.formatDuration(
                Math.abs(
                    displayMilliseconds
                )
            );
        }

        #formatRemainingRenderedDuration(
            milliseconds
        ) {
            if (!Number.isSafeInteger(milliseconds)) {
                return undefined;
            }

            const displayMilliseconds =
                Math.trunc(
                    milliseconds /
                    1000
                ) * 1000;

            return TemporalFormat.formatDuration(
                Math.abs(
                    displayMilliseconds
                )
            );
        }
'''
clock = replace_once(clock, old, new, "duration display formatters")

old = '''        #formatSummaryEndTime(value) {
            if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
                return undefined;
            }

'''
new = '''        #formatSummaryEndTime(value) {
            if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
                return undefined;
            }

            value = new Date(
                value.getTime() -
                value.getMilliseconds()
            );

'''
clock = replace_once(clock, old, new, "calculated end truncation")
path.write_text(clock)


# -----------------------------------------------------------------------------
# App behavior: main UI interval suffix, connection handoff, Now-button content.
# -----------------------------------------------------------------------------
path = Path("app.js")
app = path.read_text()

old = '''    const tripSetStartsNow = $("#tripSetStartsNow");
    const tripSetStartsNowCancel = $("#tripSetStartsNowCancel");
'''
new = '''    const tripSetStartsNow = $("#tripSetStartsNow");
    const tripSetStartsNowStartCopy = tripSetStartsNow.querySelector(".trip-now-start-copy");
    const tripSetStartsNowValueCopy = tripSetStartsNow.querySelector(".trip-now-value-copy");
    const tripSetStartsNowNowLabel = tripSetStartsNow.querySelector(".trip-now-now-label");
    const tripSetStartsNowTimestampLabel = tripSetStartsNow.querySelector(".trip-now-timestamp-label");
    const tripSetStartsNowCancel = $("#tripSetStartsNowCancel");
'''
app = replace_once(app, old, new, "trip Now button element references")

old = '''    async function settleInitialNumberPadConnection(state, preparationPromise) {
        const startedAt = performance.now();
'''
new = '''    async function settleInitialNumberPadConnection(state, preparationPromise) {
        const startedAt =
            Number.isFinite(state?.connectionAnimationStartedAt)
                ? state.connectionAnimationStartedAt
                : performance.now();
'''
app = replace_once(app, old, new, "connection animation anchor")

old = '''        updateNumberPadConnectionStatus(
            state.connectionStatusToken,
            clockTimer.networkStatus,
            { presentation: "handoff" }
        );
        await wait(CONNECTION_CLOUD_FADE_DURATION);
        updateNumberPadConnectionStatus(
            state.connectionStatusToken,
            clockTimer.networkStatus,
            { presentation: "settled" }
        );
'''
new = '''        updateNumberPadConnectionStatus(
            state.connectionStatusToken,
            clockTimer.networkStatus,
            { presentation: "handoff" }
        );
        await wait(CONNECTION_CLOUD_FADE_DURATION);

        const status = normalizedConnectionStatus();
        updateNumberPadConnectionStatus(
            state.connectionStatusToken,
            status,
            {
                presentation:
                    status === "offline" && !loginDialog.open
                        ? "awaiting-login"
                        : "settled"
            }
        );
'''
app = replace_once(app, old, new, "failed connection gear handoff")

old = '''        numberPadState = state;
        refreshNumberPad();
        mainMenu?.hidePopover?.();
'''
new = '''        numberPadState = state;
        refreshNumberPad();
        if (
            source === "new-trip" &&
            state.persistence === "pending"
        ) {
            state.connectionAnimationStartedAt =
                performance.now();
        }
        mainMenu?.hidePopover?.();
'''
app = replace_once(app, old, new, "record gear animation start")

old = '''        initialLoginAttemptPending = false;
        if (!opened) return;
        requestAnimationFrame(() => {
'''
new = '''        initialLoginAttemptPending = false;
        if (!opened) return;

        const connectionState =
            numberPadState ??
            findUIReturnFrame("number-pad")?.state;
        if (
            connectionState?.connectionPresentation ===
                "awaiting-login" &&
            connectionState.connectionStatusToken
        ) {
            updateNumberPadConnectionStatus(
                connectionState.connectionStatusToken,
                "offline",
                { presentation: "settled" }
            );
        }

        requestAnimationFrame(() => {
'''
app = replace_once(app, old, new, "stop failed gear when login appears")

# Main-summary suffixes are UI-only and are appended only to an existing value.
old = '''    function updateSummaryValues(summary) {
'''
new = '''    function getMainRenderedTimeValue(selected) {
        const renderedTime =
            typeof selected?.renderedTime === "string"
                ? selected.renderedTime
                : "";

        if (!renderedTime) return undefined;

        const mode =
            selected?.renderedTimeMode ??
            clockTimer.renderedTimeMode;

        if (mode !== "remaining" && mode !== "elapsed") {
            return renderedTime;
        }

        let intervalState;
        try {
            intervalState =
                clockTimer.getActiveIntervalState?.(
                    new Date()
                );
        }
        catch {}

        if (intervalState?.open !== false) {
            return renderedTime;
        }

        return `${renderedTime}${mode === "remaining" ? "⁺" : "⁻"}`;
    }

    function updateSummaryValues(summary) {
'''
app = replace_once(app, old, new, "main rendered time suffix helper")

old = '''        $("#renderedTimeValue").textContent =
            typeof selected?.renderedTime === "string" && selected.renderedTime
                ? selected.renderedTime
                : "---";
'''
new = '''        const mainRenderedTime =
            getMainRenderedTimeValue(
                selected
            );
        $("#renderedTimeValue").textContent =
            mainRenderedTime || "---";
'''
app = replace_once(app, old, new, "main rendered time value")

# Add structured content handling before the existing state synchronizer.
old = '''    function syncTripStartsNowUI() {
'''
new = '''    function syncTripStartsNowButtonContent(active) {
        if (
            !tripSetStartsNowStartCopy ||
            !tripSetStartsNowValueCopy ||
            !tripSetStartsNowNowLabel ||
            !tripSetStartsNowTimestampLabel
        ) {
            return;
        }

        if (active && tripStartsNowState?.label) {
            tripSetStartsNowTimestampLabel.textContent =
                tripStartsNowState.label;
        }
        else if (!tripStartsNowExiting) {
            tripSetStartsNowTimestampLabel.textContent = "";
        }

        const startWidth =
            tripSetStartsNowStartCopy.scrollWidth;
        const nowWidth =
            tripSetStartsNowNowLabel.scrollWidth;
        const timestampWidth =
            tripSetStartsNowTimestampLabel.scrollWidth;

        if (startWidth > 0) {
            tripSetStartsNow.style.setProperty(
                "--trip-now-start-copy-width",
                `${startWidth}px`
            );
        }
        if (nowWidth > 0) {
            tripSetStartsNow.style.setProperty(
                "--trip-now-now-width",
                `${nowWidth}px`
            );
        }
        if (timestampWidth > 0) {
            tripSetStartsNow.style.setProperty(
                "--trip-now-timestamp-width",
                `${timestampWidth}px`
            );
        }

        tripSetStartsNowNowLabel.setAttribute(
            "aria-hidden",
            String(active)
        );
        tripSetStartsNowTimestampLabel.setAttribute(
            "aria-hidden",
            String(!active)
        );
        tripSetStartsNow.setAttribute(
            "aria-label",
            active && tripStartsNowState?.label
                ? `Set To ${tripStartsNowState.label}`
                : "Set Scheduled/Actual Start to Now"
        );
    }

    function syncTripStartsNowUI() {
'''
app = replace_once(app, old, new, "structured Now-button content helper")

old = '''        tripSetStartsNowActions.classList.toggle("is-selecting", active);
'''
new = '''        tripSetStartsNowActions.classList.toggle("is-selecting", active);
        tripSetStartsNowActions.classList.toggle("is-exiting", tripStartsNowExiting);
'''
app = replace_once(app, old, new, "trip Now exiting class")

old = '''        if (!active) {
            if (!tripStartsNowExiting) {
                tripSetStartsNow.textContent = "Set Scheduled/Actual Start to Now";
            }
            tripSetStartsNow.disabled = tripStartsNowExiting ||
                Boolean(draft && !parseDateInput(values?.creationDate || draft.creationDate));
            return;
        }

        tripSetStartsNow.textContent = `Set To ${tripStartsNowState.label}`;
        tripSetStartsNow.disabled = !tripStartsNowState.scheduled && !tripStartsNowState.actual;
'''
new = '''        syncTripStartsNowButtonContent(active);

        if (!active) {
            tripSetStartsNow.disabled =
                Boolean(
                    draft &&
                    !parseDateInput(
                        values?.creationDate ||
                        draft.creationDate
                    )
                );
            return;
        }

        tripSetStartsNow.disabled =
            !tripStartsNowState.scheduled &&
            !tripStartsNowState.actual;
'''
app = replace_once(app, old, new, "trip Now button state and disabled timing")
path.write_text(app)


# -----------------------------------------------------------------------------
# Markup: split the action into independently animatable semantic pieces.
# -----------------------------------------------------------------------------
path = Path("index.html")
html = path.read_text()
old = '''                <button id="tripSetStartsNow" class="trip-now-action" type="button">Set Scheduled/Actual Start to Now</button>
'''
new = '''                <button id="tripSetStartsNow" class="trip-now-action" type="button" aria-label="Set Scheduled/Actual Start to Now">
                    <span class="trip-now-set-word">Set</span>
                    <div class="trip-now-start-copy">Scheduled/Actual Start</div>
                    <span class="trip-now-to-word">to</span>
                    <div class="trip-now-value-copy">
                        <span class="trip-now-now-label">Now</span>
                        <span class="trip-now-timestamp-label" aria-hidden="true"></span>
                    </div>
                </button>
'''
html = replace_once(html, old, new, "structured Set Starts Now markup")
path.write_text(html)


# -----------------------------------------------------------------------------
# CSS: failed gear hold + staged text collapse/morph/reveal animation.
# -----------------------------------------------------------------------------
path = Path("app.css")
css = path.read_text()
css += r'''

/* connection-failure-login-handoff-v1 */
.number-pad-settings[data-connection-phase="awaiting-login"] .number-pad-settings-gear {
    animation: number-pad-gear-spin 800ms linear infinite;
}

/* trip-start-now-content-transition-v1 */
.trip-now-action {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.3em;
    white-space: nowrap;
    overflow: hidden;
}

.trip-now-start-copy {
    width: var(--trip-now-start-copy-width, auto);
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    opacity: 1;
    transform-origin: left center;
    transition:
        width var(--trip-start-transition-duration) ease-in-out,
        opacity var(--trip-start-transition-duration) linear;
}

.trip-now-actions.is-selecting .trip-now-start-copy,
.trip-now-actions.is-exiting .trip-now-start-copy {
    width: 0;
    opacity: 0;
}

.trip-now-value-copy {
    position: relative;
    display: inline-block;
    flex: 0 0 auto;
    width: var(--trip-now-now-width, auto);
    min-width: 0;
    height: 1em;
    line-height: 1;
    overflow: visible;
    transition: width var(--trip-start-transition-duration) ease-in-out;
}

.trip-now-actions.is-selecting .trip-now-value-copy {
    width: var(--trip-now-timestamp-width, var(--trip-now-now-width, auto));
}

.trip-now-now-label,
.trip-now-timestamp-label {
    position: absolute;
    left: 0;
    top: 50%;
    display: inline-block;
    width: max-content;
    white-space: nowrap;
    transition:
        opacity var(--trip-start-transition-duration) linear,
        transform var(--trip-start-transition-duration) ease-in-out;
}

.trip-now-now-label {
    opacity: 1;
    transform: translateY(-50%) scale(1);
}

.trip-now-timestamp-label {
    opacity: 0;
    transform: translateY(-35%) scale(0.94);
}

.trip-now-actions.is-selecting .trip-now-now-label {
    opacity: 0;
    transform: translateY(-65%) scale(0.94);
}

.trip-now-actions.is-selecting .trip-now-timestamp-label {
    opacity: 1;
    transform: translateY(-50%) scale(1);
}
'''
path.write_text(css)
