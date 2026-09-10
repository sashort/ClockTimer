from pathlib import Path
import re

path = Path("RingContainer.js")
text = path.read_text()

mapping = {
    "filter": "instanceFilter",
    "filterRamp": "instanceFilterRamp",
    "filterRampDuration": "instanceFilterRampDuration",
    "filterRampConnect": "instanceFilterRampConnect",
    "filterRampDisconnect": "instanceFilterRampDisconnect",
    "resizeFilter": "instanceResizeFilter",
    "reorderFilter": "instanceReorderFilter",
    "connectFilter": "instanceConnectFilter",
    "disconnectFilter": "instanceDisconnectFilter",
}

for old, new in mapping.items():
    declaration = f"    #{old};"
    replacement = f"    #{new};"
    count = text.count(declaration)
    if count != 1:
        raise SystemExit(
            f"Expected one instance declaration {declaration!r}, found {count}"
        )
    text = text.replace(declaration, replacement, 1)

for old, new in mapping.items():
    text, count = re.subn(
        rf"this\.#{re.escape(old)}\b",
        f"this.#{new}",
        text,
    )
    if count == 0:
        raise SystemExit(
            f"Expected at least one instance reference to this.#{old}"
        )

# The repair must not reintroduce the resize-target experiment.
if "#resizeTarget" in text:
    raise SystemExit("Unexpected #resizeTarget found")

path.write_text(text)
