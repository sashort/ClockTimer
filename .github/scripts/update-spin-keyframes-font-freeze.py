from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

old_field = '''        #spinAnimation;\n\n        #grayscaleAnimation;'''
new_field = '''        #spinAnimation;\n\n        #spinFrozenTimeFontSize;\n\n        #spinPreviousTimeInlineFontSize;\n\n        #spinPreviousTimeInlineFontPriority;\n\n        #grayscaleAnimation;'''
if old_field not in text:
    raise SystemExit('spin field anchor not found')
text = text.replace(old_field, new_field, 1)

old_disconnect = '''            this.#spinAnimation\n                ?.cancel();\n\n            this.#spinAnimation =\n                undefined;\n\n            this.#grayscaleAnimation'''
new_disconnect = '''            this.#spinAnimation\n                ?.cancel();\n\n            this.#spinAnimation =\n                undefined;\n\n            this.#restoreTimeFontAfterSpin();\n\n            this.#grayscaleAnimation'''
if old_disconnect not in text:
    raise SystemExit('disconnect spin anchor not found')
text = text.replace(old_disconnect, new_disconnect, 1)

start = text.find('        #runSpin(rotations, duration) {')
if start == -1:
    raise SystemExit('runSpin start not found')
end = text.find('\n        #parseGrayscalePercentage(value) {', start)
if end == -1:
    raise SystemExit('runSpin end not found')

replacement = '''        #freezeTimeFontForSpin() {\n            if (\n                !this.#timeElement ||\n                this.#spinFrozenTimeFontSize !==\n                    undefined\n            ) {\n                return;\n            }\n\n            const computedFontSize =\n                getComputedStyle(\n                    this.#timeElement\n                ).fontSize;\n\n            if (!computedFontSize) {\n                return;\n            }\n\n            this.#spinPreviousTimeInlineFontSize =\n                this.#timeElement.style.getPropertyValue(\n                    "font-size"\n                );\n\n            this.#spinPreviousTimeInlineFontPriority =\n                this.#timeElement.style.getPropertyPriority(\n                    "font-size"\n                );\n\n            this.#spinFrozenTimeFontSize =\n                computedFontSize;\n\n            this.#timeElement.style.setProperty(\n                "font-size",\n                computedFontSize,\n                "important"\n            );\n        }\n\n        #restoreTimeFontAfterSpin() {\n            if (\n                !this.#timeElement ||\n                this.#spinFrozenTimeFontSize ===\n                    undefined\n            ) {\n                return;\n            }\n\n            if (this.#spinPreviousTimeInlineFontSize) {\n                this.#timeElement.style.setProperty(\n                    "font-size",\n                    this.#spinPreviousTimeInlineFontSize,\n                    this.#spinPreviousTimeInlineFontPriority ||\n                        ""\n                );\n            }\n            else {\n                this.#timeElement.style.removeProperty(\n                    "font-size"\n                );\n            }\n\n            this.#spinFrozenTimeFontSize =\n                undefined;\n\n            this.#spinPreviousTimeInlineFontSize =\n                undefined;\n\n            this.#spinPreviousTimeInlineFontPriority =\n                undefined;\n        }\n\n        #runSpin(rotations, duration) {\n            const perRotationDuration =\n                this.#getSpinDurationMilliseconds(\n                    duration\n                );\n\n            this.#freezeTimeFontForSpin();\n\n            this.#spinAnimation\n                ?.cancel();\n\n            const animation =\n                this.animate(\n                    [\n                        {\n                            offset: 0,\n                            transform: "perspective(var(--clock-timer-spin-perspective, 800px)) rotateY(0deg)"\n                        },\n                        {\n                            offset: 0.5,\n                            transform: "perspective(var(--clock-timer-spin-perspective, 800px)) rotateY(90deg)"\n                        },\n                        {\n                            offset: 0.5,\n                            transform: "perspective(var(--clock-timer-spin-perspective, 800px)) rotateY(-90deg)"\n                        },\n                        {\n                            offset: 1,\n                            transform: "perspective(var(--clock-timer-spin-perspective, 800px)) rotateY(0deg)"\n                        }\n                    ],\n                    {\n                        duration:\n                            perRotationDuration,\n                        iterations:\n                            rotations,\n                        easing: "ease-in-out"\n                    }\n                );\n\n            this.#spinAnimation =\n                animation;\n\n            animation.finished\n                .catch(() => {})\n                .finally(() => {\n                    if (\n                        this.#spinAnimation !==\n                            animation\n                    ) {\n                        return;\n                    }\n\n                    this.#spinAnimation =\n                        undefined;\n\n                    this.#restoreTimeFontAfterSpin();\n                });\n        }\n'''
text = text[:start] + replacement + text[end:]

path.write_text(text)
