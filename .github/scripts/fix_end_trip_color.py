from pathlib import Path

path = Path('app.css')
css = path.read_text()
old = '''.end-trip-button,
.break-button {
    color: var(--wm-white);
    background: var(--timer-break-color, #001e60);
}'''
new = '''.end-trip-button {
    background: var(--wm-yellow);
}

.break-button {
    color: var(--wm-white);
    background: var(--timer-break-color, #001e60);
}'''
if old not in css:
    raise SystemExit('end/break grouped selector not found')
path.write_text(css.replace(old, new, 1))
