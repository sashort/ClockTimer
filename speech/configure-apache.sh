#!/usr/bin/env bash
set -euo pipefail

APACHE_ROOT=/opt/bitnami/apache2
APACHECTL="$APACHE_ROOT/bin/apachectl"
HTTPD_CONF="$APACHE_ROOT/conf/httpd.conf"

if [ ! -x "$APACHECTL" ]; then
  echo "Bitnami apachectl not found at $APACHECTL" >&2
  exit 1
fi

sudo -n cp -n \
  "$HTTPD_CONF" \
  "$HTTPD_CONF.before-clocktimer-speech" \
  2>/dev/null || true

for module in proxy_module proxy_wstunnel_module; do
  if ! sudo -n "$APACHECTL" -M 2>/dev/null |
    grep -q "$module"
  then
    if [ "$module" = "proxy_module" ]; then
      so=proxy
    else
      so=proxy_wstunnel
    fi

    sudo -n sed -i -E \
      "s|^[[:space:]]*#[[:space:]]*(LoadModule[[:space:]]+$module[[:space:]]+modules/mod_$so\\.so)|\\1|" \
      "$HTTPD_CONF"
  fi
done

for module in proxy_module proxy_wstunnel_module; do
  if ! sudo -n "$APACHECTL" -M 2>/dev/null |
    grep -q "$module"
  then
    echo "Apache module $module is not loaded." >&2
    exit 1
  fi
done

sudo -n python3 - <<'PY'
from pathlib import Path
import re
import shutil
import sys

root = Path("/opt/bitnami/apache2/conf")
domain = "wmof.sashort-apps.com"
begin = "# BEGIN CLOCKTIMER SPEECH PROXY"
end = "# END CLOCKTIMER SPEECH PROXY"

proxy = """
    # BEGIN CLOCKTIMER SPEECH PROXY
    ProxyPass        "/api/speech/stream" "ws://127.0.0.1:8765/api/speech/stream"
    ProxyPassReverse "/api/speech/stream" "ws://127.0.0.1:8765/api/speech/stream"
    # END CLOCKTIMER SPEECH PROXY
""".rstrip()

block_pattern = re.compile(
    r"<VirtualHost\b[^>]*>.*?</VirtualHost>",
    re.IGNORECASE | re.DOTALL,
)

host_pattern = re.compile(
    r"(?im)^\s*Server(?:Name|Alias)\s+[^\n]*\b"
    + re.escape(domain)
    + r"(?::\d+)?\b"
)

matches = []

for path in root.rglob("*.conf"):
    try:
        text = path.read_text()
    except Exception:
        continue

    for match in block_pattern.finditer(text):
        block = match.group(0)
        header = block.split(">", 1)[0]

        if (
            ":443" in header
            and host_pattern.search(block)
        ):
            matches.append(
                (
                    path,
                    text,
                    match.start(),
                    match.end(),
                    block,
                )
            )

if len(matches) != 1:
    print(
        "Expected exactly one TLS vhost for "
        + domain
        + ", found "
        + str(len(matches)),
        file=sys.stderr,
    )
    sys.exit(2)

path, text, start, finish, block = matches[0]

marked = re.compile(
    r"\n\s*"
    + re.escape(begin)
    + r".*?"
    + re.escape(end)
    + r"\s*",
    re.DOTALL,
)

if begin in block:
    block = marked.sub(
        "\n" + proxy + "\n",
        block,
    )
else:
    block = block.rsplit(
        "</VirtualHost>",
        1,
    )[0].rstrip()
    block += "\n" + proxy + "\n</VirtualHost>"

backup = Path(
    str(path)
    + ".before-clocktimer-speech"
)

if not backup.exists():
    shutil.copy2(
        path,
        backup,
    )

path.write_text(
    text[:start]
    + block
    + text[finish:]
)

Path(
    "/tmp/clocktimer-speech-vhost-path"
).write_text(
    str(path)
)

print(
    "Updated TLS vhost:",
    path,
)
PY

VHOST_FILE=$(cat /tmp/clocktimer-speech-vhost-path)

if ! sudo -n "$APACHECTL" -t; then
  echo "Apache config test failed; restoring backups." >&2

  sudo -n cp \
    "$VHOST_FILE.before-clocktimer-speech" \
    "$VHOST_FILE"

  if [ -f "$HTTPD_CONF.before-clocktimer-speech" ]; then
    sudo -n cp \
      "$HTTPD_CONF.before-clocktimer-speech" \
      "$HTTPD_CONF"
  fi

  sudo -n "$APACHECTL" -t || true
  exit 1
fi

sudo -n /opt/bitnami/ctlscript.sh restart apache

curl \
  --fail \
  --silent \
  --show-error \
  http://127.0.0.1:8765/health
