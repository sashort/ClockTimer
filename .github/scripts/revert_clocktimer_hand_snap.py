from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

helper_start = text.index('        #getHandTransform(\n')
helper_end = text.index('        #synchronizeHands() {\n', helper_start)
text = text[:helper_start] + text[helper_end:]

old = '''            const createKeyframes =\n                hand => [\n                    {\n                        transform:\n                            this.#getHandTransform(\n                                hand,\n                                0\n                            )\n                    },\n                    {\n                        transform:\n                            this.#getHandTransform(\n                                hand,\n                                360\n                            )\n                    }\n                ];\n\n            this.#hourHandAnimation =\n                this.#hourHand.animate(\n                    createKeyframes(\n                        this.#hourHand\n                    ),\n'''
new = '''            const keyframes = [\n                {\n                    transform:\n                        "translate(-50%, -100%) rotate(0deg)"\n                },\n                {\n                    transform:\n                        "translate(-50%, -100%) rotate(360deg)"\n                }\n            ];\n\n            this.#hourHandAnimation =\n                this.#hourHand.animate(\n                    keyframes,\n'''
if old not in text:
    raise SystemExit('hour hand snapped keyframe block not found')
text = text.replace(old, new, 1)

old = '''            this.#minuteHandAnimation =\n                this.#minuteHand.animate(\n                    createKeyframes(\n                        this.#minuteHand\n                    ),\n'''
new = '''            this.#minuteHandAnimation =\n                this.#minuteHand.animate(\n                    keyframes,\n'''
if old not in text:
    raise SystemExit('minute hand snapped keyframe block not found')
text = text.replace(old, new, 1)

old = '''            this.#secondHandAnimation =\n                this.#secondHand.animate(\n                    createKeyframes(\n                        this.#secondHand\n                    ),\n'''
new = '''            this.#secondHandAnimation =\n                this.#secondHand.animate(\n                    keyframes,\n'''
if old not in text:
    raise SystemExit('second hand snapped keyframe block not found')
text = text.replace(old, new, 1)

# Preserve the newly-added format grammar and rendering behavior.
required = [
    'return /^(?:hh:mm(?::ss)?|(?:h|0h):mm',
    'format.startsWith(\n                    "hh:"\n                )',
    'format.startsWith(\n                    "0h:"\n                )',
]
for marker in required:
    if marker not in text:
        raise SystemExit(f'formatting marker missing: {marker}')

path.write_text(text)
