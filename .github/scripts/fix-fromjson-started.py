from pathlib import Path

path = Path('ClockTimer.js')
s = path.read_text()
p = s.index('fromJSON(')
q = s.index('\n        get status()', p)
method = s[p:q]
old = '''                this.#started =\n                    false;\n\n                this.#starting =\n                    true;'''
new = '''                this.#started =\n                    true;\n\n                this.#starting =\n                    true;'''
if method.count(old) != 1:
    raise SystemExit('expected started assignment not found exactly once')
method = method.replace(old, new, 1)
old_finally = '''                finally {\n                    this.#starting =\n                        false;\n                }'''
new_finally = '''                finally {\n                    this.#starting =\n                        false;\n\n                    this.#started =\n                        false;\n                }'''
if method.count(old_finally) != 1:
    raise SystemExit('expected fromJSON finally not found exactly once')
method = method.replace(old_finally, new_finally, 1)
s = s[:p] + method + s[q:]
path.write_text(s)
