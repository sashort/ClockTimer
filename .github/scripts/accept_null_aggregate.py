from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match in {path}, found {count}")
    p.write_text(text.replace(old, new, 1))

replace_once(
    "ClockTimer.js",
    '''        get hasAggregateTrips() {\n            return Boolean(\n                this.#hasUsableAggregateSnapshot() &&\n                this.#tripTotals.tripCount > 0 &&\n                this.#tripTotals.standardTimeMilliseconds > 0 &&\n                this.#tripTotals.actualTimeMilliseconds > 0\n            );\n        }\n\n        get autoSyncTripGoal() {''',
    '''        get hasAggregateData() {\n            return this.#hasUsableAggregateSnapshot();\n        }\n\n        get hasAggregateTrips() {\n            return Boolean(\n                this.#hasUsableAggregateSnapshot() &&\n                this.#tripTotals.tripCount > 0 &&\n                this.#tripTotals.standardTimeMilliseconds > 0 &&\n                this.#tripTotals.actualTimeMilliseconds > 0\n            );\n        }\n\n        get autoSyncTripGoal() {''',
    "aggregate data getter",
)

replace_once(
    "app.js",
    '        const aggregateGoalAvailable = clockTimer.hasAggregateTrips === true;',
    '        const aggregateGoalAvailable = clockTimer.hasAggregateData === true;',
    "trip settings aggregate availability",
)
