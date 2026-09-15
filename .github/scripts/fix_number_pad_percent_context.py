from pathlib import Path
p = Path('app.js')
s = p.read_text()
old = '''        numberPadContext.dataset.context = percentMode ? "percent" : "settings";\n        numberPadContext.disabled = percentMode;\n        numberPadContext.setAttribute("aria-label", percentMode ? "Percent" : "Number pad settings");\n'''
new = '''        numberPadContext.dataset.context = percentMode ? "percent" : "settings";\n        numberPadContext.disabled = false;\n        numberPadContext.setAttribute("aria-disabled", String(percentMode));\n        numberPadContext.setAttribute("aria-label", percentMode ? "Percent" : "Number pad settings");\n'''
if old not in s:
    raise SystemExit('target not found')
p.write_text(s.replace(old, new, 1))
