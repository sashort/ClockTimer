from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
# Attribute-name string literals only. Keep method names like #normalizeFormat unchanged.
s=s.replace('"format"', '"time-format"')
p.write_text(s)
