from pathlib import Path
import re

path = Path("ClockTimer.js")
text = path.read_text()

# Register the externally configurable scale-ramp duration.
needle = '''                @property --clock-timer-spin-duration {
                    syntax: "<time>";
                    inherits: true;
                    initial-value: 750ms;
                }
'''
replacement = needle + '''
                @property --clock-timer-spin-scale-speed {
                    syntax: "<time>";
                    inherits: true;
                    initial-value: 125ms;
                }
'''
if needle not in text:
    raise SystemExit("spin duration property not found")
text = text.replace(needle, replacement, 1)

# Public API now takes one destructured options object.
old_sig = '''        spin(rotations = 1, duration) {
            const normalizedRotations =
                Number(rotations);
'''
new_sig = '''        spin({
            rotations = 1,
            duration,
            scaleSpeed
        } = {}) {
            const normalizedRotations =
                Number(rotations);
'''
if old_sig not in text:
    raise SystemExit("spin signature not found")
text = text.replace(old_sig, new_sig, 1)

# Validate an explicit scaleSpeed just like duration.
needle = '''            if (duration !== undefined) {
                this.#parseCSSTimeMilliseconds(
                    duration,
                    {
                        throwOnInvalid: true
                    }
                );
            }

            if (
                this.#updatesSuspended &&
'''
replacement = '''            if (duration !== undefined) {
                this.#parseCSSTimeMilliseconds(
                    duration,
                    {
                        throwOnInvalid: true
                    }
                );
            }

            if (scaleSpeed !== undefined) {
                this.#parseCSSTimeMilliseconds(
                    scaleSpeed,
                    {
                        throwOnInvalid: true
                    }
                );
            }

            if (
                this.#updatesSuspended &&
'''
if needle not in text:
    raise SystemExit("spin validation block not found")
text = text.replace(needle, replacement, 1)

# Preserve scaleSpeed through async buffering and pass it into the runner.
needle = '''                    type: "spin",
                    rotations: normalizedRotations,
                    duration
'''
replacement = '''                    type: "spin",
                    rotations: normalizedRotations,
                    duration,
                    scaleSpeed
'''
if needle not in text:
    raise SystemExit("spin async queue block not found")
text = text.replace(needle, replacement, 1)

needle = '''            this.#runSpin(
                normalizedRotations,
                duration
            );
'''
replacement = '''            this.#runSpin(
                normalizedRotations,
                duration,
                scaleSpeed
            );
'''
if needle not in text:
    raise SystemExit("runSpin call not found")
text = text.replace(needle, replacement, 1)

# Resolve scaleSpeed from the argument first, then external CSS, then 125ms.
needle = '''        #getSpinDurationMilliseconds(duration) {
            if (duration !== undefined) {
                return this.#parseCSSTimeMilliseconds(
                    duration,
                    {
                        throwOnInvalid: true
                    }
                );
            }

            const computed =
                getComputedStyle(this)
                    .getPropertyValue(
                        "--clock-timer-spin-duration"
                    )
                    .trim();

            return this.#parseCSSTimeMilliseconds(
                computed
            ) ?? 750;
        }
'''
replacement = needle + '''
        #getSpinScaleSpeedMilliseconds(scaleSpeed) {
            if (scaleSpeed !== undefined) {
                return this.#parseCSSTimeMilliseconds(
                    scaleSpeed,
                    {
                        throwOnInvalid: true
                    }
                );
            }

            const computed =
                getComputedStyle(this)
                    .getPropertyValue(
                        "--clock-timer-spin-scale-speed"
                    )
                    .trim();

            return this.#parseCSSTimeMilliseconds(
                computed
            ) ?? 125;
        }
'''
if needle not in text:
    raise SystemExit("spin duration helper not found")
text = text.replace(needle, replacement, 1)

text = text.replace(
    '''        #runSpin(rotations, duration) {\n''',
    '''        #runSpin(rotations, duration, scaleSpeed) {\n''',
    1
)
needle = '''            const totalDuration =
                perRotationDuration *
                rotations;

            const scaleDuration =
                Math.min(
                    125,
                    totalDuration / 2
                );
'''
replacement = '''            const totalDuration =
                perRotationDuration *
                rotations;

            const requestedScaleDuration =
                this.#getSpinScaleSpeedMilliseconds(
                    scaleSpeed
                );

            const scaleDuration =
                Math.min(
                    requestedScaleDuration,
                    totalDuration / 2
                );
'''
if needle not in text:
    raise SystemExit("scale duration block not found")
text = text.replace(needle, replacement, 1)

# Async replay used the old positional public API. Convert every buffered spin replay.
pattern = re.compile(r'''this\.spin\(\s*operation\.rotations,\s*operation\.duration\s*\);''')
text, count = pattern.subn('''this.spin({\n                                rotations:\n                                    operation.rotations,\n                                duration:\n                                    operation.duration,\n                                scaleSpeed:\n                                    operation.scaleSpeed\n                            });''', text)
if count < 1:
    raise SystemExit("buffered spin replay not found")

path.write_text(text)
print(f"updated {count} buffered spin replay(s)")