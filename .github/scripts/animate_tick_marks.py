from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

host_marker = '''                    --clock-timer-tick-shadow:\n                        0 0 1px rgb(0 0 0 / 35%);\n'''
host_insert = '''                    --clock-timer-tick-shadow:\n                        0 0 1px rgb(0 0 0 / 35%);\n\n                    --clock-timer-ring-resize-duration:\n                        333ms;\n'''
if host_marker not in text:
    raise SystemExit("Could not find host tick-shadow marker")
text = text.replace(host_marker, host_insert, 1)

marks_marker = '''                #tick-marks {\n                    position: absolute;\n\n                    inset: 0;\n\n                    z-index: 10;\n\n                    pointer-events:\n                        none;\n                }\n'''
marks_insert = '''                #tick-marks {\n                    position: absolute;\n\n                    inset: 0;\n\n                    z-index: 10;\n\n                    pointer-events:\n                        none;\n\n                    transition-property:\n                        inset;\n\n                    transition-duration:\n                        var(\n                            --clock-timer-ring-resize-duration\n                        );\n\n                    transition-timing-function:\n                        linear;\n                }\n'''
if marks_marker not in text:
    raise SystemExit("Could not find #tick-marks style block")
text = text.replace(marks_marker, marks_insert, 1)

path.write_text(text)
