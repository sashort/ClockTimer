from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()

replacements = []

replacements.append((
'''            "tick-marks",\n            "indicator-symbol"\n        ];''',
'''            "tick-marks",\n            "indicator-symbol",\n            "grayscale",\n            "grayscale-ramp"\n        ];'''
))

replacements.append((
'''        #spinAnimation;\n\n        constructor() {''',
'''        #spinAnimation;\n\n        #grayscaleAnimation;\n\n        constructor() {'''
))

replacements.append((
'''                @property --clock-timer-spin-duration {\n                    syntax: "<time>";\n                    inherits: true;\n                    initial-value: 750ms;\n                }\n''',
'''                @property --clock-timer-spin-duration {\n                    syntax: "<time>";\n                    inherits: true;\n                    initial-value: 750ms;\n                }\n\n                @property --clock-timer-grayscale {\n                    syntax: "<percentage>";\n                    inherits: true;\n                    initial-value: 100%;\n                }\n\n                @property --clock-timer-grayscale-ramp {\n                    syntax: "<time>";\n                    inherits: true;\n                    initial-value: 333ms;\n                }\n'''
))

replacements.append((
'''            this.#spinAnimation =\n                undefined;\n\n            if (this.#indicatorFrame !== undefined) {''',
'''            this.#spinAnimation =\n                undefined;\n\n            this.#grayscaleAnimation\n                ?.cancel();\n\n            this.#grayscaleAnimation =\n                undefined;\n\n            if (this.#indicatorFrame !== undefined) {'''
))

replacements.append((
'''                case "indicator-symbol":\n                    this.#syncIndicatorSymbolContent();\n                    this.#scheduleIndicatorSymbolUpdate();\n                    break;\n            }''',
'''                case "indicator-symbol":\n                    this.#syncIndicatorSymbolContent();\n                    this.#scheduleIndicatorSymbolUpdate();\n                    break;\n\n                case "grayscale":\n                case "grayscale-ramp":\n                    if (\n                        this.#updatesSuspended &&\n                        !this.#processingAsyncBatch\n                    ) {\n                        this.#queueAsyncOperation({\n                            type: "grayscale"\n                        });\n                    }\n                    else {\n                        this.#runGrayscale();\n                    }\n                    break;\n            }'''
))

replacements.append((
'''            if (operation.type === "percent-goal") {\n                this.#asyncOperationBuffer =\n                    this.#asyncOperationBuffer.filter(\n                        item =>\n                            item.type !== "percent-goal"\n                    );\n            }\n\n            this.#asyncOperationBuffer.push(''',
'''            if (operation.type === "percent-goal") {\n                this.#asyncOperationBuffer =\n                    this.#asyncOperationBuffer.filter(\n                        item =>\n                            item.type !== "percent-goal"\n                    );\n            }\n\n            if (operation.type === "grayscale") {\n                this.#asyncOperationBuffer =\n                    this.#asyncOperationBuffer.filter(\n                        item =>\n                            item.type !== "grayscale"\n                    );\n            }\n\n            this.#asyncOperationBuffer.push('''
))

replacements.append((
'''                        case "spin":\n                            this.#runSpin(\n                                operation.rotations,\n                                operation.duration\n                            );\n                            break;\n                    }''',
'''                        case "spin":\n                            this.#runSpin(\n                                operation.rotations,\n                                operation.duration\n                            );\n                            break;\n\n                        case "grayscale":\n                            this.#runGrayscale();\n                            break;\n                    }'''
))

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'missing expected block:\n{old[:180]}')
    text = text.replace(old, new, 1)

marker = '''        #flushAsyncOperations() {\n'''
if marker not in text:
    raise SystemExit('missing async flush marker')

methods = r'''        #parseGrayscalePercentage(value) {
            if (typeof value !== "string") {
                return undefined;
            }

            const text =
                value.trim();

            const match =
                text.match(
                    /^([+]?(?:\d+(?:\.\d+)?|\.\d+))%$/
                );

            if (!match) {
                return undefined;
            }

            const percentage =
                Number(match[1]);

            if (
                !Number.isFinite(percentage) ||
                percentage < 0 ||
                percentage > 100
            ) {
                return undefined;
            }

            return percentage;
        }

        #parseGrayscaleRampMilliseconds(value) {
            if (typeof value !== "string") {
                return undefined;
            }

            const text =
                value.trim();

            const match =
                text.match(
                    /^([+]?(?:\d+(?:\.\d+)?|\.\d+))(ms|s)$/i
                );

            if (!match) {
                return undefined;
            }

            const amount =
                Number(match[1]);

            const milliseconds =
                match[2].toLowerCase() === "s"
                    ? amount * 1000
                    : amount;

            if (
                !Number.isFinite(milliseconds) ||
                milliseconds < 0
            ) {
                return undefined;
            }

            return milliseconds;
        }

        #getGrayscalePercentage() {
            if (!this.hasAttribute("grayscale")) {
                return 0;
            }

            const attributeValue =
                this.#parseGrayscalePercentage(
                    this.getAttribute("grayscale")
                );

            if (attributeValue !== undefined) {
                return attributeValue;
            }

            const cssValue =
                getComputedStyle(this)
                    .getPropertyValue(
                        "--clock-timer-grayscale"
                    )
                    .trim();

            return this.#parseGrayscalePercentage(
                cssValue
            ) ?? 100;
        }

        #getGrayscaleRampMilliseconds() {
            const attributeValue =
                this.#parseGrayscaleRampMilliseconds(
                    this.getAttribute("grayscale-ramp")
                );

            if (attributeValue !== undefined) {
                return attributeValue;
            }

            const cssValue =
                getComputedStyle(this)
                    .getPropertyValue(
                        "--clock-timer-grayscale-ramp"
                    )
                    .trim();

            return this.#parseGrayscaleRampMilliseconds(
                cssValue
            ) ?? 333;
        }

        #runGrayscale() {
            if (!this.#clockFace) {
                return;
            }

            const percentage =
                this.#getGrayscalePercentage();

            const targetFilter =
                `grayscale(${percentage}%)`;

            if (!this.isConnected) {
                this.#grayscaleAnimation
                    ?.cancel();

                this.#grayscaleAnimation =
                    undefined;

                this.#clockFace.style.filter =
                    targetFilter;

                return;
            }

            const duration =
                this.#getGrayscaleRampMilliseconds();

            const currentFilter =
                getComputedStyle(
                    this.#clockFace
                ).filter || "none";

            this.#grayscaleAnimation
                ?.cancel();

            this.#clockFace.style.filter =
                currentFilter;

            if (duration <= 0) {
                this.#grayscaleAnimation =
                    undefined;

                this.#clockFace.style.filter =
                    targetFilter;

                return;
            }

            const animation =
                this.#clockFace.animate(
                    [
                        {
                            filter: currentFilter
                        },
                        {
                            filter: targetFilter
                        }
                    ],
                    {
                        duration,
                        easing: "linear",
                        fill: "forwards"
                    }
                );

            this.#grayscaleAnimation =
                animation;

            animation.finished
                .then(() => {
                    if (
                        this.#grayscaleAnimation !==
                            animation
                    ) {
                        return;
                    }

                    this.#clockFace.style.filter =
                        targetFilter;

                    animation.cancel();

                    this.#grayscaleAnimation =
                        undefined;
                })
                .catch(() => {});
        }

'''

text = text.replace(marker, methods + marker, 1)
path.write_text(text)
