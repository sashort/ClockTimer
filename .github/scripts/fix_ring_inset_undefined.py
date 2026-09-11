from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()

old = '''        if (\n            inset !== null &&\n            inset\n                .trim()\n                .toLowerCase() !==\n                "auto"\n        ) {'''

new = '''        if (\n            inset !== null &&\n            inset !== undefined &&\n            inset\n                .trim()\n                .toLowerCase() !==\n                "auto"\n        ) {'''

count = text.count(old)
if count != 1:
    raise RuntimeError(f"expected exactly one calculateEffectiveInset match, found {count}")

path.write_text(text.replace(old, new, 1))
