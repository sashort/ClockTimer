from pathlib import Path

path = Path('TimeRange.js')
text = path.read_text()

old_css = '''            :host([type="elapsed"]) #elapsed-wave {
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

new_css = '''            :host([type="elapsed"]) #elapsed-wave {
                display: block;
                animation: elapsed-wave-sweep 4.5s linear infinite;
            }

            @keyframes elapsed-wave-sweep {
                0% {
                    opacity: 0;
                    transform: rotate(
                        var(--elapsed-wave-start-angle, 0deg)
                    );
                }

                3% {
                    opacity: 1;
                }

                30.333% {
                    opacity: 1;
                }

                33.333% {
                    opacity: 0;
                    transform: rotate(
                        var(--elapsed-wave-end-angle, 360deg)
                    );
                }

                100% {
                    opacity: 0;
                    transform: rotate(
                        var(--elapsed-wave-end-angle, 360deg)
                    );
                }
            }
'''

if old_css not in text:
    raise SystemExit('elapsed wave css block not found')
text = text.replace(old_css, new_css, 1)

old_gradient = '''        this.#elapsedWaveLayer.style.backgroundImage =
            `conic-gradient(from 0deg at 50% 50%, ` +
            `${rgba(strength)} 0deg, ` +
            `${rgba(shoulder)} 13deg, ` +
            `transparent 38deg, ` +
            `transparent 322deg, ` +
            `${rgba(shoulder)} 347deg, ` +
            `${rgba(strength)} 360deg)`;
'''

new_gradient = '''        this.#elapsedWaveLayer.style.backgroundImage =
            `conic-gradient(from 0deg at 50% 50%, ` +
            `${rgba(strength)} 0deg, ` +
            `${rgba(shoulder)} var(--elapsed-wave-shoulder, 4deg), ` +
            `transparent var(--elapsed-wave-width, 12deg), ` +
            `transparent calc(360deg - var(--elapsed-wave-width, 12deg)), ` +
            `${rgba(shoulder)} calc(360deg - var(--elapsed-wave-shoulder, 4deg)), ` +
            `${rgba(strength)} 360deg)`;
'''

if old_gradient not in text:
    raise SystemExit('elapsed wave gradient block not found')
text = text.replace(old_gradient, new_gradient, 1)

old_full = '''                this.#elapsedWaveLayer.style.setProperty(
                    "--elapsed-wave-start-angle",
                    "0deg"
                );

                this.#elapsedWaveLayer.style.setProperty(
                    "--elapsed-wave-end-angle",
                    "360deg"
                );
'''

new_full = '''                const waveWidth = 38;

                this.#elapsedWaveLayer.style.setProperty(
                    "--elapsed-wave-width",
                    `${waveWidth}deg`
                );

                this.#elapsedWaveLayer.style.setProperty(
                    "--elapsed-wave-shoulder",
                    `${waveWidth * 0.35}deg`
                );

                this.#elapsedWaveLayer.style.setProperty(
                    "--elapsed-wave-start-angle",
                    `${-waveWidth}deg`
                );

                this.#elapsedWaveLayer.style.setProperty(
                    "--elapsed-wave-end-angle",
                    `${360 + waveWidth}deg`
                );
'''

if old_full not in text:
    raise SystemExit('full elapsed wave angle block not found')
text = text.replace(old_full, new_full, 1)

old_partial = '''            this.#elapsedWaveLayer.style.setProperty(
                "--elapsed-wave-start-angle",
                `${startAngle}deg`
            );

            this.#elapsedWaveLayer.style.setProperty(
                "--elapsed-wave-end-angle",
                `${sweepEndAngle}deg`
            );
'''

new_partial = '''            const sweepAngle =
                Math.max(
                    0,
                    sweepEndAngle - startAngle
                );

            const waveWidth =
                Math.max(
                    1.5,
                    Math.min(
                        38,
                        sweepAngle * 0.4
                    )
                );

            this.#elapsedWaveLayer.style.setProperty(
                "--elapsed-wave-width",
                `${waveWidth}deg`
            );

            this.#elapsedWaveLayer.style.setProperty(
                "--elapsed-wave-shoulder",
                `${Math.max(0.5, waveWidth * 0.35)}deg`
            );

            this.#elapsedWaveLayer.style.setProperty(
                "--elapsed-wave-start-angle",
                `${startAngle - waveWidth}deg`
            );

            this.#elapsedWaveLayer.style.setProperty(
                "--elapsed-wave-end-angle",
                `${sweepEndAngle + waveWidth}deg`
            );
'''

if old_partial not in text:
    raise SystemExit('partial elapsed wave angle block not found')
text = text.replace(old_partial, new_partial, 1)

path.write_text(text)
