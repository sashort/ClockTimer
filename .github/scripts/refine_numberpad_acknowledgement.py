from pathlib import Path

app_path = Path('app.js')
css_path = Path('app.css')
app = app_path.read_text()
css = css_path.read_text()

replacements = [
    (
'''    function getNumberPadClearAction() {
        if (!numberPadState) return "close";
        return numberPadState.pending === "" || numberPadState.pending === numberPadState.initial
            ? "close"
            : "clear";
    }
''',
'''    function numberPadHasChanges() {
        return Boolean(numberPadState) &&
            numberPadState.pending !== numberPadState.initial;
    }

    function getNumberPadClearAction() {
        if (!numberPadState) return "close";
        return numberPadHasChanges() ? "reset" : "close";
    }
'''
    ),
    (
'''        const clearAction = getNumberPadClearAction();
        numberPadClear.dataset.action = clearAction;
        numberPadClear.setAttribute("aria-label", clearAction === "clear" ? "Clear" : "Close");

        const valid = numberPadValueValid();
        const autocorrect = !percentMode && numberPadState.pending !== "" && !valid;
        numberPadConfirm.dataset.action = autocorrect ? "autocorrect" : "confirm";
        numberPadConfirm.setAttribute("aria-label", autocorrect ? "Auto-Correct" : "Confirm");
        numberPadConfirm.disabled = !autocorrect && !valid;
''',
'''        const changed = numberPadHasChanges();
        const clearAction = getNumberPadClearAction();
        numberPadClear.dataset.action = clearAction;
        numberPadClear.setAttribute("aria-label", clearAction === "reset" ? "Reset" : "Close");

        const valid = numberPadValueValid();
        const autocorrect = changed && !percentMode && numberPadState.pending !== "" && !valid;
        numberPadConfirm.dataset.action = autocorrect ? "autocorrect" : "confirm";
        numberPadConfirm.setAttribute("aria-label", autocorrect ? "Auto-Correct" : "Confirm");
        numberPadConfirm.disabled = !changed || (!autocorrect && !valid);
        numberPadSettings.disabled = changed;
'''
    ),
    (
'''        const locked = source === "standard-time" && typeof clockTimer.standardTime === "string" && clockTimer.standardTime !== "";
        const state = {
            mode,
            source,
            initial,
            pending: initial,
            replaceOnNextDigit: source !== "new-trip",
            locked,
            persistence: source === "new-trip"
''',
'''        const state = {
            mode,
            source,
            initial,
            pending: initial,
            replaceOnNextDigit: source !== "new-trip",
            persistence: source === "new-trip"
'''
    ),
    (
'''        if (numberPadConfirm) {
            numberPadConfirm.dataset.action = "confirm";
            numberPadConfirm.setAttribute("aria-label", "Confirm");
            numberPadConfirm.disabled = true;
        }
    }

    function closeNumberPad({ discardPrepared = true } = {}) {
        const state = numberPadState;
        if (numberPadDialog?.open && !closeDialog(numberPadDialog, { reason: "number-pad" })) {
            return false;
        }
''',
'''        if (numberPadConfirm) {
            numberPadConfirm.dataset.action = "confirm";
            numberPadConfirm.setAttribute("aria-label", "Confirm");
            numberPadConfirm.disabled = true;
        }
        if (numberPadSettings) numberPadSettings.disabled = false;
    }

    function closeNumberPad({ discardPrepared = true, allowChanged = false } = {}) {
        const state = numberPadState;
        if (!allowChanged && numberPadHasChanges()) return false;
        if (numberPadDialog?.open && !closeDialog(numberPadDialog, { reason: "number-pad" })) {
            return false;
        }
'''
    ),
    (
'''    function requestNumberPadClose() {
        if (numberPadState?.locked) return false;
        return closeNumberPad();
    }
''',
'''    function requestNumberPadClose() {
        return closeNumberPad();
    }
'''
    ),
    (
'''    async function commitNumberPad() {
        if (!numberPadState || !numberPadValueValid()) return false;
''',
'''    async function commitNumberPad() {
        if (!numberPadState || !numberPadHasChanges() || !numberPadValueValid()) return false;
'''
    ),
    (
'''    function runNumberPadClearShortAction() {
        if (!numberPadState) return;
        if (getNumberPadClearAction() === "close") {
            requestNumberPadClose();
            return;
        }
        numberPadState.pending = numberPadState.initial;
        numberPadState.replaceOnNextDigit = numberPadState.source !== "new-trip";
        refreshNumberPad();
    }
''',
'''    function resetNumberPadPendingValue() {
        if (!numberPadState) return;
        numberPadState.pending = numberPadState.initial;
        numberPadState.replaceOnNextDigit = numberPadState.source !== "new-trip";
        refreshNumberPad();
    }

    function runNumberPadClearShortAction() {
        if (!numberPadState) return;
        if (getNumberPadClearAction() === "close") {
            requestNumberPadClose();
            return;
        }
        resetNumberPadPendingValue();
    }
'''
    ),
    (
'''                if (await commitNumberPad()) closeNumberPad({ discardPrepared: false });
''',
'''                if (await commitNumberPad()) closeNumberPad({ discardPrepared: false, allowChanged: true });
'''
    ),
    (
'''        numberPadClear.addEventListener("pointerdown", event => {
            if (!numberPadState || getNumberPadClearAction() !== "clear") return;
''',
'''        numberPadClear.addEventListener("pointerdown", event => {
            if (!numberPadState || getNumberPadClearAction() !== "reset") return;
'''
    ),
    (
'''            if (doublePress) {
                numberPadLongPressed = true;
                numberPadState.pending = "";
                refreshNumberPad();
                if (!numberPadState.locked) closeNumberPad();
                return;
            }
''',
'''            if (doublePress) {
                numberPadLongPressed = true;
                resetNumberPadPendingValue();
                return;
            }
'''
    ),
    (
'''            numberPadLongPressTimer = setTimeout(() => {
                numberPadLongPressTimer = undefined;
                numberPadLongPressed = true;
                if (!numberPadState) return;
                numberPadState.pending = "";
                refreshNumberPad();
                if (!numberPadState.locked) closeNumberPad();
            }, NUMBER_PAD_LONG_PRESS);
''',
'''            numberPadLongPressTimer = setTimeout(() => {
                numberPadLongPressTimer = undefined;
                numberPadLongPressed = true;
                if (!numberPadState) return;
                resetNumberPadPendingValue();
            }, NUMBER_PAD_LONG_PRESS);
'''
    ),
    (
'''        numberPadSettings.addEventListener("pointerup", () => {
            if (!numberPadState || numberPadState.mode === "percent") return;
''',
'''        numberPadSettings.addEventListener("pointerup", () => {
            if (!numberPadState || numberPadState.mode === "percent" || numberPadHasChanges()) return;
'''
    ),
]

for old, new in replacements:
    if old not in app:
        raise SystemExit(f'app.js anchor not found:\n{old[:160]}')
    app = app.replace(old, new, 1)

css_old = '''.number-pad-clear[data-action="clear"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}
'''
css_new = '''.number-pad-clear[data-action="reset"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 7V3L2 6l3 3V7a8 8 0 1 1-1.2 9.2' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 7V3L2 6l3 3V7a8 8 0 1 1-1.2 9.2' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}
'''
if css_old not in css:
    raise SystemExit('app.css reset icon anchor not found')
css = css.replace(css_old, css_new, 1)

settings_anchor = '''.number-pad-settings[hidden] { display: none; }
.number-pad-header.percent-mode { grid-template-columns: 1fr; }
'''
settings_replacement = '''.number-pad-settings[hidden] { display: none; }
.number-pad-settings:disabled { opacity: 0.38; cursor: not-allowed; }
.number-pad-header.percent-mode { grid-template-columns: 1fr; }
'''
if settings_anchor not in css:
    raise SystemExit('app.css settings disabled anchor not found')
css = css.replace(settings_anchor, settings_replacement, 1)

app_path.write_text(app)
css_path.write_text(css)
