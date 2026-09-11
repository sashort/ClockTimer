from pathlib import Path
import re

path = Path("ClockTimer.js")
text = path.read_text()

# Add typed external CSS custom property.
needle = '''                @property --clock-timer-spin-scale-speed {
                    syntax: "<time>";
                    inherits: true;
                    initial-value: 125ms;
                }
'''
replacement = needle + '''
                @property --clock-timer-spin-scale-factor {
                    syntax: "<number>";
                    inherits: true;
                    initial-value: 0.95;
                }
'''
if needle not in text:
    raise SystemExit("spin scale speed property block not found")
text = text.replace(needle, replacement, 1)

# Add public destructured option.
needle = '''        spin({
            rotations = 1,
            duration,
            scaleSpeed
        } = {}) {
'''
replacement = '''        spin({
            rotations = 1,
            duration,
            scaleSpeed,
            spinScaleFactor
        } = {}) {
'''
if needle not in text:
    raise SystemExit("spin options signature not found")
text = text.replace(needle, replacement, 1)

# Validate explicit factor.
needle = '''            if (scaleSpeed !== undefined) {
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
replacement = '''            if (scaleSpeed !== undefined) {
                this.#parseCSSTimeMilliseconds(
                    scaleSpeed,
                    {
                        throwOnInvalid: true
                    }
                );
            }

            if (spinScaleFactor !== undefined) {
                const normalizedSpinScaleFactor =
                    Number(spinScaleFactor);

                if (
                    !Number.isFinite(normalizedSpinScaleFactor) ||
                    normalizedSpinScaleFactor <= 0
                ) {
                    throw new RangeError(
                        "spinScaleFactor must be a finite number greater than zero."
                    );
                }
            }

            if (
                this.#updatesSuspended &&
'''
if needle not in text:
    raise SystemExit("spin validation insertion point not found")
text = text.replace(needle, replacement, 1)

# Preserve factor when buffering.
needle = '''                    type: "spin",
                    rotations: normalizedRotations,
                    duration,
                    scaleSpeed
'''
replacement = '''                    type: "spin",
                    rotations: normalizedRotations,
                    duration,
                    scaleSpeed,
                    spinScaleFactor
'''
if needle not in text:
    raise SystemExit("spin queue block not found")
text = text.replace(needle, replacement, 1)

# Pass factor into runner.
needle = '''            this.#runSpin(
                normalizedRotations,
                duration,
                scaleSpeed
            );
'''
replacement = '''            this.#runSpin(
                normalizedRotations,
                duration,
                scaleSpeed,
                spinScaleFactor
            );
'''
if needle not in text:
    raise SystemExit("runSpin call not found")
text = text.replace(needle, replacement, 1)

# Add factor resolver after scale speed resolver.
needle = '''        #getSpinScaleSpeedMilliseconds(scaleSpeed) {
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
replacement = needle + '''
        #getSpinScaleFactor(spinScaleFactor) {
            if (spinScaleFactor !== undefined) {
                return Number(spinScaleFactor);
            }

            const computed =
                Number(
                    getComputedStyle(this)
                        .getPropertyValue(
                            "--clock-timer-spin-scale-factor"
                        )
                        .trim()
                );

            return Number.isFinite(computed) &&
                computed > 0
                    ? computed
                    : 0.95;
        }
'''
if needle not in text:
    raise SystemExit("scale speed helper not found")
text = text.replace(needle, replacement, 1)

# Runner receives factor and resolves it once.
needle = '''        #runSpin(rotations, duration, scaleSpeed) {
'''
replacement = '''        #runSpin(
            rotations,
            duration,
            scaleSpeed,
            spinScaleFactor
        ) {
'''
if needle not in text:
    raise SystemExit("runSpin signature not found")
text = text.replace(needle, replacement, 1)

needle = '''            const scaleOffset =
                totalDuration > 0
                    ? scaleDuration /
                        totalDuration
                    : 0.5;

            const spinAnimation =
'''
replacement = '''            const scaleOffset =
                totalDuration > 0
                    ? scaleDuration /
                        totalDuration
                    : 0.5;

            const scaleFactor =
                this.#getSpinScaleFactor(
                    spinScaleFactor
                );

            const spinAnimation =
'''
if needle not in text:
    raise SystemExit("scale factor insertion point not found")
text = text.replace(needle, replacement, 1)

# Replace hardcoded scale values in the scale animation only.
text = text.replace('''                            scale: "0.95"\n''', '''                            scale:\n                                String(scaleFactor)\n''', 2)

# Update buffered replay(s) if they use the old positional public spin API.
patterns = [
    re.compile(r'''this\.spin\(\s*operation\.rotations,\s*operation\.duration\s*\);'''),
    re.compile(r'''this\.spin\(\s*operation\.rotations,\s*operation\.duration,\s*operation\.scaleSpeed\s*\);''')
]
for pattern in patterns:
    text = pattern.sub('''this.spin({\n                                rotations:\n                                    operation.rotations,\n                                duration:\n                                    operation.duration,\n                                scaleSpeed:\n                                    operation.scaleSpeed,\n                                spinScaleFactor:\n                                    operation.spinScaleFactor\n                            });''', text)

# If buffered replay is already destructured, add the new field when possible.
text = text.replace('''                                scaleSpeed:\n                                    operation.scaleSpeed\n                            });''', '''                                scaleSpeed:\n                                    operation.scaleSpeed,\n                                spinScaleFactor:\n                                    operation.spinScaleFactor\n                            });''')

path.write_text(text)
