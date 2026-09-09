from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

ACTIVE = '--clock-timer-active-ring-width'
INACTIVE = '--clock-timer-inactive-ring-width'
PLACEHOLDER = '--clock-timer-__RING_WIDTH_SWAP__'

# Swap usage names globally. There are currently no custom-property declaration
# lines for these names in ClockTimer.js; fallbacks remain exactly where they are.
text = text.replace(ACTIVE, PLACEHOLDER)
text = text.replace(INACTIVE, ACTIVE)
text = text.replace(PLACEHOLDER, INACTIVE)

old_sort = '''                .sort(\n                    (\n                        [a],\n                        [b]\n                    ) =>\n                        a - b\n                )'''
new_sort = '''                .sort(\n                    (\n                        [a],\n                        [b]\n                    ) =>\n                        b - a\n                )'''
if old_sort not in text:
    raise SystemExit('current inactive sort not found')
text = text.replace(old_sort, new_sort, 1)

old_order = '''            const order = [\n                ...inactive,\n                borderRing,\n                activeRing,\n                handRing,\n                numberRing\n            ];'''
new_order = '''            const order = [\n                activeRing,\n                borderRing,\n                ...inactive,\n                handRing,\n                numberRing\n            ];'''
if old_order not in text:
    raise SystemExit('current ring order not found')
text = text.replace(old_order, new_order, 1)

path.write_text(text)
