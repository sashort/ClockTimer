from pathlib import Path

path = Path('ClockTimer.js')
s = path.read_text()

old = '''                const originalPercentGoal =
                    this.#percentGoal;

                const originalStandardDuration =
                    this.#standardDuration;

                let customIntervalOffset =
                    0;

                for (
                    let index = 1;
                    index < events.length - 1;
                    index++
                ) {
                    const event =
                        events[index];

                    if (
                        event.type === "resume" ||
                        event.type === "start" ||
                        event.type === "end"
                    ) {
                        continue;
                    }

                    const next =
                        events[index + 1];

                    if (
                        next &&
                        next.milliseconds >
                            event.milliseconds
                    ) {
                        customIntervalOffset +=
                            next.milliseconds -
                            event.milliseconds;
                    }
                }

                this.#percentGoal =
                    1;

                this.#standardDuration =
                    originalStandardDuration +
                    customIntervalOffset;

                this.#ringAnchor ='''
new = '''                const originalPercentGoal =
                    this.#percentGoal;

                this.#percentGoal =
                    1;

                this.#ringAnchor ='''
if old not in s:
    raise SystemExit('planned-end offset block not found')
s = s.replace(old, new, 1)

old = '''                    this.#percentGoal =
                        originalPercentGoal;

                    this.#standardDuration =
                        originalStandardDuration;
                }'''
new = '''                    this.#percentGoal =
                        originalPercentGoal;
                }'''
if old not in s:
    raise SystemExit('standard-duration restore block not found')
s = s.replace(old, new, 1)

path.write_text(s)
