from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


# TemporalFormat.js: make date formats genuinely format-driven instead of
# requiring year + month + numeric day as a fixed schema.
path = Path("TemporalFormat.js")
text = path.read_text()
old = '''        const hasYear =
            dateTokens.includes("yy") ||
            dateTokens.includes("yyyy");

        const hasMonth =
            dateTokens.includes("M") ||
            dateTokens.includes("MM") ||
            dateTokens.includes("MMM") ||
            dateTokens.includes("MMMM");

        const hasDay =
            dateTokens.includes("d") ||
            dateTokens.includes("dd");

        const hasDate =
            hasYear &&
            hasMonth &&
            hasDay;
'''
new = '''        const hasDate =
            dateTokens.length > 0;
'''
text = replace_once(text, old, new, "TemporalFormat getFormatType date detection")
old = '''        const hasYear =
            tokens.includes("yy") ||
            tokens.includes("yyyy");

        const hasMonth =
            tokens.includes("M") ||
            tokens.includes("MM") ||
            tokens.includes("MMM") ||
            tokens.includes("MMMM");

        const hasDay =
            tokens.includes("d") ||
            tokens.includes("dd");

        return (
            hasYear &&
            hasMonth &&
            hasDay
        )
            ? text
            : undefined;
'''
new = '''        return tokens.length > 0
            ? text
            : undefined;
'''
text = replace_once(text, old, new, "TemporalFormat normalizeDateFormat")
path.write_text(text)


# ClockTimer.js: an absent/blank/invalid date format hides the date instead of
# silently falling back to another format. Preserve the exact valid format.
path = Path("ClockTimer.js")
text = path.read_text()
old = '''        static #DEFAULT_DATE_FORMAT =
            "yyyy-mm-dd";

'''
text = replace_once(text, old, "", "ClockTimer default date format")
old = '''        #normalizeDateFormat(
            format
        ) {
            if (typeof format !== "string") {
                return undefined;
            }

            const translated =
                format.trim().replace(
                    /m{1,4}/g,
                    token =>
                        "M".repeat(
                            token.length
                        )
                );

            return TemporalFormat.isDateFormat(
                translated
            )
                ? translated
                : undefined;
        }

        #getDateFormat() {
            return (
                this.#normalizeDateFormat(
                    this.getAttribute(
                        "date-format"
                    )
                ) ??
                this.#normalizeDateFormat(
                    ClockTimer.#DEFAULT_DATE_FORMAT
                )
            );
        }
'''
new = '''        #normalizeDateFormat(
            format
        ) {
            if (typeof format !== "string") {
                return undefined;
            }

            const text =
                format.trim();

            if (!text) {
                return undefined;
            }

            return TemporalFormat.normalizeDateFormat(
                text
            );
        }

        #getDateFormat() {
            return this.#normalizeDateFormat(
                this.getAttribute(
                    "date-format"
                )
            );
        }
'''
text = replace_once(text, old, new, "ClockTimer date format normalization")
old = '''            const dateVisible =
                this.hasAttribute(
                    "date-format"
                );

            this.#dateElement.hidden =
                !dateVisible;

            this.#dateElement.textContent =
                dateVisible
                    ? (
                        TemporalFormat.formatDate(
                            now,
                            this.#getDateFormat()
                        ) ??
                        ""
                    )
                    : "";
'''
new = '''            const dateFormat =
                this.#getDateFormat();

            const dateVisible =
                dateFormat !== undefined;

            this.#dateElement.hidden =
                !dateVisible;

            this.#dateElement.textContent =
                dateVisible
                    ? (
                        TemporalFormat.formatDate(
                            now,
                            dateFormat
                        ) ??
                        ""
                    )
                    : "";
'''
text = replace_once(text, old, new, "ClockTimer date display")
path.write_text(text)


# index.html: Trip List menu row + pin control, and clarify date help.
path = Path("index.html")
text = path.read_text()
text = replace_once(
    text,
    '<main id="app" class="app is-offline" data-state="offline" data-trip-state="ready" data-trip-grayscale-ramp="250">',
    '<main id="app" class="app is-offline" data-state="offline" data-trip-state="ready" data-trip-log-pinned="true" data-trip-grayscale-ramp="250">',
    "app trip log pinned state"
)
old = '''        <nav id="mainMenu" class="main-menu" popover aria-label="Application menu">
            <button id="profileMenuButton" type="button" data-dialog="profileDialog" hidden>Profile</button>
            <button type="button" data-dialog="stateSettingsDialog">Trip Preferences</button>
            <button type="button" data-dialog="graphicalSettingsDialog">Clock Graphical Settings</button>
            <hr>
            <button id="authButton" type="button">Login</button>
        </nav>
'''
new = '''        <nav id="mainMenu" class="main-menu" popover aria-label="Application menu">
            <button id="profileMenuButton" type="button" data-dialog="profileDialog" hidden>Profile</button>
            <button type="button" data-dialog="stateSettingsDialog">Trip Preferences</button>
            <button type="button" data-dialog="graphicalSettingsDialog">Clock Graphical Settings</button>
            <div class="main-menu-row trip-list-menu-row">
                <button id="tripListMenuButton" class="trip-list-menu-button" type="button">Trip List</button>
                <button id="tripLogPinButton" class="menu-pin-button" type="button" aria-label="Unpin Trip Log" aria-pressed="true" title="Unpin Trip Log"></button>
            </div>
            <hr>
            <button id="authButton" type="button">Login</button>
        </nav>
'''
text = replace_once(text, old, new, "Trip List menu row")
old = '''        <p><strong>Leave this field blank if you don’t want the date shown.</strong> When you use a date format, it must include a year, month, and numeric day.</p>
'''
new = '''        <p><strong>Leave this field blank if you don’t want the date shown.</strong> Otherwise, combine any of the date tokens below in the order you want.</p>
'''
text = replace_once(text, old, new, "date help blank guidance")
path.write_text(text)


# app.css: animate the Trip Log row out/in, reclaim its grid height, grow the
# clock into the freed area, and style the Trip List/pin menu controls.
path = Path("app.css")
text = path.read_text()
old = '''.app {
    width: 100vw;
    height: 100dvh;
    margin: 0;
    padding: 0.125in;
    display: grid;
    grid-template-rows: 52px 142px 62px 29px 122px 1fr 74px;
    background: linear-gradient(180deg, var(--wm-blue-dark) 0%, var(--wm-blue-mid) 25%, var(--wm-blue) 55%, var(--wm-blue-mid) 100%);
    overflow: hidden;
    transition: filter var(--app-grayscale-ramp, 2000ms) linear;
}
'''
new = '''.app {
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
'''
text = replace_once(text, old, new, "app grid rows")
old = '''.app[data-trip-state="running"] {
    grid-template-rows: 52px 142px 122px 0 122px 1fr 74px;
}
'''
new = '''.app[data-trip-state="running"] {
    grid-template-rows: 52px 142px 122px 0 122px 1fr var(--trip-log-row-height);
}
'''
text = replace_once(text, old, new, "running grid rows")
old = '''.clock-region {
    min-height: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
}
'''
new = '''.clock-region {
    min-height: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
    container-type: size;
}
'''
text = replace_once(text, old, new, "clock region container")
old = '''clock-timer {
    width: 56vw;
    height: 56vw;
    display: block;
'''
new = '''clock-timer {
    width: 56vw;
    height: 56vw;
    display: block;
'''
# Keep the generic preview/default rule untouched; add a stronger home-clock rule.
if old not in text:
    raise RuntimeError("clock-timer base rule not found")
insert_after = '''    --clock-timer-border-color: var(--wm-blue-dark);
}
'''
addition = '''    --clock-timer-border-color: var(--wm-blue-dark);
}

.clock-region > #clockTimer {
    width: min(var(--home-clock-preferred-size), 100cqw, 100cqh);
    height: min(var(--home-clock-preferred-size), 100cqw, 100cqh);
    transition:
        width 1000ms ease-in-out,
        height 1000ms ease-in-out;
}
'''
text = replace_once(text, insert_after, addition, "home clock sizing")
old = '''.trip-log-button {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 3px solid #000;
    border-radius: 14px;
    color: var(--wm-white);
    background: var(--wm-gray);
    font-size: 48px;
    font-weight: 700;
}
'''
new = '''.trip-log-button {
    width: 100%;
    height: 74px;
    margin: 0;
    padding: 0;
    align-self: start;
    border: 3px solid #000;
    border-radius: 14px;
    color: var(--wm-white);
    background: var(--wm-gray);
    font-size: 48px;
    font-weight: 700;
    transform: translateY(0);
    transition: transform 1000ms ease-in-out;
    will-change: transform;
}

.app[data-trip-log-pinned="false"] .trip-log-button {
    transform: translateY(calc(100% + 0.125in));
    pointer-events: none;
}
'''
text = replace_once(text, old, new, "Trip Log slide animation")
anchor = '''.main-menu button[hidden] {
    display: none;
}

'''
menu_css = '''.main-menu button[hidden] {
    display: none;
}

.main-menu-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 58px;
    align-items: stretch;
}

.main-menu .main-menu-row > button {
    min-width: 0;
}

.main-menu .menu-pin-button {
    width: 58px;
    padding: 0;
    justify-content: center;
    gap: 0;
    color: rgb(255 255 255 / 70%);
}

.main-menu .menu-pin-button[aria-pressed="true"] {
    color: #8bd5ff;
}

'''
text = replace_once(text, anchor, menu_css, "main menu row layout")
anchor = '''#profileMenuButton::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='7' r='4' fill='black'/%3E%3Cpath d='M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8H4Z' fill='black'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='7' r='4' fill='black'/%3E%3Cpath d='M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8H4Z' fill='black'/%3E%3C/svg%3E");
}

'''
icons = anchor + '''#tripListMenuButton::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='4' y='3' width='16' height='18' rx='2' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M8 8h8M8 12h8M8 16h8' fill='none' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='4' y='3' width='16' height='18' rx='2' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M8 8h8M8 12h8M8 16h8' fill='none' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");
}

#tripLogPinButton::before {
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M9 3h6l-1 5 3 3v2h-4v8l-1 1-1-1v-8H7v-2l3-3-1-5Z' fill='black'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M9 3h6l-1 5 3 3v2h-4v8l-1 1-1-1v-8H7v-2l3-3-1-5Z' fill='black'/%3E%3C/svg%3E");
    transform: rotate(45deg);
    transform-origin: center;
    opacity: 0.72;
    transition:
        transform 250ms ease-in-out,
        opacity 250ms linear;
}

#tripLogPinButton[aria-pressed="true"]::before {
    transform: rotate(0deg);
    opacity: 1;
}

'''
text = replace_once(text, anchor, icons, "Trip List and pin icons")
path.write_text(text)


# app.js: persist and apply the pin state, keep menu text and pin actions
# separate, and expose a deferred Trip List request event.
path = Path("app.js")
text = path.read_text()
old = '''        graphicalSettings: "wmof.clock.graphicalSettings",
        tripPreferences: "wmof.clock.tripPreferences"
'''
new = '''        graphicalSettings: "wmof.clock.graphicalSettings",
        tripPreferences: "wmof.clock.tripPreferences",
        tripLogPinned: "wmof.clock.tripLogPinned"
'''
text = replace_once(text, old, new, "Trip Log storage key")
old = '''    const mainMenu = $("#mainMenu");
    const activeTripControls = $("#activeTripControls");
'''
new = '''    const mainMenu = $("#mainMenu");
    const tripListMenuButton = $("#tripListMenuButton");
    const tripLogPinButton = $("#tripLogPinButton");
    const tripLogButton = $("#tripLogButton");
    const activeTripControls = $("#activeTripControls");
'''
text = replace_once(text, old, new, "Trip List DOM references")
anchor = '''    function safeStorageSet(key, value) {
        try { localStorage.setItem(key, value); }
        catch {}
    }

'''
functions = anchor + '''    function tripLogIsPinned() {
        return app.dataset.tripLogPinned !== "false";
    }

    function getStoredTripLogPinned() {
        return safeStorageGet(STORAGE.tripLogPinned) !== "false";
    }

    function setTripLogPinned(value, { persist = true } = {}) {
        const pinned = value !== false;

        app.dataset.tripLogPinned = String(pinned);

        tripLogPinButton?.setAttribute(
            "aria-pressed",
            String(pinned)
        );

        if (tripLogPinButton) {
            const label = pinned
                ? "Unpin Trip Log"
                : "Pin Trip Log";

            tripLogPinButton.setAttribute(
                "aria-label",
                label
            );

            tripLogPinButton.title =
                label;
        }

        if (tripLogButton) {
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

        if (persist) {
            safeStorageSet(
                STORAGE.tripLogPinned,
                String(pinned)
            );
        }

        return pinned;
    }

'''
text = replace_once(text, anchor, functions, "Trip Log pin helpers")
anchor = '''    document.querySelectorAll("[data-dialog]").forEach(button => {
'''
events = '''    tripLogPinButton?.addEventListener(
        "click",
        event => {
            event.preventDefault();
            event.stopPropagation();

            setTripLogPinned(
                !tripLogIsPinned()
            );
        }
    );

    tripListMenuButton?.addEventListener(
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

''' + anchor
text = replace_once(text, anchor, events, "Trip List menu handlers")
old = '''    const graphicalSettings = getGraphicalSettings();
    const tripPreferences = getTripPreferences();
    applyGraphicalSettings(graphicalSettings);
'''
new = '''    const graphicalSettings = getGraphicalSettings();
    const tripPreferences = getTripPreferences();
    setTripLogPinned(
        getStoredTripLogPinned(),
        { persist: false }
    );
    applyGraphicalSettings(graphicalSettings);
'''
text = replace_once(text, old, new, "Trip Log pin startup")
path.write_text(text)
