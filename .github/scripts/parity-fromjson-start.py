from pathlib import Path

path = Path('ClockTimer.js')
s = path.read_text()

old = '''                const originalPercentGoal =
                    this.#percentGoal;

                this.#percentGoal =
                    1;
'''
new = '''                this.#percentGoal =
                    this.#getPercentGoal();
'''
if old not in s:
    raise SystemExit('temporary percent-goal block not found')
s = s.replace(old, new, 1)

old = '''                this.#tickAlignmentMilliseconds =
                    this.#millisecondsComponent(
                        this.#scheduledStartMilliseconds
                    );

                this.#setIndicatorSymbolVisible(false);'''
new = '''                if (
                    !Number.isFinite(
                        this.#tickAlignmentMilliseconds
                    )
                ) {
                    this.#tickAlignmentMilliseconds =
                        this.#millisecondsComponent(
                            this.#scheduledStartMilliseconds
                        );
                }

                this.#setIndicatorSymbolVisible(false);'''
if old not in s:
    raise SystemExit('fromJSON tick-alignment block not found')
s = s.replace(old, new, 1)

old = '''                    this.#started =
                        false;

                    this.#percentGoal =
                        originalPercentGoal;
                }'''
new = '''                    this.#started =
                        false;
                }'''
if old not in s:
    raise SystemExit('fromJSON percent-goal restore block not found')
s = s.replace(old, new, 1)

path.write_text(s)
