from pathlib import Path

path = Path('ClockTimer.js')
s = path.read_text()

old = '''                this.#percentGoal =
                    this.#getPercentGoal();

                this.#ringAnchor ='''
new = '''                const originalPercentGoal =
                    this.#percentGoal;

                this.#percentGoal =
                    1;

                this.#ringAnchor ='''
if old not in s:
    raise SystemExit('percentGoal initialization target not found')
s = s.replace(old, new, 1)

old = '''                finally {
                    this.#starting =
                        false;

                    this.#started =
                        false;
                }'''
new = '''                finally {
                    this.#starting =
                        false;

                    this.#started =
                        false;

                    this.#percentGoal =
                        originalPercentGoal;
                }'''
if old not in s:
    raise SystemExit('fromJSON finally target not found')
s = s.replace(old, new, 1)

path.write_text(s)
