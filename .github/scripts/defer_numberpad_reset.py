from pathlib import Path

path = Path("app.js")
text = path.read_text(encoding="utf-8")
old = '''        if (caller) popUIReturnFrame(caller);\n        if (!numberPadDialog?.open) resetNumberPad();\n        if (discardPrepared && state?.source === "new-trip") {'''
new = '''        if (caller) popUIReturnFrame(caller);\n        if (discardPrepared && state?.source === "new-trip") {'''
count = text.count(old)
if count != 1:
    raise RuntimeError(f"expected one immediate reset block, found {count}")
text = text.replace(old, new, 1)
if text.count('numberPadDialog.addEventListener("close", () => {\n            resetNumberPad();\n        });') != 1:
    raise RuntimeError("number pad close-event reset missing")
path.write_text(text, encoding="utf-8")
