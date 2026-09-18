from pathlib import Path

path = Path("TimeRange.js")
text = path.read_text()

old = '''        ) {
            const existing =
                instances[i];

            if (
                existing === this ||
                existing.parentElement !==
                    this.parentElement ||
'''

new = '''        ) {
            const existing =
                instances[i];

            if (
                !(existing instanceof TimeRange) ||
                !existing.isConnected
            ) {
                instances.splice(
                    i,
                    1
                );

                continue;
            }

            if (
                existing === this ||
                existing.parentElement !==
                    this.parentElement ||
'''

count = text.count(old)
if count != 1:
    raise SystemExit(
        f"expected one removeOverlaps registry access, found {count}"
    )

text = text.replace(old, new, 1)
path.write_text(text)
