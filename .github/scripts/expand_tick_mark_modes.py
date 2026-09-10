from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()
start = text.index('        #getTickMarkMode() {')
end = text.index('        #stopTickMarkTimer() {', start)

replacement = r'''        #getTickMarkMode() {
            const value =
                this.getAttribute(
                    "tick-marks"
                );

            if (
                value === null
            ) {
                return undefined;
            }

            const normalized =
                value.trim();

            if (
                normalized === "+/-5"
            ) {
                return {
                    type: "rolling-offset",
                    value: 5
                };
            }

            if (
                normalized === ""
            ) {
                return {
                    type: "fixed",
                    value: 1
                };
            }

            const rollingMatch =
                normalized.match(
                    /^(\[|\()(\d+)(\]|\))$/
                );

            if (rollingMatch) {
                const value =
                    Number(
                        rollingMatch[2]
                    );

                if (
                    Number.isInteger(value) &&
                    value > 0
                ) {
                    return {
                        type: "rolling-groups",
                        value,
                        includeBoundaries:
                            rollingMatch[1] === "[" &&
                            rollingMatch[3] === "]"
                    };
                }

                return undefined;
            }

            if (
                /^\d+$/.test(
                    normalized
                )
            ) {
                const value =
                    Number(
                        normalized
                    );

                if (
                    Number.isInteger(value) &&
                    value >= 1 &&
                    value <= 60
                ) {
                    return {
                        type: "fixed",
                        value
                    };
                }
            }

            return undefined;
        }

        #getTickMarkSeconds(
            mode,
            now
        ) {
            if (
                mode.type === "fixed"
            ) {
                const seconds = [];

                for (
                    let second = 0;
                    second < 60;
                    second += mode.value
                ) {
                    seconds.push(
                        second
                    );
                }

                return seconds;
            }

            const currentSecond =
                now.getSeconds();

            if (
                mode.type === "rolling-offset"
            ) {
                const seconds = [];

                for (
                    let offset = -mode.value;
                    offset <= mode.value;
                    offset++
                ) {
                    seconds.push(
                        (
                            currentSecond +
                            offset +
                            60
                        ) % 60
                    );
                }

                return seconds;
            }

            const groupCount =
                Math.max(
                    1,
                    Math.ceil(
                        mode.value /
                        5
                    )
                );

            const currentGroup =
                Math.floor(
                    currentSecond /
                    5
                );

            const startGroup =
                currentGroup -
                Math.floor(
                    (
                        groupCount -
                        1
                    ) /
                    2
                );

            const startSecond =
                startGroup *
                5;

            const endSecond =
                startSecond +
                groupCount *
                5;

            const firstSecond =
                mode.includeBoundaries
                    ? startSecond
                    : startSecond + 1;

            const lastSecond =
                mode.includeBoundaries
                    ? endSecond
                    : endSecond - 1;

            const seconds = [];

            for (
                let second = firstSecond;
                second <= lastSecond;
                second++
            ) {
                seconds.push(
                    (
                        second % 60 +
                        60
                    ) % 60
                );
            }

            return seconds;
        }

        #createTickMark(
            second
        ) {
            const track =
                document.createElement(
                    "div"
                );

            track.className =
                "tick-mark-track";

            track.dataset.clockTimerTickSecond =
                String(
                    second
                );

            track.style.setProperty(
                "--clock-timer-tick-angle",
                `${second * 6}deg`
            );

            const mark =
                document.createElement(
                    "div"
                );

            const major =
                second % 5 ===
                    0;

            mark.className =
                major
                    ? "tick-mark major"
                    : "tick-mark";

            mark.setAttribute(
                "part",
                major
                    ? "tick-mark major-tick-mark"
                    : "tick-mark"
            );

            track.appendChild(
                mark
            );

            return track;
        }

        #fadeTickMarkIn(
            track
        ) {
            track.animate(
                [
                    { opacity: 0 },
                    { opacity: 1 }
                ],
                {
                    duration: 1000 / 3,
                    easing: "linear",
                    fill: "both"
                }
            );
        }

        #fadeTickMarkOut(
            track
        ) {
            track.dataset.clockTimerTickExiting =
                "";

            const opacity =
                getComputedStyle(
                    track
                ).opacity;

            track.animate(
                [
                    { opacity },
                    { opacity: 0 }
                ],
                {
                    duration: 1000 / 3,
                    easing: "linear",
                    fill: "forwards"
                }
            ).finished
                .finally(
                    () => track.remove()
                );
        }

        #updateTickMarks(
            now = new Date()
        ) {
            this.#stopTickMarkTimer();

            const mode =
                this.#getTickMarkMode();

            if (!mode) {
                this.#tickMarkLayer.replaceChildren();
                return;
            }

            const seconds =
                this.#getTickMarkSeconds(
                    mode,
                    now
                );

            const rolling =
                mode.type !== "fixed";

            if (!rolling) {
                const fragment =
                    document.createDocumentFragment();

                for (
                    const second of seconds
                ) {
                    fragment.appendChild(
                        this.#createTickMark(
                            second
                        )
                    );
                }

                this.#tickMarkLayer.replaceChildren(
                    fragment
                );

                return;
            }

            const desired =
                new Set(
                    seconds.map(
                        second =>
                            String(second)
                    )
                );

            const existing =
                new Map();

            for (
                const track of
                    Array.from(
                        this.#tickMarkLayer.children
                    )
            ) {
                if (
                    track.hasAttribute(
                        "data-clock-timer-tick-exiting"
                    )
                ) {
                    continue;
                }

                const second =
                    track.dataset.clockTimerTickSecond;

                if (
                    second !== undefined
                ) {
                    existing.set(
                        second,
                        track
                    );
                }
            }

            for (
                const [second, track] of
                    existing
            ) {
                if (
                    !desired.has(
                        second
                    )
                ) {
                    existing.delete(
                        second
                    );

                    this.#fadeTickMarkOut(
                        track
                    );
                }
            }

            for (
                const second of seconds
            ) {
                const key =
                    String(second);

                let track =
                    existing.get(
                        key
                    );

                if (!track) {
                    track =
                        this.#createTickMark(
                            second
                        );

                    this.#tickMarkLayer.appendChild(
                        track
                    );

                    this.#fadeTickMarkIn(
                        track
                    );
                }
                else {
                    this.#tickMarkLayer.appendChild(
                        track
                    );
                }
            }

            if (
                this.isConnected
            ) {
                const millisecondsToNextSecond =
                    now.getMilliseconds() === 0
                        ? 1000
                        : 1000 -
                            now.getMilliseconds();

                this.#tickMarkTimeout =
                    setTimeout(
                        () => {
                            this.#tickMarkTimeout =
                                undefined;

                            this.#updateTickMarks(
                                new Date()
                            );
                        },
                        millisecondsToNextSecond
                    );
            }
        }

'''

text = text[:start] + replacement + text[end:]
path.write_text(text)
