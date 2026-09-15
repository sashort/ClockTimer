from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

old_tick = '''                #tick-marks {
                    position: absolute;

                    inset: 0;

                    z-index: 10;

                    pointer-events:
                        none;
                }
'''
new_tick = '''                #tick-marks {
                    position: absolute;

                    inset: 0;

                    z-index: 10;

                    opacity: 0;

                    transition-property:
                        inset, opacity;

                    transition-duration:
                        var(
                            --clock-timer-ring-resize-duration
                        ),
                        750ms;

                    transition-timing-function:
                        linear, linear;

                    pointer-events:
                        none;
                }
'''
if old_tick not in text:
    raise SystemExit("Expected tick-marks CSS block not found")
text = text.replace(old_tick, new_tick, 1)

old_stop = '''            if (this.#handLayer) {
                this.#handLayer.style.opacity =
                    "0";
            }

            this.#handsStarted =
                false;
'''
new_stop = '''            if (this.#handLayer) {
                this.#handLayer.style.opacity =
                    "0";
            }

            if (this.#tickMarkLayer) {
                this.#tickMarkLayer.style.opacity =
                    "0";
            }

            this.#handsStarted =
                false;
'''
if old_stop not in text:
    raise SystemExit("Expected hand stop opacity block not found")
text = text.replace(old_stop, new_stop, 1)

old_reveal = '''                    if (
                        this.#handsStarted &&
                        this.isConnected &&
                        this.#handLayer
                    ) {
                        this.#handLayer.style.opacity =
                            "1";
                    }
'''
new_reveal = '''                    if (
                        this.#handsStarted &&
                        this.isConnected
                    ) {
                        if (this.#handLayer) {
                            this.#handLayer.style.opacity =
                                "1";
                        }

                        if (this.#tickMarkLayer) {
                            this.#tickMarkLayer.style.opacity =
                                "1";
                        }
                    }
'''
if old_reveal not in text:
    raise SystemExit("Expected hand reveal block not found")
text = text.replace(old_reveal, new_reveal, 1)

path.write_text(text)
