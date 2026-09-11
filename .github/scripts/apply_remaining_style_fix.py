from pathlib import Path
import subprocess


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"{label} not found")
    return text.replace(old, new, 1)

clock_path = Path("ClockTimer.js")
clock = clock_path.read_text()
clock = replace_once(
    clock,
    '''            if (\n                type === "elapsed" ||\n                type === "remaining"\n            ) {\n                range.setAttribute(\n                    "overlapping",\n                    ""\n                );\n            }\n\n            if (type === "elapsed") {\n                range.setAttribute(\n                    "timer-mode",\n                    this.#getTimerMode()\n                );\n            }''',
    '''            if (\n                type === "elapsed" ||\n                type === "remaining"\n            ) {\n                range.setAttribute(\n                    "overlapping",\n                    ""\n                );\n\n                range.setAttribute(\n                    "timer-mode",\n                    this.#getTimerMode()\n                );\n            }''',
    "ClockTimer progress range timer-mode"
)
clock_path.write_text(clock)

range_path = Path("TimeRange.js")
tr = range_path.read_text()
tr = replace_once(
    tr,
    '''            :host([type="elapsed"]) {\n                animation: none !important;\n                background: transparent !important;\n                background-color: transparent !important;\n                background-image: none !important;\n            }\n\n            :host([type="elapsed"]) #elapsed-base,\n            :host([type="elapsed"]) #elapsed-edge,\n            :host([type="elapsed"]) #elapsed-wave {\n                display: block;\n            }\n\n            :host([type="elapsed"][timer-mode="remaining"]) #elapsed-base,\n            :host([type="elapsed"][timer-mode="remaining"]) #elapsed-edge {\n                display: none;\n            }\n\n            :host([type="remaining"]) {\n                animation: none !important;\n                transition: none !important;\n            }''',
    '''            :host([type="elapsed"]),\n            :host([type="remaining"][timer-mode="remaining"]) {\n                animation: none !important;\n                background: transparent !important;\n                background-color: transparent !important;\n                background-image: none !important;\n            }\n\n            :host([type="remaining"][timer-mode="elapsed"]) {\n                display: none !important;\n            }\n\n            :host([type="elapsed"]) #elapsed-base,\n            :host([type="elapsed"]) #elapsed-edge,\n            :host([type="elapsed"]) #elapsed-wave {\n                display: block;\n            }\n\n            :host([type="remaining"][timer-mode="remaining"]) #elapsed-base,\n            :host([type="remaining"][timer-mode="remaining"]) #elapsed-edge {\n                display: block;\n            }\n\n            :host([type="elapsed"][timer-mode="remaining"]) #elapsed-base,\n            :host([type="elapsed"][timer-mode="remaining"]) #elapsed-edge {\n                display: none;\n            }\n\n            :host([type="remaining"]) {\n                animation: none !important;\n                transition: none !important;\n            }''',
    "TimeRange progress CSS"
)

old = '''        if (\n            this.getAttribute("type") !==\n                "elapsed"\n        ) {\n            this.#elapsedBaseLayer.style.background =\n                "transparent";\n\n            this.#elapsedEdgeLayer.style.backgroundImage =\n                "none";\n\n            this.#elapsedWaveLayer.style.backgroundImage =\n                "none";\n\n            return;\n        }'''
new = '''        const type =\n            this.getAttribute(\n                "type"\n            );\n\n        const timerMode =\n            this.getAttribute(\n                "timer-mode"\n            );\n\n        const elapsedAppearance =\n            type === "elapsed";\n\n        const remainingAppearance =\n            type === "remaining" &&\n            timerMode === "remaining";\n\n        if (\n            !elapsedAppearance &&\n            !remainingAppearance\n        ) {\n            this.#elapsedBaseLayer.style.background =\n                "transparent";\n\n            this.#elapsedEdgeLayer.style.backgroundImage =\n                "none";\n\n            this.#elapsedWaveLayer.style.backgroundImage =\n                "none";\n\n            return;\n        }'''
tr = replace_once(tr, old, new, "progress appearance gate")

tr = replace_once(
    tr,
    '''                    range.getAttribute("type") ===\n                        "elapsed"\n                ) {''',
    '''                    [\n                        "elapsed",\n                        "remaining"\n                    ].includes(\n                        range.getAttribute(\n                            "type"\n                        )\n                    )\n                ) {''',
    "progress underlay exclusion"
)

tr = replace_once(
    tr,
    '''        if (\n            this.hasAttribute(\n                "static-elapsed"\n            ) ||\n            !activeRing\n        ) {''',
    '''        if (\n            remainingAppearance ||\n            this.hasAttribute(\n                "static-elapsed"\n            ) ||\n            !activeRing\n        ) {''',
    "remaining wave suppression"
)
range_path.write_text(tr)

subprocess.run(["node", "--check", "ClockTimer.js"], check=True)
subprocess.run(["node", "--check", "TimeRange.js"], check=True)
subprocess.run(["git", "add", "ClockTimer.js", "TimeRange.js"], check=True)
subprocess.run(["git", "commit", "-m", "Match remaining progress default styling"], check=True)
subprocess.run(["git", "push", "origin", "main"], check=True)
