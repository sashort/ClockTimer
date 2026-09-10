from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text(encoding='utf-8')

start_marker = '        #syncTickMarkGeometry() {'
end_marker = '        #startTickGeometryTracking() {'

start = text.find(start_marker)
if start == -1:
    raise RuntimeError('Could not find #syncTickMarkGeometry()')

end = text.find(end_marker, start)
if end == -1:
    raise RuntimeError('Could not find #startTickGeometryTracking() after sync method')

replacement = '''        #getTickInset() {
            let outerInset =
                "0px";

            const rings =
                Array.from(
                    this.children
                ).filter(
                    element =>
                        element.localName ===
                            "ring-container"
                );

            for (
                const ring of
                    rings
            ) {
                const width =
                    ring.getAttribute(
                        "width"
                    ) ??
                    "0px";

                const outerMargin =
                    ring.getAttribute(
                        "outer-margin"
                    ) ??
                    "0px";

                const innerMargin =
                    ring.getAttribute(
                        "inner-margin"
                    ) ??
                    "0px";

                const inset =
                    `calc(${outerInset} + ${outerMargin})`;

                if (
                    ring ===
                        this.#tickRing
                ) {
                    return inset;
                }

                outerInset =
                    `calc(${inset} + ${width} + ${innerMargin})`;
            }

            return "0px";
        }

        #syncTickMarkGeometry() {
            this.#ensureTickRing();

            const inset =
                this.#getTickInset();

            this.#tickMarkLayer.style.left =
                "";

            this.#tickMarkLayer.style.top =
                "";

            this.#tickMarkLayer.style.width =
                "";

            this.#tickMarkLayer.style.height =
                "";

            this.#tickMarkLayer.style.inset =
                inset;
        }

'''

text = text[:start] + replacement + text[end:]
path.write_text(text, encoding='utf-8')
