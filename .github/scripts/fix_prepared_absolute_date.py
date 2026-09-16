from pathlib import Path

path = Path('app.js')
text = path.read_text()
old = '''    function getAbsolutePadInitial(value) {
        const milliseconds = parseTimelineTime(value);
        const base = getTripBaseDate();'''
new = '''    function getAbsolutePadInitial(value, creationDate) {
        const milliseconds = parseTimelineTime(value);
        const base = parseDateInput(creationDate) || getTripBaseDate();'''
if text.count(old) != 1:
    raise SystemExit(f'getAbsolutePadInitial match count: {text.count(old)}')
text = text.replace(old, new, 1)
old = '''        if (normalizedMode === "absolute") {
            const absolute = getAbsolutePadInitial(initialValue);'''
new = '''        if (normalizedMode === "absolute") {
            const absolute = getAbsolutePadInitial(initialValue, tripDefaults?.creationDate);'''
if text.count(old) != 1:
    raise SystemExit(f'absolute initialization match count: {text.count(old)}')
text = text.replace(old, new, 1)
path.write_text(text)
