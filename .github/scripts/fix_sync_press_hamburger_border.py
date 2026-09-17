from pathlib import Path

path = Path('app.css')
text = path.read_text()

old = '''.header-button {
    background: transparent;
    border-color: rgb(255 255 255 / 52%);
    box-shadow: var(--ui-inner-highlight);
}'''
new = '''.header-button:not(.hamburger-button) {
    background: transparent;
    border-color: rgb(255 255 255 / 52%);
    box-shadow: var(--ui-inner-highlight);
}'''
if text.count(old) != 1:
    raise SystemExit(f'header-button override count: {text.count(old)}')
text = text.replace(old, new, 1)

old = '''button:active:not(:disabled) {
    filter: brightness(0.92);
    transform: translateY(1px);
}'''
new = '''button:active:not(:disabled):not(#goalSyncButton) {
    filter: brightness(0.92);
    transform: translateY(1px);
}'''
if text.count(old) != 1:
    raise SystemExit(f'button active rule count: {text.count(old)}')
text = text.replace(old, new, 1)

path.write_text(text)
