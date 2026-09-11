from pathlib import Path

p=Path('ClockTimer.js')
s=p.read_text()

s=s.replace('''        #timeElement;\n\n        #hourLayer;''','''        #timeElement;\n\n        #dateElement;\n\n        #hourLayer;''',1)

old='''                #time {\n                    display:\n                        inline-block;'''
new='''                #date {\n                    position: absolute;\n                    left: 50%;\n                    top: 50%;\n                    transform:\n                        translate(\n                            -50%,\n                            calc(\n                                -50% -\n                                var(\n                                    --clock-timer-auto-date-offset,\n                                    2rem\n                                )\n                            )\n                        );\n                    width: max-content;\n                    max-width: 80%;\n                    text-align: center;\n                    white-space: nowrap;\n                    font-family:\n                        var(\n                            --clock-timer-date-font,\n                            var(\n                                --clock-timer-time-font,\n                                inherit\n                            )\n                        );\n                    font-size:\n                        var(\n                            --clock-timer-date-font-size,\n                            var(\n                                --clock-timer-auto-date-font-size,\n                                0.75rem\n                            )\n                        );\n                    line-height: 1;\n                    pointer-events: none;\n                }\n\n                #time {\n                    display:\n                        inline-block;'''
if old not in s: raise SystemExit('time css anchor missing')
s=s.replace(old,new,1)

old='''            this.#timeElement =\n                document.createElement(\n                    "div"\n                );\n\n            this.#timeElement.id =\n                "time";\n\n            this.#timeElement.setAttribute(\n                "part",\n                "time"\n            );\n\n            timeLayer.appendChild(\n                this.#timeElement\n            );'''
new='''            this.#dateElement =\n                document.createElement(\n                    "div"\n                );\n\n            this.#dateElement.id =\n                "date";\n\n            this.#dateElement.setAttribute(\n                "part",\n                "date"\n            );\n\n            this.#timeElement =\n                document.createElement(\n                    "div"\n                );\n\n            this.#timeElement.id =\n                "time";\n\n            this.#timeElement.setAttribute(\n                "part",\n                "time"\n            );\n\n            timeLayer.append(\n                this.#dateElement,\n                this.#timeElement\n            );'''
if old not in s: raise SystemExit('time element construction anchor missing')
s=s.replace(old,new,1)

# add date update at beginning of updateDisplay after signature
old='''        #updateDisplay(\n            now\n        ) {\n            const military ='''
new='''        #updateDisplay(\n            now\n        ) {\n            this.#dateElement.textContent =\n                new Intl.DateTimeFormat(\n                    undefined,\n                    {\n                        weekday: "long",\n                        month: "long",\n                        day: "numeric"\n                    }\n                ).format(now);\n\n            const military ='''
if old not in s: raise SystemExit('updateDisplay anchor missing')
s=s.replace(old,new,1)

# responsive sizing after fittedSize calculation / setting time var
old='''            this.#timeElement.style.setProperty(\n                "--clock-timer-auto-time-font-size",\n                `${fittedSize}px`\n            );'''
new='''            this.#timeElement.style.setProperty(\n                "--clock-timer-auto-time-font-size",\n                `${fittedSize}px`\n            );\n\n            const dateSize =\n                fittedSize * 0.38;\n\n            const dateOffset =\n                fittedSize * 0.72;\n\n            this.#dateElement.style.setProperty(\n                "--clock-timer-auto-date-font-size",\n                `${dateSize}px`\n            );\n\n            this.#dateElement.style.setProperty(\n                "--clock-timer-auto-date-offset",\n                `${dateOffset}px`\n            );'''
if old not in s: raise SystemExit('font sizing anchor missing')
s=s.replace(old,new,1)

p.write_text(s)
