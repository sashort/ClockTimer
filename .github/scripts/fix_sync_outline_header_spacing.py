from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)

# ---------------------------------------------------------------------------
# app.js: main Sync keeps its sync-icon rotation but opts out of the generic
# button press feedback used by ordinary buttons.
# ---------------------------------------------------------------------------
path = Path('app.js')
text = path.read_text()
text = replace_once(
    text,
    '''    function beginButtonPressFeedback(button) {
        if (!(button instanceof HTMLButtonElement) || button.disabled) return;
        if (buttonPressStates.has(button)) return;
''',
    '''    function beginButtonPressFeedback(button) {
        if (!(button instanceof HTMLButtonElement) || button.disabled) return;
        if (button === goalSyncButton) return;
        if (buttonPressStates.has(button)) return;
''',
    'main Sync generic press behavior'
)
path.write_text(text)

# ---------------------------------------------------------------------------
# app.css: remove the late site-wide app padding override and make the
# hamburger's button chrome explicitly identical to the neighboring scope
# control border.
# ---------------------------------------------------------------------------
path = Path('app.css')
text = path.read_text()
text = replace_once(
    text,
    '''    --app-document-padding: 0.125in;''',
    '''    --app-document-padding: 0;''',
    'app document padding variable'
)
text = replace_once(
    text,
    '''.app {
    padding: var(--app-document-padding);
    background: var(--wm-blue);
}''',
    '''.app {
    margin: 0;
    padding: 0;
    background: var(--wm-blue);
}''',
    'late app spacing override'
)
text = replace_once(
    text,
    '''.hamburger-button {
    height: 100%;
    width: auto;''',
    '''.hamburger-button {
    appearance: none;
    height: 100%;
    width: auto;
    border: var(--control-border);
    border-radius: 12px;''',
    'hamburger button chrome'
)
path.write_text(text)

# ---------------------------------------------------------------------------
# ClockTimer.js: make the main time color setting effective and calculate a
# black/white outline only when the main time lacks sufficient contrast with
# the face background or an individually visible hand color.
# ---------------------------------------------------------------------------
path = Path('ClockTimer.js')
text = path.read_text()

text = replace_once(
    text,
    '''        #timeElement;

        #dateElement;''',
    '''        #timeElement;

        #timeOutlineSignature;

        #dateElement;''',
    'time outline signature field'
)

text = replace_once(
    text,
    '''                #time {
                    font-family:
                        var(
                            --clock-timer-time-font,
                            inherit
                        );

                    font-size:
                        var(
                            --clock-timer-time-font-size,
                            var(
                                --clock-timer-auto-time-font-size,
                                1rem
                            )
                        );
                }''',
    '''                #time {
                    font-family:
                        var(
                            --clock-timer-time-font,
                            inherit
                        );

                    font-size:
                        var(
                            --clock-timer-time-font-size,
                            var(
                                --clock-timer-auto-time-font-size,
                                1rem
                            )
                        );

                    color:
                        var(
                            --clock-timer-time-color,
                            currentColor
                        );

                    -webkit-text-stroke:
                        var(
                            --clock-timer-time-outline-width,
                            0px
                        )
                        var(
                            --clock-timer-time-outline-color,
                            transparent
                        );

                    text-shadow:
                        var(
                            --clock-timer-time-outline-shadow,
                            none
                        );
                }''',
    'main time outline CSS'
)

outline_methods = r'''        #parseContrastColor(
            value
        ) {
            const text =
                String(value ?? "")
                    .trim()
                    .toLowerCase();

            if (!text) {
                return undefined;
            }

            if (text === "transparent") {
                return {
                    r: 0,
                    g: 0,
                    b: 0,
                    a: 0
                };
            }

            const hex =
                text.match(
                    /^#([0-9a-f]{3,8})$/i
                );

            if (hex) {
                let value =
                    hex[1];

                if (
                    value.length === 3 ||
                    value.length === 4
                ) {
                    value =
                        Array.from(value)
                            .map(
                                digit =>
                                    `${digit}${digit}`
                            )
                            .join("");
                }

                if (
                    value.length === 6 ||
                    value.length === 8
                ) {
                    return {
                        r: Number.parseInt(
                            value.slice(0, 2),
                            16
                        ),
                        g: Number.parseInt(
                            value.slice(2, 4),
                            16
                        ),
                        b: Number.parseInt(
                            value.slice(4, 6),
                            16
                        ),
                        a:
                            value.length === 8
                                ? Number.parseInt(
                                    value.slice(6, 8),
                                    16
                                ) / 255
                                : 1
                    };
                }
            }

            if (
                text.startsWith("rgb(") ||
                text.startsWith("rgba(")
            ) {
                const values =
                    text.match(
                        /-?\d*\.?\d+%?/g
                    ) ?? [];

                if (values.length >= 3) {
                    const channel =
                        raw => {
                            const percent =
                                raw.endsWith("%");

                            const number =
                                Number.parseFloat(raw);

                            if (!Number.isFinite(number)) {
                                return undefined;
                            }

                            return Math.max(
                                0,
                                Math.min(
                                    255,
                                    percent
                                        ? number * 2.55
                                        : number
                                )
                            );
                        };

                    const r =
                        channel(values[0]);

                    const g =
                        channel(values[1]);

                    const b =
                        channel(values[2]);

                    if (
                        r === undefined ||
                        g === undefined ||
                        b === undefined
                    ) {
                        return undefined;
                    }

                    let a =
                        1;

                    if (values[3] !== undefined) {
                        const alphaPercent =
                            values[3].endsWith("%");

                        const alpha =
                            Number.parseFloat(
                                values[3]
                            );

                        if (Number.isFinite(alpha)) {
                            a =
                                Math.max(
                                    0,
                                    Math.min(
                                        1,
                                        alphaPercent
                                            ? alpha / 100
                                            : alpha
                                    )
                                );
                        }
                    }

                    return {
                        r,
                        g,
                        b,
                        a
                    };
                }
            }

            return undefined;
        }

        #contrastLuminance(
            color
        ) {
            const channel =
                value => {
                    const normalized =
                        value / 255;

                    return normalized <= 0.04045
                        ? normalized / 12.92
                        : Math.pow(
                            (
                                normalized +
                                0.055
                            ) / 1.055,
                            2.4
                        );
                };

            return (
                0.2126 * channel(color.r) +
                0.7152 * channel(color.g) +
                0.0722 * channel(color.b)
            );
        }

        #contrastRatio(
            left,
            right
        ) {
            const leftLuminance =
                this.#contrastLuminance(
                    left
                );

            const rightLuminance =
                this.#contrastLuminance(
                    right
                );

            const lighter =
                Math.max(
                    leftLuminance,
                    rightLuminance
                );

            const darker =
                Math.min(
                    leftLuminance,
                    rightLuminance
                );

            return (
                lighter + 0.05
            ) / (
                darker + 0.05
            );
        }

        #getEffectiveContrastBackground() {
            const faceColor =
                this.#parseContrastColor(
                    getComputedStyle(
                        this.#faceBackground
                    ).backgroundColor
                );

            if (
                faceColor &&
                faceColor.a >= 0.95
            ) {
                return faceColor;
            }

            let element =
                this;

            while (element) {
                const color =
                    this.#parseContrastColor(
                        getComputedStyle(
                            element
                        ).backgroundColor
                    );

                if (
                    color &&
                    color.a >= 0.95
                ) {
                    return color;
                }

                element =
                    element.parentElement;
            }

            return faceColor?.a > 0
                ? faceColor
                : {
                    r: 255,
                    g: 255,
                    b: 255,
                    a: 1
                };
        }

        #getVisibleHandContrastColors() {
            const hands = [
                [
                    this.#hourHand,
                    "hide-hour-hand"
                ],
                [
                    this.#minuteHand,
                    "hide-minute-hand"
                ],
                [
                    this.#secondHand,
                    "hide-second-hand"
                ]
            ];

            const colors = [];

            for (
                const [
                    hand,
                    hiddenAttribute
                ] of hands
            ) {
                if (
                    !hand ||
                    this.hasAttribute(
                        hiddenAttribute
                    )
                ) {
                    continue;
                }

                const style =
                    getComputedStyle(
                        hand
                    );

                if (
                    style.display === "none" ||
                    style.visibility === "hidden" ||
                    Number.parseFloat(
                        style.opacity || "1"
                    ) <= 0
                ) {
                    continue;
                }

                const color =
                    this.#parseContrastColor(
                        style.backgroundColor
                    );

                if (
                    color &&
                    color.a > 0
                ) {
                    colors.push(
                        color
                    );
                }
            }

            return colors;
        }

        #updateTimeOutlineContrast() {
            if (!this.#timeElement) {
                return;
            }

            const timeStyle =
                getComputedStyle(
                    this.#timeElement
                );

            const timeColor =
                this.#parseContrastColor(
                    timeStyle.color
                );

            const background =
                this.#getEffectiveContrastBackground();

            if (
                !timeColor ||
                !background
            ) {
                return;
            }

            const handColors =
                this.#getVisibleHandContrastColors();

            // Contrast is intentionally evaluated only as main-time color
            // versus each visual surface independently. Hand colors are never
            // compared with the background or with each other.
            const surfaces = [
                background,
                ...handColors
            ];

            const fontSize =
                Number.parseFloat(
                    timeStyle.fontSize
                );

            const fontWeight =
                Number.parseInt(
                    timeStyle.fontWeight,
                    10
                );

            const largeText =
                Number.isFinite(fontSize) &&
                (
                    fontSize >= 24 ||
                    (
                        fontSize >= 18.66 &&
                        Number.isFinite(fontWeight) &&
                        fontWeight >= 700
                    )
                );

            const threshold =
                largeText
                    ? 3
                    : 4.5;

            const contrastValues =
                surfaces.map(
                    surface =>
                        this.#contrastRatio(
                            timeColor,
                            surface
                        )
                );

            const problematic =
                surfaces.filter(
                    (
                        surface,
                        index
                    ) =>
                        contrastValues[index] <
                            threshold
                );

            const signature =
                JSON.stringify({
                    timeColor,
                    surfaces,
                    fontSize,
                    fontWeight,
                    threshold,
                    problematicCount:
                        problematic.length
                });

            if (
                signature ===
                    this.#timeOutlineSignature
            ) {
                return;
            }

            this.#timeOutlineSignature =
                signature;

            if (problematic.length === 0) {
                this.#timeElement.style.setProperty(
                    "--clock-timer-time-outline-width",
                    "0px"
                );

                this.#timeElement.style.setProperty(
                    "--clock-timer-time-outline-color",
                    "transparent"
                );

                this.#timeElement.style.setProperty(
                    "--clock-timer-time-outline-shadow",
                    "none"
                );

                return;
            }

            const candidates = [
                {
                    r: 0,
                    g: 0,
                    b: 0,
                    a: 1
                },
                {
                    r: 255,
                    g: 255,
                    b: 255,
                    a: 1
                }
            ];

            let best =
                candidates[0];

            let bestScore =
                -Infinity;

            let bestAverage =
                -Infinity;

            for (const candidate of candidates) {
                const candidateContrasts = [
                    this.#contrastRatio(
                        candidate,
                        timeColor
                    ),
                    ...problematic.map(
                        surface =>
                            this.#contrastRatio(
                                candidate,
                                surface
                            )
                    )
                ];

                const score =
                    Math.min(
                        ...candidateContrasts
                    );

                const average =
                    candidateContrasts.reduce(
                        (
                            total,
                            value
                        ) =>
                            total + value,
                        0
                    ) /
                    candidateContrasts.length;

                if (
                    score > bestScore ||
                    (
                        score === bestScore &&
                        average > bestAverage
                    )
                ) {
                    best =
                        candidate;

                    bestScore =
                        score;

                    bestAverage =
                        average;
                }
            }

            const outlineColor =
                `rgb(${best.r} ${best.g} ${best.b})`;

            const outlineWidth =
                Number.isFinite(fontSize)
                    ? Math.max(
                        1,
                        Math.min(
                            2.5,
                            fontSize * 0.04
                        )
                    )
                    : 1.5;

            this.#timeElement.style.setProperty(
                "--clock-timer-time-outline-width",
                `${outlineWidth}px`
            );

            this.#timeElement.style.setProperty(
                "--clock-timer-time-outline-color",
                outlineColor
            );

            this.#timeElement.style.setProperty(
                "--clock-timer-time-outline-shadow",
                `0 0 ${Math.max(1, outlineWidth * 0.8)}px ${outlineColor}`
            );
        }

'''
text = replace_once(
    text,
    '''        #captureFaceBackground() {
            if (!this.#faceBackground) {
                return;
            }
''',
    outline_methods + '''        #captureFaceBackground() {
            if (!this.#faceBackground) {
                return;
            }
''',
    'contrast methods insertion'
)

text = replace_once(
    text,
    '''            this.#faceBackground.style.backgroundColor =
                backgroundColor;
        }
        #syncFaceBackgroundGeometry() {''',
    '''            this.#faceBackground.style.backgroundColor =
                backgroundColor;

            this.#updateTimeOutlineContrast();
        }
        #syncFaceBackgroundGeometry() {''',
    'time outline refresh hook'
)

path.write_text(text)
