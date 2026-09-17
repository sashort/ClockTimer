from pathlib import Path

INDEX = Path("index.html")
APP_JS = Path("app.js")
APP_CSS = Path("app.css")

html = INDEX.read_text()
replacements = {
    '<input id="breakColor" name="breakColor" type="color" value="#ffc420">': '<input id="breakColor" name="breakColor" type="color" value="#001e60">',
    '<input id="lunchColor" name="lunchColor" type="color" value="#f59e0b">': '<input id="lunchColor" name="lunchColor" type="color" value="#ffc420">',
    '<input id="downColor" name="downColor" type="color" value="#2e7d32">': '<input id="downColor" name="downColor" type="color" value="#5f6772">',
    '<input id="toleranceColor" name="toleranceColor" type="color" value="#5f6772">\n                                <input name="showTolerance" type="checkbox" checked aria-label="Show Tolerance">': '<input name="showTolerance" type="checkbox" checked aria-label="Show Tolerance">\n                                <input id="toleranceColor" name="toleranceColor" type="color" value="#2e7d32">',
    '<input id="latencyColor" name="latencyColor" type="color" value="#e1251b">\n                                <input name="showLatency" type="checkbox" checked aria-label="Show Latency">': '<input name="showLatency" type="checkbox" checked aria-label="Show Latency">\n                                <input id="latencyColor" name="latencyColor" type="color" value="#e1251b">',
}
for old, new in replacements.items():
    if old not in html:
        raise SystemExit(f"index anchor not found: {old[:50]}")
    html = html.replace(old, new, 1)
INDEX.write_text(html)

js = APP_JS.read_text()
if 'const GRAPHICAL_SETTINGS_VERSION = 5;' not in js:
    raise SystemExit('graphical version anchor not found')
js = js.replace('const GRAPHICAL_SETTINGS_VERSION = 5;', 'const GRAPHICAL_SETTINGS_VERSION = 6;', 1)

old_defaults = '''        breakColor: "#ffc420",
        lunchColor: "#f59e0b",
        downColor: "#2e7d32",
        toleranceColor: "#5f6772",'''
new_defaults = '''        breakColor: "#001e60",
        lunchColor: "#ffc420",
        downColor: "#5f6772",
        toleranceColor: "#2e7d32",'''
if old_defaults not in js:
    raise SystemExit('palette defaults anchor not found')
js = js.replace(old_defaults, new_defaults, 1)

migration_anchor = '''            if (!settings.borderWidth || settings.borderWidth === "7px") settings.borderWidth = GRAPHICAL_DEFAULTS.borderWidth;
            safeStorageSet(STORAGE.graphicalSettings, JSON.stringify(settings));'''
migration_new = '''            if (!settings.borderWidth || settings.borderWidth === "7px") settings.borderWidth = GRAPHICAL_DEFAULTS.borderWidth;
            if (version === 5) {
                if (settings.breakColor === "#ffc420") settings.breakColor = "#001e60";
                if (settings.lunchColor === "#f59e0b") settings.lunchColor = "#ffc420";
                if (settings.downColor === "#2e7d32") settings.downColor = "#5f6772";
                if (settings.toleranceColor === "#5f6772") settings.toleranceColor = "#2e7d32";
            }
            safeStorageSet(STORAGE.graphicalSettings, JSON.stringify(settings));'''
if migration_anchor not in js:
    raise SystemExit('migration anchor not found')
js = js.replace(migration_anchor, migration_new, 1)

apply_anchor = '''        for (const [name, value] of Object.entries(variables)) setClockVariable(target, name, value);
        target.style.color = settings.hourColor || GRAPHICAL_DEFAULTS.hourColor;'''
apply_new = '''        for (const [name, value] of Object.entries(variables)) setClockVariable(target, name, value);
        target.style.color = settings.hourColor || GRAPHICAL_DEFAULTS.hourColor;

        if (target === clockTimer) {
            app.style.setProperty(
                "--timer-break-color",
                settings.breakColor || GRAPHICAL_DEFAULTS.breakColor
            );
            app.style.setProperty(
                "--timer-lunch-color",
                settings.lunchColor || GRAPHICAL_DEFAULTS.lunchColor
            );
            app.style.setProperty(
                "--timer-down-color",
                settings.downColor || GRAPHICAL_DEFAULTS.downColor
            );
        }'''
if apply_anchor not in js:
    raise SystemExit('apply UI color anchor not found')
js = js.replace(apply_anchor, apply_new, 1)
APP_JS.write_text(js)

css = APP_CSS.read_text()
css_replacements = {
    '.break-button {\n    background: var(--wm-yellow);\n}': '.break-button {\n    color: var(--wm-white);\n    background: var(--timer-break-color, #001e60);\n}',
    '.down-button {\n    color: var(--wm-white);\n    background: #2e7d32;\n}': '.down-button {\n    color: var(--wm-white);\n    background: var(--timer-down-color, #5f6772);\n}',
    '.break-type-button {\n    min-height: 88px;': '.break-type-button {\n    min-height: 88px;',
    '    background: var(--wm-blue-dark);\n    font-size: clamp(18px, 4vw, 28px);': '    background: var(--timer-break-color, #001e60);\n    font-size: clamp(18px, 4vw, 28px);',
    '.break-type-button.lunch {\n    color: var(--wm-blue-dark);\n    background: var(--wm-yellow);\n}': '.break-type-button.lunch {\n    color: var(--wm-blue-dark);\n    background: var(--timer-lunch-color, #ffc420);\n}',
    '.timer-color-row.with-toggle {\n    grid-template-columns: minmax(0, 1fr) 68px 28px;\n}': '.timer-color-row.with-toggle {\n    grid-template-columns: minmax(0, 1fr) 28px 68px;\n}',
    'clock-timer time-range[type="break"] {\n    background: var(--clock-timer-break-color, #ffc420);\n}': 'clock-timer time-range[type="break"] {\n    background: var(--clock-timer-break-color, #001e60);\n}',
    'clock-timer time-range[type="lunch"] {\n    background: var(--clock-timer-lunch-color, #f59e0b);\n}': 'clock-timer time-range[type="lunch"] {\n    background: var(--clock-timer-lunch-color, #ffc420);\n}',
    'clock-timer time-range[type="down"] {\n    background: var(--clock-timer-down-color, #2e7d32);\n}': 'clock-timer time-range[type="down"] {\n    background: var(--clock-timer-down-color, #5f6772);\n}',
    'clock-timer time-range[type="tolerance"] {\n    background: var(--clock-timer-tolerance-color, #5f6772);\n}': 'clock-timer time-range[type="tolerance"] {\n    background: var(--clock-timer-tolerance-color, #2e7d32);\n}',
}
for old, new in css_replacements.items():
    if old not in css:
        raise SystemExit(f"css anchor not found: {old[:60]}")
    css = css.replace(old, new, 1)
APP_CSS.write_text(css)
