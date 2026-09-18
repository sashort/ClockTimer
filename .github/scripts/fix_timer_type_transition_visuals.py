from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

def replace_in_method(method_name, next_method_name, old, new, label):
    global text
    start = text.index(f"        {method_name}")
    end = text.index(f"        {next_method_name}", start + 10)
    block = text[start:end]
    count = block.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    block = block.replace(old, new, 1)
    text = text[:start] + block + text[end:]

replace_in_method(
    "#transitionTimerType(",
    "#getStateChangeActiveRing()",
'''            const stateChangeVisual =
                this.#beginStateChangeVisuals();

            const oldRings =
''',
'''            const stateChangeVisual =
                this.#beginStateChangeVisuals();

            if (stateChangeVisual) {
                stateChangeVisual.timerTypeTransition =
                    true;
            }

            const oldRings =
''',
    "mark timer-type state visual"
)

replace_in_method(
    "#syncStateChangeVisuals(",
    "#beginStateChangeVisuals()",
'''            const visible =
                this.#getStateChangeVisibleSegments(
                    timestamp
                );

            const pieces =
                this.#splitStateChangeOverlaySegments(
                    visible,
                    state.fadeStartedAt !==
                        undefined
                );
''',
'''            const semanticCoverageOnly =
                state.timerTypeTransition ===
                    true;

            const visible =
                semanticCoverageOnly
                    ? this.#getStateChangeFinalCoverage()
                    : this.#getStateChangeVisibleSegments(
                        timestamp
                    );

            const pieces =
                semanticCoverageOnly
                    ? visible.map(
                        segment => ({
                            ...segment,
                            role:
                                state.fadeStartedAt ===
                                    undefined
                                    ? "hold"
                                    : "keep"
                        })
                    )
                    : this.#splitStateChangeOverlaySegments(
                        visible,
                        state.fadeStartedAt !==
                            undefined
                    );
''',
    "use semantic timer-type coverage"
)

replace_in_method(
    "#syncStateChangeOverlayRecord(",
    "#syncStateChangeVisuals(",
'''                    record.ring.appendChild(
                        range
                    );

                    TimeRangeClass?.suspendLayout?.(
                        range
                    );

                    record.ranges.push(
                        range
                    );
''',
'''                    TimeRangeClass?.suspendLayout?.(
                        range
                    );

                    try {
                        record.ring.appendChild(
                            range
                        );
                    }
                    catch (error) {
                        TimeRangeClass?.resumeLayout?.(
                            range
                        );

                        throw error;
                    }

                    record.ranges.push(
                        range
                    );
''',
    "suspend overlay before connection"
)

path.write_text(text)
