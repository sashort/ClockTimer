from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text(encoding="utf-8")

old_constructor = '''            clockFace.append(\n                ringLayer,\n                this.#timeElement\n            );'''
new_constructor = '''            this.#handLayer =\n                document.createElement(\n                    "div"\n                );\n\n            this.#handLayer.dataset.clockTimerHandLayer =\n                "";\n\n            this.#handLayer.style.position =\n                "absolute";\n\n            this.#handLayer.style.inset =\n                "0";\n\n            this.#handLayer.style.width =\n                "100%";\n\n            this.#handLayer.style.height =\n                "100%";\n\n            this.#handLayer.style.boxSizing =\n                "border-box";\n\n            this.#handLayer.style.pointerEvents =\n                "none";\n\n            this.#handLayer.style.overflow =\n                "visible";\n\n            this.#handLayer.style.zIndex =\n                "30";\n\n            this.#hourHand =\n                this.#createHand(\n                    "hour"\n                );\n\n            this.#minuteHand =\n                this.#createHand(\n                    "minute"\n                );\n\n            this.#secondHand =\n                this.#createHand(\n                    "second"\n                );\n\n            this.#handLayer.append(\n                this.#hourHand,\n                this.#minuteHand,\n                this.#secondHand\n            );\n\n            clockFace.append(\n                ringLayer,\n                this.#handLayer,\n                this.#timeElement\n            );'''

old_hand_block = '''            const handLayer =\n                document.createElement(\n                    "div"\n                );\n\n            handLayer.dataset.clockTimerHandLayer =\n                "";\n\n            handLayer.style.position =\n                "absolute";\n\n            handLayer.style.inset =\n                "0";\n\n            handLayer.style.width =\n                "100%";\n\n            handLayer.style.height =\n                "100%";\n\n            handLayer.style.boxSizing =\n                "border-box";\n\n            handLayer.style.pointerEvents =\n                "none";\n\n            handLayer.style.overflow =\n                "visible";\n\n            handLayer.style.zIndex =\n                "30";\n\n            this.#hourHand =\n                this.#createHand(\n                    "hour"\n                );\n\n            this.#minuteHand =\n                this.#createHand(\n                    "minute"\n                );\n\n            this.#secondHand =\n                this.#createHand(\n                    "second"\n                );\n\n            handLayer.append(\n                this.#hourHand,\n                this.#minuteHand,\n                this.#secondHand\n            );\n\n            ring.appendChild(\n                handLayer\n            );\n\n            this.#handRing =\n                ring;\n\n            this.#handLayer =\n                handLayer;'''
new_hand_block = '''            this.#handRing =\n                ring;'''

old_class = '''            hand.className =\n                `${type}-hand`;\n\n            hand.style.position ='''
new_class = '''            hand.className =\n                `${type}-hand`;\n\n            hand.setAttribute(\n                "part",\n                `${type}-hand`\n            );\n\n            hand.style.position ='''

for old, new, label in [
    (old_constructor, new_constructor, "constructor hand layer insertion"),
    (old_hand_block, new_hand_block, "light-DOM hand layer removal"),
    (old_class, new_class, "hand part attribute"),
]:
    if old not in text:
        raise SystemExit(f"Expected {label} block not found")
    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
