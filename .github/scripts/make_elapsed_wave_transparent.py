from pathlib import Path

path = Path('TimeRange.js')
text = path.read_text()

old_css = '''            :host([type="elapsed"]) {
                animation: none !important;
            }

            :host([type="elapsed"]) #elapsed-wave {
                display: block;
                animation: elapsed-wave-rotation 4s linear infinite;
            }
'''
new_css = '''            :host([type="elapsed"]) {
                animation: none !important;
                background: transparent !important;
                background-color: transparent !important;
                background-image: none !important;
            }

            :host([type="elapsed"]) #elapsed-wave {
                display: block;
                animation: elapsed-wave-rotation 4s linear infinite;
            }
'''
if old_css not in text:
    raise SystemExit('elapsed CSS target not found')
text = text.replace(old_css, new_css, 1)

old_observe = '''        if (parent) {
            this.#appearanceObserver.observe(
                parent,
                {
                    attributes: true
                }
            );
        }
'''
new_observe = '''        if (parent) {
            this.#appearanceObserver.observe(
                parent,
                {
                    attributes: true,
                    childList: true,
                    subtree: true
                }
            );
        }
'''
if old_observe not in text:
    raise SystemExit('appearance observer target not found')
text = text.replace(old_observe, new_observe, 1)

start = text.index('    #updateElapsedWaveAppearance() {')
end = text.index('\n    #updateContour() {', start)
new_method = r'''    #updateElapsedWaveAppearance() {
        if (!this.#elapsedWaveLayer) {
            return;
        }

        if (
            this.getAttribute("type") !==
                "elapsed"
        ) {
            this.#elapsedWaveLayer.style.backgroundImage =
                "none";

            return;
        }

        const parent =
            this.parentElement;

        let darkestLuminance = 1;
        let lightestLuminance = 0;
        let hasUnderlay = false;
        let strongestOpacity = 0;

        const channel =
            value => {
                const normalized =
                    value / 255;

                return normalized <= 0.04045
                    ? normalized / 12.92
                    : Math.pow(
                        (normalized + 0.055) / 1.055,
                        2.4
                    );
            };

        if (parent) {
            for (
                const range of
                    parent.children
            ) {
                if (
                    range === this ||
                    range.localName !==
                        "time-range" ||
                    range.getAttribute("type") ===
                        "elapsed"
                ) {
                    continue;
                }

                const style =
                    getComputedStyle(range);

                const color =
                    this.#parseComputedColor(
                        style.backgroundColor
                    );

                const opacityValue =
                    Number.parseFloat(
                        style.opacity
                    );

                const opacity =
                    Number.isFinite(opacityValue)
                        ? Math.min(
                            1,
                            Math.max(
                                0,
                                opacityValue
                            )
                        )
                        : 1;

                if (color) {
                    const luminance =
                        0.2126 * channel(color.red) +
                        0.7152 * channel(color.green) +
                        0.0722 * channel(color.blue);

                    darkestLuminance =
                        Math.min(
                            darkestLuminance,
                            luminance
                        );

                    lightestLuminance =
                        Math.max(
                            lightestLuminance,
                            luminance
                        );

                    strongestOpacity =
                        Math.max(
                            strongestOpacity,
                            opacity * color.alpha
                        );

                    hasUnderlay =
                        true;
                }
                else if (
                    style.backgroundImage !==
                        "none"
                ) {
                    hasUnderlay =
                        true;

                    strongestOpacity =
                        Math.max(
                            strongestOpacity,
                            opacity
                        );
                }
            }
        }

        const contrastRange =
            hasUnderlay
                ? lightestLuminance -
                    darkestLuminance
                : 0;

        let strength =
            hasUnderlay
                ? 0.48 +
                    (1 - strongestOpacity) *
                        0.18 +
                    contrastRange *
                        0.16
                : 0.58;

        strength =
            Math.min(
                0.82,
                Math.max(
                    0.46,
                    strength
                )
            );

        const shoulder =
            strength * 0.38;

        const rgba =
            alpha =>
                `rgba(255, 255, 255, ${alpha.toFixed(3)})`;

        this.#elapsedWaveLayer.style.mixBlendMode =
            "screen";

        this.#elapsedWaveLayer.style.backgroundImage =
            `conic-gradient(from 0deg at 50% 50%, ` +
            `${rgba(strength)} 0deg, ` +
            `${rgba(shoulder)} 13deg, ` +
            `transparent 38deg, ` +
            `transparent 322deg, ` +
            `${rgba(shoulder)} 347deg, ` +
            `${rgba(strength)} 360deg)`;
    }
'''
text = text[:start] + new_method + text[end:]

# Ensure no old dark-wave logic remains.
for forbidden in ['useDarkWave', 'waveChannel', '"multiply"']:
    if forbidden in text:
        raise SystemExit(f'legacy elapsed wave logic remains: {forbidden}')

path.write_text(text)
