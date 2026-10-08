import importlib.util
import json
from pathlib import Path
import re
import tempfile

spec = importlib.util.spec_from_file_location('stamp_version', Path(__file__).resolve().parents[1] / 'scripts/stamp-version.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    (root / 'templates').mkdir()
    page = '<output id="appVersion">LOCAL</output><script src="app.js?v=old"></script><link href="app.css">'
    for name in ('index.html', 'templates/index.html', 'drop-in.html', 'templates/drop-in.html'):
        (root / name).write_text(page, encoding='utf-8')
    (root / 'app.js').write_text('const SPEECH_RUNTIME_REVISION = "old";', encoding='utf-8')
    first = module.stamp(root)
    assert re.fullmatch('[A-Z0-9]{6}', first)
    for name in ('index.html', 'templates/index.html', 'drop-in.html', 'templates/drop-in.html'):
        text = (root / name).read_text(encoding='utf-8')
        assert f'>{first}</output>' in text and f'build={first}' in text and 'v=old' in text
    assert first in (root / 'app.js').read_text(encoding='utf-8')
    second = module.stamp(root)
    assert first != second
    assert (root / 'index.html').read_text(encoding='utf-8').count('build=') == 2
    assert json.loads((root / 'build-version.json').read_text())['version'] == second
print('PASS release version, page agreement, cache updates and repeated deployment')
