from pathlib import Path
import sys

script_path = Path(__file__).with_name("add_timer_type_transition.py")
source = script_path.read_text()

needle = '''# During a timer-type transition, fitted layout is applied without suspendLayout.\nclock = replace_once(\n'''
replacement = '''# During a timer-type transition, fitted layout is applied without suspendLayout.\ndef replace_first(text, old, new, label):\n    count = text.count(old)\n    if count < 1:\n        raise RuntimeError(f"{label}: expected at least one match, found {count}")\n    return text.replace(old, new, 1)\n\ndef replace_optional(text, old, new, label):\n    count = text.count(old)\n    if count == 0:\n        return text\n    if count != 1:\n        raise RuntimeError(f"{label}: expected at most one match, found {count}")\n    return text.replace(old, new, 1)\n\nclock = replace_first(\n'''
if source.count(needle) != 1:
    raise RuntimeError("Could not locate fitted refresh patch driver hook")
source = source.replace(needle, replacement, 1)

optional_label = '"RingContainer mark pending excludes detached"'
label_index = source.find(optional_label)
if label_index == -1:
    raise RuntimeError("Could not locate optional RingContainer patch")
call_index = source.rfind("ring = replace_once(", 0, label_index)
if call_index == -1:
    raise RuntimeError("Could not locate optional RingContainer patch call")
source = (
    source[:call_index]
    + source[call_index:].replace(
        "ring = replace_once(",
        "ring = replace_optional(",
        1
    )
)

sys.argv = [str(script_path), *(sys.argv[1:] or ["."])]
exec(compile(source, str(script_path), "exec"), {"__name__": "__main__", "__file__": str(script_path)})
