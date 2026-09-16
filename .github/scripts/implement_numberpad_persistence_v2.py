from pathlib import Path
import runpy

path = Path('.github/scripts/implement_numberpad_persistence.py')
text = path.read_text()

text = text.replace(
    'index = replace_between(index, numberpad_start, login_start, login_start, "embedded number pad")',
    'index = replace_between(index, numberpad_start, login_start, "", "embedded number pad")'
)
text = text.replace(
    'new_numberpad_block + numberpad_block_end, "number pad behavior")',
    'new_numberpad_block, "number pad behavior")'
)
text = text.replace(
    'new_post + tripid_anchor, "trip POST block")',
    'new_post, "trip POST block")'
)

if 'new_numberpad_block + numberpad_block_end' in text:
    raise RuntimeError('app end anchor fix did not apply')
if 'new_post + tripid_anchor' in text:
    raise RuntimeError('API end anchor fix did not apply')
if 'login_start, "embedded number pad")' in text and '"", "embedded number pad")' not in text:
    raise RuntimeError('index end anchor fix did not apply')

path.write_text(text)
runpy.run_path(str(path), run_name='__main__')
