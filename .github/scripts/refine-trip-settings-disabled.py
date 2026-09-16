from pathlib import Path

index_path = Path("index.html")
index = index_path.read_text(encoding="utf-8")
old = '<legend>Options</legend>'
new = '<legend>Trip Preferences</legend>'
if index.count(old) != 1:
    raise RuntimeError(f"expected one Trip Settings Options legend, found {index.count(old)}")
index = index.replace(old, new, 1)
index_path.write_text(index, encoding="utf-8")

css_path = Path("app.css")
css = css_path.read_text(encoding="utf-8")
marker = "/* trip-settings-disabled-primary-v1 */"
if marker in css:
    raise RuntimeError("disabled primary styles already present")
css += '''\n\n/* trip-settings-disabled-primary-v1 */\n.trip-settings-dialog #tripSettingsPrimary:disabled {\n    color: rgb(255 255 255 / 68%);\n    background: var(--ui-gray-gradient);\n    border-color: rgb(255 255 255 / 32%);\n    box-shadow: inset 0 1px 0 rgb(255 255 255 / 8%);\n    opacity: 0.5;\n    filter: grayscale(1) saturate(0.25);\n    cursor: not-allowed;\n    transform: none;\n    text-shadow: none;\n}\n'''
css_path.write_text(css, encoding="utf-8")
