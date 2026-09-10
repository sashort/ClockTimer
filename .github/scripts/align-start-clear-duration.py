from pathlib import Path

replacements = {
    "TimeRange.js": [
        (
            "    static #animationDuration = 1000;",
            "    static #animationDuration = 333;"
        )
    ],
    "RingContainer.js": [
        (
            '            "333.333ms"',
            '            "333ms"'
        )
    ]
}

for filename, changes in replacements.items():
    path = Path(filename)
    text = path.read_text()

    for old, new in changes:
        count = text.count(old)
        if count == 0:
            raise SystemExit(f"Missing expected text in {filename}: {old!r}")
        text = text.replace(old, new)

    path.write_text(text)
