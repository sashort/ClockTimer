from pathlib import Path
import subprocess

patch = Path('.github/scripts/update-async-api.py')
s = patch.read_text()
marker = '# stop() should discard queued previous-direction replacements too.\n'
if marker not in s:
    raise SystemExit('tail marker not found')
head = s.split(marker, 1)[0]
tail = r'''# stop() should discard queued previous-direction replacements too.
needle = ''' + "'''" + r'''                    new Set([
                        "insert",
                        "overwrite",
                        "replaceWithNext",
                        "replaceToNext"
                    ]);''' + "'''" + r'''
replacement = ''' + "'''" + r'''                    new Set([
                        "insert",
                        "overwrite",
                        "replaceWithNext",
                        "replaceToNext",
                        "replaceWithPrevious",
                        "replaceToPrevious"
                    ]);''' + "'''" + r'''
if needle not in s:
    raise SystemExit('stop cancelledTypes anchor not found')
s = s.replace(needle, replacement, 1)

p.write_text(s)
'''
patch.write_text(head + tail)
subprocess.run(['python', str(patch)], check=True)
