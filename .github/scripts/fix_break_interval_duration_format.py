from pathlib import Path

path = Path('app.js')
text = path.read_text()
replacements = {
    'break: { type: "break", length: "0:15:00", attributes: { breakType: "break" } }': 'break: { type: "break", length: "15:00", attributes: { breakType: "break" } }',
    'lunch: { type: "lunch", length: "0:30:00", attributes: { breakType: "lunch" } }': 'lunch: { type: "lunch", length: "30:00", attributes: { breakType: "lunch" } }',
    '"short-break": { type: "break", length: "0:10:00", attributes: { breakType: "short" } }': '"short-break": { type: "break", length: "10:00", attributes: { breakType: "short" } }',
    '            "0:02:30",\n            "0:02:30"': '            "2:30",\n            "2:30"',
}
for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'Expected exactly one occurrence of {old!r}, found {count}')
    text = text.replace(old, new)

path.write_text(text)
