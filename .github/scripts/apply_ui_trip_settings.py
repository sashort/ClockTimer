from pathlib import Path
import re


def replace_once(text, old, new, label):
    if old not in text:
        raise AssertionError(f"missing anchor: {label}")
    return text.replace(old, new, 1)


def find_matching_brace(text, open_index):
    depth = 0
    quote = None
    escape = False
    template_depth = 0
    i = open_index
    while i < len(text):
        ch = text[i]
        if quote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif quote == "`" and ch == "$" and i + 1 < len(text) and text[i + 1] == "{":
                # We only use this for ordinary method bodies; template expressions may contain braces.
                depth += 1
                template_depth += 1
                i += 1
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ('"', "'", "`"):
            quote = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if template_depth and depth >= 1:
                template_depth -= 1
            elif depth == 0:
                return i
        i += 1
    raise AssertionError("unmatched brace")


def instrument_setter(text, property_name):
    marker = f"        set {property_name}(value) {{"
    start = text.find(marker)
    if start < 0:
        raise AssertionError(f"missing setter {property_name}")
    open_index = text.find("{", start)
    close_index = find_matching_brace(text, open_index)
    body = text[open_index + 1:close_index]
    if f'"{property_name}Changing"' in body:
        return text
    prelude = f'''\n            const previousValue =\n                this.{property_name};\n\n            if (\n                !this.#emitClockTimerEvent(\n                    "{property_name}Changing",\n                    {{\n                        previousValue,\n                        value\n                    }},\n                    {{ cancelable: true }}\n                )\n            ) {{\n                return;\n            }}\n'''
    epilogue = f'''\n\n            const currentValue =\n                this.{property_name};\n\n            if (currentValue !== previousValue) {{\n                this.#emitClockTimerEvent(\n                    "{property_name}Changed",\n                    {{\n                        previousValue,\n                        value: currentValue,\n                        summary:\n                            this.#buildSummarySnapshot(\n                                new Date()\n                            )\n                    }}\n                );\n            }}\n        '''
    text = text[:open_index + 1] + prelude + body + epilogue + text[close_index:]
    return text


# ClockTimer: add a calendar-date override that does not disturb the real-time timeline anchor.
clock = Path("ClockTimer.js")
ct = clock.read_text(encoding="utf-8")
ct = replace_once(
    ct,
    "        #startedAtEpoch;\n\n        #ringAnchor;",
    "        #startedAtEpoch;\n\n        #creationDateOverride;\n\n        #ringAnchor;",
    "creation date private field",
)
ct = replace_once(
    ct,
    "        #getJSONCreationDate() {\n            if (\n                !Number.isFinite(\n                    this.#startedAtEpoch\n                )\n            ) {\n                return undefined;\n            }",
    "        #getJSONCreationDate() {\n            if (\n                this.#creationDateOverride instanceof Date &&\n                !Number.isNaN(\n                    this.#creationDateOverride.getTime()\n                )\n            ) {\n                return new Date(\n                    this.#creationDateOverride.getTime()\n                );\n            }\n\n            if (\n                !Number.isFinite(\n                    this.#startedAtEpoch\n                )\n            ) {\n                return undefined;\n            }",
    "creation date getter override",
)
creation_getter = '''        get creationDate() {\n            return this.#formatJSONDate(\n                this.#getJSONCreationDate()\n            );\n        }\n'''
creation_setter = creation_getter + '''\n        set creationDate(value) {\n            if (!this.#hasStartProperties()) {\n                return;\n            }\n\n            let next;\n\n            if (value instanceof Date) {\n                if (Number.isNaN(value.getTime())) {\n                    return;\n                }\n                next = new Date(\n                    value.getFullYear(),\n                    value.getMonth(),\n                    value.getDate()\n                );\n            }\n            else if (typeof value === "string") {\n                const match =\n                    value.trim().match(\n                        /^(\\d{4})-(\\d{2})-(\\d{2})$/\n                    );\n\n                if (!match) {\n                    return;\n                }\n\n                next = new Date(\n                    Number(match[1]),\n                    Number(match[2]) - 1,\n                    Number(match[3])\n                );\n\n                if (\n                    next.getFullYear() !== Number(match[1]) ||\n                    next.getMonth() !== Number(match[2]) - 1 ||\n                    next.getDate() !== Number(match[3])\n                ) {\n                    return;\n                }\n            }\n            else {\n                return;\n            }\n\n            const previousValue =\n                this.creationDate;\n\n            const nextValue =\n                this.#formatJSONDate(next);\n\n            if (nextValue === previousValue) {\n                return;\n            }\n\n            if (\n                !this.#emitClockTimerEvent(\n                    "creationDateChanging",\n                    {\n                        previousValue,\n                        value: nextValue\n                    },\n                    { cancelable: true }\n                )\n            ) {\n                return;\n            }\n\n            this.#creationDateOverride =\n                next;\n\n            this.#emitClockTimerEvent(\n                "creationDateChanged",\n                {\n                    previousValue,\n                    value: nextValue,\n                    summary:\n                        this.#buildSummarySnapshot(\n                            new Date()\n                        )\n                }\n            );\n        }\n'''
ct = replace_once(ct, creation_getter, creation_setter, "creationDate setter")
ct = replace_once(
    ct,
    "            this.#startedAtEpoch =\n                Date.now();",
    "            this.#creationDateOverride =\n                undefined;\n\n            this.#startedAtEpoch =\n                Date.now();",
    "start creation date reset",
)
ct = replace_once(
    ct,
    "            this.#startedAtEpoch =\n                undefined;",
    "            this.#startedAtEpoch =\n                undefined;\n\n            this.#creationDateOverride =\n                undefined;",
    "clear creation date reset",
)
for property_name in ("creationTime", "scheduledStart", "startTime"):
    ct = instrument_setter(ct, property_name)
clock.write_text(ct, encoding="utf-8")


# Number pad fragment: context header, absolute-time date row and AM/PM controls.
numberpad = Path("numberpad.html")
numberpad.write_text('''<dialog id="numberPadDialog" class="number-pad-dialog" aria-label="Number pad">\n    <section class="number-pad-shell">\n        <div id="numberPadContext" class="number-pad-context">Standard Time</div>\n        <div class="number-pad-header">\n            <div id="numberPadReadout" class="number-pad-readout">\n                <output id="numberPadDisplay" class="number-pad-display" aria-live="polite"></output>\n                <button id="numberPadAM" class="number-pad-meridiem number-pad-am" type="button" data-meridiem="AM" aria-label="AM">AM</button>\n                <label id="numberPadDateRow" class="number-pad-date-row">\n                    <span class="number-pad-calendar-icon" aria-hidden="true"></span>\n                    <input id="numberPadDate" type="date" aria-label="Date">\n                </label>\n                <button id="numberPadPM" class="number-pad-meridiem number-pad-pm" type="button" data-meridiem="PM" aria-label="PM">PM</button>\n            </div>\n            <button id="numberPadSettings" class="number-pad-settings" type="button" aria-label="Trip settings" data-persistence="offline">\n                <span class="number-pad-settings-gear" aria-hidden="true"></span>\n                <span class="number-pad-persistence-badge" aria-hidden="true"></span>\n            </button>\n        </div>\n        <div id="numberPadGrid" class="number-pad-grid">\n            <button class="number-pad-key" type="button" data-number="1">1</button>\n            <button class="number-pad-key" type="button" data-number="2">2</button>\n            <button class="number-pad-key" type="button" data-number="3">3</button>\n            <button class="number-pad-key" type="button" data-number="4">4</button>\n            <button class="number-pad-key" type="button" data-number="5">5</button>\n            <button class="number-pad-key" type="button" data-number="6">6</button>\n            <button class="number-pad-key" type="button" data-number="7">7</button>\n            <button class="number-pad-key" type="button" data-number="8">8</button>\n            <button class="number-pad-key" type="button" data-number="9">9</button>\n            <button id="numberPadClear" class="number-pad-key number-pad-clear" type="button" aria-label="Close" data-action="close"></button>\n            <button class="number-pad-key" type="button" data-number="0">0</button>\n            <button id="numberPadConfirm" class="number-pad-key number-pad-confirm" type="button" aria-label="Confirm" data-action="confirm"></button>\n        </div>\n    </section>\n</dialog>\n''', encoding="utf-8")


# Trip settings modal.
index = Path("index.html")
html = index.read_text(encoding="utf-8")
trip_modal = '''    <dialog id="tripSettingsDialog" class="app-dialog trip-settings-dialog">\n        <form id="tripSettingsForm" method="dialog">\n            <header class="dialog-header">\n                <h2>Trip Settings</h2>\n                <button class="dialog-close" type="button" data-close-dialog aria-label="Close">×</button>\n            </header>\n\n            <section class="trip-settings-times" aria-label="Trip times">\n                <article class="trip-time-row" data-trip-time-row="creation-time">\n                    <div class="trip-time-copy">\n                        <strong>Creation Time</strong>\n                        <span>When the trip was created.</span>\n                    </div>\n                    <output id="tripCreationTime" class="trip-time-value">---</output>\n                    <button class="trip-time-edit" type="button" data-trip-time-field="creation-time" aria-label="Edit creation time"><span aria-hidden="true"></span></button>\n                </article>\n                <article class="trip-time-row" data-trip-time-row="scheduled-start">\n                    <div class="trip-time-copy">\n                        <strong>Scheduled Start</strong>\n                        <span>Planned start time.</span>\n                    </div>\n                    <output id="tripScheduledStart" class="trip-time-value">---</output>\n                    <button class="trip-time-edit" type="button" data-trip-time-field="scheduled-start" aria-label="Edit scheduled start"><span aria-hidden="true"></span></button>\n                </article>\n                <article class="trip-time-row" data-trip-time-row="actual-start">\n                    <div class="trip-time-copy">\n                        <strong>Actual Start</strong>\n                        <span>When the trip actually started.</span>\n                    </div>\n                    <output id="tripActualStart" class="trip-time-value">---</output>\n                    <button class="trip-time-edit" type="button" data-trip-time-field="actual-start" aria-label="Edit actual start"><span aria-hidden="true"></span></button>\n                </article>\n                <article class="trip-time-row" data-trip-time-row="standard-time">\n                    <div class="trip-time-copy">\n                        <strong>Standard Time</strong>\n                        <span>Expected duration.</span>\n                    </div>\n                    <output id="tripStandardTime" class="trip-time-value">---</output>\n                    <button class="trip-time-edit" type="button" data-trip-time-field="standard-time" aria-label="Edit standard time"><span aria-hidden="true"></span></button>\n                </article>\n            </section>\n\n            <fieldset class="trip-settings-behavior">\n                <legend>Interval Behavior</legend>\n                <label>When an interval elapses\n                    <select name="intervalElapsedBehavior">\n                        <option value="startLatency">Start Latency</option>\n                        <option value="extendBoundary">Keep Boundary Open</option>\n                        <option value="extendInterval">Extend Interval Only</option>\n                    </select>\n                </label>\n                <label class="toggle-row">Auto Sync Trip Goal<input name="autoSyncTripGoal" type="checkbox"></label>\n            </fieldset>\n\n            <div class="dialog-actions two-actions">\n                <button type="button" data-close-dialog>Cancel</button>\n                <button class="primary-action" type="submit" value="save">Save</button>\n            </div>\n        </form>\n    </dialog>\n\n'''
html = replace_once(
    html,
    '    <dialog id="breakDialog" class="app-dialog break-dialog">',
    trip_modal + '    <dialog id="breakDialog" class="app-dialog break-dialog">',
    "trip settings modal insertion",
)
index.write_text(html, encoding="utf-8")


# App JS: wire the new modal and replace the number-pad controller in one cohesive block.
app = Path("app.js")
js = app.read_text(encoding="utf-8")
js = replace_once(
    js,
    '    const breakDialog = $("#breakDialog");',
    '    const breakDialog = $("#breakDialog");\n    const tripSettingsDialog = $("#tripSettingsDialog");\n    const tripSettingsForm = $("#tripSettingsForm");',
    "trip settings references",
)
js = replace_once(
    js,
    '    let numberPadConfirm;\n    let numberPadLongPressTimer;',
    '    let numberPadConfirm;\n    let numberPadContext;\n    let numberPadReadout;\n    let numberPadDate;\n    let numberPadDateRow;\n    let numberPadAM;\n    let numberPadPM;\n    let numberPadClosedState;\n    let tripSettingsOpenAfterPadClose = false;\n    const tripSettingsPadStack = [];\n    let tripSettingsOpeningEditor = false;\n    let numberPadLongPressTimer;',
    "numberpad variables",
)

start = js.find("    async function ensureNumberPadLoaded() {")
end = js.find("    function renderIndependentTimer() {", start)
if start < 0 or end < 0:
    raise AssertionError("numberpad controller anchors not found")

controller = r'''    async function ensureNumberPadLoaded() {
        if (numberPadDialog?.isConnected) return;
        if (!numberPadLoadPromise) {
            numberPadLoadPromise = (async () => {
                const response = await fetch("numberpad.html", { cache: "no-store" });
                if (!response.ok) throw new Error(`Unable to load number pad (${response.status}).`);
                const template = document.createElement("template");
                template.innerHTML = (await response.text()).trim();
                document.body.append(template.content.cloneNode(true));
                numberPadDialog = $("#numberPadDialog");
                numberPadDisplay = $("#numberPadDisplay");
                numberPadSettings = $("#numberPadSettings");
                numberPadClear = $("#numberPadClear");
                numberPadConfirm = $("#numberPadConfirm");
                numberPadContext = $("#numberPadContext");
                numberPadReadout = $("#numberPadReadout");
                numberPadDate = $("#numberPadDate");
                numberPadDateRow = $("#numberPadDateRow");
                numberPadAM = $("#numberPadAM");
                numberPadPM = $("#numberPadPM");
                bindNumberPadEvents();
            })().catch(error => {
                numberPadLoadPromise = undefined;
                throw error;
            });
        }
        await numberPadLoadPromise;
    }

    function normalizeTimeDigits(value) {
        const text = String(value || "").trim();
        if (!text) return "";
        const match = text.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
        if (!match) return "";
        const hours = match[1] || "";
        const minutes = match[2];
        const seconds = match[3];
        return hours ? `${hours}${minutes.padStart(2, "0")}${seconds}` : `${minutes}${seconds}`;
    }

    function parseTimelineTime(value) {
        const text = String(value || "").trim();
        const match = text.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
        if (!match) return undefined;
        const hours = Number(match[1] || 0);
        const minutes = Number(match[2]);
        const seconds = Number(match[3]);
        const milliseconds = Number(String(match[4] || "0").padEnd(3, "0"));
        if (![hours, minutes, seconds, milliseconds].every(Number.isFinite)) return undefined;
        if (minutes > 59 || seconds > 59) return undefined;
        return (((hours * 60) + minutes) * 60 + seconds) * 1000 + milliseconds;
    }

    function splitTimeDigits(raw) {
        if (!/^\d+$/.test(raw)) return undefined;
        const secondsText = raw.slice(-2).padStart(2, "0");
        if (raw.length <= 2) return { hoursText: "", minutesText: "0", secondsText };
        if (raw.length <= 4) return {
            hoursText: "",
            minutesText: raw.slice(0, -2) || "0",
            secondsText
        };
        return {
            hoursText: raw.slice(0, -4).replace(/^0+(?=\d)/, "") || "0",
            minutesText: raw.slice(-4, -2),
            secondsText
        };
    }

    function renderTimeDigits(raw) {
        const parts = splitTimeDigits(raw);
        if (!parts) return "";
        return parts.hoursText
            ? `${parts.hoursText}:${parts.minutesText.padStart(2, "0")}:${parts.secondsText}`
            : `${Number(parts.minutesText)}:${parts.secondsText}`;
    }

    function timeDigitsValid(raw) {
        const parts = splitTimeDigits(raw);
        if (!parts) return false;
        return Number(parts.minutesText) < 60 && Number(parts.secondsText) < 60;
    }

    function autocorrectTimeDigits(raw) {
        const parts = splitTimeDigits(raw);
        if (!parts) return raw;
        const totalSeconds =
            Number(parts.hoursText || 0) * 3600 +
            Number(parts.minutesText) * 60 +
            Number(parts.secondsText);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return hours > 0
            ? `${hours}${String(minutes).padStart(2, "0")}${String(seconds).padStart(2, "0")}`
            : `${minutes}${String(seconds).padStart(2, "0")}`;
    }

    function splitAbsoluteDigits(raw) {
        if (!/^\d+$/.test(raw)) return undefined;
        if (raw.length <= 2) {
            return { hour: Number(raw), minute: 0, second: 0 };
        }
        if (raw.length <= 4) {
            return {
                hour: Number(raw.slice(0, -2)),
                minute: Number(raw.slice(-2)),
                second: 0
            };
        }
        return {
            hour: Number(raw.slice(0, -4)),
            minute: Number(raw.slice(-4, -2)),
            second: Number(raw.slice(-2))
        };
    }

    function absoluteDigits(hour, minute, second) {
        return `${Number(hour)}${String(minute).padStart(2, "0")}${String(second).padStart(2, "0")}`;
    }

    function absoluteDigitsValid(raw, meridiem) {
        const parts = splitAbsoluteDigits(raw);
        if (!parts) return false;
        if (parts.minute > 59 || parts.second > 59) return false;
        return meridiem ? parts.hour >= 1 && parts.hour <= 12 : parts.hour >= 0 && parts.hour <= 23;
    }

    function renderAbsoluteDigits(raw) {
        const parts = splitAbsoluteDigits(raw);
        if (!parts) return "";
        return `${parts.hour}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`;
    }

    function formatDateInput(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
        const pad = value => String(value).padStart(2, "0");
        return `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function parseDateInput(value) {
        const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return undefined;
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        if (
            date.getFullYear() !== Number(match[1]) ||
            date.getMonth() !== Number(match[2]) - 1 ||
            date.getDate() !== Number(match[3])
        ) return undefined;
        return date;
    }

    function shiftDateInput(value, days) {
        const date = parseDateInput(value);
        if (!date || !Number.isFinite(days)) return value;
        date.setDate(date.getDate() + days);
        return formatDateInput(date);
    }

    function getTripBaseDate() {
        return parseDateInput(clockTimer.creationDate) || new Date(new Date().setHours(0, 0, 0, 0));
    }

    function getAbsolutePadInitial(value) {
        const milliseconds = parseTimelineTime(value);
        const base = getTripBaseDate();
        const date = new Date(base.getTime() + (Number.isFinite(milliseconds) ? milliseconds : 0));
        const hour24 = date.getHours();
        const military = clockTimer.getAttribute("military-time") !== "false";
        const meridiem = military ? null : (hour24 >= 12 ? "PM" : "AM");
        const displayHour = meridiem ? (hour24 % 12 || 12) : hour24;
        return {
            digits: absoluteDigits(displayHour, date.getMinutes(), date.getSeconds()),
            date: formatDateInput(date),
            meridiem
        };
    }

    function absoluteHour24(state) {
        const parts = splitAbsoluteDigits(state.pending);
        if (!parts) return undefined;
        if (state.meridiem === "AM") return parts.hour === 12 ? 0 : parts.hour;
        if (state.meridiem === "PM") return parts.hour === 12 ? 12 : parts.hour + 12;
        return parts.hour;
    }

    function absoluteTimelineMilliseconds(state, { creation = false } = {}) {
        if (!absoluteDigitsValid(state.pending, state.meridiem)) return undefined;
        const date = parseDateInput(state.pendingDate);
        if (!date) return undefined;
        const hour = absoluteHour24(state);
        if (!Number.isFinite(hour)) return undefined;
        const parts = splitAbsoluteDigits(state.pending);
        const timeMilliseconds = ((hour * 60 + parts.minute) * 60 + parts.second) * 1000;
        if (creation) return timeMilliseconds;
        const base = getTripBaseDate();
        const dayMilliseconds = date.getTime() - base.getTime();
        const result = dayMilliseconds + timeMilliseconds;
        return result >= 0 ? result : undefined;
    }

    function formatTimelineMilliseconds(milliseconds) {
        if (!Number.isFinite(milliseconds) || milliseconds < 0) return undefined;
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    function autocorrectAbsoluteState(state) {
        const parts = splitAbsoluteDigits(state.pending);
        if (!parts) return;
        let hour24;
        if (state.meridiem === "AM") hour24 = parts.hour % 12;
        else if (state.meridiem === "PM") hour24 = (parts.hour % 12) + 12;
        else hour24 = parts.hour;
        let totalSeconds = hour24 * 3600 + parts.minute * 60 + parts.second;
        const dayOffset = Math.floor(totalSeconds / 86400);
        totalSeconds = ((totalSeconds % 86400) + 86400) % 86400;
        const correctedHour24 = Math.floor(totalSeconds / 3600);
        const minute = Math.floor((totalSeconds % 3600) / 60);
        const second = totalSeconds % 60;
        state.pendingDate = shiftDateInput(state.pendingDate, dayOffset);
        if (state.meridiem) {
            state.meridiem = correctedHour24 >= 12 ? "PM" : "AM";
            state.pending = absoluteDigits(correctedHour24 % 12 || 12, minute, second);
        }
        else {
            state.pending = absoluteDigits(correctedHour24, minute, second);
        }
    }

    function normalizePercentDigits(value) {
        const match = String(value || "").trim().match(/^(\d+)(?:%)?$/);
        return match ? String(Number(match[1])) : "";
    }

    function getNumberPadTitle(source) {
        const titles = {
            "new-trip": "Start Time",
            "standard-time": "Standard Time",
            "creation-time": "Creation Time",
            "scheduled-start": "Scheduled Start",
            "actual-start": "Actual Start"
        };
        if (source === "percent-goal") {
            return clockTimer.percentMode === "total" ? "Total Percent" : "Trip Percent";
        }
        return titles[source] || "Number Pad";
    }

    function numberPadValueValid() {
        if (!numberPadState || !numberPadState.pending) return false;
        if (numberPadState.mode === "percent") {
            return Number.isInteger(Number(numberPadState.pending)) && Number(numberPadState.pending) > 0;
        }
        if (numberPadState.mode === "absolute") {
            return Boolean(numberPadState.pendingDate) && absoluteDigitsValid(numberPadState.pending, numberPadState.meridiem);
        }
        return timeDigitsValid(numberPadState.pending);
    }

    function numberPadHasChanges() {
        if (!numberPadState) return false;
        return numberPadState.pending !== numberPadState.initial ||
            numberPadState.pendingDate !== numberPadState.initialDate ||
            numberPadState.meridiem !== numberPadState.initialMeridiem;
    }

    function getNumberPadClearAction() {
        if (!numberPadState) return "close";
        return numberPadHasChanges() ? "reset" : "close";
    }

    function refreshNumberPad() {
        if (!numberPadState || !numberPadDialog) return;
        const percentMode = numberPadState.mode === "percent";
        const absoluteMode = numberPadState.mode === "absolute";
        numberPadContext.textContent = numberPadState.title;
        numberPadReadout.classList.toggle("absolute-mode", absoluteMode);
        numberPadDisplay.textContent = percentMode
            ? (numberPadState.pending ? `${Number(numberPadState.pending)}%` : "")
            : absoluteMode
                ? (numberPadState.pending ? renderAbsoluteDigits(numberPadState.pending) : "")
                : (numberPadState.pending ? renderTimeDigits(numberPadState.pending) : "");

        numberPadDateRow.hidden = !absoluteMode;
        numberPadAM.hidden = !absoluteMode;
        numberPadPM.hidden = !absoluteMode;
        if (absoluteMode) {
            numberPadDate.value = numberPadState.pendingDate || "";
            numberPadAM.classList.toggle("is-selected", numberPadState.meridiem === "AM");
            numberPadPM.classList.toggle("is-selected", numberPadState.meridiem === "PM");
            numberPadAM.setAttribute("aria-pressed", String(numberPadState.meridiem === "AM"));
            numberPadPM.setAttribute("aria-pressed", String(numberPadState.meridiem === "PM"));
        }

        const changed = numberPadHasChanges();
        const clearAction = getNumberPadClearAction();
        numberPadClear.dataset.action = clearAction;
        numberPadClear.setAttribute("aria-label", clearAction === "reset" ? "Reset" : "Close");

        const valid = numberPadValueValid();
        const autocorrect = changed && !percentMode && numberPadState.pending !== "" && !valid;
        numberPadConfirm.dataset.action = autocorrect ? "autocorrect" : "confirm";
        numberPadConfirm.setAttribute("aria-label", autocorrect ? "Auto-Correct" : "Confirm");
        numberPadConfirm.disabled = !changed || (!autocorrect && !valid);

        numberPadSettings.hidden = percentMode;
        if (!percentMode) {
            numberPadSettings.dataset.persistence = numberPadState.persistence || (clockTimer.connected ? "online" : "offline");
            numberPadSettings.setAttribute(
                "aria-label",
                numberPadSettings.dataset.persistence === "pending"
                    ? "Trip settings; trip persistence pending"
                    : numberPadSettings.dataset.persistence === "online"
                        ? "Trip settings; trip persisted online"
                        : "Trip settings; trip local and not persisted"
            );
        }
    }

    async function openNumberPad({ mode, source, initialValue = "", preparationPromise, returnToTripSettings = false } = {}) {
        await ensureNumberPadLoaded();
        const normalizedMode = mode === "percent" ? "percent" : mode === "absolute" ? "absolute" : "duration";
        let initial;
        let initialDate;
        let initialMeridiem;
        if (normalizedMode === "absolute") {
            const absolute = getAbsolutePadInitial(initialValue);
            initial = absolute.digits;
            initialDate = absolute.date;
            initialMeridiem = absolute.meridiem;
        }
        else {
            initial = normalizedMode === "percent"
                ? normalizePercentDigits(initialValue)
                : normalizeTimeDigits(initialValue);
        }
        const state = {
            mode: normalizedMode,
            source,
            title: getNumberPadTitle(source),
            initial,
            pending: initial,
            initialDate,
            pendingDate: initialDate,
            initialMeridiem,
            meridiem: initialMeridiem,
            replaceOnNextDigit: source !== "new-trip",
            persistence: source === "new-trip"
                ? (clockTimer.connected ? "pending" : "offline")
                : (clockTimer.connected ? "online" : "offline"),
            returnToTripSettings
        };
        numberPadState = state;
        refreshNumberPad();
        mainMenu?.hidePopover?.();
        if (!numberPadDialog.open) {
            openDialogElement(numberPadDialog, {
                duration: 250,
                reason: `number-pad:${source}`
            });
        }

        if (preparationPromise) {
            Promise.resolve(preparationPromise).then(result => {
                if (numberPadState !== state) return;
                state.persistence = result?.persisted ? "online" : "offline";
                refreshNumberPad();
            }).catch(() => {
                if (numberPadState !== state) return;
                state.persistence = "offline";
                refreshNumberPad();
            });
        }
    }

    async function restoreNumberPadState(snapshot) {
        if (!snapshot) return;
        await ensureNumberPadLoaded();
        numberPadState = { ...snapshot };
        refreshNumberPad();
        if (!numberPadDialog.open) {
            openDialogElement(numberPadDialog, {
                duration: 250,
                reason: "trip-settings-return"
            });
        }
    }

    function resetNumberPad() {
        clearTimeout(numberPadLongPressTimer);
        numberPadLongPressTimer = undefined;
        numberPadLongPressed = false;
        numberPadLastClearPointerDown = 0;
        numberPadState = undefined;
        if (numberPadDisplay) numberPadDisplay.textContent = "";
        if (numberPadContext) numberPadContext.textContent = "Number Pad";
        if (numberPadDate) numberPadDate.value = "";
        if (numberPadClear) {
            numberPadClear.dataset.action = "close";
            numberPadClear.setAttribute("aria-label", "Close");
        }
        if (numberPadConfirm) {
            numberPadConfirm.dataset.action = "confirm";
            numberPadConfirm.setAttribute("aria-label", "Confirm");
            numberPadConfirm.disabled = true;
        }
    }

    function closeNumberPad({ discardPrepared = true, allowChanged = false, suppressReturn = false } = {}) {
        const state = numberPadState;
        if (!allowChanged && numberPadHasChanges()) return false;
        if (numberPadDialog?.open && !closeDialog(numberPadDialog, { reason: "number-pad" })) {
            return false;
        }
        numberPadClosedState = suppressReturn && state ? { ...state, returnToTripSettings: false } : state;
        resetNumberPad();
        if (discardPrepared && state?.source === "new-trip") {
            clockTimer.discardPreparedTrip?.().catch?.(() => {});
        }
        return true;
    }

    function requestNumberPadClose() {
        return closeNumberPad();
    }

    function getPercentGoalValue() {
        const attribute = clockTimer.percentMode === "total" ? "total-goal" : "trip-goal";
        const raw = clockTimer.getAttribute(attribute);
        if (raw) return raw;
        const goal = Number(clockTimer.renderedPercentGoal);
        return Number.isFinite(goal) && goal > 0 ? `${Math.round(goal * 100)}%` : "100%";
    }

    async function commitNumberPad() {
        if (!numberPadState || !numberPadHasChanges() || !numberPadValueValid()) return false;
        const state = { ...numberPadState };
        if (state.mode === "percent") {
            const percent = Number(state.pending);
            const attribute = clockTimer.percentMode === "total" ? "total-goal" : "trip-goal";
            clockTimer.setAttribute(attribute, `${percent}%`);
            return true;
        }

        if (state.mode === "absolute") {
            if (state.source === "creation-time") {
                const value = formatTimelineMilliseconds(absoluteTimelineMilliseconds(state, { creation: true }));
                if (!value) return false;
                if (state.pendingDate !== clockTimer.creationDate) {
                    clockTimer.creationDate = state.pendingDate;
                    if (clockTimer.creationDate !== state.pendingDate) return false;
                }
                clockTimer.creationTime = value;
                return clockTimer.creationTime === value;
            }

            const timeline = absoluteTimelineMilliseconds(state);
            const value = formatTimelineMilliseconds(timeline);
            if (!value) return false;
            if (state.source === "scheduled-start") {
                clockTimer.scheduledStart = value;
                return clockTimer.scheduledStart === value;
            }
            if (state.source === "actual-start") {
                clockTimer.startTime = value;
                return clockTimer.startTime === value;
            }
            return false;
        }

        const formatted = renderTimeDigits(state.pending);
        if (!formatted) return false;
        stagedStandardTime = formatted;
        if (state.source === "new-trip") {
            await clockTimer.start({ standardTime: formatted });
        }
        else if (clockTimer.standardTime !== undefined) {
            clockTimer.standardTime = formatted;
            if (clockTimer.standardTime !== formatted) return false;
        }
        return true;
    }

    function resetNumberPadPendingValue() {
        if (!numberPadState) return;
        numberPadState.pending = numberPadState.initial;
        numberPadState.pendingDate = numberPadState.initialDate;
        numberPadState.meridiem = numberPadState.initialMeridiem;
        numberPadState.replaceOnNextDigit = numberPadState.source !== "new-trip";
        refreshNumberPad();
    }

    function runNumberPadClearShortAction() {
        if (!numberPadState) return;
        if (getNumberPadClearAction() === "close") {
            requestNumberPadClose();
            return;
        }
        resetNumberPadPendingValue();
    }

    function changeNumberPadMeridiem(next) {
        if (!numberPadState || numberPadState.mode !== "absolute") return;
        const parts = splitAbsoluteDigits(numberPadState.pending);
        if (!parts) return;
        const previous = numberPadState.meridiem;
        const target = previous === next ? null : next;
        let hour = parts.hour;
        if (previous && !target) {
            hour = previous === "AM"
                ? (hour === 12 ? 0 : hour)
                : (hour === 12 ? 12 : hour + 12);
        }
        else if (!previous && target && hour > 12) {
            hour = hour % 12 || 12;
        }
        numberPadState.meridiem = target;
        numberPadState.pending = absoluteDigits(hour, parts.minute, parts.second);
        numberPadState.replaceOnNextDigit = false;
        refreshNumberPad();
    }

    function formatTripTimeDisplay(value) {
        const milliseconds = parseTimelineTime(value);
        if (!Number.isFinite(milliseconds)) return "---";
        const base = getTripBaseDate();
        const date = new Date(base.getTime() + milliseconds);
        const military = clockTimer.getAttribute("military-time") !== "false";
        const time = military
            ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`
            : `${date.getHours() % 12 || 12}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")} ${date.getHours() >= 12 ? "PM" : "AM"}`;
        const dateText = new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric"
        }).format(date);
        return `${time} · ${dateText}`;
    }

    function refreshTripSettingsValues() {
        const active = clockTimer.status === "running";
        const values = {
            "creation-time": active ? formatTripTimeDisplay(clockTimer.creationTime) : "---",
            "scheduled-start": active ? formatTripTimeDisplay(clockTimer.scheduledStart) : "---",
            "actual-start": active ? formatTripTimeDisplay(clockTimer.startTime) : "---",
            "standard-time": active && clockTimer.standardTime ? clockTimer.standardTime : "---"
        };
        $("#tripCreationTime").textContent = values["creation-time"];
        $("#tripScheduledStart").textContent = values["scheduled-start"];
        $("#tripActualStart").textContent = values["actual-start"];
        $("#tripStandardTime").textContent = values["standard-time"];
        tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {
            button.disabled = !active;
        });
        tripSettingsForm.elements.intervalElapsedBehavior.value = clockTimer.intervalElapsedBehavior;
        tripSettingsForm.elements.autoSyncTripGoal.checked = clockTimer.autoSyncTripGoal;
    }

    function openTripSettingsDialog(reason = "number-pad-settings") {
        refreshTripSettingsValues();
        return openDialogElement(tripSettingsDialog, { duration: 250, reason });
    }

    function getTripFieldValue(field) {
        if (field === "creation-time") return clockTimer.creationTime || "";
        if (field === "scheduled-start") return clockTimer.scheduledStart || "";
        if (field === "actual-start") return clockTimer.startTime || "";
        if (field === "standard-time") return clockTimer.standardTime || "";
        return "";
    }

    function openTripFieldNumberPad(field) {
        if (clockTimer.status !== "running") return Promise.resolve();
        const absolute = field !== "standard-time";
        return openNumberPad({
            mode: absolute ? "absolute" : "time",
            source: field,
            initialValue: getTripFieldValue(field),
            returnToTripSettings: true
        });
    }

    function bindNumberPadEvents() {
        numberPadDialog.querySelectorAll("[data-number]").forEach(button => {
            button.addEventListener("pointerup", () => {
                if (!numberPadState) return;
                if (numberPadState.replaceOnNextDigit) {
                    numberPadState.pending = "";
                    numberPadState.replaceOnNextDigit = false;
                }
                const candidate = numberPadState.pending + button.dataset.number;
                if (numberPadState.mode === "absolute" && candidate.length > 6) return;
                numberPadState.pending = candidate;
                refreshNumberPad();
            });
        });

        [numberPadAM, numberPadPM].forEach(button => {
            button.addEventListener("pointerup", () => changeNumberPadMeridiem(button.dataset.meridiem));
        });

        numberPadDate.addEventListener("input", () => {
            if (!numberPadState || numberPadState.mode !== "absolute") return;
            numberPadState.pendingDate = numberPadDate.value;
            refreshNumberPad();
        });

        numberPadConfirm.addEventListener("pointerup", async () => {
            if (!numberPadState || numberPadConfirm.disabled) return;
            if (numberPadConfirm.dataset.action === "autocorrect") {
                if (numberPadState.mode === "absolute") autocorrectAbsoluteState(numberPadState);
                else numberPadState.pending = autocorrectTimeDigits(numberPadState.pending);
                numberPadState.replaceOnNextDigit = false;
                refreshNumberPad();
                return;
            }
            try {
                if (await commitNumberPad()) closeNumberPad({ discardPrepared: false, allowChanged: true });
            }
            catch {
                if (numberPadState) {
                    numberPadState.persistence = "offline";
                    refreshNumberPad();
                }
            }
        });

        numberPadClear.addEventListener("pointerdown", event => {
            if (!numberPadState || getNumberPadClearAction() !== "reset") return;
            const now = performance.now();
            const doublePress = now - numberPadLastClearPointerDown <= NUMBER_PAD_DOUBLE_PRESS;
            numberPadLastClearPointerDown = now;
            numberPadLongPressed = false;
            numberPadClear.setPointerCapture?.(event.pointerId);
            clearTimeout(numberPadLongPressTimer);
            if (doublePress) {
                numberPadLongPressed = true;
                resetNumberPadPendingValue();
                return;
            }
            numberPadLongPressTimer = setTimeout(() => {
                numberPadLongPressTimer = undefined;
                numberPadLongPressed = true;
                if (!numberPadState) return;
                resetNumberPadPendingValue();
            }, NUMBER_PAD_LONG_PRESS);
        });

        numberPadClear.addEventListener("pointerup", event => {
            if (numberPadClear.hasPointerCapture?.(event.pointerId)) numberPadClear.releasePointerCapture(event.pointerId);
            if (numberPadLongPressTimer !== undefined) {
                clearTimeout(numberPadLongPressTimer);
                numberPadLongPressTimer = undefined;
            }
            if (numberPadLongPressed) {
                numberPadLongPressed = false;
                return;
            }
            runNumberPadClearShortAction();
        });

        numberPadClear.addEventListener("pointercancel", () => {
            clearTimeout(numberPadLongPressTimer);
            numberPadLongPressTimer = undefined;
            numberPadLongPressed = false;
        });

        numberPadClear.addEventListener("click", event => {
            if (event.detail === 0) runNumberPadClearShortAction();
        });

        numberPadSettings.addEventListener("pointerup", () => {
            if (!numberPadState || numberPadState.mode === "percent") return;
            tripSettingsPadStack.push({ ...numberPadState });
            tripSettingsOpenAfterPadClose = true;
            closeNumberPad({ discardPrepared: false, allowChanged: true, suppressReturn: true });
        });

        numberPadDialog.addEventListener("cancel", event => {
            event.preventDefault();
            requestNumberPadClose();
        });

        numberPadDialog.addEventListener("close", () => {
            resetNumberPad();
        });

        numberPadDialog.addEventListener("closed", () => {
            const state = numberPadClosedState;
            numberPadClosedState = undefined;
            if (tripSettingsOpenAfterPadClose) {
                tripSettingsOpenAfterPadClose = false;
                openTripSettingsDialog();
                return;
            }
            if (state?.returnToTripSettings) {
                openTripSettingsDialog("number-pad-return");
            }
        });
    }

    tripSettingsDialog.addEventListener("opening", () => {
        refreshTripSettingsValues();
    });

    tripSettingsDialog.addEventListener("closed", () => {
        if (tripSettingsOpeningEditor) {
            tripSettingsOpeningEditor = false;
            return;
        }
        const snapshot = tripSettingsPadStack.pop();
        if (snapshot) void restoreNumberPadState(snapshot).catch(() => {});
    });

    tripSettingsDialog.querySelectorAll("[data-trip-time-field]").forEach(button => {
        button.addEventListener("pointerup", () => {
            if (button.disabled) return;
            const field = button.dataset.tripTimeField;
            tripSettingsOpeningEditor = true;
            if (!closeDialog(tripSettingsDialog, { reason: `trip-settings:${field}`, immediate: true })) {
                tripSettingsOpeningEditor = false;
                return;
            }
            setTimeout(() => {
                void openTripFieldNumberPad(field).catch(() => {});
            }, 0);
        });
    });

    tripSettingsForm.addEventListener("submit", event => {
        event.preventDefault();
        const form = event.currentTarget;
        clockTimer.intervalElapsedBehavior = form.elements.intervalElapsedBehavior.value;
        clockTimer.autoSyncTripGoal = form.elements.autoSyncTripGoal.checked;
        closeDialog(tripSettingsDialog, { reason: "trip-settings-save" });
    });

    async function beginNewTripWorkflow({ initialValue } = {}) {
        const newTripInitialValue = initialValue ?? (
            clockTimer.status === "stopped"
                ? ""
                : (stagedStandardTime || "")
        );

        let preparationPromise;
        try {
            preparationPromise = Promise.resolve(
                clockTimer.prepareTrip({ timeout: 5000 })
            ).catch(() => ({
                persisted: false,
                pending: true,
                reason: "offline"
            }));
        }
        catch {
            preparationPromise = Promise.resolve({
                persisted: false,
                pending: true,
                reason: "offline"
            });
        }

        return openNumberPad({
            mode: "time",
            source: "new-trip",
            initialValue: newTripInitialValue,
            preparationPromise
        });
    }

    $("#newTripButton").addEventListener("pointerup", () => {
        void beginNewTripWorkflow().catch(() => {});
    });

    $("#endTripButton").addEventListener("pointerup", () => {
        void clockTimer.stop().catch(() => {});
    });

    $("#breakButton").addEventListener("pointerup", () => {
        openDialog("breakDialog", { reason: "break" });
    });

    $("#downButton").addEventListener("pointerup", () => {
        void clockTimer.startInterval("down").catch(() => {});
    });

    $("#standardTimeButton").addEventListener("pointerup", () => {
        void openNumberPad({
            mode: "time",
            source: "standard-time",
            initialValue: clockTimer.standardTime || stagedStandardTime || ""
        }).catch(() => {});
    });

    $("#goalPercentValue").addEventListener("pointerup", () => {
        void openNumberPad({
            mode: "percent",
            source: "percent-goal",
            initialValue: getPercentGoalValue()
        }).catch(() => {});
    });

'''
js = js[:start] + controller + js[end:]

# Refresh UI when trip timing setters complete.
js = replace_once(
    js,
    '        "standardTimeChanged",\n        "intervalStarted",',
    '        "standardTimeChanged",\n        "creationDateChanged",\n        "creationTimeChanged",\n        "scheduledStartChanged",\n        "startTimeChanged",\n        "intervalStarted",',
    "summary timing events",
)
app.write_text(js, encoding="utf-8")


# Cross-UI visual system + numberpad + trip settings styles. Appended overrides intentionally centralize the design language.
css = Path("app.css")
styles = css.read_text(encoding="utf-8")
marker = "/* unified-gradient-ui-v1 */"
if marker not in styles:
    styles += r'''

/* unified-gradient-ui-v1 */
:root {
    --ui-navy-gradient: linear-gradient(145deg, #0d5b99 0%, #073f73 42%, #041e42 100%);
    --ui-blue-gradient: linear-gradient(145deg, #16a6ef 0%, #0071ce 54%, #0053a0 100%);
    --ui-yellow-gradient: linear-gradient(145deg, #ffe35a 0%, #ffc220 52%, #efa900 100%);
    --ui-gray-gradient: linear-gradient(145deg, #667481 0%, #46515c 48%, #29343e 100%);
    --ui-charcoal-gradient: linear-gradient(180deg, #46515c 0%, #2f3943 45%, #202933 100%);
    --ui-green-gradient: linear-gradient(145deg, #42a447 0%, #2e7d32 58%, #1f5e24 100%);
    --ui-border: rgb(255 255 255 / 72%);
    --ui-inner-highlight: inset 0 1px 0 rgb(255 255 255 / 20%);
    --ui-shadow: 0 10px 24px rgb(0 0 0 / 28%);
}

.app-header {
    background: var(--ui-navy-gradient);
    border-bottom: 1px solid rgb(255 255 255 / 22%);
    box-shadow: var(--ui-inner-highlight);
}

.header-button {
    background: transparent;
    border-color: rgb(255 255 255 / 52%);
    box-shadow: var(--ui-inner-highlight);
}

.new-trip-button,
.end-trip-button,
.break-button {
    background: var(--ui-yellow-gradient);
    border-color: rgb(255 255 255 / 38%);
    box-shadow: var(--ui-inner-highlight), 0 5px 12px rgb(0 0 0 / 18%);
}

.down-button {
    background: var(--ui-green-gradient);
    border-color: rgb(255 255 255 / 35%);
    box-shadow: var(--ui-inner-highlight), 0 5px 12px rgb(0 0 0 / 18%);
}

.trip-log-button {
    background: var(--ui-gray-gradient);
    border-color: rgb(255 255 255 / 38%);
    box-shadow: var(--ui-inner-highlight);
}

.independent-timer-value {
    background: var(--ui-navy-gradient);
    border-color: var(--ui-border);
    box-shadow: var(--ui-inner-highlight);
}

.independent-timer-controls {
    background: var(--ui-navy-gradient);
    border-radius: 14px;
    overflow: hidden;
}

.independent-timer-controls button {
    background: transparent;
    border-color: rgb(255 255 255 / 34%);
    box-shadow: var(--ui-inner-highlight);
}

.main-menu {
    background: var(--ui-navy-gradient);
    border-color: var(--ui-border);
    box-shadow: var(--ui-shadow), var(--ui-inner-highlight);
}

.main-menu::after {
    border-bottom-color: #073c6e;
}

.main-menu button:hover,
.main-menu button:focus-visible {
    background: linear-gradient(90deg, rgb(255 255 255 / 13%), rgb(255 255 255 / 4%));
}

.app-dialog {
    padding: 0;
    overflow: hidden;
    border: 1.5px solid rgb(210 232 255 / 86%);
    background: var(--ui-navy-gradient);
    box-shadow: 0 20px 55px rgb(0 0 0 / 48%), var(--ui-inner-highlight);
}

.app-dialog form,
.break-dialog-content {
    gap: 16px;
}

.dialog-header {
    min-height: 64px;
    margin: 0;
    padding: 10px 12px 10px 18px;
    background: linear-gradient(180deg, #1866a6 0%, #0b4f8e 45%, #073765 100%);
    border-bottom: 1px solid rgb(172 220 255 / 58%);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 22%);
}

.dialog-header h2 {
    text-shadow: 0 2px 3px rgb(0 0 0 / 22%);
}

.dialog-close {
    border-radius: 10px;
    background: linear-gradient(145deg, rgb(18 94 157 / 55%), rgb(4 30 66 / 35%));
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 15%);
}

.app-dialog form > :not(.dialog-header),
.break-dialog-content > :not(.dialog-header) {
    margin-inline: 16px;
}

.app-dialog form > .dialog-actions,
.break-dialog-content > :last-child {
    margin-bottom: 16px;
}

.app-dialog fieldset,
.clock-preview {
    border-color: rgb(180 220 255 / 62%);
    background: linear-gradient(145deg, rgb(13 79 132 / 76%), rgb(4 30 66 / 74%));
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 8%);
}

.app-dialog input,
.app-dialog select {
    border-color: rgb(190 224 255 / 78%);
    background: linear-gradient(145deg, rgb(25 77 121 / 92%), rgb(4 30 66 / 90%));
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 10%);
}

.dialog-actions button,
.secondary-action {
    background: var(--ui-navy-gradient);
    border-color: rgb(218 236 255 / 86%);
    box-shadow: var(--ui-inner-highlight), 0 5px 12px rgb(0 0 0 / 18%);
}

.dialog-actions .primary-action {
    color: var(--wm-blue-dark);
    background: var(--ui-yellow-gradient);
    border-color: rgb(255 255 255 / 84%);
}

button:active:not(:disabled) {
    filter: brightness(0.92);
    transform: translateY(1px);
}

/* Trip settings */
.trip-settings-dialog {
    width: min(760px, 94vw);
    max-height: 92dvh;
    overflow: auto;
}

.trip-settings-times {
    display: grid;
    gap: 10px;
}

.trip-time-row {
    display: grid;
    grid-template-columns: minmax(170px, 1fr) minmax(230px, 1.2fr) 54px;
    gap: 12px;
    align-items: center;
}

.trip-time-copy {
    display: grid;
    gap: 3px;
}

.trip-time-copy strong {
    font-size: 18px;
}

.trip-time-copy span {
    color: rgb(255 255 255 / 74%);
    font-size: 13px;
    font-weight: 400;
}

.trip-time-value {
    min-height: 54px;
    padding: 8px 12px;
    display: grid;
    place-items: center;
    border: 1.5px solid rgb(255 255 255 / 82%);
    border-radius: 12px;
    color: var(--wm-blue-dark);
    background: var(--ui-yellow-gradient);
    box-shadow: var(--ui-inner-highlight), 0 5px 12px rgb(0 0 0 / 18%);
    font-size: 18px;
    text-align: center;
}

.trip-time-edit {
    width: 54px;
    height: 54px;
    padding: 0;
    display: grid;
    place-items: center;
    border: 1.5px solid rgb(180 225 255 / 88%);
    border-radius: 12px;
    color: var(--wm-white);
    background: var(--ui-blue-gradient);
    box-shadow: var(--ui-inner-highlight), 0 5px 12px rgb(0 0 0 / 18%);
}

.trip-time-edit span {
    width: 27px;
    height: 27px;
    background: currentColor;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4 20l4.1-1 10.8-10.8a2.1 2.1 0 0 0 0-3l-.1-.1a2.1 2.1 0 0 0-3 0L5 15.9 4 20Z' fill='none' stroke='black' stroke-width='2' stroke-linejoin='round'/%3E%3Cpath d='m14.5 6.4 3.1 3.1M5 15.9l3.1 3.1' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") center / contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4 20l4.1-1 10.8-10.8a2.1 2.1 0 0 0 0-3l-.1-.1a2.1 2.1 0 0 0-3 0L5 15.9 4 20Z' fill='none' stroke='black' stroke-width='2' stroke-linejoin='round'/%3E%3Cpath d='m14.5 6.4 3.1 3.1M5 15.9l3.1 3.1' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") center / contain no-repeat;
}

.trip-time-edit:disabled {
    opacity: 0.38;
    cursor: not-allowed;
}

.trip-settings-behavior {
    margin-top: 2px !important;
}

/* Number pad */
.number-pad-dialog {
    width: min(430px, 94vw);
    overflow: visible;
}

.number-pad-shell {
    border: 1px solid rgb(180 220 255 / 58%);
    border-radius: 15px;
    box-shadow: 0 18px 50px rgb(0 0 0 / 52%), inset 0 1px 0 rgb(255 255 255 / 18%);
}

.number-pad-context {
    min-height: clamp(38px, 11vw, 52px);
    display: grid;
    place-items: center;
    color: var(--wm-white);
    background: var(--ui-charcoal-gradient);
    border-bottom: 1px solid rgb(255 255 255 / 28%);
    font-size: clamp(18px, 5.2vw, 24px);
    font-weight: 700;
    line-height: 1;
    text-align: center;
    text-shadow: 0 2px 3px rgb(0 0 0 / 28%);
}

.number-pad-header {
    aspect-ratio: auto;
    min-height: clamp(128px, 34vw, 154px);
    grid-template-columns: 2fr 1fr;
    background: transparent;
}

.number-pad-readout {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 1fr;
    place-items: center;
    gap: 0;
    padding: 0;
    background: var(--ui-yellow-gradient);
}

.number-pad-readout.absolute-mode {
    grid-template-columns: minmax(0, 1fr) clamp(54px, 16vw, 72px);
    grid-template-rows: 1fr 1fr;
}

.number-pad-display {
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
    padding: 0 8px;
    font-size: clamp(32px, 11vw, 54px);
    cursor: pointer;
}

.number-pad-readout:not(.absolute-mode) .number-pad-display {
    grid-column: 1 / -1;
    grid-row: 1 / -1;
}

.number-pad-meridiem {
    width: clamp(46px, 13vw, 60px);
    aspect-ratio: 1 / 1;
    justify-self: center;
    align-self: center;
    padding: 0;
    border: 4px solid #858585;
    border-radius: 50%;
    color: #6d6d6d;
    background: rgb(255 255 255 / 20%);
    font-size: clamp(13px, 4vw, 18px);
    font-weight: 700;
    box-shadow: inset 0 1px 1px rgb(255 255 255 / 40%);
}

.number-pad-meridiem.is-selected {
    color: #ffbd22;
    background: #747474;
    border-color: #747474;
    box-shadow: 0 7px 13px rgb(0 0 0 / 42%), 0 0 0 2px rgb(255 194 32 / 24%);
}

.number-pad-am { grid-column: 2; grid-row: 1; }
.number-pad-pm { grid-column: 2; grid-row: 2; }

.number-pad-date-row {
    grid-column: 1;
    grid-row: 2;
    width: calc(100% - 18px);
    min-width: 0;
    justify-self: center;
    align-self: center;
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 8px;
    color: var(--wm-blue-dark);
    background: linear-gradient(90deg, rgb(190 137 0 / 12%), rgb(255 255 255 / 10%));
    cursor: pointer;
}

.number-pad-date-row[hidden],
.number-pad-meridiem[hidden] {
    display: none;
}

.number-pad-calendar-icon {
    width: 22px;
    height: 22px;
    background: currentColor;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='3' y='5' width='18' height='16' rx='2' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M7 3v4M17 3v4M3 9h18' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='3' y='5' width='18' height='16' rx='2' fill='none' stroke='black' stroke-width='2'/%3E%3Cpath d='M7 3v4M17 3v4M3 9h18' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;
}

.number-pad-date-row input {
    min-width: 0;
    width: 100%;
    padding: 0;
    border: 0;
    outline: 0;
    color: var(--wm-blue-dark);
    background: transparent;
    font: inherit;
    font-size: clamp(12px, 3.5vw, 16px);
    font-weight: 700;
    cursor: pointer;
}

.number-pad-date-row input::-webkit-calendar-picker-indicator {
    opacity: 0;
    width: 0;
    padding: 0;
    margin: 0;
}

.number-pad-settings {
    border-left: 1px solid rgb(255 255 255 / 28%);
    background: var(--ui-blue-gradient);
    box-shadow: var(--ui-inner-highlight);
}

.number-pad-grid {
    background: var(--ui-navy-gradient);
}

.number-pad-key {
    background: transparent;
    border-color: rgb(164 211 248 / 28%);
    box-shadow: none;
}

.number-pad-confirm {
    background: var(--ui-blue-gradient);
}

.number-pad-key:disabled {
    filter: grayscale(0.28);
}

@media (max-width: 620px) {
    .trip-time-row {
        grid-template-columns: minmax(0, 1fr) 50px;
        gap: 8px;
        padding-top: 4px;
    }

    .trip-time-copy {
        grid-column: 1 / -1;
    }

    .trip-time-value {
        min-height: 50px;
        font-size: 15px;
    }

    .trip-time-edit {
        width: 50px;
        height: 50px;
    }
}
'''
css.write_text(styles, encoding="utf-8")

# Architecture/feature anchors.
assert 'id="tripSettingsDialog"' in html
assert 'data-trip-time-field="creation-time"' in html
assert 'id="numberPadContext"' in numberpad.read_text(encoding="utf-8")
assert 'data-meridiem="AM"' in numberpad.read_text(encoding="utf-8")
assert 'creationDateChanged' in ct
assert 'creationTimeChanging' in ct
assert 'scheduledStartChanging' in ct
assert 'startTimeChanging' in ct
assert 'tripSettingsPadStack' in js
assert 'numberPadReadout.classList.toggle("absolute-mode"' in js
assert marker in styles
