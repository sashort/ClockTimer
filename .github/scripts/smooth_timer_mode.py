from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label} not found')
    return text.replace(old, new, 1)


clock_path = Path('ClockTimer.js')
clock = clock_path.read_text()

clock = replace_once(
    clock,
    '''        #remainingRanges =
            new Map();

        #waveRing;''',
    '''        #remainingRanges =
            new Map();

        #timerModeTransitionAnimations =
            new Set();

        #timerModeTransitionToken =
            0;

        #waveRing;''',
    'timer mode transition fields'
)

clock = replace_once(
    clock,
    '''                case "timer-mode":
                    this.#handleTimerModeChange();
                    break;''',
    '''                case "timer-mode":
                    this.#handleTimerModeChange(
                        oldValue,
                        newValue
                    );
                    break;''',
    'timer mode callback args'
)

clock = replace_once(
    clock,
    '''            this.#stopFaceBackgroundTracking();

            this.#spinAnimation''',
    '''            this.#stopFaceBackgroundTracking();

            this.#cancelTimerModeTransition();

            this.#spinAnimation''',
    'disconnect transition cleanup'
)

start = clock.index('        #handleTimerModeChange() {')
end = clock.index('        #findWaveSourceRange() {', start)
new_block = '''        #getTimerModeTransitionStart() {
            if (this.#started) {
                return this.#getCurrentTimelineTime();
            }

            let start;

            for (
                const range of
                    this.querySelectorAll(
                        "time-range.elapsed"
                    )
            ) {
                const end =
                    Number(
                        range.clockTimerEnd
                    );

                if (
                    Number.isFinite(end) &&
                    (
                        !Number.isFinite(start) ||
                        end > start
                    )
                ) {
                    start = end;
                }
            }

            return start;
        }

        #cancelTimerModeTransition() {
            const currentOpacity =
                new Map();

            for (
                const range of
                    this.querySelectorAll(
                        "time-range.elapsed, time-range.remaining"
                    )
            ) {
                const opacity =
                    Number.parseFloat(
                        getComputedStyle(
                            range
                        ).opacity
                    );

                if (Number.isFinite(opacity)) {
                    currentOpacity.set(
                        range,
                        opacity
                    );
                }
            }

            this.#timerModeTransitionToken++;

            for (
                const animation of
                    this.#timerModeTransitionAnimations
            ) {
                animation.cancel();
            }

            this.#timerModeTransitionAnimations.clear();

            for (
                const range of
                    this.querySelectorAll(
                        "time-range[timer-mode-transitioning]"
                    )
            ) {
                range.removeAttribute(
                    "timer-mode-transitioning"
                );
            }

            return currentOpacity;
        }

        #getRangeOpacity(range) {
            const value =
                Number.parseFloat(
                    getComputedStyle(
                        range
                    ).opacity
                );

            return Number.isFinite(value)
                ? Math.min(
                    1,
                    Math.max(
                        0,
                        value
                    )
                )
                : 1;
        }

        #animateTimerModeRange(
            range,
            fromOpacity,
            toOpacity
        ) {
            if (
                !range?.isConnected ||
                typeof range.animate !==
                    "function"
            ) {
                return undefined;
            }

            const animation =
                range.animate(
                    [
                        {
                            opacity:
                                String(
                                    fromOpacity
                                )
                        },
                        {
                            opacity:
                                String(
                                    toOpacity
                                )
                        }
                    ],
                    {
                        duration: 333,
                        easing: "ease-in-out",
                        fill: "both"
                    }
                );

            this.#timerModeTransitionAnimations.add(
                animation
            );

            return animation;
        }

        #applyTimerModeState(mode) {
            if (mode !== "remaining") {
                this.#removeRemainingRanges();
                this.#syncWaveRange();
                return;
            }

            const start =
                this.#getTimerModeTransitionStart();

            if (Number.isFinite(start)) {
                this.#updateRemainingRanges(
                    start
                );
            }

            this.#syncWaveRange();
        }

        #transitionTimerMode(
            previousMode,
            mode
        ) {
            const previousOpacity =
                this.#cancelTimerModeTransition();

            const token =
                ++this.#timerModeTransitionToken;

            const elapsedRanges =
                Array.from(
                    this.querySelectorAll(
                        "time-range.elapsed"
                    )
                );

            for (const range of elapsedRanges) {
                range.setAttribute(
                    "timer-mode-transitioning",
                    ""
                );
            }

            if (mode === "remaining") {
                const start =
                    this.#getTimerModeTransitionStart();

                if (Number.isFinite(start)) {
                    this.#updateRemainingRanges(
                        start
                    );
                }
            }

            this.#syncWaveRange();

            const remainingRanges =
                Array.from(
                    this.querySelectorAll(
                        "time-range.remaining"
                    )
                );

            const animations = [];

            for (const range of elapsedRanges) {
                const target =
                    this.#getRangeOpacity(
                        range
                    );

                const from =
                    previousOpacity.get(
                        range
                    ) ??
                    (
                        previousMode === "elapsed"
                            ? target
                            : 0
                    );

                const to =
                    mode === "elapsed"
                        ? target
                        : 0;

                const animation =
                    this.#animateTimerModeRange(
                        range,
                        from,
                        to
                    );

                if (animation) {
                    animations.push(
                        animation
                    );
                }
            }

            for (const range of remainingRanges) {
                const target =
                    this.#getRangeOpacity(
                        range
                    );

                const from =
                    previousOpacity.get(
                        range
                    ) ??
                    (
                        previousMode === "remaining"
                            ? target
                            : 0
                    );

                const to =
                    mode === "remaining"
                        ? target
                        : 0;

                const animation =
                    this.#animateTimerModeRange(
                        range,
                        from,
                        to
                    );

                if (animation) {
                    animations.push(
                        animation
                    );
                }
            }

            const finish =
                () => {
                    if (
                        token !==
                            this.#timerModeTransitionToken
                    ) {
                        return;
                    }

                    for (const animation of animations) {
                        this.#timerModeTransitionAnimations.delete(
                            animation
                        );

                        animation.cancel();
                    }

                    for (const range of elapsedRanges) {
                        range.removeAttribute(
                            "timer-mode-transitioning"
                        );
                    }

                    if (mode !== "remaining") {
                        this.#removeRemainingRanges();
                    }

                    this.#syncWaveRange();
                };

            if (animations.length === 0) {
                finish();
                return;
            }

            Promise.allSettled(
                animations.map(
                    animation =>
                        animation.finished
                )
            ).then(
                finish
            );
        }

        #handleTimerModeChange(
            oldValue,
            newValue
        ) {
            const mode =
                this.#normalizeTimerMode();

            if (newValue !== mode) {
                return;
            }

            const previousMode =
                oldValue === "remaining"
                    ? "remaining"
                    : "elapsed";

            if (
                !this.isConnected ||
                oldValue === null ||
                previousMode === mode
            ) {
                this.#cancelTimerModeTransition();
                this.#applyTimerModeState(
                    mode
                );
                return;
            }

            this.#transitionTimerMode(
                previousMode,
                mode
            );
        }

'''
clock = clock[:start] + new_block + clock[end:]
clock_path.write_text(clock)


time_path = Path('TimeRange.js')
time = time_path.read_text()
time = replace_once(
    time,
    ''':host(.elapsed):host-context(clock-timer[timer-mode="remaining"]) {
                display: none !important;
            }''',
    ''':host(.elapsed:not([timer-mode-transitioning])):host-context(clock-timer[timer-mode="remaining"]) {
                display: none !important;
            }''',
    'elapsed final hide selector'
)
time_path.write_text(time)
