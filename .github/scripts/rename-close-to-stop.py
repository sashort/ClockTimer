from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
old='        close() {'
assert s.count(old)==1, s.count(old)
s=s.replace(old,'        stop() {',1)
# Keep queued operation semantics consistent with the public API rename.
s=s.replace('type: "close"','type: "stop"')
s=s.replace('case "close":','case "stop":')
s=s.replace('this.close();','this.stop();')
p.write_text(s)
