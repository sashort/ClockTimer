from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    text = text.replace(old, new, 1)


replace_once(
    '''        #percentGoal =\n            1;\n\n        #startedAtEpoch;''',
    '''        #percentGoal =\n            1;\n\n        #showTolerance =\n            true;\n\n        #loadingFromJSON =\n            false;\n\n        #startedAtEpoch;''',
    "private state"
)

replace_once(
    '''        get status() {\n''',
    '''        get showTolerance() {\n            return this.#showTolerance;\n        }\n\n        set showTolerance(value) {\n            let normalized;\n\n            if (typeof value === "boolean") {\n                normalized = value;\n            }\n            else if (typeof value === "string") {\n                const text =\n                    value.trim().toLowerCase();\n\n                if (text === "true") {\n                    normalized = true;\n                }\n                else if (text === "false") {\n                    normalized = false;\n                }\n                else {\n                    return;\n                }\n            }\n            else {\n                return;\n            }\n\n            if (normalized === this.#showTolerance) {\n                return;\n            }\n\n            this.#showTolerance =\n                normalized;\n\n            if (\n                !this.#started ||\n                this.#percentGoal <= 1 ||\n                this.#json !== undefined ||\n                this.#loadingFromJSON\n            ) {\n                return;\n            }\n\n            const now =\n                this.#getCurrentTimelineTime();\n\n            this.#reconcilePlannedRanges();\n\n            this.#refreshRingLayout(\n                now,\n                { refreshTickMarks: true }\n            );\n        }\n\n        get status() {\n''',
    "public showTolerance property"
)

replace_once(
    '''        #getPlannedSegments(\n            startTimeMilliseconds =\n                this.#getStartTimeMilliseconds()\n        ) {\n''',
    '''        #getToleranceRenderEnd(\n            now = undefined\n        ) {\n            if (\n                this.#percentGoal <= 1 ||\n                this.#loadingFromJSON ||\n                this.#json !== undefined\n            ) {\n                return undefined;\n            }\n\n            if (\n                !this.#started ||\n                this.#showTolerance\n            ) {\n                return this.#standardEnd;\n            }\n\n            const current =\n                Number.isFinite(now)\n                    ? now\n                    : this.#getCurrentTimelineTime();\n\n            if (\n                !Number.isFinite(current) ||\n                current <= this.#calculatedEnd\n            ) {\n                return undefined;\n            }\n\n            return Math.min(\n                current,\n                this.#standardEnd\n            );\n        }\n\n        #getPlannedSegments(\n            startTimeMilliseconds =\n                this.#getStartTimeMilliseconds()\n        ) {\n''',
    "tolerance helper"
)

replace_once(
    '''                spans.push({\n                    type: "tolerance",\n                    start: this.#calculatedEnd,\n                    end: this.#standardEnd\n                });''',
    '''                const toleranceRenderEnd =\n                    this.#getToleranceRenderEnd();\n\n                if (\n                    Number.isFinite(\n                        toleranceRenderEnd\n                    ) &&\n                    toleranceRenderEnd >\n                        this.#calculatedEnd\n                ) {\n                    spans.push({\n                        type: "tolerance",\n                        start: this.#calculatedEnd,\n                        end: toleranceRenderEnd\n                    });\n                }''',
    "planned tolerance span"
)

replace_once(
    '''                this.#createSpan(\n                    "tolerance",\n                    this.#calculatedEnd,\n                    this.#standardEnd\n                );\n\n                return;''',
    '''                const toleranceRenderEnd =\n                    this.#getToleranceRenderEnd();\n\n                if (\n                    Number.isFinite(\n                        toleranceRenderEnd\n                    ) &&\n                    toleranceRenderEnd >\n                        this.#calculatedEnd\n                ) {\n                    this.#createSpan(\n                        "tolerance",\n                        this.#calculatedEnd,\n                        toleranceRenderEnd\n                    );\n                }\n\n                return;''',
    "built tolerance span"
)

replace_once(
    '''                this.#setIndicatorSymbolVisible(false);\n\n                this.#started =\n                    true;\n\n                this.#starting =\n                    true;''',
    '''                this.#setIndicatorSymbolVisible(false);\n\n                this.#loadingFromJSON =\n                    true;\n\n                this.#started =\n                    true;\n\n                this.#starting =\n                    true;''',
    "fromJSON loading marker start"
)

replace_once(
    '''                finally {\n                    this.#starting =\n                        false;\n\n                    this.#started =\n                        false;\n                }''',
    '''                finally {\n                    this.#starting =\n                        false;\n\n                    this.#started =\n                        false;\n\n                    this.#loadingFromJSON =\n                        false;\n                }''',
    "fromJSON loading marker end"
)

replace_once(
    '''            const now =\n                this.#getCurrentTimelineTime(\n                    nowDate\n                );\n\n            this.#processElapsedOverwriteRanges(\n                now\n            );''',
    '''            const now =\n                this.#getCurrentTimelineTime(\n                    nowDate\n                );\n\n            if (\n                !this.#showTolerance &&\n                this.#percentGoal > 1 &&\n                this.#json === undefined &&\n                !this.#loadingFromJSON\n            ) {\n                this.#reconcilePlannedRanges();\n            }\n\n            this.#processElapsedOverwriteRanges(\n                now\n            );''',
    "tick tolerance growth"
)

path.write_text(text)
