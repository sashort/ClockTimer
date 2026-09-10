from pathlib import Path

p = Path('ClockTimer.js')
s = p.read_text()

# Add ring/tracking fields.
old = '''        #numberRing;\n\n        #tickMarkLayer;\n\n        #tickMarkTimeout;'''
new = '''        #numberRing;\n\n        #tickRing;\n\n        #tickGeometryFrame;\n\n        #tickMarkLayer;\n\n        #tickMarkTimeout;'''
assert s.count(old) == 1, f'field anchor count={s.count(old)}'
s = s.replace(old, new, 1)

# The tick layer is now positioned from the geometry-only RingContainer.
old = '''                #tick-marks {\n                    position: absolute;\n\n                    inset:\n                        var(\n                            --clock-timer-tick-inset\n                        );\n\n                    z-index: 10;'''
new = '''                #tick-marks {\n                    position: absolute;\n\n                    inset: 0;\n\n                    z-index: 10;'''
assert s.count(old) == 1, f'tick css anchor count={s.count(old)}'
s = s.replace(old, new, 1)

# Ensure the tick geometry ring everywhere permanent rings are established.
s = s.replace(
'''                this.#ensureHandRing();\n\n                this.#ensureNumberRing();\n\n                this.#ensurePermanentRingOrder();''',
'''                this.#ensureTickRing();\n\n                this.#ensureHandRing();\n\n                this.#ensureNumberRing();\n\n                this.#ensurePermanentRingOrder();'''
)

# Stop geometry tracking on disconnect.
old = '''            this.#stopTickMarkTimer();\n\n            this.#stopHandAnimations();'''
new = '''            this.#stopTickMarkTimer();\n\n            this.#stopTickGeometryTracking();\n\n            this.#stopHandAnimations();'''
assert s.count(old) == 1, f'disconnect anchor count={s.count(old)}'
s = s.replace(old, new, 1)

# Add tick ring method before number ring method.
anchor = '''        #ensureNumberRing() {'''
assert s.count(anchor) == 1, f'number method anchor count={s.count(anchor)}'
method = '''        #ensureTickRing() {\n            if (\n                this.#tickRing &&\n                this.#tickRing.parentElement ===\n                    this\n            ) {\n                return this.#tickRing;\n            }\n\n            const ring =\n                document.createElement(\n                    "ring-container"\n                );\n\n            ring.dataset.clockTimerTicks =\n                "";\n\n            ring.setAttribute(\n                "geometry-only",\n                ""\n            );\n\n            ring.setAttribute(\n                "width",\n                "0px"\n            );\n\n            ring.setAttribute(\n                "outer-margin",\n                "var(--clock-timer-tick-inset, clamp(5px, 2cqi, 10px))"\n            );\n\n            ring.resizeFilter =\n                "none";\n\n            ring.reorderFilter =\n                "none";\n\n            ring.connectFilter =\n                "none";\n\n            ring.disconnectFilter =\n                "none";\n\n            ring.filterRamp =\n                false;\n\n            this.#tickRing =\n                ring;\n\n            this.appendChild(\n                ring\n            );\n\n            return ring;\n        }\n\n        #syncTickMarkGeometry() {\n            const ring =\n                this.#ensureTickRing();\n\n            const hostRect =\n                this.getBoundingClientRect();\n\n            const ringRect =\n                ring.getBoundingClientRect();\n\n            const left =\n                ringRect.left -\n                hostRect.left;\n\n            const top =\n                ringRect.top -\n                hostRect.top;\n\n            this.#tickMarkLayer.style.inset =\n                "auto";\n\n            this.#tickMarkLayer.style.left =\n                `${left}px`;\n\n            this.#tickMarkLayer.style.top =\n                `${top}px`;\n\n            this.#tickMarkLayer.style.width =\n                `${ringRect.width}px`;\n\n            this.#tickMarkLayer.style.height =\n                `${ringRect.height}px`;\n        }\n\n        #startTickGeometryTracking() {\n            if (\n                this.#tickGeometryFrame !==\n                    undefined\n            ) {\n                return;\n            }\n\n            const update =\n                () => {\n                    this.#tickGeometryFrame =\n                        undefined;\n\n                    if (\n                        !this.isConnected ||\n                        !this.hasAttribute(\n                            "tick-marks"\n                        )\n                    ) {\n                        return;\n                    }\n\n                    this.#syncTickMarkGeometry();\n\n                    this.#tickGeometryFrame =\n                        requestAnimationFrame(\n                            update\n                        );\n                };\n\n            this.#syncTickMarkGeometry();\n\n            this.#tickGeometryFrame =\n                requestAnimationFrame(\n                    update\n                );\n        }\n\n        #stopTickGeometryTracking() {\n            if (\n                this.#tickGeometryFrame !==\n                    undefined\n            ) {\n                cancelAnimationFrame(\n                    this.#tickGeometryFrame\n                );\n\n                this.#tickGeometryFrame =\n                    undefined;\n            }\n\n            this.#tickMarkLayer.style.removeProperty(\n                "left"\n            );\n\n            this.#tickMarkLayer.style.removeProperty(\n                "top"\n            );\n\n            this.#tickMarkLayer.style.removeProperty(\n                "width"\n            );\n\n            this.#tickMarkLayer.style.removeProperty(\n                "height"\n            );\n\n            this.#tickMarkLayer.style.removeProperty(\n                "inset"\n            );\n        }\n\n'''
s = s.replace(anchor, method + anchor, 1)

# Permanent ring order: tick ring immediately outside hands/numbers.
old = '''            const handRing =\n                this.#ensureHandRing();\n\n            const numberRing =\n                this.#ensureNumberRing();'''
new = '''            const tickRing =\n                this.#ensureTickRing();\n\n            const handRing =\n                this.#ensureHandRing();\n\n            const numberRing =\n                this.#ensureNumberRing();'''
# This occurs in permanent order and reorderRings; replace both.
count = s.count(old)
assert count >= 2, f'order local anchor count={count}'
s = s.replace(old, new)

old = '''            const order = [\n                borderRing,\n                handRing,\n                numberRing\n            ];'''
new = '''            const order = [\n                borderRing,\n                tickRing,\n                handRing,\n                numberRing\n            ];'''
assert s.count(old) == 1, f'permanent order count={s.count(old)}'
s = s.replace(old, new, 1)

# Ensure dynamic ring creation establishes the tick ring too.
old = '''            this.#ensureBorderRing();\n\n            this.#ensureHandRing();\n\n            const numberRing =\n                this.#ensureNumberRing();'''
new = '''            this.#ensureBorderRing();\n\n            this.#ensureTickRing();\n\n            this.#ensureHandRing();\n\n            const numberRing =\n                this.#ensureNumberRing();'''
assert s.count(old) == 1, f'ensureRing anchor count={s.count(old)}'
s = s.replace(old, new, 1)

old = '''            const order = [\n                activeRing,\n                borderRing,\n                ...inactive,\n                handRing,\n                numberRing\n            ];'''
new = '''            const order = [\n                activeRing,\n                borderRing,\n                ...inactive,\n                tickRing,\n                handRing,\n                numberRing\n            ];'''
assert s.count(old) == 1, f'dynamic order count={s.count(old)}'
s = s.replace(old, new, 1)

# Start/stop geometry tracking with tick rendering.
old = '''            if (!mode) {\n                this.#tickMarkLayer.replaceChildren();\n                return;\n            }'''
new = '''            if (!mode) {\n                this.#tickMarkLayer.replaceChildren();\n                this.#stopTickGeometryTracking();\n                return;\n            }\n\n            this.#startTickGeometryTracking();'''
assert s.count(old) == 1, f'updateTickMarks mode anchor count={s.count(old)}'
s = s.replace(old, new, 1)

p.write_text(s)
