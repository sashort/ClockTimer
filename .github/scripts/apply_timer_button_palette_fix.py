from pathlib import Path

APP_JS = Path("app.js")
APP_CSS = Path("app.css")

js = APP_JS.read_text()

if 'const GRAPHICAL_SETTINGS_VERSION = 6;' not in js:
    raise SystemExit('graphical settings version anchor not found')
js = js.replace(
    'const GRAPHICAL_SETTINGS_VERSION = 6;',
    'const GRAPHICAL_SETTINGS_VERSION = 7;',
    1
)

old_migration = '''            if (version === 5) {
                if (settings.breakColor === "#ffc420") settings.breakColor = "#001e60";
                if (settings.lunchColor === "#f59e0b") settings.lunchColor = "#ffc420";
                if (settings.downColor === "#2e7d32") settings.downColor = "#5f6772";
                if (settings.toleranceColor === "#5f6772") settings.toleranceColor = "#2e7d32";
            }'''
new_migration = '''            if (version <= 6) {
                if (settings.breakColor === "#ffc420") settings.breakColor = "#001e60";
                if (settings.lunchColor === "#f59e0b") settings.lunchColor = "#ffc420";
                if (settings.downColor === "#2e7d32") settings.downColor = "#5f6772";
                if (settings.toleranceColor === "#5f6772") settings.toleranceColor = "#2e7d32";
            }'''
if old_migration not in js:
    raise SystemExit('graphical settings migration anchor not found')
js = js.replace(old_migration, new_migration, 1)

old_helper = '''    function setClockVariable(target, name, value) {
        if (value === "" || value === null || value === undefined) target.style.removeProperty(name);
        else target.style.setProperty(name, value);
    }

    function applyGraphicalSettings(settings, target = clockTimer) {'''
new_helper = '''    function setClockVariable(target, name, value) {
        if (value === "" || value === null || value === undefined) target.style.removeProperty(name);
        else target.style.setProperty(name, value);
    }

    function getContrastingTextColor(value) {
        const match = /^#([0-9a-f]{6})$/i.exec(String(value || "").trim());
        if (!match) return "#ffffff";

        const hex = match[1];
        const channels = [0, 2, 4].map(index => {
            const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
            return channel <= 0.04045
                ? channel / 12.92
                : ((channel + 0.055) / 1.055) ** 2.4;
        });
        const luminance =
            0.2126 * channels[0] +
            0.7152 * channels[1] +
            0.0722 * channels[2];
        const blackContrast = (luminance + 0.05) / 0.05;
        const whiteContrast = 1.05 / (luminance + 0.05);

        return blackContrast >= whiteContrast
            ? "#000000"
            : "#ffffff";
    }

    function applyGraphicalSettings(settings, target = clockTimer) {'''
if old_helper not in js:
    raise SystemExit('setClockVariable/applyGraphicalSettings anchor not found')
js = js.replace(old_helper, new_helper, 1)

old_palette = '''        if (target === clockTimer) {
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
new_palette = '''        if (target === clockTimer) {
            const paletteRoot = document.documentElement;
            const breakColor = settings.breakColor || GRAPHICAL_DEFAULTS.breakColor;
            const lunchColor = settings.lunchColor || GRAPHICAL_DEFAULTS.lunchColor;
            const downColor = settings.downColor || GRAPHICAL_DEFAULTS.downColor;

            paletteRoot.style.setProperty("--timer-break-color", breakColor);
            paletteRoot.style.setProperty("--timer-break-text-color", getContrastingTextColor(breakColor));
            paletteRoot.style.setProperty("--timer-lunch-color", lunchColor);
            paletteRoot.style.setProperty("--timer-lunch-text-color", getContrastingTextColor(lunchColor));
            paletteRoot.style.setProperty("--timer-down-color", downColor);
            paletteRoot.style.setProperty("--timer-down-text-color", getContrastingTextColor(downColor));
        }'''
if old_palette not in js:
    raise SystemExit('timer palette root anchor not found')
js = js.replace(old_palette, new_palette, 1)

APP_JS.write_text(js)

css = APP_CSS.read_text().rstrip()
marker = '/* authoritative-timer-button-palette-v3 */'
if marker in css:
    raise SystemExit('authoritative timer button palette CSS already present')

css += '''\n\n\n/* authoritative-timer-button-palette-v3 */
.break-button {
    color: var(--timer-break-text-color, #ffffff);
    background: var(--timer-break-color, #001e60);
}

.down-button {
    color: var(--timer-down-text-color, #ffffff);
    background: var(--timer-down-color, #5f6772);
}

.break-type-button {
    color: var(--timer-break-text-color, #ffffff);
    background: var(--timer-break-color, #001e60);
}

.break-type-button.lunch {
    color: var(--timer-lunch-text-color, #000000);
    background: var(--timer-lunch-color, #ffc420);
}
'''
APP_CSS.write_text(css + '\n')
