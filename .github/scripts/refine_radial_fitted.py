from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else "ClockTimer.js")
text = path.read_text()


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    '''                    const coordinatorManaged =
                        this.#timeRangeTimingAnimations.has(
                            range
                        );

                    if (
                        !coordinatorManaged &&
                        typeof TimeRangeClass?.suspendLayout ===
                            "function"
                    ) {''',
    '''                    const coordinatorManaged =
                        this.#timeRangeTimingAnimations.has(
                            range
                        );

                    if (coordinatorManaged) {
                        continue;
                    }

                    if (
                        typeof TimeRangeClass?.suspendLayout ===
                            "function"
                    ) {''',
    "skip coordinator-managed fitted ranges"
)

replace_once(
    '''            if (
                this.#timeRangeTimingAnimations.get(
                    range
                ) !== state
            ) {
                return;
            }

            this.#applyTimeRangeLayout(
                range,
                state.targetLayout
            );''',
    '''            if (
                this.#timeRangeTimingAnimations.get(
                    range
                ) !== state
            ) {
                return;
            }

            if (
                this.#getTimerType() ===
                    "radial-fitted"
            ) {
                const targetLayout =
                    this.#calculateTimeRangeLayout(
                        range,
                        state.targetStart,
                        state.targetEnd,
                        state.originMilliseconds
                    );

                if (targetLayout) {
                    state.targetLayout =
                        targetLayout;
                }
            }

            this.#applyTimeRangeLayout(
                range,
                state.targetLayout
            );''',
    "refresh fitted animation target at finish"
)

path.write_text(text)
print("refined radial-fitted animation coordination")
