from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Expected {label} block not found")
    return text.replace(old, new, 1)

index_path = Path("index.html")
index = index_path.read_text()
index = replace_once(
    index,
    '''                        <label>Grayscale<input name="grayscale" type="number" min="0" max="100" step="1" value="0"></label>\n                        <label>Grayscale Ramp<input name="grayscaleRamp" value="333ms"></label>\n''',
    '',
    "grayscale controls"
)
index_path.write_text(index)

app_path = Path("app.js")
app = app_path.read_text()
app = replace_once(app, '    const GRAPHICAL_SETTINGS_VERSION = 3;\n', '    const GRAPHICAL_SETTINGS_VERSION = 4;\n', 'graphical settings version')
app = replace_once(
    app,
    '''        borderWidth: "5px",\n        grayscale: "0",\n        grayscaleRamp: "333ms"\n''',
    '''        borderWidth: "5px"\n''',
    "graphical grayscale defaults"
)
app = replace_once(
    app,
    '''        if (version < GRAPHICAL_SETTINGS_VERSION) {\n            if (!settings.timeFormat || settings.timeFormat === "HHmmss") settings.timeFormat = "HHmm";\n''',
    '''        if (version < GRAPHICAL_SETTINGS_VERSION) {\n            delete settings.grayscale;\n            delete settings.grayscaleRamp;\n            if (!settings.timeFormat || settings.timeFormat === "HHmmss") settings.timeFormat = "HHmm";\n''',
    "graphical settings migration"
)
app = replace_once(
    app,
    '''        setOptionalAttribute(target, "tick-marks", settings.tickMarks);\n        setOptionalAttribute(target, "indicator-symbol", settings.indicatorSymbol);\n        target.setAttribute("grayscale", `${Math.max(0, Math.min(100, Number(settings.grayscale) || 0))}%`);\n        target.setAttribute("grayscale-ramp", settings.grayscaleRamp || "333ms");\n        target.showTolerance = Boolean(settings.showTolerance);\n''',
    '''        setOptionalAttribute(target, "tick-marks", settings.tickMarks);\n        setOptionalAttribute(target, "indicator-symbol", settings.indicatorSymbol);\n        target.removeAttribute("grayscale");\n        target.removeAttribute("grayscale-ramp");\n        target.showTolerance = Boolean(settings.showTolerance);\n''',
    "graphical grayscale application"
)
app = replace_once(
    app,
    '''            activeRingWidth: text("activeRingWidth"),\n            inactiveRingWidth: text("inactiveRingWidth"),\n            borderWidth: text("borderWidth"),\n            grayscale: text("grayscale") || "0",\n            grayscaleRamp: text("grayscaleRamp") || "333ms"\n''',
    '''            activeRingWidth: text("activeRingWidth"),\n            inactiveRingWidth: text("inactiveRingWidth"),\n            borderWidth: text("borderWidth")\n''',
    "graphical form values"
)
app_path.write_text(app)
