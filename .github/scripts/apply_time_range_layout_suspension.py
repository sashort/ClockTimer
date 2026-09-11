from pathlib import Path

path = Path("TimeRange.js")
text = path.read_text()

old_signature = '''    static calculateCorners(
        startAngle,
        endAngle,
        width,
        height,
        parent = undefined,
        mode = "radial"
    ) {'''
new_signature = '''    static calculateCorners({
        startAngle,
        endAngle,
        width,
        height,
        parent = undefined,
        mode = "radial"
    } = {}) {'''

if text.count(old_signature) != 1:
    raise SystemExit("Expected exactly one calculateCorners signature")

text = text.replace(
    old_signature,
    new_signature,
    1
)

old_call = '''        const corners =
            TimeRange.calculateCorners(
                startAngle,
                endAngle,
                width,
                height
            );'''
new_call = '''        const corners =
            TimeRange.calculateCorners({
                startAngle,
                endAngle,
                width,
                height
            });'''

if text.count(old_call) != 1:
    raise SystemExit("Expected exactly one calculateCorners call site")

text = text.replace(
    old_call,
    new_call,
    1
)

path.write_text(text)
