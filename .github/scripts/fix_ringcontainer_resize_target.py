from pathlib import Path

path = Path("RingContainer.js")
text = path.read_text(encoding="utf-8")

# Existing syntax issue: static and instance private fields reuse the same
# private names. Keep the public API unchanged while separating instance state.
instance_private_names = {
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

for old_name, new_name in instance_private_names.items():
    field = f"    #{old_name};"
    replacement = f"    #{new_name};"
    if field not in text:
        raise RuntimeError(f"Could not find instance private field {field}")
    text = text.replace(field, replacement, 1)

# Replace instance references only; static RingContainer.#... references remain.
text = text.replace("this.#filterRampDisconnect", "this.#instanceFilterRampDisconnect")
text = text.replace("this.#filterRampConnect", "this.#instanceFilterRampConnect")
text = text.replace("this.#filterRampDuration", "this.#instanceFilterRampDuration")
text = text.replace("this.#filterRamp", "this.#instanceFilterRamp")
text = text.replace("this.#resizeFilter", "this.#instanceResizeFilter")
text = text.replace("this.#reorderFilter", "this.#instanceReorderFilter")
text = text.replace("this.#connectFilter", "this.#instanceConnectFilter")
text = text.replace("this.#disconnectFilter", "this.#instanceDisconnectFilter")
text = text.replace("this.#filter", "this.#instanceFilter")

old = """    #pendingResize;\n    #pendingReorder;\n"""
new = """    #pendingResize;\n    #resizeTarget;\n    #pendingReorder;\n"""
if old not in text:
    raise RuntimeError("Could not find pending resize field block")
text = text.replace(old, new, 1)

old = """            if (\n                ring.getAttribute(\n                    \"inset\"\n                ) !==\n                    targetInset\n            ) {\n"""
new = """            const pendingInset =\n                ring.#resizeTarget\n                    ?.inset;\n\n            const currentInset =\n                pendingInset ??\n                ring.getAttribute(\n                    \"inset\"\n                );\n\n            if (\n                currentInset !==\n                    targetInset\n            ) {\n"""
if old not in text:
    raise RuntimeError("Could not find recalculateParent inset comparison")
text = text.replace(old, new, 1)

old = """        const targetGeometry = {\n            ...to\n        };\n\n        const animationStyle =\n"""
new = """        const targetGeometry = {\n            ...to\n        };\n\n        this.#resizeTarget =\n            targetGeometry;\n\n        const animationStyle =\n"""
if old not in text:
    raise RuntimeError("Could not find targetGeometry block")
text = text.replace(old, new, 1)

# Capture the specific animation object so cancelled/stale finalizers can be ignored.
old = """        if (\n            this.filterRamp\n        ) {\n"""
new = """        const resizeAnimation =\n            this.#resizeAnimation;\n\n        if (\n            this.filterRamp\n        ) {\n"""
start = text.find("    #animateResize(")
if start == -1:
    raise RuntimeError("Could not find #animateResize")
index = text.find(old, start)
if index == -1:
    raise RuntimeError("Could not find resize filter-ramp block")
text = text[:index] + text[index:].replace(old, new, 1)

old = """        this.#pendingResize =\n            this.#resizeAnimation.finished\n"""
new = """        this.#pendingResize =\n            resizeAnimation.finished\n"""
if old not in text:
    raise RuntimeError("Could not find pending resize animation reference")
text = text.replace(old, new, 1)

old = """                    () => {\n                        animationStyle.remove();\n\n                        if (\n                            commitAttributes\n"""
new = """                    () => {\n                        animationStyle.remove();\n\n                        if (\n                            this.#resizeAnimation !==\n                                resizeAnimation\n                        ) {\n                            return;\n                        }\n\n                        if (\n                            commitAttributes\n"""
if old not in text:
    raise RuntimeError("Could not find resize finalizer entry")
text = text.replace(old, new, 1)

old = """                        this.#resizeAnimation =\n                            undefined;\n"""
new = """                        this.#resizeTarget =\n                            undefined;\n\n                        this.#resizeAnimation =\n                            undefined;\n"""
# Limit to the occurrence inside #animateResize, not other animation cleanup.
start = text.find("    #animateResize(")
index = text.find(old, start)
if index == -1:
    raise RuntimeError("Could not find resize animation cleanup")
text = text[:index] + text[index:].replace(old, new, 1)

path.write_text(text, encoding="utf-8")
