from pathlib import Path

APP_JS = Path("app.js")
js = APP_JS.read_text()

if 'const GRAPHICAL_SETTINGS_VERSION = 7;' not in js:
    raise SystemExit('graphical settings version anchor not found')
js = js.replace(
    'const GRAPHICAL_SETTINGS_VERSION = 7;',
    'const GRAPHICAL_SETTINGS_VERSION = 8;',
    1
)

old = '''            if (version <= 6) {
                if (settings.breakColor === "#ffc420") settings.breakColor = "#001e60";
                if (settings.lunchColor === "#f59e0b") settings.lunchColor = "#ffc420";
                if (settings.downColor === "#2e7d32") settings.downColor = "#5f6772";
                if (settings.toleranceColor === "#5f6772") settings.toleranceColor = "#2e7d32";
            }
            safeStorageSet(STORAGE.graphicalSettings, JSON.stringify(settings));'''
new = '''            if (version <= 6) {
                if (settings.breakColor === "#ffc420") settings.breakColor = "#001e60";
                if (settings.lunchColor === "#f59e0b") settings.lunchColor = "#ffc420";
                if (settings.downColor === "#2e7d32") settings.downColor = "#5f6772";
                if (settings.toleranceColor === "#5f6772") settings.toleranceColor = "#2e7d32";
            }
            if (version <= 7) {
                settings.downColor = GRAPHICAL_DEFAULTS.downColor;
            }
            safeStorageSet(STORAGE.graphicalSettings, JSON.stringify(settings));'''

if old not in js:
    raise SystemExit('migration anchor not found')
js = js.replace(old, new, 1)
APP_JS.write_text(js.rstrip() + "\n")
