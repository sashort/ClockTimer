from pathlib import Path

p = Path('TimeRange.js')
s = p.read_text()

old_full = '''            this.#styleElement.textContent = `
                :host {
                    clip-path: none;
                }
            `;

            return;
'''
new_full = '''            this.#styleElement.textContent = `
                :host {
                    clip-path: none;
                    -webkit-mask-image: none;
                    mask-image: none;
                }
            `;

            return;
'''
if old_full not in s:
    raise SystemExit('full-hour style block not found')
s = s.replace(old_full, new_full, 1)

old_tail = '''        const polygonPoints = [
            "50% 50%",
            `${startX}% ${startY}%`,
            ...corners.map(
                corner =>
                    `${
                        corner.x /
                        width *
                        100
                    }% ${
                        corner.y /
                        height *
                        100
                    }%`
            ),
            `${endX}% ${endY}%`
        ];

        this.#styleElement.textContent = `
            :host {
                clip-path: polygon(
                    ${polygonPoints.join(",\\n                    ")}
                );
            }
        `;
'''

new_tail = '''        const polygonPoints = [
            "50% 50%",
            `${startX}% ${startY}%`,
            ...corners.map(
                corner =>
                    `${
                        corner.x /
                        width *
                        100
                    }% ${
                        corner.y /
                        height *
                        100
                    }%`
            ),
            `${endX}% ${endY}%`
        ];

        const staticRange =
            this.getAttribute("type") !==
                "elapsed";

        if (staticRange) {
            const renderedRingWidth =
                this.#resolveLength(
                    parent.renderedWidth ??
                    parent.getAttribute("width") ??
                    "0px"
                );

            const renderedRingInset =
                this.#resolveLength(
                    parent.renderedInset ??
                    this.#getEffectiveRingInset(parent)
                );

            const ringRadius =
                Math.min(width, height) / 2;

            const centerRadius =
                Math.max(
                    0,
                    ringRadius -
                        renderedRingInset
                );

            const capRadius =
                Math.max(
                    0,
                    renderedRingWidth / 2
                );

            const sweepEndAngle =
                duration > 0 &&
                endAngle <= startAngle
                    ? endAngle + 360
                    : endAngle;

            const sweepAngle =
                Math.max(
                    0,
                    Math.min(
                        360,
                        sweepEndAngle -
                            startAngle
                    )
                );

            const capPoint =
                angle => {
                    const radians =
                        angle * Math.PI / 180;

                    return {
                        x:
                            width / 2 +
                            Math.sin(radians) *
                                centerRadius,
                        y:
                            height / 2 -
                            Math.cos(radians) *
                                centerRadius
                    };
                };

            const startCap =
                capPoint(startAngle);

            const endCap =
                capPoint(sweepEndAngle);

            if (capRadius > 0) {
                const mask =
                    `conic-gradient(from ${startAngle}deg at 50% 50%, ` +
                    `#000 0deg ${sweepAngle}deg, ` +
                    `transparent ${sweepAngle}deg 360deg), ` +
                    `radial-gradient(circle ${capRadius}px at ${startCap.x}px ${startCap.y}px, ` +
                    `#000 0%, #000 98%, transparent 100%), ` +
                    `radial-gradient(circle ${capRadius}px at ${endCap.x}px ${endCap.y}px, ` +
                    `#000 0%, #000 98%, transparent 100%)`;

                this.#styleElement.textContent = `
                    :host {
                        clip-path: none;
                        -webkit-mask-image: ${mask};
                        mask-image: ${mask};
                        -webkit-mask-repeat: no-repeat;
                        mask-repeat: no-repeat;
                    }
                `;

                return;
            }
        }

        this.#styleElement.textContent = `
            :host {
                -webkit-mask-image: none;
                mask-image: none;
                clip-path: polygon(
                    ${polygonPoints.join(",\\n                    ")}
                );
            }
        `;
'''

if old_tail not in s:
    raise SystemExit('clip-path tail block not found')
s = s.replace(old_tail, new_tail, 1)

p.write_text(s)
