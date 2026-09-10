from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

helper = '''
        #refreshTimeRangeVisualGeometry() {
            for (
                const range of
                    this.#getManagedTimeRanges()
            ) {
                if (
                    typeof range.refreshVisualGeometry ===
                        "function"
                ) {
                    range.refreshVisualGeometry();
                }
            }
        }

'''

if '#refreshTimeRangeVisualGeometry()' not in text:
    marker = '        #startSizeObserver() {'
    if marker not in text:
        raise SystemExit('startSizeObserver method not found')
    text = text.replace(marker, helper + marker, 1)

start = text.find('        #startSizeObserver() {')
if start == -1:
    raise SystemExit('startSizeObserver method not found after helper insertion')

obs = text.find('new ResizeObserver(', start)
if obs == -1:
    raise SystemExit('ResizeObserver construction not found')

arrow = text.find('() => {', obs)
if arrow == -1:
    raise SystemExit('ResizeObserver callback not found')

brace = text.find('{', arrow)
depth = 0
i = brace
while i < len(text):
    ch = text[i]
    if ch == '{':
        depth += 1
    elif ch == '}':
        depth -= 1
        if depth == 0:
            callback_end = i
            break
    i += 1
else:
    raise SystemExit('ResizeObserver callback closing brace not found')

callback = text[brace:callback_end]
if 'this.#refreshTimeRangeVisualGeometry();' not in callback:
    insertion = '''

                    this.#refreshTimeRangeVisualGeometry();'''
    text = text[:callback_end] + insertion + text[callback_end:]

path.write_text(text)
