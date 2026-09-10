from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

# Rolling tick marks are seconds, not minutes.
text = text.replace('''                const minute =\n                    now.getMinutes();''', '''                const second =\n                    now.getSeconds();''', 1)
text = text.replace('''                    const tickMinute =\n                        (\n                            minute +\n                            offset +\n                            60\n                        ) % 60;''', '''                    const tickSecond =\n                        (\n                            second +\n                            offset +\n                            60\n                        ) % 60;''', 1)
text = text.replace('''                            tickMinute * 6,''', '''                            tickSecond * 6,''', 1)

# Update rolling marks on exact second boundaries.
old = '''                const millisecondsToNextMinute =\n                    60 * 1000 -\n                    (\n                        now.getSeconds() *\n                            1000 +\n                        now.getMilliseconds()\n                    );'''
new = '''                const millisecondsToNextSecond =\n                    now.getMilliseconds() === 0\n                        ? 1000\n                        : 1000 -\n                            now.getMilliseconds();'''
if old not in text:
    raise SystemExit('rolling timer block not found')
text = text.replace(old, new, 1)
text = text.replace('''                        millisecondsToNextMinute\n                    );''', '''                        millisecondsToNextSecond\n                    );''', 1)

# Clarify fixed mode naming as seconds while preserving 5-second positions.
text = text.replace('''                    let minute = 0;\n                    minute < 60;\n                    minute += 5''', '''                    let second = 0;\n                    second < 60;\n                    second += 5''', 1)
text = text.replace('''                            minute * 6,\n                            true''', '''                            second * 6,\n                            true''', 1)

path.write_text(text)
