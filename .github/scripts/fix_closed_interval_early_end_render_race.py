from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

old = '''        #removeInsertedSegments() {
            for (
                const range of
                    this.#getManagedTimeRanges()
                        .filter(
                            range =>
                                range.clockTimerInserted !==
                                    undefined
                        )
            ) {
                if (
                    typeof range.removeAnimated ===
                        "function"
                ) {
                    this.#releaseTimeRangeTimingAnimation(
                        range
                    );

                    range.removeAnimated({
                        collapseTo: "start"
                    });
                }
                else {
                    range.remove();
                }
            }
        }
'''
new = '''        #removeInsertedSegments({
            animate = true
        } = {}) {
            for (
                const range of
                    this.#getManagedTimeRanges()
                        .filter(
                            range =>
                                range.clockTimerInserted !==
                                    undefined
                        )
            ) {
                if (
                    animate &&
                    typeof range.removeAnimated ===
                        "function"
                ) {
                    this.#releaseTimeRangeTimingAnimation(
                        range
                    );

                    range.removeAnimated({
                        collapseTo: "start"
                    });
                }
                else {
                    range.remove();
                }
            }
        }
'''
if text.count(old) != 1:
    raise SystemExit(f"removeInsertedSegments block mismatch: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''        #renderAllInsertedRanges() {
            this.#captureInsertedAttributes();

            this.#removeInsertedSegments();
'''
new = '''        #renderAllInsertedRanges({
            animateRemoval = true
        } = {}) {
            this.#captureInsertedAttributes();

            this.#removeInsertedSegments({
                animate: animateRemoval
            });
'''
if text.count(old) != 1:
    raise SystemExit(f"renderAllInsertedRanges block mismatch: {text.count(old)}")
text = text.replace(old, new, 1)

old = '''            this.#pendingIntervalRecord =
                undefined;

            this.#renderAllInsertedRanges();

            let replacement;
'''
new = '''            this.#pendingIntervalRecord =
                undefined;

            this.#renderAllInsertedRanges({
                animateRemoval: false
            });

            let replacement;
'''
if text.count(old) != 1:
    raise SystemExit(f"early closed interval rebuild mismatch: {text.count(old)}")
text = text.replace(old, new, 1)

path.write_text(text)
