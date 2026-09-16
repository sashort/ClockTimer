from pathlib import Path

path = Path("app.js")
text = path.read_text()
old = '''    function getTripPreferences() {\n        const stored = getStoredJSON(STORAGE.tripPreferences, TRIP_PREFERENCE_DEFAULTS);\n        const legacy = stored.intervalElapsedBehavior === "rollover"\n            ? "autoRestartTrip"\n            : "showLateWindow";\n        return {\n            lateBreakBehavior: stored.lateBreakBehavior === "autoRestartTrip"\n                ? "autoRestartTrip"\n                : stored.lateBreakBehavior === "showLateWindow"\n                    ? "showLateWindow"\n                    : legacy,\n            matchTripGoalToTotal: Boolean(stored.matchTripGoalToTotal)\n        };\n    }'''
new = '''    function getTripPreferences() {\n        let stored = {};\n        try {\n            stored = JSON.parse(safeStorageGet(STORAGE.tripPreferences) || "{}");\n        }\n        catch {}\n\n        const lateBreakBehavior = stored.lateBreakBehavior === "autoRestartTrip"\n            ? "autoRestartTrip"\n            : stored.lateBreakBehavior === "showLateWindow"\n                ? "showLateWindow"\n                : stored.intervalElapsedBehavior === "rollover"\n                    ? "autoRestartTrip"\n                    : TRIP_PREFERENCE_DEFAULTS.lateBreakBehavior;\n\n        return {\n            lateBreakBehavior,\n            matchTripGoalToTotal: Boolean(\n                stored.matchTripGoalToTotal ??\n                TRIP_PREFERENCE_DEFAULTS.matchTripGoalToTotal\n            )\n        };\n    }'''
if text.count(old) != 1:
    raise SystemExit(f"expected one getTripPreferences block, found {text.count(old)}")
path.write_text(text.replace(old, new, 1))
