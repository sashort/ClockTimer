from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


# index.html
index_path = Path("index.html")
index = index_path.read_text(encoding="utf-8")
index = replace_once(
    index,
    '<h2>Trip Settings</h2>',
    '<h2 id="tripSettingsTitle">Edit Trip Settings</h2>',
    "trip settings title"
)

section_match = re.search(
    r'(?P<open>\s*<section class="trip-settings-times" aria-label="Trip times">)(?P<body>.*?)(?P<close>\s*</section>)',
    index,
    re.S,
)
if not section_match:
    raise RuntimeError("trip settings times section not found")

body = section_match.group("body")
articles = {}
for field in ("standard-time", "scheduled-start", "actual-start", "creation-time"):
    match = re.search(
        rf'\n(?P<article>\s*<article class="trip-time-row" data-trip-time-row="{re.escape(field)}">.*?</article>)',
        body,
        re.S,
    )
    if not match:
        raise RuntimeError(f"trip settings article {field} not found")
    articles[field] = match.group("article")

new_body = "\n" + "\n".join(
    articles[field].lstrip("\n")
    for field in ("standard-time", "scheduled-start", "actual-start", "creation-time")
) + "\n            "
index = index[:section_match.start("body")] + new_body + index[section_match.end("body"):]

fieldset_pattern = re.compile(
    r'\s*<fieldset class="trip-settings-behavior">.*?</fieldset>',
    re.S,
)
fieldset_replacement = '''
            <fieldset class="trip-settings-behavior">
                <legend>Options</legend>
                <label class="toggle-row">Match Trip Goal to Total<input name="autoSyncTripGoal" type="checkbox"></label>
            </fieldset>'''
index, count = fieldset_pattern.subn(fieldset_replacement, index, count=1)
if count != 1:
    raise RuntimeError(f"trip settings options fieldset: expected one replacement, found {count}")
index_path.write_text(index, encoding="utf-8")


# ClockTimer.js
clock_path = Path("ClockTimer.js")
clock = clock_path.read_text(encoding="utf-8")
clock = replace_once(
    clock,
    '''        get autoSyncTripGoal() {
            return this.#autoSyncTripGoal;
        }
''',
    '''        get hasAggregateTrips() {
            return Boolean(
                this.#hasUsableAggregateSnapshot() &&
                this.#tripTotals.tripCount > 0 &&
                this.#tripTotals.standardTimeMilliseconds > 0 &&
                this.#tripTotals.actualTimeMilliseconds > 0
            );
        }

        get autoSyncTripGoal() {
            return this.#autoSyncTripGoal;
        }
''',
    "aggregate availability getter"
)
clock_path.write_text(clock, encoding="utf-8")


# app.js
app_path = Path("app.js")
app = app_path.read_text(encoding="utf-8")
app = replace_once(
    app,
    '''    const tripSettingsDialog = $("#tripSettingsDialog");
    const tripSettingsForm = $("#tripSettingsForm");
    const tripSettingsPrimary = $("#tripSettingsPrimary");
''',
    '''    const tripSettingsDialog = $("#tripSettingsDialog");
    const tripSettingsForm = $("#tripSettingsForm");
    const tripSettingsTitle = $("#tripSettingsTitle");
    const tripSettingsPrimary = $("#tripSettingsPrimary");
''',
    "trip settings title reference"
)
app = replace_once(
    app,
    '''        tripSettingsForm.elements.intervalElapsedBehavior.value = clockTimer.intervalElapsedBehavior;
        tripSettingsForm.elements.autoSyncTripGoal.checked = clockTimer.autoSyncTripGoal;
        tripSettingsPrimary.textContent = draft ? "Start Trip" : "Save";
''',
    '''        tripSettingsTitle.textContent = draft ? "New Trip Settings" : "Edit Trip Settings";
        const autoSyncTripGoal = tripSettingsForm.elements.autoSyncTripGoal;
        const aggregateGoalAvailable = clockTimer.hasAggregateTrips === true;
        if (!aggregateGoalAvailable && clockTimer.autoSyncTripGoal) {
            clockTimer.autoSyncTripGoal = false;
        }
        autoSyncTripGoal.disabled = !aggregateGoalAvailable;
        autoSyncTripGoal.checked = aggregateGoalAvailable && clockTimer.autoSyncTripGoal;
        tripSettingsPrimary.textContent = draft ? "Start Trip" : "Save";
''',
    "trip settings refresh options"
)
app = replace_once(
    app,
    '''    tripSettingsForm.addEventListener("submit", event => {
        event.preventDefault();
        const form = event.currentTarget;
        clockTimer.intervalElapsedBehavior = form.elements.intervalElapsedBehavior.value;
        clockTimer.autoSyncTripGoal = form.elements.autoSyncTripGoal.checked;
''',
    '''    tripSettingsForm.addEventListener("submit", event => {
        event.preventDefault();
        const form = event.currentTarget;
        clockTimer.autoSyncTripGoal =
            !form.elements.autoSyncTripGoal.disabled &&
            form.elements.autoSyncTripGoal.checked;
''',
    "trip settings submit options"
)
app_path.write_text(app, encoding="utf-8")
