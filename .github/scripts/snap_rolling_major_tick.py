from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()
old = '''                    fragment.appendChild(
                        this.#createTickMark(
                            tickSecond * 6,
                            offset === 0
                        )
                    );'''
new = '''                    fragment.appendChild(
                        this.#createTickMark(
                            tickSecond * 6,
                            tickSecond % 5 === 0
                        )
                    );'''
if text.count(old) != 1:
    raise SystemExit(f'expected one rolling major-tick block, found {text.count(old)}')
text = text.replace(old, new, 1)
path.write_text(text)
