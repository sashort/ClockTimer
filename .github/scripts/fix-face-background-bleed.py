from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
s=s.replace('''        #clockFace;\n\n        #timeElement;''','''        #clockFace;\n\n        #faceBackground;\n\n        #faceBackgroundFrame;\n\n        #hostBackgroundOverride;\n\n        #timeElement;''',1)
s=s.replace('''                #clock-face {\n                    position: absolute;''','''                #clock-face {\n                    position: absolute;''',1)
needle='''                #rings {\n                    position: absolute;'''
insert='''                #face-background {\n                    position: absolute;\n                    inset: 0;\n                    border-radius: 50%;\n                    z-index: -1;\n                    pointer-events: none;\n                }\n\n                #rings {\n                    position: absolute;'''
if needle not in s: raise SystemExit('rings css anchor missing')
s=s.replace(needle,insert,1)
needle='''            const ringLayer =\n                document.createElement(\n                    "div"\n                );'''
insert='''            this.#faceBackground =\n                document.createElement(\n                    "div"\n                );\n\n            this.#faceBackground.id =\n                "face-background";\n\n            const ringLayer =\n                document.createElement(\n                    "div"\n                );'''
if needle not in s: raise SystemExit('ringLayer create anchor missing')
s=s.replace(needle,insert,1)
needle='''            clockFace.append(\n                ringLayer,'''
insert='''            clockFace.append(\n                this.#faceBackground,\n                ringLayer,'''
if needle not in s: raise SystemExit('append anchor missing')
s=s.replace(needle,insert,1)
needle='''        connectedCallback() {\n            this.#ensureAttributes();'''
insert='''        connectedCallback() {\n            this.#captureFaceBackground();\n\n            this.#ensureAttributes();'''
if needle not in s: raise SystemExit('connected anchor missing')
s=s.replace(needle,insert,1)
needle='''            this.#stopSizeObserver();\n\n            this.#spinAnimation'''
insert='''            this.#stopSizeObserver();\n\n            this.#stopFaceBackgroundTracking();\n\n            this.#spinAnimation'''
if needle not in s: raise SystemExit('disconnect anchor missing')
s=s.replace(needle,insert,1)
# start tracking after permanent geometry exists
needle='''            this.#syncHandGeometry();\n\n            this.#startHandAnimations();'''
insert='''            this.#syncHandGeometry();\n\n            this.#startFaceBackgroundTracking();\n\n            this.#startHandAnimations();'''
if needle not in s: raise SystemExit('tracking anchor missing')
s=s.replace(needle,insert,1)
# insert methods before ensureNumberRing
needle='''        #ensureNumberRing() {'''
methods='''        #captureFaceBackground() {\n            if (!this.#faceBackground) {\n                return;\n            }\n\n            if (this.#hostBackgroundOverride) {\n                this.#hostBackgroundOverride.remove();\n                this.#hostBackgroundOverride = undefined;\n            }\n\n            const backgroundColor =\n                getComputedStyle(this).backgroundColor;\n\n            this.#faceBackground.style.backgroundColor =\n                backgroundColor;\n\n            const override =\n                document.createElement("style");\n\n            override.textContent =\n                ":host { background-color: transparent !important; }";\n\n            this.#shadowRoot.appendChild(override);\n            this.#hostBackgroundOverride = override;\n        }\n\n        #syncFaceBackgroundGeometry() {\n            if (!this.#faceBackground || !this.#borderRing) {\n                return;\n            }\n\n            const inset = Number(this.#borderRing.renderedInset);\n            const width = Number(this.#borderRing.renderedWidth);\n\n            if (!Number.isFinite(inset) || !Number.isFinite(width)) {\n                return;\n            }\n\n            const innerEdge = Math.max(0, inset + width / 2);\n            this.#faceBackground.style.inset = `${innerEdge}px`;\n        }\n\n        #startFaceBackgroundTracking() {\n            if (this.#faceBackgroundFrame !== undefined) {\n                return;\n            }\n\n            const update = () => {\n                this.#faceBackgroundFrame = undefined;\n\n                if (!this.isConnected) {\n                    return;\n                }\n\n                this.#syncFaceBackgroundGeometry();\n                this.#faceBackgroundFrame = requestAnimationFrame(update);\n            };\n\n            this.#syncFaceBackgroundGeometry();\n            this.#faceBackgroundFrame = requestAnimationFrame(update);\n        }\n\n        #stopFaceBackgroundTracking() {\n            if (this.#faceBackgroundFrame !== undefined) {\n                cancelAnimationFrame(this.#faceBackgroundFrame);\n                this.#faceBackgroundFrame = undefined;\n            }\n\n            if (this.#hostBackgroundOverride) {\n                this.#hostBackgroundOverride.remove();\n                this.#hostBackgroundOverride = undefined;\n            }\n        }\n\n        #ensureNumberRing() {'''
if needle not in s: raise SystemExit('method insertion anchor missing')
s=s.replace(needle,methods,1)
p.write_text(s)
