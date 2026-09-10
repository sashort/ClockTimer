from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

text = text.replace(
'''            "grayscale",
            "grayscale-ramp"
        ];''',
'''            "grayscale",
            "grayscale-ramp",
            "background-color"
        ];'''
)

text = text.replace(
'''        connectedCallback() {
            this.#captureFaceBackground();

            this.#ensureAttributes();''',
'''        connectedCallback() {
            this.#captureFaceBackground();
            this.#syncFaceBackgroundColor();

            this.#ensureAttributes();'''
)

text = text.replace(
'''                case "grayscale":
                case "grayscale-ramp":
                    if (
                        this.#updatesSuspended &&
                        !this.#processingAsyncBatch
                    ) {
                        this.#queueAsyncOperation({
                            type: "grayscale"
                        });
                    }
                    else {
                        this.#runGrayscale();
                    }
                    break;
            }
        }''',
'''                case "grayscale":
                case "grayscale-ramp":
                    if (
                        this.#updatesSuspended &&
                        !this.#processingAsyncBatch
                    ) {
                        this.#queueAsyncOperation({
                            type: "grayscale"
                        });
                    }
                    else {
                        this.#runGrayscale();
                    }
                    break;

                case "background-color":
                    this.#syncFaceBackgroundColor();
                    break;
            }
        }'''
)

marker = '''        #ensureAttributes() {\n'''
method = '''        #syncFaceBackgroundColor() {
            if (!this.#faceBackground) {
                return;
            }

            const raw =
                this.getAttribute(
                    "background-color"
                );

            const value =
                typeof raw === "string"
                    ? raw.trim()
                    : "";

            if (
                value &&
                CSS.supports(
                    "color",
                    value
                )
            ) {
                this.#faceBackground.style.backgroundColor =
                    value;
            }
            else {
                this.#faceBackground.style.removeProperty(
                    "background-color"
                );
            }
        }

'''

if method not in text:
    if marker not in text:
        raise SystemExit('ensureAttributes marker not found')
    text = text.replace(marker, method + marker, 1)

path.write_text(text)
