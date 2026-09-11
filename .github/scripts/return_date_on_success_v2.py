from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

methods = [
    ('fromJSON(json)', '\n        get status()', 1),
    ('start({', '\n        #cloneInsertedRecords', 2),
    ('reset()', '\n        #typeExtendsCalculatedEndTime', 2),
    ('delete(timeRange)', '\n        closeOpenRange()', 1),
    ('closeOpenRange()', '\n        replaceWithNext()', 3),
    ('clear()', '\n        #ensureAttributes()', 2),
]

for signature, end_marker, expected in methods:
    start_marker = f'\n        {signature}'
    start = text.find(start_marker)
    if start == -1:
        raise SystemExit(f'Could not find {signature}')

    end = text.find(end_marker, start + len(start_marker))
    if end == -1:
        raise SystemExit(f'Could not find end of {signature}')

    block = text[start:end]
    actual = block.count('return true;')
    if actual != expected:
        raise SystemExit(
            f'{signature}: expected {expected} return true statements, found {actual}'
        )

    block = block.replace('return true;', 'return new Date();')
    text = text[:start] + block + text[end:]

path.write_text(text)
