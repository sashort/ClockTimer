from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

# Observe tick-marks.
old = '''        static observedAttributes = [\n            "percent-goal",\n            "military-time",\n            "format",\n            "visible-hours"\n        ];'''
new = '''        static observedAttributes = [\n            "percent-goal",\n            "military-time",\n            "format",\n            "visible-hours",\n            "tick-marks"\n        ];'''
if old not in text:
    raise SystemExit('observedAttributes anchor not found')
text = text.replace(old, new, 1)

# Add private fields.
old = '''        #numberRing;\n\n        #handLayer;'''
new = '''        #numberRing;\n\n        #tickMarkLayer;\n\n        #tickMarkTimeout;\n\n        #handLayer;'''
if old not in text:
    raise SystemExit('private field anchor not found')
text = text.replace(old, new, 1)

# Add tick-mark styling before the time layer.
old = '''                #time-layer {'''
new = '''                #tick-marks {\n                    position: absolute;\n\n                    inset:\n                        var(\n                            --clock-timer-tick-inset,\n                            clamp(8px, 4cqi, 20px)\n                        );\n\n                    z-index: 10;\n\n                    pointer-events:\n                        none;\n                }\n\n                .tick-mark-track {\n                    position: absolute;\n\n                    inset: 0;\n\n                    transform:\n                        rotate(\n                            var(--clock-timer-tick-angle)\n                        );\n\n                    transform-origin:\n                        50% 50%;\n\n                    pointer-events:\n                        none;\n                }\n\n                .tick-mark {\n                    position: absolute;\n\n                    top: 0;\n                    left: 50%;\n\n                    width:\n                        var(\n                            --clock-timer-tick-width,\n                            clamp(1px, 0.45cqi, 2px)\n                        );\n\n                    height:\n                        var(\n                            --clock-timer-tick-length,\n                            clamp(5px, 2.5cqi, 11px)\n                        );\n\n                    border-radius:\n                        999px;\n\n                    background:\n                        var(\n                            --clock-timer-tick-color,\n                            currentColor\n                        );\n\n                    transform:\n                        translateX(-50%);\n\n                    transform-origin:\n                        50% 0;\n\n                    pointer-events:\n                        none;\n                }\n\n                .tick-mark.major {\n                    width:\n                        var(\n                            --clock-timer-major-tick-width,\n                            clamp(2px, 0.75cqi, 3px)\n                        );\n\n                    height:\n                        var(\n                            --clock-timer-major-tick-length,\n                            clamp(9px, 4cqi, 18px)\n                        );\n                }\n\n                #time-layer {'''
if old not in text:
    raise SystemExit('time layer CSS anchor not found')
text = text.replace(old, new, 1)

# Create the tick-mark layer after the ring layer.
old = '''            ringLayer.appendChild(\n                ringSlot\n            );\n\n            const timeLayer ='''
new = '''            ringLayer.appendChild(\n                ringSlot\n            );\n\n            this.#tickMarkLayer =\n                document.createElement(\n                    "div"\n                );\n\n            this.#tickMarkLayer.id =\n                "tick-marks";\n\n            this.#tickMarkLayer.setAttribute(\n                "part",\n                "tick-marks"\n            );\n\n            const timeLayer ='''
if old not in text:
    raise SystemExit('ring layer construction anchor not found')
text = text.replace(old, new, 1)

# Insert tick layer into the clock face below hands and above ranges.
old = '''            clockFace.append(\n                ringLayer,\n                this.#handLayer,\n                timeLayer\n            );'''
new = '''            clockFace.append(\n                ringLayer,\n                this.#tickMarkLayer,\n                this.#handLayer,\n                timeLayer\n            );'''
if old not in text:
    raise SystemExit('clockFace append anchor not found')
text = text.replace(old, new, 1)

# Initial render when connected.
old = '''            this.#scheduleHourRender();\n\n            this.#startDisplayTimer();'''
new = '''            this.#scheduleHourRender();\n\n            this.#updateTickMarks();\n\n            this.#startDisplayTimer();'''
if old not in text:
    raise SystemExit('connectedCallback render anchor not found')
text = text.replace(old, new, 1)

# Stop rolling tick timer on disconnect.
old = '''            this.#stopDisplayTimer();\n\n            this.#stopHandAnimations();'''
new = '''            this.#stopDisplayTimer();\n\n            this.#stopTickMarkTimer();\n\n            this.#stopHandAnimations();'''
if old not in text:
    raise SystemExit('disconnectedCallback anchor not found')
text = text.replace(old, new, 1)

# React to tick-marks changes.
old = '''                case "visible-hours":\n                    this.#scheduleHourRender();\n                    break;\n            }'''
new = '''                case "visible-hours":\n                    this.#scheduleHourRender();\n                    break;\n\n                case "tick-marks":\n                    this.#updateTickMarks();\n                    break;\n            }'''
if old not in text:
    raise SystemExit('attributeChangedCallback anchor not found')
text = text.replace(old, new, 1)

# Add rendering helpers before hour rendering helpers.
anchor = '''        #scheduleHourRender() {'''
methods = '''        #getTickMarkMode() {\n            const value =\n                this.getAttribute(\n                    "tick-marks"\n                );\n\n            if (\n                value === null\n            ) {\n                return undefined;\n            }\n\n            const normalized =\n                value.trim();\n\n            if (\n                normalized === "5" ||\n                normalized === "+/-5"\n            ) {\n                return normalized;\n            }\n\n            return undefined;\n        }\n\n        #createTickMark(\n            angle,\n            major = false\n        ) {\n            const track =\n                document.createElement(\n                    "div"\n                );\n\n            track.className =\n                "tick-mark-track";\n\n            track.style.setProperty(\n                "--clock-timer-tick-angle",\n                `${angle}deg`\n            );\n\n            const mark =\n                document.createElement(\n                    "div"\n                );\n\n            mark.className =\n                major\n                    ? "tick-mark major"\n                    : "tick-mark";\n\n            mark.setAttribute(\n                "part",\n                major\n                    ? "tick-mark major-tick-mark"\n                    : "tick-mark"\n            );\n\n            track.appendChild(\n                mark\n            );\n\n            return track;\n        }\n\n        #updateTickMarks(\n            now = new Date()\n        ) {\n            this.#stopTickMarkTimer();\n\n            this.#tickMarkLayer.replaceChildren();\n\n            const mode =\n                this.#getTickMarkMode();\n\n            if (!mode) {\n                return;\n            }\n\n            const fragment =\n                document.createDocumentFragment();\n\n            if (\n                mode === "5"\n            ) {\n                for (\n                    let minute = 0;\n                    minute < 60;\n                    minute += 5\n                ) {\n                    fragment.appendChild(\n                        this.#createTickMark(\n                            minute * 6,\n                            true\n                        )\n                    );\n                }\n            }\n            else {\n                const minute =\n                    now.getMinutes();\n\n                for (\n                    let offset = -5;\n                    offset <= 5;\n                    offset++\n                ) {\n                    const tickMinute =\n                        (\n                            minute +\n                            offset +\n                            60\n                        ) % 60;\n\n                    fragment.appendChild(\n                        this.#createTickMark(\n                            tickMinute * 6,\n                            offset === 0\n                        )\n                    );\n                }\n            }\n\n            this.#tickMarkLayer.appendChild(\n                fragment\n            );\n\n            if (\n                mode === "+/-5" &&\n                this.isConnected\n            ) {\n                const millisecondsToNextMinute =\n                    60 * 1000 -\n                    (\n                        now.getSeconds() *\n                            1000 +\n                        now.getMilliseconds()\n                    );\n\n                this.#tickMarkTimeout =\n                    setTimeout(\n                        () => {\n                            this.#tickMarkTimeout =\n                                undefined;\n\n                            this.#updateTickMarks(\n                                new Date()\n                            );\n                        },\n                        millisecondsToNextMinute\n                    );\n            }\n        }\n\n        #stopTickMarkTimer() {\n            if (\n                this.#tickMarkTimeout ===\n                    undefined\n            ) {\n                return;\n            }\n\n            clearTimeout(\n                this.#tickMarkTimeout\n            );\n\n            this.#tickMarkTimeout =\n                undefined;\n        }\n\n'''
if anchor not in text:
    raise SystemExit('scheduleHourRender anchor not found')
text = text.replace(anchor, methods + anchor, 1)

path.write_text(text)
