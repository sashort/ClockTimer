from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
s=s.replace('''            "military-time",\n            "format",''','''            "military-time",\n            "format",\n            "date-format",''',1)
s=s.replace('''                case "format":\n                    this.#normalizeFormat();\n\n                    this.#updateDisplay(\n                        new Date()\n                    );\n\n                    break;''','''                case "format":\n                    this.#normalizeFormat();\n\n                    this.#updateDisplay(\n                        new Date()\n                    );\n\n                    break;\n\n                case "date-format":\n                    this.#updateDisplay(\n                        new Date()\n                    );\n\n                    break;''',1)
# Find current date rendering via generic text assignment near updateDisplay by inspect broad text patterns.
# Add a hard visibility guard at start of responsive date sizing too, while display update owns content.
s=s.replace('''            const dateSize =\n                fittedSize * 0.38;''','''            const dateVisible =\n                this.hasAttribute(\n                    "date-format"\n                );\n\n            this.#dateElement.hidden =\n                !dateVisible;\n\n            if (!dateVisible) {\n                return;\n            }\n\n            const dateSize =\n                fittedSize * 0.38;''',1)
# CSS hidden must win over shared display:inline-block.
s=s.replace('''                #date,\n                #time {''','''                #date[hidden] {\n                    display: none;\n                }\n\n                #date,\n                #time {''',1)
# Since later #date,#time display has equal specificity and comes later, move hidden rule after shared block by add stronger specificity.
s=s.replace('''                #date[hidden] {\n                    display: none;\n                }''','''                #date[hidden] {\n                    display: none !important;\n                }''',1)
# Initialize hidden immediately in constructor, before any display timer.
s=s.replace('''            this.#dateElement.id =\n                "date";\n\n            this.#dateElement.setAttribute(''','''            this.#dateElement.id =\n                "date";\n\n            this.#dateElement.hidden =\n                !this.hasAttribute(\n                    "date-format"\n                );\n\n            this.#dateElement.setAttribute(''',1)
p.write_text(s)
