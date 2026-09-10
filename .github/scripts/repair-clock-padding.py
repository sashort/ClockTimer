from pathlib import Path
import subprocess

baseline = "5b1c619c7143f73b2336d5dc0c8d0ca3ddbaefaf"
text = subprocess.check_output(["git", "show", f"{baseline}:ClockTimer.js"], text=True)
old = "                    padding:\n                        1px;"
new = "                    padding:\n                        2px;"
if old not in text:
    raise SystemExit("Expected 1px padding not found in baseline")
text = text.replace(old, new, 1)
Path("ClockTimer.js").write_text(text)
