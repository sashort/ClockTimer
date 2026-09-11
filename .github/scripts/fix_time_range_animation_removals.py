from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


# Keep TimeRange's rendered timing synchronized with the exact geometry
# ClockTimer applies on every animation frame.
path = Path("TimeRange.js")
text = path.read_text()

text = replace_once(
    text,
    '''    applyAnimatedLayout({\n        clipPath,\n        startAngle,\n        endAngle,\n        duration\n    } = {}) {''',
    '''    applyAnimatedLayout({\n        clipPath,\n        startAngle,\n        endAngle,\n        duration,\n        renderStartTime,\n        renderEndTime\n    } = {}) {''',
    "TimeRange applyAnimatedLayout signature",
)

text = replace_once(
    text,
    '''        this.#updateContour();\n        this.#updateGeometryVariables();\n\n        this.#updateWaveGeometry(''',
    '''        const renderStart =\n            this.#uniformDate(\n                renderStartTime,\n                false\n            );\n\n        const renderEnd =\n            this.#uniformDate(\n                renderEndTime,\n                false\n            );\n\n        if (\n            renderStart instanceof Date &&\n            renderEnd instanceof Date\n        ) {\n            this.#renderStartTime =\n                this.#cloneDate(\n                    renderStart\n                );\n\n            this.#renderEndTime =\n                this.#cloneDate(\n                    renderEnd\n                );\n        }\n\n        this.#updateContour();\n        this.#updateGeometryVariables();\n\n        this.#updateWaveGeometry(''',
    "TimeRange rendered timing sync",
)

path.write_text(text)


path = Path("ClockTimer.js")
text = path.read_text()

text = replace_once(
    text,
    '''                duration:\n                    rangeDuration,\n                originMilliseconds:\n                    origin\n            };''',
    '''                duration:\n                    rangeDuration,\n                renderStartTime:\n                    this.#formatTimelineTime(\n                        start\n                    ),\n                renderEndTime:\n                    this.#formatTimelineTime(\n                        end\n                    ),\n                originMilliseconds:\n                    origin\n            };''',
    "ClockTimer rendered timing layout payload",
)

release_helper = r'''        #releaseTimeRangeTimingAnimation(
            range
        ) {
            const state =
                this.#timeRangeTimingAnimations.get(
                    range
                );

            if (!state) {
                return false;
            }

            if (
                state.frame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    state.frame
                );
            }

            this.#timeRangeTimingAnimations.delete(
                range
            );

            const TimeRangeClass =
                customElements.get(
                    "time-range"
                );

            TimeRangeClass?.resumeLayout?.(
                range
            );

            return true;
        }

'''

text = replace_once(
    text,
    '''        #cancelTimeRangeTimingAnimations() {''',
    release_helper + '''        #cancelTimeRangeTimingAnimations() {''',
    "ClockTimer release timing animation helper",
)

pattern = re.compile(r'(?m)^(\s*)range\.removeAnimated\(\{')
matches = list(pattern.finditer(text))
if len(matches) != 5:
    raise SystemExit(
        f"ClockTimer removeAnimated calls: expected 5 matches, found {len(matches)}"
    )

text = pattern.sub(
    lambda match:
        f"{match.group(1)}this.#releaseTimeRangeTimingAnimation(\n"
        f"{match.group(1)}    range\n"
        f"{match.group(1)});\n\n"
        f"{match.group(1)}range.removeAnimated({{",
    text,
)

path.write_text(text)
