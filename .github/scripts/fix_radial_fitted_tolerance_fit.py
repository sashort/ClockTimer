from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

old = '''            if (\n                Number.isFinite(\n                    this.#calculatedEndTime\n                )\n            ) {\n                end =\n                    Number.isFinite(end)\n                        ? Math.max(\n                            end,\n                            this.#calculatedEndTime\n                        )\n                        : this.#calculatedEndTime;\n            }\n\n            const current =\n                Number.isFinite(now)\n                    ? now\n                    : (\n                        this.#started\n                            ? this.#getCurrentTimelineTime()\n                            : undefined\n                    );\n\n            const currentThreshold =\n                Number.isFinite(\n                    this.#calculatedEndTime\n                )\n                    ? this.#calculatedEndTime\n                    : end;\n'''

new = '''            const liveToleranceUsesVisibleEnd =\n                this.#percentGoal > 1 &&\n                this.#started &&\n                this.#json === undefined &&\n                !this.#loadingFromJSON;\n\n            if (\n                !liveToleranceUsesVisibleEnd &&\n                Number.isFinite(\n                    this.#calculatedEndTime\n                )\n            ) {\n                end =\n                    Number.isFinite(end)\n                        ? Math.max(\n                            end,\n                            this.#calculatedEndTime\n                        )\n                        : this.#calculatedEndTime;\n            }\n\n            const current =\n                Number.isFinite(now)\n                    ? now\n                    : (\n                        this.#started\n                            ? this.#getCurrentTimelineTime()\n                            : undefined\n                    );\n\n            const currentThreshold =\n                !liveToleranceUsesVisibleEnd &&\n                Number.isFinite(\n                    this.#calculatedEndTime\n                )\n                    ? this.#calculatedEndTime\n                    : end;\n'''

if old not in text:
    raise SystemExit("expected radial-fitted bounds block not found")

text = text.replace(old, new, 1)
path.write_text(text)
