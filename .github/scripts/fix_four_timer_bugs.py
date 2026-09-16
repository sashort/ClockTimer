from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)


# 1 + 4: graphical time controls stay mutually consistent; clock face toggles both radial types.
path = Path("app.js")
app = path.read_text()

old = '''    function syncTimeFormatForMilitaryToggle(form) {
        const control = form.elements.timeFormat;
        const current = String(control.value || "").trim();
        const military = form.elements.militaryTime.checked;
        const militaryDefaults = new Set(["HHmm", "HHmmss"]);
        const standardDefaults = new Set(["h:mm AM/PM", "h:mm:ss AM/PM"]);
        if (military) {
            if (!current || standardDefaults.has(current)) control.value = "HHmm";
        }
        else if (!current || militaryDefaults.has(current)) {
            control.value = "h:mm AM/PM";
        }
    }
'''
new = '''    function getGraphicalTimeFormatType(value) {
        const format = String(value || "").trim();
        if (!format || typeof TemporalFormat === "undefined") {
            return undefined;
        }

        const formatType =
            TemporalFormat.getFormatType(
                format
            );

        return formatType?.type === "time"
            ? formatType["time-type"]
            : undefined;
    }

    function syncTimeFormatForMilitaryToggle(form) {
        const control = form.elements.timeFormat;
        const current = String(control.value || "").trim();
        const military = form.elements.militaryTime.checked;
        const formatType = getGraphicalTimeFormatType(current);
        const conflict = military
            ? formatType !== "military"
            : formatType !== "12-hour";

        if (!current || conflict) {
            const includesSeconds = /s/i.test(current);
            control.value = military
                ? (includesSeconds ? "HHmmss" : "HHmm")
                : (includesSeconds ? "h:mm:ss AM/PM" : "h:mm AM/PM");
        }
    }

    function syncMilitaryToggleForTimeFormat(form) {
        const formatType = getGraphicalTimeFormatType(
            form.elements.timeFormat.value
        );

        if (formatType === "military") {
            form.elements.militaryTime.checked = true;
        }
        else if (formatType === "12-hour") {
            form.elements.militaryTime.checked = false;
        }
    }
'''
app = replace_once(app, old, new, "graphical time sync helpers")

old = '''    function fillGraphicalForm(settings) {
        const form = $("#graphicalSettingsForm");
        for (const [key, value] of Object.entries(settings)) {
            const control = form.elements[key];
            if (!control) continue;
            if (control.type === "checkbox") control.checked = Boolean(value);
            else control.value = value;
        }
        applyGraphicalSettings(settings, clockPreview);
    }
'''
new = '''    function fillGraphicalForm(settings) {
        const form = $("#graphicalSettingsForm");
        for (const [key, value] of Object.entries(settings)) {
            const control = form.elements[key];
            if (!control) continue;
            if (control.type === "checkbox") control.checked = Boolean(value);
            else control.value = value;
        }
        syncTimeFormatForMilitaryToggle(form);
        applyGraphicalSettings(
            settingsFromForm(form),
            clockPreview
        );
    }
'''
app = replace_once(app, old, new, "normalize graphical form on fill")

old = '''    clockTimer.addEventListener("pointerdown", () => {
        if (clockTimer.getAttribute("timer-type") !== "radial-overflow") return;
        clockTimer.setAttribute("timer-type", "radial-fitted");
        const settings = getGraphicalSettings();
        settings.timerType = "radial-fitted";
        saveGraphicalSettings(settings);
    });
'''
new = '''    clockTimer.addEventListener("pointerdown", () => {
        const current =
            clockTimer.getAttribute("timer-type") === "radial-fitted"
                ? "radial-fitted"
                : "radial-overflow";

        const next =
            current === "radial-overflow"
                ? "radial-fitted"
                : "radial-overflow";

        clockTimer.setAttribute(
            "timer-type",
            next
        );

        const settings = getGraphicalSettings();
        settings.timerType = next;
        saveGraphicalSettings(settings);
    });
'''
app = replace_once(app, old, new, "reversible timer type click")

old = '''    $("#graphicalSettingsForm").addEventListener("input", event => {
        if (event.target.name === "militaryTime") syncTimeFormatForMilitaryToggle(event.currentTarget);
        if (event.target.matches("input, select")) applyGraphicalSettings(settingsFromForm(event.currentTarget), clockPreview);
    });

    $("#graphicalSettingsForm").addEventListener("submit", event => {
        event.preventDefault();
        const settings = settingsFromForm(event.currentTarget);
'''
new = '''    $("#graphicalSettingsForm").addEventListener("input", event => {
        const form = event.currentTarget;

        if (event.target.name === "militaryTime") {
            syncTimeFormatForMilitaryToggle(form);
        }
        else if (event.target.name === "timeFormat") {
            syncMilitaryToggleForTimeFormat(form);
        }

        if (event.target.matches("input, select")) {
            applyGraphicalSettings(
                settingsFromForm(form),
                clockPreview
            );
        }
    });

    $("#graphicalSettingsForm").addEventListener("submit", event => {
        event.preventDefault();
        const form = event.currentTarget;
        syncMilitaryToggleForTimeFormat(form);
        syncTimeFormatForMilitaryToggle(form);
        const settings = settingsFromForm(form);
'''
app = replace_once(app, old, new, "reciprocal graphical settings input")
path.write_text(app)


# 2 + 3: complementary whole-second remaining display and non-growing
# radial-overflow pending interval ranges.
path = Path("ClockTimer.js")
clock = path.read_text()

old = '''        #formatSignedRenderedDuration(
            milliseconds
        ) {
            if (!Number.isFinite(milliseconds)) {
                return undefined;
            }

            const rounded =
                Math.round(
                    milliseconds
                );

            const formatted =
                TemporalFormat.formatDuration(
                    Math.abs(
                        rounded
                    )
                );

            if (formatted === undefined) {
                return undefined;
            }

            return rounded < 0
                ? `-${formatted}`
                : formatted;
        }

        #calculateRenderedTime(
'''
new = '''        #formatSignedRenderedDuration(
            milliseconds
        ) {
            if (!Number.isFinite(milliseconds)) {
                return undefined;
            }

            const rounded =
                Math.round(
                    milliseconds
                );

            const formatted =
                TemporalFormat.formatDuration(
                    Math.abs(
                        rounded
                    )
                );

            if (formatted === undefined) {
                return undefined;
            }

            return rounded < 0
                ? `-${formatted}`
                : formatted;
        }

        #formatRemainingRenderedDuration(
            milliseconds
        ) {
            if (!Number.isFinite(milliseconds)) {
                return undefined;
            }

            // Elapsed time truncates to the completed whole second. Remaining
            // time uses the complementary ceiling so the two displays agree at
            // whole-second precision and never expose interval milliseconds.
            const rounded =
                Math.ceil(
                    milliseconds /
                    1000
                ) *
                1000;

            const formatted =
                TemporalFormat.formatDuration(
                    Math.abs(
                        rounded
                    )
                );

            if (formatted === undefined) {
                return undefined;
            }

            if (rounded < 0) {
                return `-${formatted}`;
            }

            if (rounded > 0) {
                return `⁺${formatted}`;
            }

            return formatted;
        }

        #calculateRenderedTime(
'''
clock = replace_once(clock, old, new, "remaining formatter")

old = '''            return mode === "elapsed"
                ? this.#formatElapsedRenderedDuration(
                    milliseconds
                )
                : this.#formatSignedRenderedDuration(
                    milliseconds
                );
'''
new = '''            return mode === "elapsed"
                ? this.#formatElapsedRenderedDuration(
                    milliseconds
                )
                : this.#formatRemainingRenderedDuration(
                    milliseconds
                );
'''
clock = replace_once(clock, old, new, "clock-face remaining formatter")

old = '''            else {
                renderedTime = this.#formatSignedRenderedDuration(remainingMilliseconds);
            }
'''
new = '''            else {
                renderedTime = this.#formatRemainingRenderedDuration(
                    remainingMilliseconds
                );
            }
'''
clock = replace_once(clock, old, new, "total-summary remaining formatter")

old = '''            this.#syncOpenEndedRangeElements(
                record,
                now
            );

            this.#refreshRingLayout(
'''
new = '''            if (
                this.#getTimerType() !==
                    "radial-overflow"
            ) {
                this.#syncOpenEndedRangeElements(
                    record,
                    now
                );
            }

            this.#refreshRingLayout(
'''
clock = replace_once(clock, old, new, "radial-overflow open interval growth")
path.write_text(clock)
