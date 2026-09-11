from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()
needle = '        stop() {'
start = text.find(needle)
if start < 0:
    raise SystemExit('No no-argument stop() definition found')

i = start + len(needle)
depth = 1
state = 'code'
quote = None
escape = False
while i < len(text) and depth:
    c = text[i]
    n = text[i+1] if i + 1 < len(text) else ''
    if state == 'code':
        if c in ('"', "'", '`'):
            state = 'string'; quote = c; escape = False
        elif c == '/' and n == '/':
            state = 'line'; i += 1
        elif c == '/' and n == '*':
            state = 'block'; i += 1
        elif c == '{': depth += 1
        elif c == '}': depth -= 1
    elif state == 'string':
        if escape: escape = False
        elif c == '\\': escape = True
        elif c == quote: state = 'code'
    elif state == 'line':
        if c == '\n': state = 'code'
    elif state == 'block':
        if c == '*' and n == '/': state = 'code'; i += 1
    i += 1

if depth:
    raise SystemExit('Could not find end of no-argument stop()')
end = i
while end < len(text) and text[end] in ' \t': end += 1
if text[end:end+2] == '\n\n': end += 2
elif text[end:end+1] == '\n': end += 1
path.write_text(text[:start] + text[end:])
print('Removed no-argument stop()')
