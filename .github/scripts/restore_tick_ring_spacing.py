from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

host_marker = '''                :host {\n\n                    --clock-timer-tick-width:'''
host_replacement = '''                :host {\n                    --clock-timer-tick-inset:\n                        clamp(5px, 2cqi, 10px);\n\n                    --clock-timer-tick-width:'''
if host_marker not in text:
    raise SystemExit("Could not find :host tick width marker")
text = text.replace(host_marker, host_replacement, 1)

ensure_marker = '''            ring.setAttribute(\n                "width",\n                "0px"\n            );\n\n            ring.resizeFilter = "none";'''
ensure_replacement = '''            ring.setAttribute(\n                "width",\n                "0px"\n            );\n\n            ring.setAttribute(\n                "outer-margin",\n                "var(--clock-timer-tick-inset, clamp(5px, 2cqi, 10px))"\n            );\n\n            ring.resizeFilter = "none";'''
if ensure_marker not in text:
    raise SystemExit("Could not find tick ring width marker")
text = text.replace(ensure_marker, ensure_replacement, 1)

if '''if (\n                    ring ===\n                        this.#tickRing\n                ) {\n                    return outerInset;\n                }''' not in text:
    raise SystemExit("#getTickInset is not using flush visible-tick behavior")

path.write_text(text)
