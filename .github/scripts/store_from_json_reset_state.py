from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()

private_old = '''        #startResetState;\n\n        #restoringStartState =\n'''
private_new = '''        #startResetState;\n\n        #json;\n\n        #restoringStartState =\n'''

if "        #json;\n" not in text:
    if private_old not in text:
        raise SystemExit("private field insertion point not found")
    text = text.replace(private_old, private_new, 1)

from_start = text.index("        fromJSON(json) {")
from_end = text.index("        get status() {", from_start)
from_section = text[from_start:from_end]

parse_old = '''            try {\n                const data =\n'''
parse_new = '''            try {\n                const jsonString =\n                    typeof json === "string"\n                        ? json\n                        : JSON.stringify(\n                            json\n                        );\n\n                const data =\n'''

if "                const jsonString =\n" not in from_section:
    if parse_old not in from_section:
        raise SystemExit("fromJSON parse insertion point not found")
    from_section = from_section.replace(parse_old, parse_new, 1)

if "                this.#json =\n                    jsonString;\n" not in from_section:
    success_return = "                return new Date();\n"
    return_index = from_section.rfind(success_return)
    if return_index == -1:
        raise SystemExit("fromJSON success return not found")
    assignment = '''                this.#json =\n                    jsonString;\n\n'''
    from_section = (
        from_section[:return_index]
        + assignment
        + from_section[return_index:]
    )

text = text[:from_start] + from_section + text[from_end:]

reset_old = '''        reset() {\n            if (!this.#startResetState) {\n                return false;\n            }\n\n            if (\n                this.#updatesSuspended &&\n                !this.#processingAsyncBatch\n            ) {\n                this.#queueAsyncOperation({\n                    type: "reset"\n                });\n\n                return new Date();\n            }\n\n            const baseline =\n'''
reset_new = '''        reset() {\n            if (\n                this.#json === undefined &&\n                !this.#startResetState\n            ) {\n                return false;\n            }\n\n            if (\n                this.#updatesSuspended &&\n                !this.#processingAsyncBatch\n            ) {\n                this.#queueAsyncOperation({\n                    type: "reset"\n                });\n\n                return new Date();\n            }\n\n            if (this.#json !== undefined) {\n                const json =\n                    this.#json;\n\n                const result =\n                    this.clear();\n\n                if (result === false) {\n                    return false;\n                }\n\n                return this.fromJSON(\n                    json\n                );\n            }\n\n            const baseline =\n'''

if reset_new not in text:
    if reset_old not in text:
        raise SystemExit("reset insertion point not found")
    text = text.replace(reset_old, reset_new, 1)

clear_start = text.index("        clear() {")
clear_end = text.index("\n        ", clear_start + len("        clear() {"))
# Use the reset method as a stable boundary after clear when available.
next_reset = text.find("        reset() {", clear_start)
if next_reset != -1:
    clear_end = next_reset
else:
    clear_end = len(text)
clear_section = text[clear_start:clear_end]

clear_queue = '''            if (\n                this.#updatesSuspended &&\n                !this.#processingAsyncBatch\n            ) {\n                this.#queueAsyncOperation({\n                    type: "clear"\n                });\n\n                return new Date();\n            }\n'''
clear_assignment = '''\n            this.#json =\n                undefined;\n'''

if "            this.#json =\n                undefined;\n" not in clear_section:
    if clear_queue not in clear_section:
        raise SystemExit("clear queue block not found")
    clear_section = clear_section.replace(
        clear_queue,
        clear_queue + clear_assignment,
        1,
    )
    text = text[:clear_start] + clear_section + text[clear_end:]

path.write_text(text)
