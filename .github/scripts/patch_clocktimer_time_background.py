from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

old_css = '''                #time {
                    position: absolute;

                    inset: 0;

                    display: grid;

                    place-items:
                        center;

                    z-index: 100;

                    font-family:
                        var(
                            --clock-timer-time-font,
                            inherit
                        );

                    font-size:
                        var(
                            --clock-timer-time-font-size,
                            var(
                                --clock-timer-auto-time-font-size,
                                1rem
                            )
                        );

                    line-height: 1;

                    white-space:
                        nowrap;

                    pointer-events:
                        none;
                }
'''

new_css = '''                #time-layer {
                    position: absolute;

                    inset: 0;

                    display: grid;

                    place-items:
                        center;

                    z-index: 100;

                    pointer-events:
                        none;
                }

                #time {
                    display:
                        inline-block;

                    box-sizing:
                        border-box;

                    width:
                        max-content;

                    max-width:
                        100%;

                    background:
                        transparent;

                    font-family:
                        var(
                            --clock-timer-time-font,
                            inherit
                        );

                    font-size:
                        var(
                            --clock-timer-time-font-size,
                            var(
                                --clock-timer-auto-time-font-size,
                                1rem
                            )
                        );

                    line-height: 1;

                    white-space:
                        nowrap;

                    pointer-events:
                        none;
                }
'''

if text.count(old_css) != 1:
    raise SystemExit(f'expected one #time CSS block, found {text.count(old_css)}')
text = text.replace(old_css, new_css, 1)

old_creation = '''            this.#timeElement =
                document.createElement(
                    "div"
                );

            this.#timeElement.id =
                "time";

            this.#timeElement.setAttribute(
                "part",
                "time"
            );

            this.#handLayer =
'''

new_creation = '''            const timeLayer =
                document.createElement(
                    "div"
                );

            timeLayer.id =
                "time-layer";

            this.#timeElement =
                document.createElement(
                    "div"
                );

            this.#timeElement.id =
                "time";

            this.#timeElement.setAttribute(
                "part",
                "time"
            );

            timeLayer.appendChild(
                this.#timeElement
            );

            this.#handLayer =
'''

if text.count(old_creation) != 1:
    raise SystemExit(f'expected one time creation block, found {text.count(old_creation)}')
text = text.replace(old_creation, new_creation, 1)

old_append = '''            clockFace.append(
                ringLayer,
                this.#handLayer,
                this.#timeElement
            );
'''

new_append = '''            clockFace.append(
                ringLayer,
                this.#handLayer,
                timeLayer
            );
'''

if text.count(old_append) != 1:
    raise SystemExit(f'expected one clockFace append block, found {text.count(old_append)}')
text = text.replace(old_append, new_append, 1)

path.write_text(text)
