from pathlib import Path

path = Path('TimeRange.js')
s = path.read_text()
old = '''        if (!activeRing) {
            this.#elapsedWaveLayer.style.animation =
                "none";

            this.#elapsedWaveLayer.style.opacity =
                "0";

            this.#elapsedWaveLayer.style.backgroundImage =
                "none";

            return;
        }

        this.#elapsedWaveLayer.style.removeProperty(
            "animation"
        );'''
new = '''        if (
            this.hasAttribute(
                "static-elapsed"
            ) ||
            !activeRing
        ) {
            this.#elapsedWaveLayer.style.animation =
                "none";

            this.#elapsedWaveLayer.style.opacity =
                "0";

            this.#elapsedWaveLayer.style.backgroundImage =
                "none";

            return;
        }

        this.#elapsedWaveLayer.style.removeProperty(
            "animation"
        );'''
if old not in s:
    raise SystemExit('elapsed active-ring appearance block not found')
s = s.replace(old, new, 1)
path.write_text(s)
