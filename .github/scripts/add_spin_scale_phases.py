from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

old = '''            this.#spinAnimation
                ?.cancel();

            const animation =
                this.animate(
                    [
                        {
                            offset: 0,
                            transform: "perspective(var(--clock-timer-spin-perspective, 800px)) rotateY(0deg)"
                        },
                        {
                            offset: 0.5,
                            transform: "perspective(var(--clock-timer-spin-perspective, 800px)) rotateY(90deg)"
                        },
                        {
                            offset: 0.5,
                            transform: "perspective(var(--clock-timer-spin-perspective, 800px)) rotateY(-90deg)"
                        },
                        {
                            offset: 1,
                            transform: "perspective(var(--clock-timer-spin-perspective, 800px)) rotateY(0deg)"
                        }
                    ],
                    {
                        duration:
                            perRotationDuration,
                        iterations:
                            rotations,
                        easing: "ease-in-out"
                    }
                );

            this.#spinAnimation =
                animation;

            animation.finished
                .catch(() => {})
                .finally(() => {
                    if (
                        this.#spinAnimation !==
                            animation
                    ) {
                        return;
                    }

                    this.#spinAnimation =
                        undefined;

                    this.#restoreTimeFontAfterSpin();

                    this.#scheduleFontSizing();
                });
'''

new = '''            this.#spinAnimation
                ?.cancel();

            const scaleDuration =
                125;

            const finishSpin =
                animation => {
                    if (
                        this.#spinAnimation !==
                            animation
                    ) {
                        return;
                    }

                    this.#spinAnimation =
                        undefined;

                    this.#restoreTimeFontAfterSpin();

                    this.#scheduleFontSizing();
                };

            const shrinkAnimation =
                this.animate(
                    [
                        {
                            transform: "scale(1)"
                        },
                        {
                            transform: "scale(0.95)"
                        }
                    ],
                    {
                        duration: scaleDuration,
                        easing: "ease-out",
                        fill: "forwards"
                    }
                );

            this.#spinAnimation =
                shrinkAnimation;

            shrinkAnimation.finished
                .then(() => {
                    if (
                        this.#spinAnimation !==
                            shrinkAnimation
                    ) {
                        return;
                    }

                    const spinAnimation =
                        this.animate(
                            [
                                {
                                    offset: 0,
                                    transform: "perspective(var(--clock-timer-spin-perspective, 800px)) rotateY(0deg) scale(0.95)"
                                },
                                {
                                    offset: 0.5,
                                    transform: "perspective(var(--clock-timer-spin-perspective, 800px)) rotateY(90deg) scale(0.95)"
                                },
                                {
                                    offset: 0.5,
                                    transform: "perspective(var(--clock-timer-spin-perspective, 800px)) rotateY(-90deg) scale(0.95)"
                                },
                                {
                                    offset: 1,
                                    transform: "perspective(var(--clock-timer-spin-perspective, 800px)) rotateY(0deg) scale(0.95)"
                                }
                            ],
                            {
                                duration:
                                    perRotationDuration,
                                iterations:
                                    rotations,
                                easing: "ease-in-out",
                                fill: "forwards"
                            }
                        );

                    this.#spinAnimation =
                        spinAnimation;

                    return spinAnimation.finished
                        .then(() => {
                            if (
                                this.#spinAnimation !==
                                    spinAnimation
                            ) {
                                return;
                            }

                            const restoreAnimation =
                                this.animate(
                                    [
                                        {
                                            transform: "scale(0.95)"
                                        },
                                        {
                                            transform: "scale(1)"
                                        }
                                    ],
                                    {
                                        duration: scaleDuration,
                                        easing: "ease-in",
                                        fill: "forwards"
                                    }
                                );

                            this.#spinAnimation =
                                restoreAnimation;

                            return restoreAnimation.finished
                                .then(() => {
                                    finishSpin(
                                        restoreAnimation
                                    );
                                });
                        });
                })
                .catch(() => {});
'''

if old not in text:
    raise SystemExit("spin block not found")

text = text.replace(old, new, 1)
path.write_text(text)
