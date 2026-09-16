from pathlib import Path

app = Path('app.js')
text = app.read_text()

old = '''    function getNumberPadClearAction() {
        if (!numberPadState) return "close";
        if (numberPadHasChanges()) return "reset";
        return peekUIReturnFrame() ? "back" : "close";
    }'''
new = '''    function getNumberPadClearAction() {
        if (!numberPadState) return "close";
        if (numberPadHasChanges()) return "reset";
        if (peekUIReturnFrame()) return "back";
        if (numberPadState.source === "standard-time" && !numberPadState.everEdited) {
            return "home";
        }
        return "close";
    }'''
if text.count(old) != 1:
    raise SystemExit(f'clear action block count={text.count(old)}')
text = text.replace(old, new, 1)

old = '''            clearAction === "reset"
                ? "Reset"
                : clearAction === "back"
                    ? "Back"
                    : "Close"'''
new = '''            clearAction === "reset"
                ? "Reset"
                : clearAction === "back"
                    ? "Back"
                    : clearAction === "home"
                        ? "Home"
                        : "Close"'''
if text.count(old) != 1:
    raise SystemExit(f'aria action block count={text.count(old)}')
text = text.replace(old, new, 1)

old = '''            startsTripOnConfirm: Boolean(startsTripOnConfirm)
        };'''
new = '''            startsTripOnConfirm: Boolean(startsTripOnConfirm),
            everEdited: false
        };'''
if text.count(old) != 1:
    raise SystemExit(f'state tail count={text.count(old)}')
text = text.replace(old, new, 1)

old = '''        if (action === "close" || action === "back") {
            void requestNumberPadClose().catch(() => {});
            return;
        }'''
new = '''        if (action === "close" || action === "back" || action === "home") {
            void requestNumberPadClose().catch(() => {});
            return;
        }'''
if text.count(old) != 1:
    raise SystemExit(f'short action block count={text.count(old)}')
text = text.replace(old, new, 1)

old = '''            button.addEventListener("pointerup", () => {
                if (!numberPadState) return;
                if (numberPadState.replaceOnNextDigit) {
                    numberPadState.pending = "";
                    numberPadState.replaceOnNextDigit = false;
                }
                const candidate = numberPadState.pending + button.dataset.number;
                if (numberPadState.mode === "absolute" && candidate.length > 6) return;
                numberPadState.pending = candidate;
                refreshNumberPad();
            });'''
new = '''            button.addEventListener("pointerup", () => {
                if (!numberPadState) return;
                const previousPending = numberPadState.pending;
                if (numberPadState.replaceOnNextDigit) {
                    numberPadState.pending = "";
                    numberPadState.replaceOnNextDigit = false;
                }
                const candidate = numberPadState.pending + button.dataset.number;
                if (numberPadState.mode === "absolute" && candidate.length > 6) return;
                numberPadState.pending = candidate;
                if (candidate !== previousPending) numberPadState.everEdited = true;
                refreshNumberPad();
            });'''
if text.count(old) != 1:
    raise SystemExit(f'number input block count={text.count(old)}')
text = text.replace(old, new, 1)

old = '''        numberPadDate.addEventListener("input", () => {
            if (!numberPadState || numberPadState.mode !== "absolute") return;
            numberPadState.pendingDate = numberPadDate.value;
            refreshNumberPad();
        });'''
new = '''        numberPadDate.addEventListener("input", () => {
            if (!numberPadState || numberPadState.mode !== "absolute") return;
            if (numberPadState.pendingDate !== numberPadDate.value) {
                numberPadState.everEdited = true;
            }
            numberPadState.pendingDate = numberPadDate.value;
            refreshNumberPad();
        });'''
if text.count(old) != 1:
    raise SystemExit(f'date input block count={text.count(old)}')
text = text.replace(old, new, 1)

old = '''    function changeNumberPadMeridiem(next) {
        if (!numberPadState || numberPadState.mode !== "absolute") return;
        const parts = splitAbsoluteDigits(numberPadState.pending);
        if (!parts) return;
        const previous = numberPadState.meridiem;
        const target = previous === next ? null : next;'''
new = '''    function changeNumberPadMeridiem(next) {
        if (!numberPadState || numberPadState.mode !== "absolute") return;
        const parts = splitAbsoluteDigits(numberPadState.pending);
        if (!parts) return;
        const previous = numberPadState.meridiem;
        const target = previous === next ? null : next;
        if (target !== previous) numberPadState.everEdited = true;'''
if text.count(old) != 1:
    raise SystemExit(f'meridiem block count={text.count(old)}')
text = text.replace(old, new, 1)

app.write_text(text)

css = Path('app.css')
text = css.read_text()
marker = '''.number-pad-clear[data-action="back"]::before {
    width: 54%;
    height: 54%;
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 88 66'%3E%3Cpath d='M24 8 8 24l16 15M10 24h43c11 0 20 7.5 20 17S65 57 55 57H41' fill='none' stroke='black' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 88 66'%3E%3Cpath d='M24 8 8 24l16 15M10 24h43c11 0 20 7.5 20 17S65 57 55 57H41' fill='none' stroke='black' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}
'''
home = marker + '''
.number-pad-clear[data-action="home"]::before {
    width: 48%;
    height: 48%;
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3Z' fill='black'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3Z' fill='black'/%3E%3C/svg%3E");
}
'''
if text.count(marker) != 1:
    raise SystemExit(f'back css block count={text.count(marker)}')
text = text.replace(marker, home, 1)
css.write_text(text)
