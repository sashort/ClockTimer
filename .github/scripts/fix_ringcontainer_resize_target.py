from pathlib import Path

path = Path("RingContainer.js")
text = path.read_text(encoding="utf-8")

# Existing syntax issue: static and instance private fields currently reuse the
# same private names. Keep the public API unchanged while giving instance state
# distinct private identifiers.
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
    text = text.replace(f"this.#{old_name}", f"this.#{new_name}")

old = """    #pendingResize;\n    #pendingReorder;\n"""
new = """    #pendingResize;\n    #resizeTarget;\n    #pendingReorder;\n"""
if old not in text:
    raise RuntimeError("Could not find pending resize field block")
text = text.replace(old, new, 1)

old = """            if (\n                ring.getAttribute(\n                    \"inset\"\n                ) !==\n                    targetInset\n            ) {\n                const current =\n                    ring.#getGeometry();\n\n                const target = {\n                    ...current,\n                    inset:\n                        targetInset\n                };\n\n                ring.#animateResize(\n                    current,\n                    target,\n                    {\n                        commitAttributes: true\n                    }\n                );\n            }\n"""
new = """            const pendingInset =\n                ring.#resizeTarget\n                    ?.inset;\n\n            const currentInset =\n                pendingInset ??\n                ring.getAttribute(\n                    \"inset\"\n                );\n\n            if (\n                currentInset !==\n                    targetInset\n            ) {\n                const current =\n                    ring.#getGeometry();\n\n                const target = {\n                    ...current,\n                    inset:\n                        targetInset\n                };\n\n                ring.#animateResize(\n                    current,\n                    target,\n                    {\n                        commitAttributes: true\n                    }\n                );\n            }\n"""
if old not in text:
    raise RuntimeError("Could not find recalculateParent inset comparison")
text = text.replace(old, new, 1)

old = """        const oldGeometry = {\n            ...from\n        };\n\n        const targetGeometry = {\n            ...to\n        };\n\n        const animationStyle =\n"""
new = """        const oldGeometry = {\n            ...from\n        };\n\n        const targetGeometry = {\n            ...to\n        };\n\n        this.#resizeTarget =\n            targetGeometry;\n\n        const animationStyle =\n"""
if old not in text:
    raise RuntimeError("Could not find resize target geometry block")
text = text.replace(old, new, 1)

old = """        this.#resizeAnimation =\n            this.animate(\n                [\n                    {\n                        opacity: 1\n                    },\n                    {\n                        opacity: 1\n                    }\n                ],\n                {\n                    duration,\n                    easing,\n                    fill: \"both\"\n                }\n            );\n\n        if (\n            this.filterRamp\n        ) {\n            this.#instanceResizeFilterAnimation =\n                this.#animateFilterRamp(\n                    this.resizeFilter,\n                    this.#resizeAnimation\n                );\n        }\n\n        this.#pendingResize =\n            this.#resizeAnimation.finished\n                .catch(() => {})\n                .finally(\n                    () => {\n                        animationStyle.remove();\n\n                        if (\n                            commitAttributes\n                        ) {\n                            this.#commitGeometryAttributes(\n                                targetGeometry\n                            );\n                        }\n                        else {\n                            this.#width =\n                                targetGeometry.width;\n\n                            this.#inset =\n                                targetGeometry.inset;\n\n                            this.#outerMargin =\n                                targetGeometry.outerMargin;\n\n                            this.#innerMargin =\n                                targetGeometry.innerMargin;\n                        }\n\n                        this.#updateStyle(\n                            targetGeometry\n                        );\n\n                        this.#resizeAnimation =\n                            undefined;\n\n                        this.#instanceResizeFilterAnimation =\n                            undefined;\n\n                        this.#pendingResize =\n                            undefined;\n                    }\n                );\n"""
# The field-renaming pass above intentionally does not rename animation fields.
# Restore the exact current names for this replacement pattern.
old = old.replace("#instanceResizeFilterAnimation", "#resizeFilterAnimation")
new = """        const resizeAnimation =\n            this.animate(\n                [\n                    {\n                        opacity: 1\n                    },\n                    {\n                        opacity: 1\n                    }\n                ],\n                {\n                    duration,\n                    easing,\n                    fill: \"both\"\n                }\n            );\n\n        this.#resizeAnimation =\n            resizeAnimation;\n\n        if (\n            this.filterRamp\n        ) {\n            this.#resizeFilterAnimation =\n                this.#animateFilterRamp(\n                    this.resizeFilter,\n                    resizeAnimation\n                );\n        }\n\n        this.#pendingResize =\n            resizeAnimation.finished\n                .catch(() => {})\n                .finally(\n                    () => {\n                        animationStyle.remove();\n\n                        if (\n                            this.#resizeAnimation !==\n                                resizeAnimation\n                        ) {\n                            return;\n                        }\n\n                        if (\n                            commitAttributes\n                        ) {\n                            this.#commitGeometryAttributes(\n                                targetGeometry\n                            );\n                        }\n                        else {\n                            this.#width =\n                                targetGeometry.width;\n\n                            this.#inset =\n                                targetGeometry.inset;\n\n                            this.#outerMargin =\n                                targetGeometry.outerMargin;\n\n                            this.#innerMargin =\n                                targetGeometry.innerMargin;\n                        }\n\n                        this.#updateStyle(\n                            targetGeometry\n                        );\n\n                        this.#resizeTarget =\n                            undefined;\n\n                        this.#resizeAnimation =\n                            undefined;\n\n                        this.#resizeFilterAnimation =\n                            undefined;\n\n                        this.#pendingResize =\n                            undefined;\n                    }\n                );\n"""
if old not in text:
    raise RuntimeError("Could not find resize animation/finalizer block")
text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
