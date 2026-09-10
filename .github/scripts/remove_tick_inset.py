from pathlib import Path
import re

path = Path('ClockTimer.js')
text = path.read_text()

text, count_css = re.subn(
    r'\n\s*--clock-timer-tick-inset:\s*\n\s*clamp\(5px, 2cqi, 10px\);\n',
    '\n',
    text,
    count=1,
)
if count_css != 1:
    raise SystemExit(f'Expected one tick inset CSS variable, removed {count_css}')

text, count_margin = re.subn(
    r'\n\s*ring\.setAttribute\(\s*\n\s*"outer-margin",\s*\n\s*"var\(--clock-timer-tick-inset, clamp\(5px, 2cqi, 10px\)\)"\s*\n\s*\);\n',
    '\n',
    text,
    count=1,
)
if count_margin != 1:
    raise SystemExit(f'Expected one tick outer-margin assignment, removed {count_margin}')

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
                    return outerInset;
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
text, count_helper = pattern.subn(replacement, text, count=1)
if count_helper != 1:
    raise SystemExit(f'Expected one #getTickInset method, replaced {count_helper}')

path.write_text(text)
