from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

old_ring_content = '''        #ringHasNonToleranceContent(
            ring
        ) {
            for (const child of ring.children) {
                if (
                    child.localName !==
                        "time-range"
                ) {
                    return true;
                }

                if (
                    child.timeRangeExiting ===
                        true
                ) {
                    continue;
                }

                if (
                    child.clockTimerPlanned !==
                        undefined &&
                    child.getAttribute(
                        "type"
                    ) === "tolerance"
                ) {
                    continue;
                }

                return true;
            }

            return false;
        }
'''

new_ring_content = '''        #ringHasNonToleranceContent(
            ring
        ) {
            const removableTypes =
                new Set([
                    "tolerance",
                    "elapsed",
                    "remaining",
                    "wave"
                ]);

            for (const child of ring.children) {
                if (
                    child.localName !==
                        "time-range"
                ) {
                    return true;
                }

                if (
                    child.timeRangeExiting ===
                        true
                ) {
                    continue;
                }

                if (
                    removableTypes.has(
                        child.getAttribute(
                            "type"
                        )
                    )
                ) {
                    continue;
                }

                return true;
            }

            return false;
        }

        #removeToleranceTransitionRing(
            ring
        ) {
            if (!ring) {
                return false;
            }

            const ringIndex =
                Number(
                    ring.clockTimerRingIndex
                );

            for (
                const range of
                    Array.from(
                        ring.querySelectorAll(
                            ":scope > time-range"
                        )
                    )
            ) {
                this.#releaseTimeRangeTimingAnimation(
                    range
                );

                if (
                    this.#elapsedRange ===
                        range
                ) {
                    this.#elapsedRange =
                        undefined;
                }

                if (
                    this.#waveRange ===
                        range
                ) {
                    this.#waveRange =
                        undefined;
                }
            }

            for (
                const [
                    remainingIndex,
                    range
                ] of
                    this.#remainingRanges
            ) {
                if (
                    range.parentElement ===
                        ring ||
                    (
                        Number.isFinite(ringIndex) &&
                        remainingIndex ===
                            ringIndex
                    )
                ) {
                    this.#releaseTimeRangeTimingAnimation(
                        range
                    );

                    this.#remainingRanges.delete(
                        remainingIndex
                    );
                }
            }

            if (
                this.#waveRing ===
                    ring
            ) {
                this.#waveRing =
                    undefined;

                this.#waveRange =
                    undefined;
            }

            ring.remove();

            if (
                Number.isFinite(ringIndex) &&
                this.#rings.get(
                    ringIndex
                ) === ring
            ) {
                this.#rings.delete(
                    ringIndex
                );
            }

            return true;
        }
'''

if old_ring_content not in text:
    raise SystemExit("ring content guard not found")
text = text.replace(old_ring_content, new_ring_content, 1)

old_finish = '''                if (
                    fade.direction === "out" &&
                    !this.#ringHasNonToleranceContent(
                        fade.ring
                    ) &&
                    !Array.from(
                        fade.ring.children
                    ).some(
                        child =>
                            child.localName ===
                                "time-range" &&
                            child.timeRangeExiting !==
                                true &&
                            child.clockTimerPlanned !==
                                undefined &&
                            child.getAttribute(
                                "type"
                            ) === "tolerance"
                    )
                ) {
                    const ringIndex =
                        Number(
                            fade.ring.clockTimerRingIndex
                        );

                    fade.ring.remove();

                    if (
                        Number.isFinite(ringIndex)
                    ) {
                        this.#rings.delete(
                            ringIndex
                        );
                    }
                }
'''

new_finish = '''                if (
                    fade.direction === "out" &&
                    !this.#ringHasNonToleranceContent(
                        fade.ring
                    ) &&
                    !Array.from(
                        fade.ring.children
                    ).some(
                        child =>
                            child.localName ===
                                "time-range" &&
                            child.timeRangeExiting !==
                                true &&
                            child.getAttribute(
                                "type"
                            ) === "tolerance"
                    )
                ) {
                    this.#removeToleranceTransitionRing(
                        fade.ring
                    );
                }
'''

if old_finish not in text:
    raise SystemExit("finish cleanup guard not found")
text = text.replace(old_finish, new_finish, 1)

old_remaining = '''            const latestEnd =
                Number.isFinite(
                    this.#calculatedEndTime
                )
                    ? this.#calculatedEndTime
                    : this.#getLatestTimerEnd();
'''

new_remaining = '''            const visibleTimerEnd =
                this.#getLatestTimerEnd();

            const latestEnd =
                this.#percentGoal > 1 &&
                this.#started &&
                this.#json === undefined &&
                !this.#loadingFromJSON
                    ? visibleTimerEnd
                    : (
                        Number.isFinite(
                            this.#calculatedEndTime
                        )
                            ? this.#calculatedEndTime
                            : visibleTimerEnd
                    );
'''

if old_remaining not in text:
    raise SystemExit("remaining horizon guard not found")
text = text.replace(old_remaining, new_remaining, 1)

path.write_text(text)
