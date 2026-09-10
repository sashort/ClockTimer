from pathlib import Path

path = Path("TimeRange.js")
text = path.read_text()

old_css = '''            :host([type="elapsed"]) #elapsed-wave {
                display: block;
                animation: elapsed-wave-rotation 4s linear infinite;
            }

            @keyframes elapsed-wave-rotation {
                from {
                    transform: rotate(0deg);
                }

                to {
                    transform: rotate(360deg);
                }
            }
'''

new_css = '''            :host([type="elapsed"]) #elapsed-wave {
                display: block;
                animation: elapsed-wave-sweep 4s linear infinite;
            }

            @keyframes elapsed-wave-sweep {
                0% {
                    opacity: 1;
                    transform: rotate(
                        var(--elapsed-wave-start-angle, 0deg)
                    );
                }

                25% {
                    opacity: 1;
                    transform: rotate(
                        var(--elapsed-wave-end-angle, 360deg)
                    );
                }

                25.01%,
                100% {
                    opacity: 0;
                    transform: rotate(
                        var(--elapsed-wave-end-angle, 360deg)
                    );
                }
            }
'''

if old_css not in text:
    raise SystemExit("elapsed wave CSS block not found")
text = text.replace(old_css, new_css, 1)

old_full = '''        if (
            duration >=
                60 * 60 * 1000
        ) {
            this.#styleElement.textContent = `
                :host {
                    clip-path: none;
                }
            `;

            return;
        }
'''

new_full = '''        if (
            duration >=
                60 * 60 * 1000
        ) {
            if (
                this.getAttribute("type") ===
                    "elapsed"
            ) {
                this.#elapsedWaveLayer.style.setProperty(
                    "--elapsed-wave-start-angle",
                    "0deg"
                );

                this.#elapsedWaveLayer.style.setProperty(
                    "--elapsed-wave-end-angle",
                    "360deg"
                );
            }

            this.#styleElement.textContent = `
                :host {
                    clip-path: none;
                }
            `;

            return;
        }
'''

if old_full not in text:
    raise SystemExit("full range block not found")
text = text.replace(old_full, new_full, 1)

old_angles = '''        const endAngle =
            TimeRange.#calculateTimeAngle(
                renderEnd,
                ringOrigin
            );

        const startPoint =
'''

new_angles = '''        const endAngle =
            TimeRange.#calculateTimeAngle(
                renderEnd,
                ringOrigin
            );

        if (
            this.getAttribute("type") ===
                "elapsed"
        ) {
            const sweepEndAngle =
                duration > 0 &&
                endAngle <= startAngle
                    ? endAngle + 360
                    : endAngle;

            this.#elapsedWaveLayer.style.setProperty(
                "--elapsed-wave-start-angle",
                `${startAngle}deg`
            );

            this.#elapsedWaveLayer.style.setProperty(
                "--elapsed-wave-end-angle",
                `${sweepEndAngle}deg`
            );
        }

        const startPoint =
'''

if old_angles not in text:
    raise SystemExit("angle block not found")
text = text.replace(old_angles, new_angles, 1)

path.write_text(text)
