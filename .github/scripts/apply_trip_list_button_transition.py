from pathlib import Path

# Temporary one-shot patch for Trip List button motion.


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


root = Path('.')

css_path = root / 'app.css'
css = css_path.read_text()
css = replace_once(
    css,
    '''.app {
    --trip-log-row-height: 74px;
    --home-clock-preferred-size: 56vw;

    width: 100vw;
    height: 100dvh;
    margin: 0;
    padding: 0.125in;
    display: grid;
    grid-template-rows: 52px 142px 62px 29px 122px 1fr var(--trip-log-row-height);
    background: linear-gradient(180deg, var(--wm-blue-dark) 0%, var(--wm-blue-mid) 25%, var(--wm-blue) 55%, var(--wm-blue-mid) 100%);
    overflow: hidden;
    transition:
        filter var(--app-grayscale-ramp, 2000ms) linear,
        grid-template-rows 1000ms ease-in-out;
}

.app[data-trip-log-pinned="false"] {
    --trip-log-row-height: 0px;
    --home-clock-preferred-size: calc(56vw + 74px);
}
''',
    '''.app {
    --trip-log-row-height: 74px;
    --home-clock-preferred-size: 56vw;
    --trip-log-layout-duration: 1000ms;

    width: 100vw;
    height: 100dvh;
    margin: 0;
    padding: 0.125in;
    display: grid;
    grid-template-rows: 52px 142px 62px 29px 122px 1fr var(--trip-log-row-height);
    background: linear-gradient(180deg, var(--wm-blue-dark) 0%, var(--wm-blue-mid) 25%, var(--wm-blue) 55%, var(--wm-blue-mid) 100%);
    overflow: hidden;
    transition:
        filter var(--app-grayscale-ramp, 2000ms) linear,
        grid-template-rows var(--trip-log-layout-duration) ease-in-out;
}

.app[data-trip-log-pinned="false"] {
    --trip-log-row-height: 0px;
    --home-clock-preferred-size: calc(56vw + 74px);
}

.app[data-trip-list-state="opening"],
.app[data-trip-list-state="open"] {
    --trip-log-row-height: 0px;
    --home-clock-preferred-size: calc(56vw + 74px);
    --trip-log-layout-duration: 750ms;
}

.app[data-trip-list-state="closing"] {
    --trip-log-layout-duration: 750ms;
}
''',
    'app layout state'
)
css = replace_once(
    css,
    '''.clock-region > #clockTimer {
    width: min(var(--home-clock-preferred-size), 100cqw, 100cqh);
    height: min(var(--home-clock-preferred-size), 100cqw, 100cqh);
    transition:
        width 1000ms ease-in-out,
        height 1000ms ease-in-out;
}
''',
    '''.clock-region > #clockTimer {
    width: min(var(--home-clock-preferred-size), 100cqw, 100cqh);
    height: min(var(--home-clock-preferred-size), 100cqw, 100cqh);
    transition:
        width var(--trip-log-layout-duration, 1000ms) ease-in-out,
        height var(--trip-log-layout-duration, 1000ms) ease-in-out;
}
''',
    'clock transition duration'
)
css = replace_once(
    css,
    '''.app[data-trip-log-pinned="false"] .trip-log-button {
    transform: translateY(calc(100% + 0.125in));
    pointer-events: none;
}
''',
    '''.app[data-trip-log-pinned="false"] .trip-log-button:not(.trip-log-floating) {
    transform: translateY(calc(100% + 0.125in));
    pointer-events: none;
}

.trip-log-button.trip-log-floating {
    position: fixed;
    z-index: 3000;
    margin: 0;
    align-self: auto;
    transform: none;
    transition: none;
    pointer-events: auto;
    will-change: transform;
}
''',
    'floating trip log button'
)
css_path.write_text(css.rstrip() + '\n')

html_path = root / 'index.html'
html = html_path.read_text()
html = replace_once(
    html,
    '<button id="tripLogButton" class="trip-log-button" type="button">Trip Log</button>',
    '<button id="tripLogButton" class="trip-log-button" type="button" aria-expanded="false">Trip Log</button>',
    'trip log aria expanded'
)
html_path.write_text(html.rstrip() + '\n')

js_path = root / 'app.js'
js = js_path.read_text()
js = replace_once(
    js,
    '''    const SETTINGS_HELP_FADE_DURATION = 750;
    const SETTINGS_HELP_VISIBLE_DURATION = 4000;
    let activeSettingsHelpButton;
    let settingsHelpAnimation;
''',
    '''    const SETTINGS_HELP_FADE_DURATION = 750;
    const SETTINGS_HELP_VISIBLE_DURATION = 4000;
    const TRIP_LIST_BUTTON_TRANSITION_DURATION = 750;
    let activeSettingsHelpButton;
    let settingsHelpAnimation;
    let tripListButtonAnimation;
''',
    'Trip List transition state variables'
)
js = replace_once(
    js,
    '''        if (tripLogButton) {
            tripLogButton.inert =
                !pinned;

            if (pinned) {
                tripLogButton.removeAttribute(
                    "aria-hidden"
                );
            }
            else {
                tripLogButton.setAttribute(
                    "aria-hidden",
                    "true"
                );
            }
        }
''',
    '''        if (tripLogButton) {
            const hidden =
                !pinned &&
                !tripListIsActive();

            tripLogButton.inert =
                hidden;

            if (!hidden) {
                tripLogButton.removeAttribute(
                    "aria-hidden"
                );
            }
            else {
                tripLogButton.setAttribute(
                    "aria-hidden",
                    "true"
                );
            }
        }
''',
    'pin visibility while Trip List active'
)
insert_anchor = '''        return pinned;
    }

    function getStoredJSON(key, fallback) {
'''
insert_block = '''        return pinned;
    }

    function getTripListState() {
        return app.dataset.tripListState || "closed";
    }

    function tripListIsActive() {
        return getTripListState() !== "closed";
    }

    function getAppContentMetrics() {
        const rect = app.getBoundingClientRect();
        const style = getComputedStyle(app);
        const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
        const paddingRight = Number.parseFloat(style.paddingRight) || 0;
        const paddingTop = Number.parseFloat(style.paddingTop) || 0;
        const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
        const height = tripLogButton?.offsetHeight || 74;

        return {
            rect,
            paddingLeft,
            paddingRight,
            paddingTop,
            paddingBottom,
            height,
            left: rect.left + paddingLeft,
            width: Math.max(0, rect.width - paddingLeft - paddingRight)
        };
    }

    function getTripLogTopRect() {
        const metrics = getAppContentMetrics();
        return {
            left: metrics.left,
            top: metrics.rect.top + metrics.paddingTop,
            width: metrics.width,
            height: metrics.height
        };
    }

    function getTripLogBottomRect() {
        const metrics = getAppContentMetrics();
        return {
            left: metrics.left,
            top: metrics.rect.bottom - metrics.paddingBottom - metrics.height,
            width: metrics.width,
            height: metrics.height
        };
    }

    function setFloatingTripLogRect(rect) {
        if (!tripLogButton || !rect) return;

        tripLogButton.classList.add(
            "trip-log-floating"
        );
        tripLogButton.style.left = `${rect.left}px`;
        tripLogButton.style.top = `${rect.top}px`;
        tripLogButton.style.width = `${rect.width}px`;
        tripLogButton.style.height = `${rect.height}px`;
    }

    function clearFloatingTripLogRect() {
        if (!tripLogButton) return;

        tripLogButton.classList.remove(
            "trip-log-floating"
        );
        tripLogButton.style.removeProperty("left");
        tripLogButton.style.removeProperty("top");
        tripLogButton.style.removeProperty("width");
        tripLogButton.style.removeProperty("height");
        tripLogButton.style.removeProperty("transform");
    }

    async function animateTripLogButton(fromTransform, toTransform) {
        tripListButtonAnimation?.cancel();

        tripListButtonAnimation =
            tripLogButton.animate(
                [
                    { transform: fromTransform },
                    { transform: toTransform }
                ],
                {
                    duration: TRIP_LIST_BUTTON_TRANSITION_DURATION,
                    easing: "ease-in-out",
                    fill: "both"
                }
            );

        try {
            await tripListButtonAnimation.finished;
        }
        catch {}

        tripListButtonAnimation?.cancel();
        tripListButtonAnimation = undefined;
    }

    async function openTripList(source = "button") {
        if (!tripLogButton || getTripListState() !== "closed") {
            return false;
        }

        const pinned = tripLogIsPinned();
        const topRect = getTripLogTopRect();

        if (pinned) {
            const sourceRect =
                tripLogButton.getBoundingClientRect();

            setFloatingTripLogRect(
                sourceRect
            );

            app.dataset.tripListState =
                "opening";

            tripLogButton.inert = true;
            tripLogButton.removeAttribute("aria-hidden");
            tripLogButton.setAttribute("aria-expanded", "true");

            await animateTripLogButton(
                "translateY(0px)",
                `translateY(${topRect.top - sourceRect.top}px)`
            );
        }
        else {
            setFloatingTripLogRect(
                topRect
            );

            app.dataset.tripListState =
                "opening";

            tripLogButton.inert = true;
            tripLogButton.removeAttribute("aria-hidden");
            tripLogButton.setAttribute("aria-expanded", "true");

            const distance =
                topRect.top +
                topRect.height +
                8;

            await animateTripLogButton(
                `translateY(-${distance}px)`,
                "translateY(0px)"
            );
        }

        setFloatingTripLogRect(
            topRect
        );

        app.dataset.tripListState =
            "open";

        tripLogButton.inert = false;

        window.dispatchEvent(
            new CustomEvent(
                "wmof:trip-list-request",
                {
                    detail: {
                        open: true,
                        source
                    }
                }
            )
        );

        return true;
    }

    async function closeTripList(source = "button") {
        if (!tripLogButton || getTripListState() !== "open") {
            return false;
        }

        const pinned = tripLogIsPinned();
        const topRect = getTripLogTopRect();

        setFloatingTripLogRect(
            topRect
        );

        app.dataset.tripListState =
            "closing";

        tripLogButton.inert = true;
        tripLogButton.setAttribute("aria-expanded", "false");

        window.dispatchEvent(
            new CustomEvent(
                "wmof:trip-list-closing",
                {
                    detail: {
                        open: false,
                        source,
                        pinned
                    }
                }
            )
        );

        if (pinned) {
            const destination =
                getTripLogBottomRect();

            await animateTripLogButton(
                "translateY(0px)",
                `translateY(${destination.top - topRect.top}px)`
            );

            setFloatingTripLogRect(
                destination
            );
        }
        else {
            const distance =
                topRect.top +
                topRect.height +
                8;

            await animateTripLogButton(
                "translateY(0px)",
                `translateY(-${distance}px)`
            );
        }

        app.dataset.tripListState =
            "closed";

        clearFloatingTripLogRect();

        setTripLogPinned(
            pinned,
            { persist: false }
        );

        window.dispatchEvent(
            new CustomEvent(
                "wmof:trip-list-closed",
                {
                    detail: {
                        open: false,
                        source,
                        pinned
                    }
                }
            )
        );

        return true;
    }

    function toggleTripList(source = "button") {
        const state = getTripListState();

        if (state === "closed") {
            return openTripList(source);
        }

        if (state === "open") {
            return closeTripList(source);
        }

        return Promise.resolve(false);
    }

    function getStoredJSON(key, fallback) {
'''
js = replace_once(js, insert_anchor, insert_block, 'Trip List state machine')
js = replace_once(
    js,
    '''    tripListMenuButton?.addEventListener(
        "click",
        () => {
            mainMenu?.hidePopover?.();

            window.dispatchEvent(
                new CustomEvent(
                    "wmof:trip-list-request"
                )
            );
        }
    );
''',
    '''    tripListMenuButton?.addEventListener(
        "click",
        () => {
            mainMenu?.hidePopover?.();
            void openTripList("menu");
        }
    );

    tripLogButton?.addEventListener(
        "click",
        () => {
            void toggleTripList("button");
        }
    );
''',
    'Trip List click handlers'
)
js = replace_once(
    js,
    '''    const graphicalSettings = getGraphicalSettings();
    const tripPreferences = getTripPreferences();
    setTripLogPinned(
''',
    '''    const graphicalSettings = getGraphicalSettings();
    const tripPreferences = getTripPreferences();
    app.dataset.tripListState = "closed";
    tripLogButton?.setAttribute("aria-expanded", "false");
    setTripLogPinned(
''',
    'Trip List initial state'
)
js_path.write_text(js.rstrip() + '\n')
