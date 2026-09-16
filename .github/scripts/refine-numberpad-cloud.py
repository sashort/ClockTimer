from pathlib import Path

app = Path("app.js")
text = app.read_text()
replacements = [
    (
        'numberPadState.pending ? `${Number(numberPadState.pending)}%` : ""',
        'numberPadState.pending ? `${Number(numberPadState.pending)}%` : "---"',
    ),
    (
        'numberPadState.pending ? renderAbsoluteDigits(numberPadState.pending) : ""',
        'numberPadState.pending ? renderAbsoluteDigits(numberPadState.pending) : "---"',
    ),
    (
        'numberPadState.pending ? renderTimeDigits(numberPadState.pending) : ""',
        'numberPadState.pending ? renderTimeDigits(numberPadState.pending) : "---"',
    ),
]
for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"app.js replacement count={count}: {old}")
    text = text.replace(old, new, 1)
app.write_text(text)

css = Path("app.css")
text = css.read_text()
marker = '''.number-pad-settings[data-persistence="pending"] .number-pad-persistence-badge { display: none; }
.number-pad-settings[data-persistence="online"] .number-pad-persistence-badge { background: var(--wm-blue); }
.number-pad-settings[data-persistence="offline"] .number-pad-persistence-badge { background: var(--wm-gray); }'''
replacement = '''.number-pad-settings[data-persistence="pending"] .number-pad-persistence-badge { display: none; }
.number-pad-settings[data-persistence="online"] .number-pad-persistence-badge,
.number-pad-settings[data-persistence="offline"] .number-pad-persistence-badge {
    animation: number-pad-cloud-fade-in 250ms linear both;
}
.number-pad-settings[data-persistence="online"] .number-pad-persistence-badge { background: var(--wm-blue); }
.number-pad-settings[data-persistence="offline"] .number-pad-persistence-badge { background: var(--wm-gray); }

@keyframes number-pad-cloud-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
}'''
count = text.count(marker)
if count != 1:
    raise SystemExit(f"app.css persistence marker count={count}")
css.write_text(text.replace(marker, replacement, 1))
