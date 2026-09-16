from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"missing patch anchor: {label}")
    return text.replace(old, new, 1)


def replace_between(text, start, end, replacement, label):
    start_index = text.find(start)
    if start_index < 0:
        raise RuntimeError(f"missing start anchor: {label}")
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise RuntimeError(f"missing end anchor: {label}")
    return text[:start_index] + replacement + text[end_index:]


# --- index.html: move the number pad into a separately loaded fragment. ---
index_path = Path("index.html")
index = index_path.read_text()
numberpad_start = '    <dialog id="numberPadDialog" class="number-pad-dialog" aria-label="Number pad">\n'
login_start = '    <dialog id="loginDialog" class="app-dialog login-dialog">\n'
index = replace_between(index, numberpad_start, login_start, login_start, "embedded number pad")
index_path.write_text(index)


# --- numberpad.html ---
Path("numberpad.html").write_text('''<dialog id="numberPadDialog" class="number-pad-dialog" aria-label="Number pad">
    <section class="number-pad-shell">
        <div class="number-pad-header">
            <div class="number-pad-readout">
                <output id="numberPadDisplay" class="number-pad-display" aria-live="polite"></output>
            </div>
            <button id="numberPadSettings" class="number-pad-settings" type="button" aria-label="Number pad settings" data-persistence="offline">
                <span class="number-pad-settings-gear" aria-hidden="true"></span>
                <span class="number-pad-persistence-badge" aria-hidden="true"></span>
            </button>
        </div>
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
            <button id="numberPadClear" class="number-pad-key number-pad-clear" type="button" aria-label="Close" data-action="close"></button>
            <button class="number-pad-key" type="button" data-number="0">0</button>
            <button id="numberPadConfirm" class="number-pad-key number-pad-confirm" type="button" aria-label="Confirm" data-action="confirm"></button>
        </div>
    </section>
</dialog>
''')


# --- app.css: replace the original keypad styling with the revised layout. ---
css_path = Path("app.css")
css = css_path.read_text()
css_start = css.find(".number-pad-dialog {")
if css_start < 0:
    raise RuntimeError("missing number pad CSS")
css = css[:css_start] + r'''.number-pad-dialog {
    width: min(430px, 94vw);
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
    background: var(--wm-blue-dark);
    box-shadow: 0 18px 50px rgb(0 0 0 / 48%);
}

.number-pad-header {
    width: 100%;
    aspect-ratio: 3 / 1;
    display: grid;
    grid-template-columns: 2fr 1fr;
    background: var(--wm-yellow);
}

.number-pad-readout {
    min-width: 0;
    display: grid;
    place-items: center;
    background: var(--wm-yellow);
}

.number-pad-display {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0 12px;
    display: grid;
    place-items: center;
    color: var(--wm-blue-dark);
    background: transparent;
    font-size: clamp(34px, 12vw, 58px);
    font-weight: 700;
    line-height: 1;
    text-align: center;
}

.number-pad-settings {
    position: relative;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    display: grid;
    place-items: center;
    color: var(--wm-white);
    background: var(--wm-blue);
    touch-action: manipulation;
}

.number-pad-settings[hidden] { display: none; }
.number-pad-header.percent-mode { grid-template-columns: 1fr; }
.number-pad-header.percent-mode .number-pad-readout { grid-column: 1 / -1; }

.number-pad-settings-gear {
    width: 48%;
    height: 48%;
    background: currentColor;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round'%3E%3Ccircle cx='12' cy='12' r='5.2'/%3E%3Cpath d='M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1'/%3E%3C/g%3E%3Ccircle cx='12' cy='12' r='1.8' fill='black'/%3E%3C/svg%3E") center / contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round'%3E%3Ccircle cx='12' cy='12' r='5.2'/%3E%3Cpath d='M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1'/%3E%3C/g%3E%3Ccircle cx='12' cy='12' r='1.8' fill='black'/%3E%3C/svg%3E") center / contain no-repeat;
}

.number-pad-settings[data-persistence="pending"] .number-pad-settings-gear {
    animation: number-pad-gear-spin 800ms linear infinite;
}

@keyframes number-pad-gear-spin {
    to { transform: rotate(360deg); }
}

.number-pad-persistence-badge {
    position: absolute;
    right: 8%;
    bottom: 8%;
    width: 31%;
    height: 31%;
    border: 2px solid var(--wm-white);
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--wm-gray);
}

.number-pad-persistence-badge::before {
    content: "";
    width: 70%;
    height: 70%;
    background: var(--wm-white);
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: contain;
    mask-size: contain;
}

.number-pad-settings[data-persistence="pending"] .number-pad-persistence-badge { display: none; }
.number-pad-settings[data-persistence="online"] .number-pad-persistence-badge { background: var(--wm-blue); }
.number-pad-settings[data-persistence="offline"] .number-pad-persistence-badge { background: var(--wm-gray); }

.number-pad-settings[data-persistence="online"] .number-pad-persistence-badge::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='black'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='black'/%3E%3C/svg%3E");
}

.number-pad-settings[data-persistence="offline"] .number-pad-persistence-badge::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M5 5l14 14' stroke='black' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.4 8.4 4.8 4.8 0 0 0 7 18Z' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M5 5l14 14' stroke='black' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E");
}

.number-pad-grid {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
    background: var(--wm-blue-dark);
}

.number-pad-key {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    aspect-ratio: 1 / 1;
    margin: 0;
    padding: 0;
    border: 1px solid rgb(255 255 255 / 20%);
    border-radius: 0;
    display: grid;
    place-items: center;
    color: var(--wm-white);
    background: var(--wm-blue-dark);
    font-size: clamp(42px, 16vw, 72px);
    font-weight: 700;
    line-height: 1;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
}

.number-pad-key:disabled {
    opacity: 0.38;
    cursor: not-allowed;
}

.number-pad-confirm { background: var(--wm-blue); }

.number-pad-clear::before,
.number-pad-confirm::before {
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

.number-pad-clear[data-action="close"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 5l14 14M19 5 5 19' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 5l14 14M19 5 5 19' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E");
}

.number-pad-clear[data-action="clear"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}

.number-pad-confirm[data-action="confirm"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='m4 12 5 5L20 6' fill='none' stroke='black' stroke-width='2.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='m4 12 5 5L20 6' fill='none' stroke='black' stroke-width='2.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}

.number-pad-confirm[data-action="autocorrect"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M19 7V3l-3 3 3 3V7a7 7 0 1 1-2-5' fill='none' stroke='black' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M6 5v3M4.5 6.5h3' stroke='black' stroke-width='1.8' stroke-linecap='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M19 7V3l-3 3 3 3V7a7 7 0 1 1-2-5' fill='none' stroke='black' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M6 5v3M4.5 6.5h3' stroke='black' stroke-width='1.8' stroke-linecap='round'/%3E%3C/svg%3E");
}
'''
css_path.write_text(css)


# --- app.js: load the keypad fragment and apply revised behavior. ---
app_path = Path("app.js")
app = app_path.read_text()
app = replace_once(
    app,
    '    const numberPadDialog = $("#numberPadDialog");\n    const numberPadDisplay = $("#numberPadDisplay");\n    const numberPadAction = $("#numberPadAction");\n    const numberPadContext = $("#numberPadContext");\n',
    '',
    "static number pad refs"
)
app = replace_once(
    app,
    '    let numberPadState;\n    let numberPadLongPressTimer;\n    let numberPadLongPressed = false;\n\n    const NUMBER_PAD_LONG_PRESS = 750;\n',
    '''    let numberPadState;\n    let numberPadLoadPromise;\n    let numberPadDialog;\n    let numberPadDisplay;\n    let numberPadSettings;\n    let numberPadClear;\n    let numberPadConfirm;\n    let numberPadLongPressTimer;\n    let numberPadLongPressed = false;\n    let numberPadLastClearPointerDown = 0;\n\n    const NUMBER_PAD_LONG_PRESS = 750;\n    const NUMBER_PAD_DOUBLE_PRESS = 350;\n''',
    "number pad state vars"
)

numberpad_block_start = '    function normalizeTimeDigits(value) {\n'
numberpad_block_end = '    function renderIndependentTimer() {\n'
new_numberpad_block = r'''    async function ensureNumberPadLoaded() {
        if (numberPadDialog?.isConnected) return;
        if (!numberPadLoadPromise) {
            numberPadLoadPromise = (async () => {
                const response = await fetch("numberpad.html", { cache: "no-store" });
                if (!response.ok) throw new Error(`Unable to load number pad (${response.status}).`);
                const template = document.createElement("template");
                template.innerHTML = (await response.text()).trim();
                document.body.append(template.content.cloneNode(true));
                numberPadDialog = $("#numberPadDialog");
                numberPadDisplay = $("#numberPadDisplay");
                numberPadSettings = $("#numberPadSettings");
                numberPadClear = $("#numberPadClear");
                numberPadConfirm = $("#numberPadConfirm");
                bindNumberPadEvents();
            })().catch(error => {
                numberPadLoadPromise = undefined;
                throw error;
            });
        }
        await numberPadLoadPromise;
    }

    function normalizeTimeDigits(value) {
        const text = String(value || "").trim();
        if (!text) return "";
        const match = text.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
        if (!match) return "";
        const hours = match[1] || "";
        const minutes = match[2];
        const seconds = match[3];
        return hours ? `${hours}${minutes.padStart(2, "0")}${seconds}` : `${minutes}${seconds}`;
    }

    function splitTimeDigits(raw) {
        if (!/^\d+$/.test(raw)) return undefined;
        const secondsText = raw.slice(-2).padStart(2, "0");
        if (raw.length <= 2) return { hoursText: "", minutesText: "0", secondsText };
        if (raw.length <= 4) return {
            hoursText: "",
            minutesText: raw.slice(0, -2) || "0",
            secondsText
        };
        return {
            hoursText: raw.slice(0, -4).replace(/^0+(?=\d)/, "") || "0",
            minutesText: raw.slice(-4, -2),
            secondsText
        };
    }

    function renderTimeDigits(raw) {
        const parts = splitTimeDigits(raw);
        if (!parts) return "";
        return parts.hoursText
            ? `${parts.hoursText}:${parts.minutesText.padStart(2, "0")}:${parts.secondsText}`
            : `${Number(parts.minutesText)}:${parts.secondsText}`;
    }

    function timeDigitsValid(raw) {
        const parts = splitTimeDigits(raw);
        if (!parts) return false;
        return Number(parts.minutesText) < 60 && Number(parts.secondsText) < 60;
    }

    function autocorrectTimeDigits(raw) {
        const parts = splitTimeDigits(raw);
        if (!parts) return raw;
        const totalSeconds =
            Number(parts.hoursText || 0) * 3600 +
            Number(parts.minutesText) * 60 +
            Number(parts.secondsText);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return hours > 0
            ? `${hours}${String(minutes).padStart(2, "0")}${String(seconds).padStart(2, "0")}`
            : `${minutes}${String(seconds).padStart(2, "0")}`;
    }

    function normalizePercentDigits(value) {
        const match = String(value || "").trim().match(/^(\d+)(?:%)?$/);
        return match ? String(Number(match[1])) : "";
    }

    function numberPadValueValid() {
        if (!numberPadState || !numberPadState.pending) return false;
        if (numberPadState.mode === "percent") {
            return Number.isInteger(Number(numberPadState.pending)) && Number(numberPadState.pending) > 0;
        }
        return timeDigitsValid(numberPadState.pending);
    }

    function getNumberPadClearAction() {
        if (!numberPadState) return "close";
        return numberPadState.pending === "" || numberPadState.pending === numberPadState.initial
            ? "close"
            : "clear";
    }

    function refreshNumberPad() {
        if (!numberPadState || !numberPadDialog) return;
        const percentMode = numberPadState.mode === "percent";
        numberPadDisplay.textContent = percentMode
            ? (numberPadState.pending ? `${Number(numberPadState.pending)}%` : "")
            : (numberPadState.pending ? renderTimeDigits(numberPadState.pending) : "");

        const clearAction = getNumberPadClearAction();
        numberPadClear.dataset.action = clearAction;
        numberPadClear.setAttribute("aria-label", clearAction === "clear" ? "Clear" : "Close");

        const valid = numberPadValueValid();
        const autocorrect = !percentMode && numberPadState.pending !== "" && !valid;
        numberPadConfirm.dataset.action = autocorrect ? "autocorrect" : "confirm";
        numberPadConfirm.setAttribute("aria-label", autocorrect ? "Auto-Correct" : "Confirm");
        numberPadConfirm.disabled = !autocorrect && !valid;

        const header = numberPadDialog.querySelector(".number-pad-header");
        header?.classList.toggle("percent-mode", percentMode);
        numberPadSettings.hidden = percentMode;
        if (!percentMode) {
            numberPadSettings.dataset.persistence = numberPadState.persistence || (clockTimer.connected ? "online" : "offline");
            numberPadSettings.setAttribute(
                "aria-label",
                numberPadSettings.dataset.persistence === "pending"
                    ? "Number pad settings; trip persistence pending"
                    : numberPadSettings.dataset.persistence === "online"
                        ? "Number pad settings; trip persisted online"
                        : "Number pad settings; trip local and not persisted"
            );
        }
    }

    async function openNumberPad({ mode, source, initialValue = "", preparationPromise } = {}) {
        await ensureNumberPadLoaded();
        const initial = mode === "percent"
            ? normalizePercentDigits(initialValue)
            : normalizeTimeDigits(initialValue);
        const locked = source === "standard-time" && typeof clockTimer.standardTime === "string" && clockTimer.standardTime !== "";
        const state = {
            mode,
            source,
            initial,
            pending: initial,
            locked,
            persistence: source === "new-trip"
                ? (clockTimer.connected ? "pending" : "offline")
                : (clockTimer.connected ? "online" : "offline")
        };
        numberPadState = state;
        refreshNumberPad();
        $("#mainMenu")?.hidePopover?.();
        if (!numberPadDialog.open) numberPadDialog.showModal();

        if (preparationPromise) {
            Promise.resolve(preparationPromise).then(result => {
                if (numberPadState !== state) return;
                state.persistence = result?.persisted ? "online" : "offline";
                refreshNumberPad();
            }).catch(() => {
                if (numberPadState !== state) return;
                state.persistence = "offline";
                refreshNumberPad();
            });
        }
    }

    function closeNumberPad({ discardPrepared = true } = {}) {
        clearTimeout(numberPadLongPressTimer);
        numberPadLongPressTimer = undefined;
        numberPadLongPressed = false;
        numberPadLastClearPointerDown = 0;
        const state = numberPadState;
        if (numberPadDialog?.open) numberPadDialog.close();
        numberPadState = undefined;
        if (discardPrepared && state?.source === "new-trip") {
            clockTimer.discardPreparedTrip?.().catch?.(() => {});
        }
    }

    function requestNumberPadClose() {
        if (numberPadState?.locked) return false;
        closeNumberPad();
        return true;
    }

    function getPercentGoalValue() {
        const attribute = clockTimer.percentMode === "total" ? "total-goal" : "trip-goal";
        const raw = clockTimer.getAttribute(attribute);
        if (raw) return raw;
        const goal = Number(clockTimer.renderedPercentGoal);
        return Number.isFinite(goal) && goal > 0 ? `${Math.round(goal * 100)}%` : "100%";
    }

    async function commitNumberPad() {
        if (!numberPadState || !numberPadValueValid()) return false;
        const state = { ...numberPadState };
        if (state.mode === "percent") {
            const percent = Number(state.pending);
            const attribute = clockTimer.percentMode === "total" ? "total-goal" : "trip-goal";
            clockTimer.setAttribute(attribute, `${percent}%`);
            updateSummaryValues();
            return true;
        }

        const formatted = renderTimeDigits(state.pending);
        if (!formatted) return false;
        stagedStandardTime = formatted;
        if (state.source === "new-trip") {
            await clockTimer.start({ standardTime: formatted });
        }
        else if (clockTimer.standardTime !== undefined) {
            clockTimer.standardTime = formatted;
        }
        updateSummaryValues();
        return true;
    }

    function runNumberPadClearShortAction() {
        if (!numberPadState) return;
        if (getNumberPadClearAction() === "close") {
            requestNumberPadClose();
            return;
        }
        numberPadState.pending = "";
        refreshNumberPad();
    }

    function bindNumberPadEvents() {
        numberPadDialog.querySelectorAll("[data-number]").forEach(button => {
            button.addEventListener("click", () => {
                if (!numberPadState) return;
                numberPadState.pending += button.dataset.number;
                refreshNumberPad();
            });
        });

        numberPadConfirm.addEventListener("click", async () => {
            if (!numberPadState || numberPadConfirm.disabled) return;
            if (numberPadConfirm.dataset.action === "autocorrect") {
                numberPadState.pending = autocorrectTimeDigits(numberPadState.pending);
                refreshNumberPad();
                return;
            }
            try {
                if (await commitNumberPad()) closeNumberPad({ discardPrepared: false });
            }
            catch {
                if (numberPadState) {
                    numberPadState.persistence = "offline";
                    refreshNumberPad();
                }
            }
        });

        numberPadClear.addEventListener("pointerdown", event => {
            if (!numberPadState || getNumberPadClearAction() !== "clear") return;
            const now = performance.now();
            const doublePress = now - numberPadLastClearPointerDown <= NUMBER_PAD_DOUBLE_PRESS;
            numberPadLastClearPointerDown = now;
            numberPadLongPressed = false;
            numberPadClear.setPointerCapture?.(event.pointerId);
            clearTimeout(numberPadLongPressTimer);
            if (doublePress) {
                numberPadLongPressed = true;
                numberPadState.pending = "";
                refreshNumberPad();
                if (!numberPadState.locked) closeNumberPad();
                return;
            }
            numberPadLongPressTimer = setTimeout(() => {
                numberPadLongPressTimer = undefined;
                numberPadLongPressed = true;
                if (!numberPadState) return;
                numberPadState.pending = "";
                refreshNumberPad();
                if (!numberPadState.locked) closeNumberPad();
            }, NUMBER_PAD_LONG_PRESS);
        });

        numberPadClear.addEventListener("pointerup", event => {
            if (numberPadClear.hasPointerCapture?.(event.pointerId)) numberPadClear.releasePointerCapture(event.pointerId);
            if (numberPadLongPressTimer !== undefined) {
                clearTimeout(numberPadLongPressTimer);
                numberPadLongPressTimer = undefined;
            }
            if (numberPadLongPressed) {
                numberPadLongPressed = false;
                return;
            }
            runNumberPadClearShortAction();
        });

        numberPadClear.addEventListener("pointercancel", () => {
            clearTimeout(numberPadLongPressTimer);
            numberPadLongPressTimer = undefined;
            numberPadLongPressed = false;
        });

        numberPadClear.addEventListener("click", event => {
            if (event.detail === 0) runNumberPadClearShortAction();
        });

        numberPadSettings.addEventListener("click", () => {
            if (!numberPadState || numberPadState.mode === "percent") return;
            const state = numberPadState;
            numberPadDialog.close();
            const reopen = () => {
                stateDialog.removeEventListener("close", reopen);
                if (numberPadState === state && !numberPadDialog.open) numberPadDialog.showModal();
            };
            stateDialog.addEventListener("close", reopen);
            openDialog("stateSettingsDialog");
        });

        numberPadDialog.addEventListener("cancel", event => {
            event.preventDefault();
            requestNumberPadClose();
        });
    }

    $("#newTripButton").addEventListener("click", () => {
        const preparationPromise = clockTimer.prepareTrip({ timeout: 5000 });
        void openNumberPad({
            mode: "time",
            source: "new-trip",
            initialValue: stagedStandardTime || clockTimer.standardTime || "",
            preparationPromise
        });
    });

    $("#standardTimeButton").addEventListener("click", () => {
        void openNumberPad({
            mode: "time",
            source: "standard-time",
            initialValue: clockTimer.standardTime || stagedStandardTime || ""
        });
    });

    $("#goalPercentValue").addEventListener("click", () => {
        void openNumberPad({
            mode: "percent",
            source: "percent-goal",
            initialValue: getPercentGoalValue()
        });
    });

'''
app = replace_between(app, numberpad_block_start, numberpad_block_end, new_numberpad_block + numberpad_block_end, "number pad behavior")
app_path.write_text(app)


# --- ClockTimer.js: pending-trip reservation / finalization. ---
clock_path = Path("ClockTimer.js")
clock = clock_path.read_text()
clock = replace_once(clock, '        #tripId;\n', '        #tripId;\n\n        #preparedTrip;\n', "prepared trip private field")
clock = replace_once(
    clock,
    '        async #apiRequest(endpoint, { method = "GET", body, csrf = false, query } = {}) {',
    '        async #apiRequest(endpoint, { method = "GET", body, csrf = false, query, signal } = {}) {',
    "api request signal signature"
)
clock = replace_once(
    clock,
    '                    headers,\n                    body: body === undefined ? undefined : JSON.stringify(body)\n                });',
    '                    headers,\n                    body: body === undefined ? undefined : JSON.stringify(body),\n                    signal\n                });',
    "api request signal fetch"
)
clock = replace_once(
    clock,
    '            catch (cause) {\n                this.#setOffline({',
    '            catch (cause) {\n                if (cause?.name === "AbortError") {\n                    throw cause;\n                }\n                this.#setOffline({',
    "abort handling"
)
clock = replace_once(
    clock,
    '            return {\n                startTime,\n                endTime,\n                standardTimeMilliseconds,\n                nonProduction:\n                    this.#nonProduction\n            };',
    '''            const payload = {\n                startTime,\n                endTime,\n                standardTimeMilliseconds,\n                nonProduction:\n                    this.#nonProduction\n            };\n\n            if (typeof this.#preparedTrip?.clientToken === "string") {\n                payload.clientToken =\n                    this.#preparedTrip.clientToken;\n            }\n\n            return payload;''',
    "trip persistence payload token"
)

old_ensure = '''        async #ensureTripPersisted() {\n            if (Number.isInteger(this.#tripId) && this.#tripId > 0) {\n                return this.#tripId;\n            }\n            const data = await this.#apiRequest("trips", {\n                method: "POST",\n                csrf: true,\n                body: this.#tripPersistencePayload()\n            });\n            const tripId = Number(data.tripId);\n            if (!Number.isInteger(tripId) || tripId < 1) {\n                throw new Error("The API returned an invalid trip id.");\n            }\n            this.#tripId = tripId;\n            if (this.#originalStartArguments) {\n                this.#originalStartArguments.tripId = tripId;\n            }\n            return tripId;\n        }'''
new_ensure = '''        async #ensureTripPersisted() {\n            if (Number.isInteger(this.#tripId) && this.#tripId > 0) {\n                if (\n                    this.#preparedTrip?.pending === true &&\n                    Number(this.#preparedTrip.tripId) === this.#tripId\n                ) {\n                    await this.#apiRequest("trips", {\n                        method: "PATCH",\n                        csrf: true,\n                        body: {\n                            tripId: this.#tripId,\n                            action: "start",\n                            ...this.#tripPersistencePayload()\n                        }\n                    });\n                    this.#preparedTrip.pending = false;\n                    this.#preparedTrip.persisted = true;\n                }\n                return this.#tripId;\n            }\n            const data = await this.#apiRequest("trips", {\n                method: "POST",\n                csrf: true,\n                body: this.#tripPersistencePayload()\n            });\n            const tripId = Number(data.tripId);\n            if (!Number.isInteger(tripId) || tripId < 1) {\n                throw new Error("The API returned an invalid trip id.");\n            }\n            this.#tripId = tripId;\n            if (this.#preparedTrip) {\n                this.#preparedTrip.tripId = tripId;\n                this.#preparedTrip.persisted = true;\n                this.#preparedTrip.pending = false;\n            }\n            if (this.#originalStartArguments) {\n                this.#originalStartArguments.tripId = tripId;\n            }\n            return tripId;\n        }'''
clock = replace_once(clock, old_ensure, new_ensure, "ensure trip persisted")

prepare_methods = r'''        async prepareTrip({ timeout = 5000 } = {}) {
            const timeoutMilliseconds = Number(timeout);
            if (!Number.isFinite(timeoutMilliseconds) || timeoutMilliseconds <= 0) {
                throw new RangeError("timeout must be a positive number of milliseconds.");
            }

            const now = new Date();
            const time = this.#dateToStandardTime(now);
            const clientToken =
                globalThis.crypto?.randomUUID?.() ??
                `${Date.now()}-${Math.random().toString(16).slice(2)}`;

            const prepared = {
                clientToken,
                creationTime: time,
                startTime: time,
                creationDate: now.toISOString(),
                tripId: undefined,
                persisted: false,
                pending: true,
                reason: this.#connectionState === "connected" ? "pending" : "offline"
            };

            this.#preparedTrip = prepared;

            if (this.#connectionState !== "connected") {
                return { ...prepared };
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMilliseconds);

            try {
                const data = await this.#apiRequest("trips", {
                    method: "POST",
                    csrf: true,
                    signal: controller.signal,
                    body: {
                        action: "prepare",
                        startTime: now.toISOString(),
                        clientToken
                    }
                });

                const tripId = Number(data.tripId);
                if (!Number.isInteger(tripId) || tripId < 1) {
                    throw new Error("The API returned an invalid trip id.");
                }

                if (this.#preparedTrip?.clientToken === clientToken) {
                    this.#preparedTrip.tripId = tripId;
                    this.#preparedTrip.persisted = true;
                    this.#preparedTrip.pending = true;
                    this.#preparedTrip.reason = "online";
                    this.#tripId = tripId;
                }

                return {
                    ...prepared,
                    tripId,
                    persisted: true,
                    pending: true,
                    reason: "online"
                };
            }
            catch (error) {
                const reason = error?.name === "AbortError" ? "timeout" : "offline";
                if (this.#preparedTrip?.clientToken === clientToken) {
                    this.#preparedTrip.persisted = false;
                    this.#preparedTrip.reason = reason;
                }
                return {
                    ...prepared,
                    persisted: false,
                    reason
                };
            }
            finally {
                clearTimeout(timeoutId);
            }
        }

        async discardPreparedTrip() {
            const prepared = this.#preparedTrip;
            if (!prepared) return { discarded: false, persisted: false };

            this.#preparedTrip = undefined;
            if (!this.#hasStartProperties()) {
                this.#tripId = undefined;
            }

            if (this.#connectionState !== "connected") {
                return { discarded: true, persisted: false };
            }

            try {
                const body = Number.isInteger(Number(prepared.tripId)) && Number(prepared.tripId) > 0
                    ? { tripId: Number(prepared.tripId) }
                    : { clientToken: prepared.clientToken };
                await this.#apiRequest("trips", {
                    method: "DELETE",
                    csrf: true,
                    body
                });
                return { discarded: true, persisted: true };
            }
            catch {
                return { discarded: true, persisted: false };
            }
        }

'''
clock = replace_once(clock, '        async start(options = {}) {\n', prepare_methods + '        async start(options = {}) {\n', "prepare trip methods")
clock = replace_once(
    clock,
    '            const { tripId: ignoredTripId, ...localOptions } = options;\n            const localResult = this.#startLocal({ ...localOptions, tripId: undefined });\n            if (!localResult) {\n                throw new Error("The trip could not be started.");\n            }\n            this.#tripId = undefined;\n            this.#pendingIntervalRecord = undefined;',
    '''            const prepared = this.#preparedTrip;\n            const { tripId: ignoredTripId, ...localOptions } = options;\n            if (prepared) {\n                if (localOptions.creationTime === undefined) localOptions.creationTime = prepared.creationTime;\n                if (localOptions.startTime === undefined) localOptions.startTime = prepared.startTime;\n                if (localOptions.scheduledStart === undefined) localOptions.scheduledStart = prepared.startTime;\n            }\n            const preparedTripId = Number.isInteger(Number(prepared?.tripId)) && Number(prepared.tripId) > 0\n                ? Number(prepared.tripId)\n                : undefined;\n            const localResult = this.#startLocal({ ...localOptions, tripId: preparedTripId });\n            if (!localResult) {\n                throw new Error("The trip could not be started.");\n            }\n            this.#tripId = preparedTripId;\n            this.#pendingIntervalRecord = undefined;''',
    "start prepared trip adoption"
)
clock = replace_once(
    clock,
    '            if (this.#autoSyncTripGoal) {',
    '            if (synced && prepared && this.#preparedTrip === prepared) {\n                this.#preparedTrip = undefined;\n            }\n\n            if (this.#autoSyncTripGoal) {',
    "clear synced prepared trip"
)
clock_path.write_text(clock)


# --- trips API: support reserved/pending trips and idempotent finalization. ---
api_path = Path("api/trips/index.php")
api = api_path.read_text()
api = replace_once(
    api,
    "    $where =\n        't.user_id = :user_id '\n        . 'AND t.start_time >= :min_date_time '",
    "    $where =\n        't.user_id = :user_id '\n        . 'AND t.pending = 0 '\n        . 'AND t.start_time >= :min_date_time '",
    "exclude pending trips from reads"
)
post_start = "if ($method === 'POST') {\n"
tripid_anchor = "$tripId = require_positive_int($input, 'tripId');\n"
new_post = r'''$normalizeClientToken = static function (mixed $value): ?string {
    if ($value === null || $value === '') {
        return null;
    }
    if (!is_string($value)) {
        api_error('clientToken must be a UUID string.', 422, 'invalid_argument');
    }
    $token = strtolower(trim($value));
    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $token)) {
        api_error('clientToken must be a UUID string.', 422, 'invalid_argument');
    }
    return $token;
};

if ($method === 'POST') {
    $clientToken = $normalizeClientToken($input['clientToken'] ?? null);
    $action = isset($input['action']) && is_string($input['action'])
        ? strtolower(trim($input['action']))
        : null;

    if ($action === 'prepare') {
        if ($clientToken === null) {
            api_error('clientToken is required when preparing a trip.', 422, 'invalid_argument');
        }
        $startTime = isset($input['startTime'])
            ? normalize_datetime(require_string($input, 'startTime'), 'startTime')
            : (new DateTimeImmutable('now'))->format('Y-m-d H:i:s.v');
        $endTime = (new DateTimeImmutable($startTime))
            ->modify('+1 millisecond')
            ->format('Y-m-d H:i:s.v');

        $tripId = audited_write(
            static function (PDO $pdo) use ($startTime, $endTime, $clientToken): int {
                $existing = $pdo->prepare(
                    'SELECT id FROM trips WHERE user_id = :user_id AND client_token = :client_token LIMIT 1'
                );
                $existing->execute([
                    ':user_id' => authenticated_user_id(),
                    ':client_token' => $clientToken,
                ]);
                $existingId = (int) ($existing->fetchColumn() ?: 0);
                if ($existingId > 0) {
                    return $existingId;
                }

                $statement = $pdo->prepare(
                    'INSERT INTO trips '
                    . '(user_id, start_time, end_time, standard_time_ms, non_production, pending, client_token) '
                    . 'VALUES (:user_id, :start_time, :end_time, 1, 0, 1, :client_token)'
                );
                $statement->execute([
                    ':user_id' => authenticated_user_id(),
                    ':start_time' => $startTime,
                    ':end_time' => $endTime,
                    ':client_token' => $clientToken,
                ]);
                return (int) $pdo->lastInsertId();
            }
        );

        json_response(['tripId' => $tripId, 'pending' => true], 201);
    }

    $startTime = normalize_datetime(require_string($input, 'startTime'), 'startTime');
    $endTime = normalize_datetime(require_string($input, 'endTime'), 'endTime');
    $standardTimeMilliseconds = require_positive_int($input, 'standardTimeMilliseconds');

    $nonProduction = $input['nonProduction'] ?? false;
    if (!is_bool($nonProduction)) {
        api_error('nonProduction must be a boolean.', 422, 'invalid_argument');
    }
    $nonProductionValue = $nonProduction ? 1 : 0;

    if ($endTime <= $startTime) {
        api_error('endTime must be later than startTime.', 422, 'invalid_argument');
    }

    $tripId = audited_write(
        static function (PDO $pdo) use ($startTime, $endTime, $standardTimeMilliseconds, $nonProductionValue, $clientToken): int {
            if ($clientToken !== null) {
                $existing = $pdo->prepare(
                    'SELECT id FROM trips WHERE user_id = :user_id AND client_token = :client_token LIMIT 1 FOR UPDATE'
                );
                $existing->execute([
                    ':user_id' => authenticated_user_id(),
                    ':client_token' => $clientToken,
                ]);
                $existingId = (int) ($existing->fetchColumn() ?: 0);
                if ($existingId > 0) {
                    $update = $pdo->prepare(
                        'UPDATE trips SET start_time = :start_time, end_time = :end_time, '
                        . 'standard_time_ms = :standard_time_ms, non_production = :non_production, pending = 0 '
                        . 'WHERE id = :trip_id AND user_id = :user_id'
                    );
                    $update->execute([
                        ':start_time' => $startTime,
                        ':end_time' => $endTime,
                        ':standard_time_ms' => $standardTimeMilliseconds,
                        ':non_production' => $nonProductionValue,
                        ':trip_id' => $existingId,
                        ':user_id' => authenticated_user_id(),
                    ]);
                    return $existingId;
                }
            }

            $statement = $pdo->prepare(
                'INSERT INTO trips '
                . '(user_id, start_time, end_time, standard_time_ms, non_production, pending, client_token) '
                . 'VALUES (:user_id, :start_time, :end_time, :standard_time_ms, :non_production, 0, :client_token)'
            );
            $statement->execute([
                ':user_id' => authenticated_user_id(),
                ':start_time' => $startTime,
                ':end_time' => $endTime,
                ':standard_time_ms' => $standardTimeMilliseconds,
                ':non_production' => $nonProductionValue,
                ':client_token' => $clientToken,
            ]);
            return (int) $pdo->lastInsertId();
        }
    );

    json_response(['tripId' => $tripId, 'pending' => false], 201);
}

if ($method === 'DELETE' && !array_key_exists('tripId', $input)) {
    $clientToken = $normalizeClientToken($input['clientToken'] ?? null);
    if ($clientToken === null) {
        api_error('tripId or clientToken is required.', 422, 'invalid_argument');
    }
    audited_write(static function (PDO $pdo) use ($clientToken): void {
        $statement = $pdo->prepare(
            'DELETE FROM trips WHERE user_id = :user_id AND client_token = :client_token AND pending = 1'
        );
        $statement->execute([
            ':user_id' => authenticated_user_id(),
            ':client_token' => $clientToken,
        ]);
    });
    json_response(['clientToken' => $clientToken]);
}

'''
api = replace_between(api, post_start, tripid_anchor, new_post + tripid_anchor, "trip POST block")
api = replace_once(
    api,
    "if ($action === 'stop') {\n",
    r'''if ($action === 'start') {
    $startTime = normalize_datetime(require_string($input, 'startTime'), 'startTime');
    $endTime = normalize_datetime(require_string($input, 'endTime'), 'endTime');
    $standardTimeMilliseconds = require_positive_int($input, 'standardTimeMilliseconds');
    $nonProduction = $input['nonProduction'] ?? false;
    if (!is_bool($nonProduction)) {
        api_error('nonProduction must be a boolean.', 422, 'invalid_argument');
    }
    $nonProductionValue = $nonProduction ? 1 : 0;
    if ($endTime <= $startTime) {
        api_error('endTime must be later than startTime.', 422, 'invalid_argument');
    }

    audited_write(
        static function (PDO $pdo) use ($tripId, $startTime, $endTime, $standardTimeMilliseconds, $nonProductionValue): void {
            require_trip_owner($pdo, $tripId);
            $statement = $pdo->prepare(
                'UPDATE trips SET start_time = :start_time, end_time = :end_time, '
                . 'standard_time_ms = :standard_time_ms, non_production = :non_production, pending = 0 '
                . 'WHERE id = :trip_id AND user_id = :user_id'
            );
            $statement->execute([
                ':start_time' => $startTime,
                ':end_time' => $endTime,
                ':standard_time_ms' => $standardTimeMilliseconds,
                ':non_production' => $nonProductionValue,
                ':trip_id' => $tripId,
                ':user_id' => authenticated_user_id(),
            ]);
        }
    );

    json_response(['tripId' => $tripId, 'pending' => false]);
}

if ($action === 'stop') {
''',
    "trip start patch action"
)
api_path.write_text(api)


# --- Schema and migration for pending reservations / idempotency. ---
schema_path = Path("database/create_database.sql")
schema = schema_path.read_text()
schema = replace_once(
    schema,
    "    `non_production` TINYINT(1) NOT NULL DEFAULT 0,\n    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),",
    "    `non_production` TINYINT(1) NOT NULL DEFAULT 0,\n    `pending` TINYINT(1) NOT NULL DEFAULT 0,\n    `client_token` CHAR(36) NULL,\n    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),",
    "trip pending schema columns"
)
schema = replace_once(
    schema,
    "    KEY `idx_trips_user_start` (`user_id`, `start_time`),\n",
    "    KEY `idx_trips_user_start` (`user_id`, `start_time`),\n    UNIQUE KEY `uq_trips_client_token` (`client_token`),\n",
    "trip client token index"
)
schema = replace_once(
    schema,
    "    CONSTRAINT `chk_trips_non_production`\n        CHECK (`non_production` IN (0, 1))\n",
    "    CONSTRAINT `chk_trips_non_production`\n        CHECK (`non_production` IN (0, 1)),\n    CONSTRAINT `chk_trips_pending`\n        CHECK (`pending` IN (0, 1))\n",
    "trip pending check"
)
schema_path.write_text(schema)

migration = Path("database/migrations/20260915_add_pending_trip_reservations.sql")
migration.write_text('''ALTER TABLE `trips`
    ADD COLUMN `pending` TINYINT(1) NOT NULL DEFAULT 0 AFTER `non_production`,
    ADD COLUMN `client_token` CHAR(36) NULL AFTER `pending`,
    ADD UNIQUE KEY `uq_trips_client_token` (`client_token`),
    ADD CONSTRAINT `chk_trips_pending` CHECK (`pending` IN (0, 1));
''')


# --- Sanity checks performed before the workflow commits. ---
assert 'numberPadSettings.dataset.persistence' in app
assert 'clockTimer.prepareTrip({ timeout: 5000 })' in app
assert 'data-persistence="offline"' in Path("numberpad.html").read_text()
assert 'async prepareTrip({ timeout = 5000 } = {})' in clock
assert "action: \"prepare\"" in clock
assert "'AND t.pending = 0 '" in api
assert "if ($action === 'prepare')" in api
assert "if ($action === 'start')" in api
print("number pad persistence patch applied")
