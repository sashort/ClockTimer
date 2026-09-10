from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

host_anchor = '''                :host {\n                    position: relative;'''
host_replacement = '''                :host {\n                    --clock-timer-tick-inset:\n                        clamp(8px, 4cqi, 20px);\n\n                    --clock-timer-tick-width:\n                        clamp(1px, 0.45cqi, 2px);\n\n                    --clock-timer-tick-length:\n                        clamp(5px, 2.5cqi, 11px);\n\n                    --clock-timer-major-tick-width:\n                        clamp(2px, 0.75cqi, 3px);\n\n                    --clock-timer-major-tick-length:\n                        clamp(9px, 4cqi, 18px);\n\n                    --clock-timer-tick-color:\n                        currentColor;\n\n                    position: relative;'''

if host_anchor not in text:
    raise SystemExit('host anchor not found')
text = text.replace(host_anchor, host_replacement, 1)

replacements = {
'''                        var(\n                            --clock-timer-tick-inset,\n                            clamp(8px, 4cqi, 20px)\n                        );''': '''                        var(\n                            --clock-timer-tick-inset\n                        );''',
'''                        var(\n                            --clock-timer-tick-width,\n                            clamp(1px, 0.45cqi, 2px)\n                        );''': '''                        var(\n                            --clock-timer-tick-width\n                        );''',
'''                        var(\n                            --clock-timer-tick-length,\n                            clamp(5px, 2.5cqi, 11px)\n                        );''': '''                        var(\n                            --clock-timer-tick-length\n                        );''',
'''                        var(\n                            --clock-timer-tick-color,\n                            currentColor\n                        );''': '''                        var(\n                            --clock-timer-tick-color\n                        );''',
'''                        var(\n                            --clock-timer-major-tick-width,\n                            clamp(2px, 0.75cqi, 3px)\n                        );''': '''                        var(\n                            --clock-timer-major-tick-width\n                        );''',
'''                        var(\n                            --clock-timer-major-tick-length,\n                            clamp(9px, 4cqi, 18px)\n                        );''': '''                        var(\n                            --clock-timer-major-tick-length\n                        );'''
}

for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'tick fallback block not found: {old[:80]!r}')
    text = text.replace(old, new, 1)

path.write_text(text)
