from pathlib import Path

p = Path("index.html")
s = p.read_text()
s = s.replace(
    '<strong id="goalPercentValue">100%</strong>',
    '<button id="goalPercentValue" class="percent-value-button" type="button" aria-label="Edit percent goal">100%</button>',
    1,
)
marker = '    <dialog id="loginDialog" class="app-dialog login-dialog">\n'
pad = '''    <dialog id="numberPadDialog" class="number-pad-dialog" aria-label="Number pad">
        <section class="number-pad-shell">
            <output id="numberPadDisplay" class="number-pad-display" aria-live="polite"></output>
            <div id="numberPadGrid" class="number-pad-grid">
                <button class="number-pad-key" type="button" data-number="1">1</button>
                <button class="number-pad-key" type="button" data-number="2">2</button>
                <button class="number-pad-key" type="button" data-number="3">3</button>
                <button class="number-pad-key" type="button" data-number="4">4</button>
                <button class="number-pad-key" type="button" data-number="5">5</button>
                <button class="number-pad-key" type="button" data-number="6">6</button>
                <button class="number-pad-key" type="button" data-number="7">7</button>
                <button class="number-pad-key" type="button" data-number="8">8</button>
                <button class="number-pad-key" type="button" data-number="9">9</button>
                <button id="numberPadAction" class="number-pad-key number-pad-special number-pad-action" type="button" aria-label="Close"></button>
                <button class="number-pad-key" type="button" data-number="0">0</button>
                <button id="numberPadContext" class="number-pad-key number-pad-special number-pad-context" type="button" aria-label="Number pad settings"></button>
            </div>
        </section>
    </dialog>

'''
if 'id="numberPadDialog"' not in s:
    if marker not in s:
        raise SystemExit("index marker not found")
    s = s.replace(marker, pad + marker, 1)
p.write_text(s)

p = Path("app.css")
s = p.read_text()
percent_marker = ".percent-summary {\n"
if ".percent-value-button {" not in s:
    idx = s.find(percent_marker)
    if idx < 0:
        raise SystemExit("percent css marker not found")
    end = s.find("}\n", idx) + 2
    s = s[:end] + '''

.percent-value-button {
    appearance: none;
    margin: 0;
    padding: 0;
    border: 0;
    color: inherit;
    background: transparent;
    font: inherit;
    font-size: inherit;
    font-weight: inherit;
    line-height: inherit;
}
''' + s[end:]

if ".number-pad-dialog {" not in s:
    s += '''

.number-pad-dialog {
    width: min(430px, 96vw);
    max-width: none;
    margin: auto;
    padding: 0;
    overflow: visible;
    border: 0;
    background: transparent;
    opacity: 0;
    transition-property: opacity, display, overlay;
    transition-duration: 250ms;
    transition-timing-function: linear;
    transition-behavior: normal, allow-discrete, allow-discrete;
}

.number-pad-dialog[open] { opacity: 1; }

.number-pad-dialog::backdrop {
    background: rgb(0 0 0 / 55%);
    opacity: 0;
    transition: opacity 250ms linear;
}

.number-pad-dialog[open]::backdrop { opacity: 1; }

@starting-style {
    .number-pad-dialog[open],
    .number-pad-dialog[open]::backdrop { opacity: 0; }
}

.number-pad-shell {
    width: 100%;
    overflow: hidden;
    border-radius: 12px;
    background: #252525;
    box-shadow: 0 18px 50px rgb(0 0 0 / 48%);
}

.number-pad-display {
    width: 100%;
    min-height: 92px;
    padding: 14px 20px;
    display: grid;
    place-items: center;
    border: 2px solid rgb(255 255 255 / 55%);
    border-radius: 10px 10px 0 0;
    color: var(--wm-white);
    background: var(--wm-blue);
    font-size: clamp(34px, 12vw, 58px);
    font-weight: 700;
    line-height: 1;
    text-align: center;
}

.number-pad-grid {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(3, calc(100% / 3));
    gap: 0;
    background: #252525;
}

.number-pad-key {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    aspect-ratio: 1 / 1;
    margin: 0;
    padding: 0;
    border: 3px solid #252525;
    border-radius: 9px;
    display: grid;
    place-items: center;
    color: #111;
    background: #f4f4f4;
    font-size: clamp(42px, 16vw, 72px);
    font-weight: 700;
    line-height: 1;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
}

.number-pad-key:disabled {
    color: #7e7e7e;
    background: #a0a0a0;
    opacity: 0.45;
    cursor: not-allowed;
}

.number-pad-special {
    color: #111;
    background: #ff9d00;
}

.number-pad-action::before,
.number-pad-context::before {
    content: "";
    width: 42%;
    height: 42%;
    background: currentColor;
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: contain;
    mask-size: contain;
}

.number-pad-action[data-action="close"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 5l14 14M19 5 5 19' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 5l14 14M19 5 5 19' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E");
}

.number-pad-action[data-action="clear"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}

.number-pad-action[data-action="reset"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 7V3L2 6l3 3V7a8 8 0 1 1-1 7' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 7V3L2 6l3 3V7a8 8 0 1 1-1 7' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}

.number-pad-context[data-context="settings"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='black' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='12' cy='12' r='4'/%3E%3Cpath d='M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1'/%3E%3C/g%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='black' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='12' cy='12' r='4'/%3E%3Cpath d='M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1'/%3E%3C/g%3E%3C/svg%3E");
}

.number-pad-context[data-context="percent"]::before {
    content: "%";
    width: auto;
    height: auto;
    background: none;
    -webkit-mask-image: none;
    mask-image: none;
    font-size: clamp(34px, 12vw, 56px);
    font-weight: 700;
}
'''
p.write_text(s)

p = Path("app.js")
s = p.read_text()
refs_old = '''    const profileMenuButton = $("#profileMenuButton");
    const authButton = $("#authButton");
'''
refs_new = '''    const profileMenuButton = $("#profileMenuButton");
    const authButton = $("#authButton");
    const numberPadDialog = $("#numberPadDialog");
    const numberPadDisplay = $("#numberPadDisplay");
    const numberPadAction = $("#numberPadAction");
    const numberPadContext = $("#numberPadContext");
'''
if refs_new not in s:
    if refs_old not in s:
        raise SystemExit("app refs marker not found")
    s = s.replace(refs_old, refs_new, 1)

state_old = '''    let loginPending = false;

    const STARTUP_CONNECTION_DELAY = 2000;
'''
state_new = '''    let loginPending = false;
    let stagedStandardTime;
    let numberPadState;
    let numberPadLongPressTimer;
    let numberPadLongPressed = false;

    const NUMBER_PAD_LONG_PRESS = 750;
    const STARTUP_CONNECTION_DELAY = 2000;
'''
if state_new not in s:
    if state_old not in s:
        raise SystemExit("app state marker not found")
    s = s.replace(state_old, state_new, 1)

standard_old = '''        const standard = clockTimer.standardTime;
        $("#standardTimeValue").textContent = typeof standard === "string" && standard ? standard : "---";
'''
standard_new = '''        const standard = clockTimer.standardTime || stagedStandardTime;
        $("#standardTimeValue").textContent = typeof standard === "string" && standard ? standard : "---";
'''
if standard_new not in s:
    if standard_old not in s:
        raise SystemExit("summary standard marker not found")
    s = s.replace(standard_old, standard_new, 1)

listener_old = '''    for (const id of ["newTripButton", "standardTimeButton"]) {
        $("#" + id).addEventListener("click", () => {
            window.dispatchEvent(new CustomEvent("wmof:number-pad-request", {
                detail: { source: id === "newTripButton" ? "new-trip" : "standard-time" }
            }));
        });
    }
'''
listener_new = r'''    function normalizeTimeDigits(value) {
        const text = String(value || "").trim();
        if (!text) return "";
        const match = text.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
        if (!match) return "";
        const hours = match[1] || "";
        const minutes = match[2];
        const seconds = match[3];
        if (Number(minutes) > 59 || Number(seconds) > 59) return "";
        return hours ? `${hours}${minutes.padStart(2, "0")}${seconds}` : `${minutes}${seconds}`;
    }

    function formatTimeDigits(raw) {
        if (!/^\d+$/.test(raw)) return undefined;
        const secondsText = raw.slice(-2).padStart(2, "0");
        const seconds = Number(secondsText);
        if (seconds > 59) return undefined;

        if (raw.length <= 2) return `0:${secondsText}`;

        if (raw.length <= 4) {
            const minutesText = raw.slice(0, -2);
            const minutes = Number(minutesText);
            if (minutes > 59) return undefined;
            return `${minutesText}:${secondsText}`;
        }

        const minuteText = raw.slice(-4, -2);
        if (Number(minuteText) > 59) return undefined;
        const hourText = raw.slice(0, -4).replace(/^0+(?=\d)/, "");
        return `${hourText}:${minuteText}:${secondsText}`;
    }

    function timeDigitsValid(raw) {
        return raw === "" || formatTimeDigits(raw) !== undefined;
    }

    function normalizePercentDigits(value) {
        const match = String(value || "").trim().match(/^(\d+)(?:%)?$/);
        return match ? String(Number(match[1])) : "";
    }

    function getNumberPadAction() {
        if (!numberPadState) return "close";
        if (numberPadState.pending === "" || numberPadState.pending === numberPadState.initial) return "close";
        return numberPadState.initial ? "reset" : "clear";
    }

    function canAppendNumberPadDigit(digit) {
        if (!numberPadState) return false;
        const candidate = numberPadState.pending + digit;
        if (numberPadState.mode === "percent") {
            if (candidate === "0") return false;
            return /^\d+$/.test(candidate);
        }
        return timeDigitsValid(candidate);
    }

    function refreshNumberPad() {
        if (!numberPadState) return;

        const formatted = numberPadState.mode === "percent"
            ? (numberPadState.pending ? `${Number(numberPadState.pending)}%` : "")
            : (numberPadState.pending ? (formatTimeDigits(numberPadState.pending) || "") : "");

        numberPadDisplay.textContent = formatted;

        const action = getNumberPadAction();
        numberPadAction.dataset.action = action;
        numberPadAction.setAttribute("aria-label", action[0].toUpperCase() + action.slice(1));

        const percentMode = numberPadState.mode === "percent";
        numberPadContext.dataset.context = percentMode ? "percent" : "settings";
        numberPadContext.disabled = percentMode;
        numberPadContext.setAttribute("aria-label", percentMode ? "Percent" : "Number pad settings");

        document.querySelectorAll("#numberPadGrid [data-number]").forEach(button => {
            button.disabled = !canAppendNumberPadDigit(button.dataset.number);
        });
    }

    function openNumberPad({ mode, source, initialValue = "" }) {
        const initial = mode === "percent"
            ? normalizePercentDigits(initialValue)
            : normalizeTimeDigits(initialValue);

        numberPadState = { mode, source, initial, pending: initial };
        refreshNumberPad();
        $("#mainMenu")?.hidePopover?.();
        if (!numberPadDialog.open) numberPadDialog.showModal();
    }

    function closeNumberPad() {
        clearTimeout(numberPadLongPressTimer);
        numberPadLongPressTimer = undefined;
        numberPadLongPressed = false;
        if (numberPadDialog.open) numberPadDialog.close();
        numberPadState = undefined;
    }

    function getPercentGoalValue() {
        const attribute = clockTimer.percentMode === "total" ? "total-goal" : "trip-goal";
        const raw = clockTimer.getAttribute(attribute);
        if (raw) return raw;
        const goal = Number(clockTimer.renderedPercentGoal);
        return Number.isFinite(goal) && goal > 0 ? `${Math.round(goal * 100)}%` : "100%";
    }

    async function commitNumberPad() {
        if (!numberPadState) return;
        const state = { ...numberPadState };

        if (state.mode === "percent") {
            const percent = Number(state.pending);
            if (Number.isInteger(percent) && percent > 0) {
                const attribute = clockTimer.percentMode === "total" ? "total-goal" : "trip-goal";
                clockTimer.setAttribute(attribute, `${percent}%`);
                updateSummaryValues();
            }
            return;
        }

        if (!state.pending) return;
        const formatted = formatTimeDigits(state.pending);
        if (!formatted) return;

        stagedStandardTime = formatted;

        if (state.source === "new-trip") {
            await clockTimer.start({ standardTime: formatted });
        }
        else if (clockTimer.standardTime !== undefined) {
            clockTimer.standardTime = formatted;
        }

        updateSummaryValues();
    }

    function runNumberPadShortAction() {
        if (!numberPadState) return;
        const action = getNumberPadAction();
        if (action === "close") {
            closeNumberPad();
            return;
        }
        numberPadState.pending = action === "reset" ? numberPadState.initial : "";
        refreshNumberPad();
    }

    document.querySelectorAll("#numberPadGrid [data-number]").forEach(button => {
        button.addEventListener("click", () => {
            if (!numberPadState || button.disabled) return;
            numberPadState.pending += button.dataset.number;
            refreshNumberPad();
        });
    });

    numberPadAction.addEventListener("pointerdown", event => {
        if (!numberPadState) return;
        numberPadLongPressed = false;
        numberPadAction.setPointerCapture?.(event.pointerId);
        clearTimeout(numberPadLongPressTimer);
        numberPadLongPressTimer = setTimeout(async () => {
            numberPadLongPressTimer = undefined;
            numberPadLongPressed = true;
            try { await commitNumberPad(); }
            finally { closeNumberPad(); }
        }, NUMBER_PAD_LONG_PRESS);
    });

    numberPadAction.addEventListener("pointerup", event => {
        if (numberPadAction.hasPointerCapture?.(event.pointerId)) numberPadAction.releasePointerCapture(event.pointerId);
        if (numberPadLongPressTimer !== undefined) {
            clearTimeout(numberPadLongPressTimer);
            numberPadLongPressTimer = undefined;
        }
        if (numberPadLongPressed) {
            numberPadLongPressed = false;
            return;
        }
        runNumberPadShortAction();
    });

    numberPadAction.addEventListener("pointercancel", () => {
        clearTimeout(numberPadLongPressTimer);
        numberPadLongPressTimer = undefined;
        numberPadLongPressed = false;
    });

    numberPadContext.addEventListener("click", () => {
        if (!numberPadState || numberPadState.mode === "percent") return;
        closeNumberPad();
        setTimeout(() => openDialog("stateSettingsDialog"), 250);
    });

    numberPadDialog.addEventListener("cancel", event => {
        event.preventDefault();
        closeNumberPad();
    });

    $("#newTripButton").addEventListener("click", () => {
        openNumberPad({
            mode: "time",
            source: "new-trip",
            initialValue: stagedStandardTime || clockTimer.standardTime || ""
        });
    });

    $("#standardTimeButton").addEventListener("click", () => {
        openNumberPad({
            mode: "time",
            source: "standard-time",
            initialValue: clockTimer.standardTime || stagedStandardTime || ""
        });
    });

    $("#goalPercentValue").addEventListener("click", () => {
        openNumberPad({
            mode: "percent",
            source: "percent-goal",
            initialValue: getPercentGoalValue()
        });
    });
'''
if "function openNumberPad({" not in s:
    if listener_old not in s:
        raise SystemExit("number pad listener marker not found")
    s = s.replace(listener_old, listener_new, 1)

p.write_text(s)
