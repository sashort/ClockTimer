from pathlib import Path

INDEX = Path("index.html")
APP_JS = Path("app.js")
APP_CSS = Path("app.css")

html = INDEX.read_text()

anchor = '''                <div class="settings-groups">
                    <fieldset>
                        <legend>Time Display</legend>'''
replacement = '''                <div class="settings-groups">
                    <fieldset class="timer-settings-fieldset">
                        <legend>Timer Settings</legend>
                        <label>Timer Mode
                            <select name="timerMode">
                                <option value="elapsed">Elapsed</option>
                                <option value="remaining">Remaining</option>
                            </select>
                        </label>
                        <label>Timer Type
                            <select name="timerType">
                                <option value="radial-overflow">Radial Overflow</option>
                                <option value="radial-fitted">Radial Fitted</option>
                            </select>
                        </label>

                        <hr class="timer-settings-divider">

                        <div class="timer-color-grid">
                            <div class="timer-color-row">
                                <label for="tripColor">Trip</label>
                                <input id="tripColor" name="tripColor" type="color" value="#0053e2">
                            </div>
                            <div class="timer-color-row">
                                <label for="breakColor">Break</label>
                                <input id="breakColor" name="breakColor" type="color" value="#ffc420">
                            </div>
                            <div class="timer-color-row">
                                <label for="lunchColor">Lunch</label>
                                <input id="lunchColor" name="lunchColor" type="color" value="#f59e0b">
                            </div>
                            <div class="timer-color-row">
                                <label for="downColor">Down</label>
                                <input id="downColor" name="downColor" type="color" value="#2e7d32">
                            </div>
                            <div class="timer-color-row with-toggle">
                                <label for="toleranceColor">Tolerance</label>
                                <input id="toleranceColor" name="toleranceColor" type="color" value="#5f6772">
                                <input name="showTolerance" type="checkbox" checked aria-label="Show Tolerance">
                            </div>
                            <div class="timer-color-row with-toggle">
                                <label for="latencyColor">Latency</label>
                                <input id="latencyColor" name="latencyColor" type="color" value="#e1251b">
                                <input name="showLatency" type="checkbox" checked aria-label="Show Latency">
                            </div>
                        </div>
                    </fieldset>

                    <fieldset>
                        <legend>Time Display</legend>'''
if anchor not in html:
    raise SystemExit("settings-groups insertion anchor not found")
html = html.replace(anchor, replacement, 1)

old_show = '''                        <label>Border Width<input name="borderWidth" value="5px"></label>
                        <label class="toggle-row">Show Tolerance<input name="showTolerance" type="checkbox" checked></label>'''
new_show = '''                        <label>Border Width<input name="borderWidth" value="5px"></label>'''
if old_show not in html:
    raise SystemExit("Show Tolerance anchor not found")
html = html.replace(old_show, new_show, 1)

old_additional = '''
                    <fieldset class="advanced-graphical-settings">
                        <legend>Additional Display</legend>
                        <label>Timer Type
                            <select name="timerType">
                                <option value="radial-overflow">Radial Overflow</option>
                                <option value="radial-fitted">Radial Fitted</option>
                            </select>
                        </label>
                        <label>Timer Mode
                            <select name="timerMode">
                                <option value="elapsed">Elapsed</option>
                                <option value="remaining">Remaining</option>
                            </select>
                        </label>
                    </fieldset>
'''
if old_additional not in html:
    raise SystemExit("Additional Display fieldset anchor not found")
html = html.replace(old_additional, "\n", 1)
INDEX.write_text(html)

js = APP_JS.read_text()

if 'const GRAPHICAL_SETTINGS_VERSION = 4;' not in js:
    raise SystemExit("graphical settings version anchor not found")
js = js.replace('const GRAPHICAL_SETTINGS_VERSION = 4;', 'const GRAPHICAL_SETTINGS_VERSION = 5;', 1)

old_defaults = '''        timerType: "radial-overflow",
        timerMode: "elapsed",
        showTolerance: true,
        militaryTime: true,'''
new_defaults = '''        timerType: "radial-overflow",
        timerMode: "elapsed",
        tripColor: "#0053e2",
        breakColor: "#ffc420",
        lunchColor: "#f59e0b",
        downColor: "#2e7d32",
        toleranceColor: "#5f6772",
        latencyColor: "#e1251b",
        showTolerance: true,
        showLatency: true,
        militaryTime: true,'''
if old_defaults not in js:
    raise SystemExit("graphical defaults anchor not found")
js = js.replace(old_defaults, new_defaults, 1)

old_apply = '''        setOptionalAttribute(target, "indicator-symbol", settings.indicatorSymbol);
        target.removeAttribute("grayscale");
        target.removeAttribute("grayscale-ramp");
        target.showTolerance = Boolean(settings.showTolerance);

        const variables = {
            "--clock-timer-hour-hand-length": settings.hourHandLength,'''
new_apply = '''        setOptionalAttribute(target, "indicator-symbol", settings.indicatorSymbol);
        target.removeAttribute("grayscale");
        target.removeAttribute("grayscale-ramp");
        target.showTolerance = Boolean(settings.showTolerance);
        target.toggleAttribute("hide-latency", !Boolean(settings.showLatency));

        const variables = {
            "--clock-timer-trip-color": settings.tripColor,
            "--clock-timer-break-color": settings.breakColor,
            "--clock-timer-lunch-color": settings.lunchColor,
            "--clock-timer-down-color": settings.downColor,
            "--clock-timer-tolerance-color": settings.toleranceColor,
            "--clock-timer-latency-color": settings.latencyColor,
            "--clock-timer-hour-hand-length": settings.hourHandLength,'''
if old_apply not in js:
    raise SystemExit("apply graphical settings anchor not found")
js = js.replace(old_apply, new_apply, 1)

old_form = '''            timerType: text("timerType"),
            timerMode: text("timerMode"),
            showTolerance: form.elements.showTolerance.checked,
            militaryTime: form.elements.militaryTime.checked,'''
new_form = '''            timerType: text("timerType"),
            timerMode: text("timerMode"),
            tripColor: text("tripColor"),
            breakColor: text("breakColor"),
            lunchColor: text("lunchColor"),
            downColor: text("downColor"),
            toleranceColor: text("toleranceColor"),
            latencyColor: text("latencyColor"),
            showTolerance: form.elements.showTolerance.checked,
            showLatency: form.elements.showLatency.checked,
            militaryTime: form.elements.militaryTime.checked,'''
if old_form not in js:
    raise SystemExit("settingsFromForm anchor not found")
js = js.replace(old_form, new_form, 1)
APP_JS.write_text(js)

css = APP_CSS.read_text()
marker = "/* timer-settings-v1 */"
if marker in css:
    raise SystemExit("timer settings CSS already present")
css += r'''

/* timer-settings-v1 */
.timer-settings-divider {
    width: 100%;
    height: 1px;
    margin: 2px 0 4px;
    border: 0;
    background: linear-gradient(
        90deg,
        transparent,
        rgb(255 255 255 / 55%) 14%,
        rgb(255 255 255 / 55%) 86%,
        transparent
    );
}

.timer-color-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 14px;
}

.timer-color-row {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 68px;
    gap: 10px;
    align-items: center;
}

.timer-color-row.with-toggle {
    grid-template-columns: minmax(0, 1fr) 68px 28px;
}

.app-dialog .timer-color-row > label {
    display: block;
    min-width: 0;
}

.app-dialog .timer-color-row > input[type="color"] {
    width: 68px;
    min-width: 68px;
    min-height: 38px;
    padding: 3px;
}

.app-dialog .timer-color-row > input[type="checkbox"] {
    width: 24px;
    height: 24px;
    margin: 0;
    padding: 0;
    justify-self: center;
}

clock-timer time-range[type="trip"] {
    background: var(--clock-timer-trip-color, #0053e2);
}

clock-timer time-range[type="break"] {
    background: var(--clock-timer-break-color, #ffc420);
}

clock-timer time-range[type="lunch"] {
    background: var(--clock-timer-lunch-color, #f59e0b);
}

clock-timer time-range[type="down"] {
    background: var(--clock-timer-down-color, #2e7d32);
}

clock-timer time-range[type="tolerance"] {
    background: var(--clock-timer-tolerance-color, #5f6772);
}

clock-timer time-range[type="latency"] {
    background: var(--clock-timer-latency-color, #e1251b);
}

clock-timer[hide-latency] time-range[type="latency"] {
    display: none !important;
}

@media (max-width: 560px) {
    .timer-color-grid {
        grid-template-columns: 1fr;
    }
}
'''
APP_CSS.write_text(css)
