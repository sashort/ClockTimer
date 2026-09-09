from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

text = text.replace(
'''        #hoursRenderFrame;\n\n        #handsStarted =\n''',
'''        #hoursRenderFrame;\n\n        #fontSizingFrame;\n\n        #sizeObserver;\n\n        #handsStarted =\n''',
1
)

text = text.replace(
'''                    isolation:\n                        isolate;\n\n                    clip-path:\n''',
'''                    isolation:\n                        isolate;\n\n                    container-type:\n                        size;\n\n                    clip-path:\n''',
1
)

text = text.replace(
'''                    z-index: 100;\n\n                    pointer-events:\n                        none;\n''',
'''                    z-index: 100;\n\n                    font-family:\n                        var(\n                            --clock-timer-time-font,\n                            inherit\n                        );\n\n                    font-size:\n                        var(\n                            --clock-timer-time-font-size,\n                            var(\n                                --clock-timer-auto-time-font-size,\n                                1rem\n                            )\n                        );\n\n                    line-height: 1;\n\n                    white-space:\n                        nowrap;\n\n                    pointer-events:\n                        none;\n''',
1
)

text = text.replace(
'''            this.#startHandAnimations();\n\n            this.#scheduleHourRender();\n''',
'''            this.#startHandAnimations();\n\n            this.#startSizeObserver();\n\n            this.#scheduleHourRender();\n''',
1
)

text = text.replace(
'''            this.#stopHandAnimations();\n\n            if (\n                this.#handStartTimeout !==\n''',
'''            this.#stopHandAnimations();\n\n            this.#stopSizeObserver();\n\n            if (\n                this.#handStartTimeout !==\n''',
1
)

text = text.replace(
'''                        this.#renderHours();\n                    }\n                );\n        }\n''',
'''                        this.#renderHours();\n\n                        this.#scheduleFontSizing();\n                    }\n                );\n        }\n''',
1
)

marker = '''        #handlePercentGoalChange() {\n'''
helper = '''        #startSizeObserver() {\n            this.#stopSizeObserver();\n\n            if (\n                typeof ResizeObserver ===\n                    "function"\n            ) {\n                this.#sizeObserver =\n                    new ResizeObserver(\n                        () => {\n                            this.#scheduleFontSizing();\n                        }\n                    );\n\n                this.#sizeObserver.observe(\n                    this\n                );\n            }\n\n            this.#scheduleFontSizing();\n        }\n\n        #stopSizeObserver() {\n            this.#sizeObserver\n                ?.disconnect();\n\n            this.#sizeObserver =\n                undefined;\n\n            if (\n                this.#fontSizingFrame !==\n                    undefined\n            ) {\n                cancelAnimationFrame(\n                    this.#fontSizingFrame\n                );\n\n                this.#fontSizingFrame =\n                    undefined;\n            }\n        }\n\n        #scheduleFontSizing() {\n            if (\n                this.#fontSizingFrame !==\n                    undefined\n            ) {\n                cancelAnimationFrame(\n                    this.#fontSizingFrame\n                );\n            }\n\n            this.#fontSizingFrame =\n                requestAnimationFrame(\n                    () => {\n                        this.#fontSizingFrame =\n                            undefined;\n\n                        if (\n                            !this.isConnected\n                        ) {\n                            return;\n                        }\n\n                        this.#updateResponsiveFontSizes();\n                    }\n                );\n        }\n\n        #updateResponsiveFontSizes() {\n            const rect =\n                this.getBoundingClientRect();\n\n            const diameter =\n                Math.min(\n                    rect.width,\n                    rect.height\n                );\n\n            if (\n                !Number.isFinite(diameter) ||\n                diameter <= 0\n            ) {\n                return;\n            }\n\n            const hourSize =\n                Math.max(\n                    9,\n                    Math.min(\n                        22,\n                        diameter * 0.06\n                    )\n                );\n\n            this.style.setProperty(\n                "--clock-timer-auto-hour-font-size",\n                `${hourSize}px`\n            );\n\n            const text =\n                this.#timeElement.textContent ??\n                "";\n\n            if (!text) {\n                return;\n            }\n\n            const computed =\n                getComputedStyle(\n                    this.#timeElement\n                );\n\n            const currentSize =\n                Number.parseFloat(\n                    computed.fontSize\n                );\n\n            if (\n                !Number.isFinite(currentSize) ||\n                currentSize <= 0\n            ) {\n                return;\n            }\n\n            const canvas =\n                document.createElement(\n                    "canvas"\n                );\n\n            const context =\n                canvas.getContext(\n                    "2d"\n                );\n\n            if (!context) {\n                return;\n            }\n\n            context.font =\n                computed.font;\n\n            const measuredWidth =\n                context.measureText(\n                    text\n                ).width;\n\n            if (\n                !Number.isFinite(measuredWidth) ||\n                measuredWidth <= 0\n            ) {\n                return;\n            }\n\n            const targetWidth =\n                diameter * 0.66;\n\n            const minimumSize =\n                Math.max(\n                    10,\n                    diameter * 0.08\n                );\n\n            const maximumSize =\n                Math.max(\n                    minimumSize,\n                    diameter * 0.18\n                );\n\n            const fittedSize =\n                Math.max(\n                    minimumSize,\n                    Math.min(\n                        maximumSize,\n                        currentSize *\n                            targetWidth /\n                            measuredWidth\n                    )\n                );\n\n            this.style.setProperty(\n                "--clock-timer-auto-time-font-size",\n                `${fittedSize}px`\n            );\n        }\n\n'''
if marker not in text:
    raise SystemExit('font helper insertion marker not found')
text = text.replace(marker, helper + marker, 1)

text = text.replace(
'''                element.style.lineHeight =\n                    "1";\n\n                element.style.pointerEvents =\n''',
'''                element.style.lineHeight =\n                    "1";\n\n                element.style.fontFamily =\n                    "var(--clock-timer-hour-font, inherit)";\n\n                element.style.fontSize =\n                    "var(--clock-timer-hour-font-size, var(--clock-timer-auto-hour-font-size, 1rem))";\n\n                element.style.pointerEvents =\n''',
1
)

# Schedule a refit whenever the center text changes.
text = text.replace(
'''                this.#timeElement.textContent =\n                    format === "hhmmss"\n                        ? `${hourText}${minutes}${seconds}`\n                        : `${hourText}${minutes}`;\n\n                return;\n''',
'''                this.#timeElement.textContent =\n                    format === "hhmmss"\n                        ? `${hourText}${minutes}${seconds}`\n                        : `${hourText}${minutes}`;\n\n                this.#scheduleFontSizing();\n\n                return;\n''',
1
)

text = text.replace(
'''            this.#timeElement.textContent =\n                result;\n        }\n''',
'''            this.#timeElement.textContent =\n                result;\n\n            this.#scheduleFontSizing();\n        }\n''',
1
)

path.write_text(text)
