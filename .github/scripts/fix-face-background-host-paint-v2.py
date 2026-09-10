from pathlib import Path
import re
p=Path('ClockTimer.js')
s=p.read_text()
s=re.sub(r'\n\s*#hostBackgroundOverride;\n', '\n', s, count=1)
pattern=r'''        #captureFaceBackground\(\) \{.*?        #syncFaceBackgroundGeometry\(\) \{'''
replacement='''        #captureFaceBackground() {\n            if (!this.#faceBackground) {\n                return;\n            }\n\n            this.#syncFaceBackgroundFromExternalCSS();\n        }\n\n        #syncFaceBackgroundFromExternalCSS() {\n            if (!this.#faceBackground) {\n                return;\n            }\n\n            this.style.removeProperty(\n                "background-color"\n            );\n\n            const backgroundColor =\n                getComputedStyle(this).backgroundColor;\n\n            this.#faceBackground.style.backgroundColor =\n                backgroundColor;\n\n            this.style.setProperty(\n                "background-color",\n                "transparent",\n                "important"\n            );\n        }\n\n        #syncFaceBackgroundGeometry() {'''
s,n=re.subn(pattern,replacement,s,count=1,flags=re.S)
if n!=1:
    raise SystemExit('face background methods not replaced')
s=re.sub(r'''\n\s*if \(this\.#hostBackgroundOverride\) \{.*?\n\s*\}\n''','\n',s,flags=re.S)
p.write_text(s)
