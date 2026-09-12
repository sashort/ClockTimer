from pathlib import Path

path = Path("ClockTimer.js")
text = path.read_text()

old = '''        clear() {\n            if (!this.#hasStartProperties()) {\n                return false;\n            }\n\n            if (\n                this.#updatesSuspended &&\n                !this.#processingAsyncBatch\n            ) {'''

new = '''        clear() {\n            if (!this.#hasStartProperties()) {\n                return false;\n            }\n\n            if (this.#started) {\n                return false;\n            }\n\n            if (\n                this.#updatesSuspended &&\n                !this.#processingAsyncBatch\n            ) {'''

count = text.count(old)
if count != 1:
    raise SystemExit(f"clear guard: expected 1 match, found {count}")

path.write_text(text.replace(old, new, 1))
