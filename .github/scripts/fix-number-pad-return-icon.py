from pathlib import Path

path = Path("app.js")
text = path.read_text()
old = '''        if (!closeDialog(dialog, { reason, immediate: handoffImmediate })) return false;
        if (caller) popUIReturnFrame(caller);
        return true;
'''
new = '''        if (!closeDialog(dialog, { reason, immediate: handoffImmediate })) return false;
        if (caller) {
            popUIReturnFrame(caller);
            if (caller.type === "number-pad" && numberPadDialog?.open) {
                refreshNumberPad();
            }
        }
        return true;
'''
if old not in text:
    raise SystemExit("closeDialogWithReturn target not found")
text = text.replace(old, new, 1)
path.write_text(text)
