from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
old='''                #indicator-symbol::before {\n                    content: var(--clock-timer-indicator-symbol-content, "▼");\n                }\n'''
new='''                #indicator-symbol::before {\n                    content: none;\n                }\n'''
if old not in s: raise SystemExit('css anchor missing')
s=s.replace(old,new,1)
old='''                case "indicator-symbol":\n                    this.#scheduleIndicatorSymbolUpdate();\n                    break;'''
new='''                case "indicator-symbol":\n                    this.#syncIndicatorSymbolContent();\n                    this.#scheduleIndicatorSymbolUpdate();\n                    break;'''
if old not in s: raise SystemExit('attribute anchor missing')
s=s.replace(old,new,1)
old='''        #setIndicatorSymbolVisible(visible) {\n'''
new='''        #syncIndicatorSymbolContent() {\n            if (!this.#indicatorSymbol) {\n                return;\n            }\n\n            const symbol =\n                this.getAttribute(\n                    "indicator-symbol"\n                );\n\n            this.#indicatorSymbol.textContent =\n                symbol === null ||\n                symbol === ""\n                    ? "▲"\n                    : symbol;\n        }\n\n        #setIndicatorSymbolVisible(visible) {\n'''
if old not in s: raise SystemExit('method anchor missing')
s=s.replace(old,new,1)
old='''            this.#indicatorSymbol.setAttribute(\n                "part",\n                "indicator-symbol"\n            );\n\n            this.#indicatorTrack.appendChild('''
new='''            this.#indicatorSymbol.setAttribute(\n                "part",\n                "indicator-symbol"\n            );\n\n            this.#syncIndicatorSymbolContent();\n\n            this.#indicatorTrack.appendChild('''
if old not in s: raise SystemExit('constructor anchor missing')
s=s.replace(old,new,1)
p.write_text(s)
