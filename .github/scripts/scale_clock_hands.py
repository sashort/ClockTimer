from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

old_css = '''                #tick-marks {
                    position: absolute;

                    inset: 0;

                    z-index: 10;

                    pointer-events:
                        none;

                    transition-property:
                        inset;

                    transition-duration:
                        var(
                            --clock-timer-ring-resize-duration
                        );

                    transition-timing-function:
                        linear;
                }
'''
new_css = '''                #tick-marks,
                #hand-layer {
                    transition-property:
                        inset;

                    transition-duration:
                        var(
                            --clock-timer-ring-resize-duration
                        );

                    transition-timing-function:
                        linear;
                }

                #tick-marks {
                    position: absolute;

                    inset: 0;

                    z-index: 10;

                    pointer-events:
                        none;
                }
'''
if old_css not in text:
    raise SystemExit('tick CSS block not found')
text = text.replace(old_css, new_css, 1)

old_id = '''            this.#handLayer.dataset.clockTimerHandLayer =
                "";

            this.#handLayer.style.position =
'''
new_id = '''            this.#handLayer.id =
                "hand-layer";

            this.#handLayer.dataset.clockTimerHandLayer =
                "";

            this.#handLayer.style.position =
'''
if old_id not in text:
    raise SystemExit('hand layer setup not found')
text = text.replace(old_id, new_id, 1)

old_get = '''        #getTickInset() {
            let outerInset =
                "0px";

            const rings =
                Array.from(
                    this.children
                ).filter(
                    element =>
                        element.localName ===
                            "ring-container"
                );

            for (
                const ring of
                    rings
            ) {
                const width =
                    ring.getAttribute(
                        "width"
                    ) ?? "0px";

                const outerMargin =
                    ring.getAttribute(
                        "outer-margin"
                    ) ?? "0px";

                const innerMargin =
                    ring.getAttribute(
                        "inner-margin"
                    ) ?? "0px";

                if (
                    ring ===
                        this.#tickRing
                ) {
                    return outerInset;
                }

                const inset =
                    `calc(${outerInset} + ${outerMargin})`;

                outerInset =
                    `calc(${inset} + ${width} + ${innerMargin})`;
            }

            return "0px";
        }
'''
new_get = '''        #getRingInset(
            targetRing
        ) {
            let outerInset =
                "0px";

            const rings =
                Array.from(
                    this.children
                ).filter(
                    element =>
                        element.localName ===
                            "ring-container"
                );

            for (
                const ring of
                    rings
            ) {
                const width =
                    ring.getAttribute(
                        "width"
                    ) ?? "0px";

                const outerMargin =
                    ring.getAttribute(
                        "outer-margin"
                    ) ?? "0px";

                const innerMargin =
                    ring.getAttribute(
                        "inner-margin"
                    ) ?? "0px";

                if (
                    ring ===
                        targetRing
                ) {
                    return outerInset;
                }

                const inset =
                    `calc(${outerInset} + ${outerMargin})`;

                outerInset =
                    `calc(${inset} + ${width} + ${innerMargin})`;
            }

            return "0px";
        }

        #getTickInset() {
            return this.#getRingInset(
                this.#tickRing
            );
        }

        #syncHandGeometry() {
            this.#ensureHandRing();

            this.#handLayer.style.inset =
                this.#getRingInset(
                    this.#handRing
                );

            this.#handLayer.style.width =
                "";

            this.#handLayer.style.height =
                "";
        }
'''
if old_get not in text:
    raise SystemExit('getTickInset block not found')
text = text.replace(old_get, new_get, 1)

old_schedule = '''                        this.#renderHours();

                        this.#scheduleFontSizing();
'''
new_schedule = '''                        this.#syncHandGeometry();

                        this.#renderHours();

                        this.#scheduleFontSizing();
'''
if old_schedule not in text:
    raise SystemExit('schedule hour render block not found')
text = text.replace(old_schedule, new_schedule, 1)

old_connect = '''            this.#startHandAnimations();

            this.#startSizeObserver();
'''
new_connect = '''            this.#syncHandGeometry();

            this.#startHandAnimations();

            this.#startSizeObserver();
'''
if old_connect not in text:
    raise SystemExit('connected hand start block not found')
text = text.replace(old_connect, new_connect, 1)

path.write_text(text)
