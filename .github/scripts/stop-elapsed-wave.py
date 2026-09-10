from pathlib import Path

tr = Path('TimeRange.js')
text = tr.read_text()
anchor = '''    transitionTo({\n        startTime,\n        endTime\n    } = {}) {\n'''
if anchor not in text:
    raise SystemExit('TimeRange transitionTo anchor not found')
method = '''    stopElapsedAnimation() {\n        if (\n            this.getAttribute(\n                "type"\n            ) !== "elapsed"\n        ) {\n            return this;\n        }\n\n        this.#elapsedWaveLayer.style.animationPlayState =\n            "paused";\n\n        return this;\n    }\n\n'''
text = text.replace(anchor, method + anchor, 1)
tr.write_text(text)

ct = Path('ClockTimer.js')
text = ct.read_text()
anchor = '''            if (\n                this.#elapsedRange &&\n                this.#elapsedRange.isConnected\n            ) {\n                this.#elapsedRange.setAttribute(\n                    "end-time",\n                    this.#formatTimelineTime(\n                        stopTime\n                    )\n                );\n\n                this.#elapsedRange.clockTimerEnd =\n                    String(stopTime);\n            }\n'''
if anchor not in text:
    raise SystemExit('ClockTimer elapsed stop anchor not found')
replacement = '''            if (\n                this.#elapsedRange &&\n                this.#elapsedRange.isConnected\n            ) {\n                this.#elapsedRange.setAttribute(\n                    "end-time",\n                    this.#formatTimelineTime(\n                        stopTime\n                    )\n                );\n\n                this.#elapsedRange.clockTimerEnd =\n                    String(stopTime);\n\n                this.#elapsedRange.stopElapsedAnimation\n                    ?.();\n            }\n'''
text = text.replace(anchor, replacement, 1)
ct.write_text(text)
