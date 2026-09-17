from pathlib import Path

APP_JS = Path("app.js")
js = APP_JS.read_text()

js = js.replace('    const GRAPHICAL_SETTINGS_VERSION = 8;\n', '', 1)
js = js.replace('        graphicalSettingsVersion: "wmof.clock.graphicalSettingsVersion",\n', '', 1)

old_get = '''    function getGraphicalSettings() {
        const settings = getStoredJSON(STORAGE.graphicalSettings, GRAPHICAL_DEFAULTS);
        const version = Number(safeStorageGet(STORAGE.graphicalSettingsVersion) || 0);

        if (version < GRAPHICAL_SETTINGS_VERSION) {
            delete settings.grayscale;
            delete settings.grayscaleRamp;
            if (!settings.timeFormat || settings.timeFormat === "HHmmss") settings.timeFormat = "HHmm";
            if (!settings.visibleHours) settings.visibleHours = GRAPHICAL_DEFAULTS.visibleHours;
            if (!settings.tickMarks) settings.tickMarks = GRAPHICAL_DEFAULTS.tickMarks;
            if (!settings.indicatorSymbol || settings.indicatorSymbol === "↑") settings.indicatorSymbol = GRAPHICAL_DEFAULTS.indicatorSymbol;
            if (!settings.borderWidth || settings.borderWidth === "7px") settings.borderWidth = GRAPHICAL_DEFAULTS.borderWidth;
            if (version <= 6) {
                if (settings.breakColor === "#ffc420") settings.breakColor = "#001e60";
                if (settings.lunchColor === "#f59e0b") settings.lunchColor = "#ffc420";
                if (settings.downColor === "#2e7d32") settings.downColor = "#5f6772";
                if (settings.toleranceColor === "#5f6772") settings.toleranceColor = "#2e7d32";
            }
            if (version <= 7) {
                settings.downColor = GRAPHICAL_DEFAULTS.downColor;
            }
            safeStorageSet(STORAGE.graphicalSettings, JSON.stringify(settings));
            safeStorageSet(STORAGE.graphicalSettingsVersion, String(GRAPHICAL_SETTINGS_VERSION));
        }

        return settings;
    }

    function saveGraphicalSettings(settings) {
        safeStorageSet(STORAGE.graphicalSettings, JSON.stringify(settings));
        safeStorageSet(STORAGE.graphicalSettingsVersion, String(GRAPHICAL_SETTINGS_VERSION));
    }
'''
new_get = '''    function getGraphicalSettings() {
        return getStoredJSON(STORAGE.graphicalSettings, GRAPHICAL_DEFAULTS);
    }

    function saveGraphicalSettings(settings) {
        safeStorageSet(STORAGE.graphicalSettings, JSON.stringify(settings));
    }
'''
if old_get not in js:
    raise SystemExit("graphical settings upgrade block not found")
js = js.replace(old_get, new_get, 1)
APP_JS.write_text(js.rstrip() + "\n")

for path in (
    Path("database/migrations/001_add_trip_standard_time.sql"),
    Path("database/migrations/002_add_trip_non_production.sql"),
    Path(".github/scripts/remove_down_migration.py"),
):
    if path.exists():
        path.unlink()
