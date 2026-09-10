from pathlib import Path

path = Path('TimeRange.js')
text = path.read_text()

old = '''    #geometryStyleElement;\n    #contourLayer;\n    #syncing = 0;'''
new = '''    #geometryStyleElement;\n    #contourLayer;\n    #elapsedWaveLayer;\n    #appearanceObserver;\n    #appearanceRefreshFrame;\n    #syncing = 0;'''
if old not in text:
    raise SystemExit('field anchor not found')
text = text.replace(old, new, 1)

old = '''            :host([overlapping]) #contour {\n                display: none;\n            }\n        `;'''
new = '''            :host([overlapping]) #contour {\n                display: none;\n            }\n\n            #elapsed-wave {\n                position: absolute;\n                inset: 0;\n                display: none;\n                pointer-events: none;\n                transform-origin: 50% 50%;\n                background-repeat: no-repeat;\n                will-change: transform;\n            }\n\n            :host([type="elapsed"]) {\n                animation: none !important;\n            }\n\n            :host([type="elapsed"]) #elapsed-wave {\n                display: block;\n                animation: elapsed-wave-rotation 4s linear infinite;\n            }\n\n            @keyframes elapsed-wave-rotation {\n                from {\n                    transform: rotate(0deg);\n                }\n\n                to {\n                    transform: rotate(360deg);\n                }\n            }\n        `;'''
if old not in text:
    raise SystemExit('style anchor not found')
text = text.replace(old, new, 1)

old = '''        this.#contourLayer.id =\n            "contour";\n\n        this.#styleElement ='''
new = '''        this.#contourLayer.id =\n            "contour";\n\n        this.#elapsedWaveLayer =\n            document.createElement(\n                "div"\n            );\n\n        this.#elapsedWaveLayer.id =\n            "elapsed-wave";\n\n        this.#styleElement ='''
if old not in text:
    raise SystemExit('layer anchor not found')
text = text.replace(old, new, 1)

old = '''            this.#styleElement,\n            this.#contourLayer\n        );'''
new = '''            this.#styleElement,\n            this.#contourLayer,\n            this.#elapsedWaveLayer\n        );'''
if old not in text:
    raise SystemExit('append anchor not found')
text = text.replace(old, new, 1)

old = '''        TimeRange.#reorderParent(\n            this.parentElement\n        );\n\n        if ('''
new = '''        TimeRange.#reorderParent(\n            this.parentElement\n        );\n\n        this.#startAppearanceObserver();\n        this.#scheduleAppearanceRefresh();\n\n        if ('''
if old not in text:
    raise SystemExit('connect anchor not found')
text = text.replace(old, new, 1)

old = '''    disconnectedCallback() {\n        if (\n            TimeRange.#reordering\n        ) {\n            return;\n        }\n\n        if ('''
new = '''    disconnectedCallback() {\n        if (\n            TimeRange.#reordering\n        ) {\n            return;\n        }\n\n        this.#stopAppearanceObserver();\n\n        if ('''
if old not in text:
    raise SystemExit('disconnect anchor not found')
text = text.replace(old, new, 1)

old = '''        if (\n            this.#syncing !== 0 ||\n            oldValue === newValue ||\n            !this.isConnected\n        ) {\n            return;\n        }\n\n        if ('''
new = '''        if (\n            this.#syncing !== 0 ||\n            oldValue === newValue ||\n            !this.isConnected\n        ) {\n            return;\n        }\n\n        this.#scheduleAppearanceRefresh();\n\n        if ('''
if old not in text:
    raise SystemExit('attribute callback anchor not found')
text = text.replace(old, new, 1)

anchor = '''    #updateContour() {\n'''
if anchor not in text:
    raise SystemExit('updateContour anchor not found')
methods = r'''    #startAppearanceObserver() {
        this.#stopAppearanceObserver();

        this.#appearanceObserver =
            new MutationObserver(
                mutations => {
                    if (
                        mutations.some(
                            mutation =>
                                mutation.type === "attributes" &&
                                (
                                    mutation.target === this ||
                                    mutation.target === this.parentElement
                                )
                        )
                    ) {
                        this.#scheduleAppearanceRefresh();
                    }
                }
            );

        this.#appearanceObserver.observe(
            this,
            {
                attributes: true
            }
        );

        const parent =
            this.parentElement;

        if (parent) {
            this.#appearanceObserver.observe(
                parent,
                {
                    attributes: true
                }
            );
        }
    }

    #stopAppearanceObserver() {
        this.#appearanceObserver?.disconnect();
        this.#appearanceObserver =
            undefined;

        if (
            this.#appearanceRefreshFrame !==
                undefined
        ) {
            cancelAnimationFrame(
                this.#appearanceRefreshFrame
            );

            this.#appearanceRefreshFrame =
                undefined;
        }
    }

    #scheduleAppearanceRefresh() {
        if (
            !this.isConnected ||
            this.#appearanceRefreshFrame !==
                undefined
        ) {
            return;
        }

        this.#appearanceRefreshFrame =
            requestAnimationFrame(
                () => {
                    this.#appearanceRefreshFrame =
                        undefined;

                    this.#updateElapsedWaveAppearance();
                }
            );
    }

    #parseComputedColor(value) {
        const match =
            String(value ?? "").match(
                /^rgba?\(\s*([\d.]+)\s*(?:,|\s)\s*([\d.]+)\s*(?:,|\s)\s*([\d.]+)(?:\s*(?:,|\/)\s*([\d.]+%?))?\s*\)$/i
            );

        if (!match) {
            return undefined;
        }

        const alphaText =
            match[4];

        const alpha =
            alphaText === undefined
                ? 1
                : alphaText.endsWith("%")
                    ? Number(alphaText.slice(0, -1)) / 100
                    : Number(alphaText);

        return {
            red: Number(match[1]),
            green: Number(match[2]),
            blue: Number(match[3]),
            alpha: Number.isFinite(alpha)
                ? Math.min(1, Math.max(0, alpha))
                : 1
        };
    }

    #updateElapsedWaveAppearance() {
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

        const computed =
            getComputedStyle(this);

        const color =
            this.#parseComputedColor(
                computed.backgroundColor
            );

        const opacityValue =
            Number.parseFloat(
                computed.opacity
            );

        const hostOpacity =
            Number.isFinite(opacityValue)
                ? Math.min(1, Math.max(0, opacityValue))
                : 1;

        const backgroundAlpha =
            color?.alpha ?? 1;

        const effectiveOpacity =
            hostOpacity *
            backgroundAlpha;

        let luminance =
            0.5;

        if (color) {
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

            luminance =
                0.2126 * channel(color.red) +
                0.7152 * channel(color.green) +
                0.0722 * channel(color.blue);
        }

        const useDarkWave =
            luminance > 0.58;

        const waveChannel =
            useDarkWave ? 0 : 255;

        let strength =
            0.42 +
            (1 - effectiveOpacity) *
                0.38;

        if (
            computed.backgroundImage !==
                "none"
        ) {
            strength += 0.08;
        }

        if (
            computed.filter !== "none" ||
            computed.mixBlendMode !== "normal"
        ) {
            strength += 0.05;
        }

        strength =
            Math.min(
                0.9,
                Math.max(
                    0.38,
                    strength
                )
            );

        const shoulder =
            strength * 0.34;

        const rgba =
            alpha =>
                `rgba(${waveChannel}, ${waveChannel}, ${waveChannel}, ${alpha.toFixed(3)})`;

        this.#elapsedWaveLayer.style.mixBlendMode =
            useDarkWave
                ? "multiply"
                : "screen";

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
text = text.replace(anchor, methods + anchor, 1)

old = '''    refreshVisualGeometry() {\n        this.#updateClipPath();\n\n        return this;\n    }'''
new = '''    refreshVisualGeometry() {\n        this.#updateClipPath();\n        this.#scheduleAppearanceRefresh();\n\n        return this;\n    }'''
if old not in text:
    raise SystemExit('refreshVisualGeometry anchor not found')
text = text.replace(old, new, 1)

path.write_text(text)
