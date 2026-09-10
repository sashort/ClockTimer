from pathlib import Path
p=Path('ClockTimer.js')
lines=p.read_text().splitlines()
lines=[line for line in lines if line.strip() != '#hostBackgroundOverride;']

def replace_between(lines, start_marker, end_marker, replacement):
    start=next(i for i,l in enumerate(lines) if l == start_marker)
    end=next(i for i,l in enumerate(lines[start+1:], start+1) if l == end_marker)
    return lines[:start] + replacement.splitlines() + lines[end:]

lines=replace_between(
    lines,
    '        #captureFaceBackground() {',
    '        #syncFaceBackgroundGeometry() {',
'''        #captureFaceBackground() {
            if (!this.#faceBackground) {
                return;
            }

            this.#syncFaceBackgroundFromExternalCSS();
        }

        #syncFaceBackgroundFromExternalCSS() {
            if (!this.#faceBackground) {
                return;
            }

            this.style.removeProperty(
                "background-color"
            );

            const backgroundColor =
                getComputedStyle(this).backgroundColor;

            this.#faceBackground.style.backgroundColor =
                backgroundColor;

            this.style.setProperty(
                "background-color",
                "transparent",
                "important"
            );
        }
''')

lines=replace_between(
    lines,
    '        #stopFaceBackgroundTracking() {',
    '        #ensureNumberRing() {',
'''        #stopFaceBackgroundTracking() {
            if (this.#faceBackgroundFrame !== undefined) {
                cancelAnimationFrame(this.#faceBackgroundFrame);
                this.#faceBackgroundFrame = undefined;
            }

            this.style.removeProperty(
                "background-color"
            );
        }

''')

p.write_text('\n'.join(lines) + '\n')
