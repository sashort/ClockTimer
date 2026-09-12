from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()

elapsed_old = '''                ring.appendChild(\n                    this.#elapsedRange\n                );\n\n                return;'''
elapsed_new = '''                ring.appendChild(\n                    this.#elapsedRange\n                );\n\n                this.#prepareTimerTypeTransitionVisualRange(\n                    this.#elapsedRange\n                );\n\n                return;'''

remaining_old = '''                    ring.appendChild(\n                        range\n                    );\n\n                    this.#remainingRanges.set(\n                        ringIndex,\n                        range\n                    );'''
remaining_new = '''                    ring.appendChild(\n                        range\n                    );\n\n                    this.#prepareTimerTypeTransitionVisualRange(\n                        range\n                    );\n\n                    this.#remainingRanges.set(\n                        ringIndex,\n                        range\n                    );'''

if text.count(elapsed_old) != 1:
    raise SystemExit(f"expected exactly one elapsed insertion site, found {text.count(elapsed_old)}")

if text.count(remaining_old) != 1:
    raise SystemExit(f"expected exactly one remaining insertion site, found {text.count(remaining_old)}")

text = text.replace(elapsed_old, elapsed_new, 1)
text = text.replace(remaining_old, remaining_new, 1)
path.write_text(text)
