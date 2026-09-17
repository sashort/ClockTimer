from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)


root = Path('.')

index_path = root / 'index.html'
index = index_path.read_text()
index = replace_once(
    index,
    '''    <title>ClockTimer</title>\n    <link rel="stylesheet" href="app.css">''',
    '''    <title>ClockTimer</title>\n    <script>\n        (() => {\n            try {\n                if (\n                    localStorage.getItem(\n                        "wmof.clock.tripLogPinned"\n                    ) === "false"\n                ) {\n                    document.documentElement.dataset.tripLogStartup =\n                        "unpinned";\n                }\n            }\n            catch {}\n        })();\n    </script>\n    <link rel="stylesheet" href="app.css">''',
    'pre-paint trip log state'
)
index_path.write_text(index.rstrip() + '\n')

css_path = root / 'app.css'
css = css_path.read_text()
css = replace_once(
    css,
    '''.app[data-trip-log-pinned="false"] {\n    --trip-log-row-height: 0px;\n    --home-clock-preferred-size: calc(56vw + 74px);\n}\n''',
    '''.app[data-trip-log-pinned="false"] {\n    --trip-log-row-height: 0px;\n    --home-clock-preferred-size: calc(56vw + 74px);\n}\n\nhtml[data-trip-log-startup="unpinned"] .app {\n    --trip-log-row-height: 0px;\n    --home-clock-preferred-size: calc(56vw + 74px);\n    --trip-log-layout-duration: 0ms;\n}\n''',
    'startup app layout'
)
css = replace_once(
    css,
    '''.app[data-trip-log-pinned="false"] .trip-log-button:not(.trip-log-floating) {\n    transform: translateY(calc(100% + 0.125in));\n    pointer-events: none;\n}\n''',
    '''.app[data-trip-log-pinned="false"] .trip-log-button:not(.trip-log-floating) {\n    transform: translateY(calc(100% + 0.125in));\n    pointer-events: none;\n}\n\nhtml[data-trip-log-startup="unpinned"] .trip-log-button:not(.trip-log-floating) {\n    display: none;\n    transition: none;\n}\n\nhtml[data-trip-log-startup="unpinned"] .clock-region > #clockTimer {\n    transition: none;\n}\n''',
    'startup hidden button and clock transition'
)
css_path.write_text(css.rstrip() + '\n')

js_path = root / 'app.js'
js = js_path.read_text()
js = replace_once(
    js,
    '''    setTripLogPinned(\n        getStoredTripLogPinned(),\n        { persist: false }\n    );\n    applyGraphicalSettings(graphicalSettings);''',
    '''    setTripLogPinned(\n        getStoredTripLogPinned(),\n        { persist: false }\n    );\n\n    if (\n        document.documentElement.dataset.tripLogStartup ===\n            "unpinned"\n    ) {\n        requestAnimationFrame(\n            () => requestAnimationFrame(\n                () => {\n                    delete document.documentElement.dataset.tripLogStartup;\n                }\n            )\n        );\n    }\n\n    applyGraphicalSettings(graphicalSettings);''',
    'clear startup marker after first paint'
)
js_path.write_text(js.rstrip() + '\n')

# Trigger the one-shot workflow after the workflow file exists.
