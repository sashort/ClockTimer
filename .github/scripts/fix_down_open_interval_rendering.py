from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

old = '''            if (
                this.#getTimerType() !==
                    "radial-overflow"
            ) {
                this.#syncOpenEndedRangeElements(
                    record,
                    now
                );
            }
'''
new = '''            this.#syncOpenEndedRangeElements(
                record,
                now
            );
'''

count = text.count(old)
if count != 1:
    raise SystemExit(f'expected exactly one open-ended mode gate, found {count}')

text = text.replace(old, new, 1)
path.write_text(text)
