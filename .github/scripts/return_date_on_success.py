from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

expected = {
    'fromJSON': 1,
    'start': 2,
    'reset': 2,
    'delete': 1,
    'closeOpenRange': 3,
    'clear': 2,
}


def find_matching_brace(source, start):
    depth = 0
    i = start
    quote = None
    escape = False
    line_comment = False
    block_comment = False
    template = False

    while i < len(source):
        ch = source[i]
        nxt = source[i + 1] if i + 1 < len(source) else ''

        if line_comment:
            if ch == '\n':
                line_comment = False
            i += 1
            continue

        if block_comment:
            if ch == '*' and nxt == '/':
                block_comment = False
                i += 2
                continue
            i += 1
            continue

        if quote:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue

        if template:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == '`':
                template = False
            i += 1
            continue

        if ch == '/' and nxt == '/':
            line_comment = True
            i += 2
            continue

        if ch == '/' and nxt == '*':
            block_comment = True
            i += 2
            continue

        if ch in ('"', "'"):
            quote = ch
            i += 1
            continue

        if ch == '`':
            template = True
            i += 1
            continue

        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return i

        i += 1

    raise RuntimeError('Unmatched method brace')


for name, count in expected.items():
    marker = f'\n        {name}('
    method_start = text.find(marker)
    if method_start == -1:
        raise SystemExit(f'Could not find public method {name}')

    brace_start = text.find('{', method_start)
    if brace_start == -1:
        raise SystemExit(f'Could not find opening brace for {name}')

    brace_end = find_matching_brace(text, brace_start)
    block = text[method_start:brace_end + 1]
    actual = block.count('return true;')

    if actual != count:
        raise SystemExit(
            f'{name}: expected {count} return true statements, found {actual}'
        )

    block = block.replace(
        'return true;',
        'return new Date();'
    )

    text = (
        text[:method_start] +
        block +
        text[brace_end + 1:]
    )

path.write_text(text)
