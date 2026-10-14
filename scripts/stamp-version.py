"""Stamp one release ID into all pages and their cached assets."""
from pathlib import Path
import json
import re
import secrets
import string
import subprocess
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode


def stamp(root):
    version = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    prepared = {}
    paths = [root / name for name in ('index.html', 'drop-in.html', 'order-filler.html')]
    paths += sorted((root / 'templates').rglob('*.html'))
    for path in paths:
        name = str(path.relative_to(root))
        text = path.read_text(encoding='utf-8')
        text, count = re.subn(r'(<output id="appVersion"[^>]*>)[^<]*(</output>)',
                             lambda match: match[1] + version + match[2], text)
        if (path.parent == root and count != 1) or count > 1:
            raise ValueError(f'{name} has an invalid Version output count')
        def asset(match):
            url = urlsplit(match[2].replace('&amp;', '&'))
            if url.scheme or url.netloc or not url.path.endswith(('.js', '.css')):
                return match[0]
            query = [(key, value) for key, value in parse_qsl(url.query, keep_blank_values=True) if key != 'build']
            query.append(('build', version))
            updated = urlunsplit((url.scheme, url.netloc, url.path, urlencode(query), url.fragment))
            return match[1] + updated.replace('&', '&amp;') + match[3]
        text = re.sub(r'((?:src|href)=")([^"]+)(")', asset, text)
        prepared[path] = text
    app = root / 'app.js'
    text, count = re.subn(r'(const SPEECH_RUNTIME_REVISION\s*=\s*")[^"]+(";)',
                         lambda match: match[1] + version + match[2], app.read_text(encoding='utf-8'))
    if count != 1:
        raise ValueError('Speech runtime version declaration is missing')
    prepared[app] = text
    for path, text in prepared.items():
        path.write_text(text, encoding='utf-8')
    revision = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=root, capture_output=True, text=True).stdout.strip()
    (root / 'build-version.json').write_text(json.dumps({'version': version, 'commit': revision,
        'builtAt': datetime.now(timezone.utc).isoformat()}, indent=2) + '\n', encoding='utf-8')
    return version


if __name__ == '__main__':
    print('Version: ' + stamp(Path(__file__).resolve().parents[1]))
