from pathlib import Path
import re

path = Path("ClockTimer.js")
text = path.read_text()

replacement = '''        #getTickInset() {
            let outerInset =
                "0px";

            let timerRingCount =
                0;

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
                    ) ?? "0px";

                const outerMargin =
                    ring.getAttribute(
                        "outer-margin"
                    ) ?? "0px";

                const innerMargin =
                    ring.getAttribute(
                        "inner-margin"
                    ) ?? "0px";

                if (
                    ring ===
                        this.#tickRing
                ) {
                    return timerRingCount > 1
                        ? outerInset
                        : `calc(${outerInset} + ${outerMargin})`;
                }

                if (
                    ring.hasAttribute(
                        "data-clock-timer-ring"
                    )
                ) {
                    timerRingCount++;
                }

                const inset =
                    `calc(${outerInset} + ${outerMargin})`;

                outerInset =
                    `calc(${inset} + ${width} + ${innerMargin})`;
            }

            return "0px";
        }

'''

pattern = re.compile(
    r'        #getTickInset\(\) \{.*?\n        \}\n\n(?=        #syncTickMarkGeometry\(\))',
    re.S,
)

updated, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise RuntimeError(f"Expected one #getTickInset method, replaced {count}")

path.write_text(updated)
