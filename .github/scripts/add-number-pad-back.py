from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


app_path = Path("app.js")
app = app_path.read_text(encoding="utf-8")

app = replace_once(
    app,
    '''    function getNumberPadClearAction() {
        if (!numberPadState) return "close";
        return numberPadHasChanges() ? "reset" : "close";
    }
''',
    '''    function getNumberPadClearAction() {
        if (!numberPadState) return "close";
        if (numberPadHasChanges()) return "reset";
        return peekUIReturnFrame() ? "back" : "close";
    }
''',
    "clear action"
)

app = replace_once(
    app,
    '''        numberPadClear.dataset.action = clearAction;
        numberPadClear.setAttribute("aria-label", clearAction === "reset" ? "Reset" : "Close");
''',
    '''        numberPadClear.dataset.action = clearAction;
        numberPadClear.setAttribute(
            "aria-label",
            clearAction === "reset"
                ? "Reset"
                : clearAction === "back"
                    ? "Back"
                    : "Close"
        );
''',
    "clear aria label"
)

app = replace_once(
    app,
    '''    function runNumberPadClearShortAction() {
        if (!numberPadState) return;
        if (getNumberPadClearAction() === "close") {
            void requestNumberPadClose().catch(() => {});
            return;
        }
        resetNumberPadPendingValue();
    }
''',
    '''    function runNumberPadClearShortAction() {
        if (!numberPadState) return;
        const action = getNumberPadClearAction();
        if (action === "close" || action === "back") {
            void requestNumberPadClose().catch(() => {});
            return;
        }
        resetNumberPadPendingValue();
    }
''',
    "clear short action"
)

app_path.write_text(app, encoding="utf-8")

css_path = Path("app.css")
css = css_path.read_text(encoding="utf-8")

close_rule = '''.number-pad-clear[data-action="close"]::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 5l14 14M19 5 5 19' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 5l14 14M19 5 5 19' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E");
}
'''

back_rule = '''
.number-pad-clear[data-action="back"]::before {
    width: 54%;
    height: 54%;
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 88 66'%3E%3Cpath d='M24 8 8 24l16 15M10 24h43c11 0 20 7.5 20 17S65 57 55 57H41' fill='none' stroke='black' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 88 66'%3E%3Cpath d='M24 8 8 24l16 15M10 24h43c11 0 20 7.5 20 17S65 57 55 57H41' fill='none' stroke='black' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}
'''

css = replace_once(
    css,
    close_rule,
    close_rule + back_rule,
    "back icon css"
)

css_path.write_text(css, encoding="utf-8")
