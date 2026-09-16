from pathlib import Path

app = Path("app.js")
text = app.read_text()
old = '''    $("#standardTimeButton").addEventListener("pointerup", () => {
        void openNumberPad({
            mode: "time",
            source: "standard-time",
            initialValue: clockTimer.standardTime || stagedStandardTime || ""
        }).catch(() => {});
    });'''
new = '''    $("#standardTimeButton").addEventListener("pointerup", () => {
        if (!tripIsLive() || clockTimer.percentMode === "total") return;
        void openNumberPad({
            mode: "time",
            source: "standard-time",
            initialValue: clockTimer.standardTime || stagedStandardTime || ""
        }).catch(() => {});
    });'''
if text.count(old) != 1:
    raise SystemExit(f"standardTimeButton block count={text.count(old)}")
app.write_text(text.replace(old, new, 1))

css = Path("app.css")
text = css.read_text()
marker = '''button, input, select { font: inherit; }
button { cursor: pointer; }'''
replacement = '''button, input, select { font: inherit; }
button {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}

button:active:not(:disabled) {
    text-shadow: 0 2px 3px rgb(0 0 0 / 48%), 0 0 5px rgb(255 255 255 / 18%);
    box-shadow: inset 0 4px 8px rgb(0 0 0 / 38%), inset 0 1px 2px rgb(0 0 0 / 52%);
}'''
if text.count(marker) != 1:
    raise SystemExit(f"base button marker count={text.count(marker)}")
css.write_text(text.replace(marker, replacement, 1))
