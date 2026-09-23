#!/usr/bin/env bash
set -euo pipefail

APACHE_ROOT=/opt/bitnami/apache2
APACHECTL="$APACHE_ROOT/bin/apachectl"
HTTPD_CONF="$APACHE_ROOT/conf/httpd.conf"
TX_BACKUP="/tmp/httpd.conf.before-clocktimer-speech.$$"

if [ ! -x "$APACHECTL" ]; then
  echo "Bitnami apachectl not found at $APACHECTL" >&2
  exit 1
fi

sudo -n cp \
  "$HTTPD_CONF" \
  "$TX_BACKUP"

restore_apache() {
  sudo -n cp \
    "$TX_BACKUP" \
    "$HTTPD_CONF"

  sudo -n "$APACHECTL" -t || true
  sudo -n /opt/bitnami/ctlscript.sh restart apache || true
}

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
    restore_apache
    exit 1
  fi
done

sudo -n python3 - <<'PY'
from pathlib import Path
import re

path = Path("/opt/bitnami/apache2/conf/httpd.conf")
text = path.read_text()

begin = "# BEGIN CLOCKTIMER SPEECH PROXY"
end = "# END CLOCKTIMER SPEECH PROXY"

proxy = """# BEGIN CLOCKTIMER SPEECH PROXY
ProxyPass        "/api/speech/stream" "ws://127.0.0.1:8765/api/speech/stream"
ProxyPassReverse "/api/speech/stream" "ws://127.0.0.1:8765/api/speech/stream"
# END CLOCKTIMER SPEECH PROXY"""

pattern = re.compile(
    r"\n?"
    + re.escape(begin)
    + r".*?"
    + re.escape(end)
    + r"\n?",
    re.DOTALL,
)

if begin in text:
    text = pattern.sub(
        "\n" + proxy + "\n",
        text,
    )
else:
    text = (
        text.rstrip()
        + "\n\n"
        + proxy
        + "\n"
    )

path.write_text(text)
PY

if ! sudo -n "$APACHECTL" -t; then
  echo "Apache config test failed; restoring previous configuration." >&2
  restore_apache
  exit 1
fi

if ! sudo -n /opt/bitnami/ctlscript.sh restart apache; then
  echo "Apache restart failed; restoring previous configuration." >&2
  restore_apache
  exit 1
fi

sudo -n rm -f "$TX_BACKUP"

curl \
  --fail \
  --silent \
  --show-error \
  http://127.0.0.1:8765/health

echo
echo "ClockTimer speech WebSocket proxy is configured at /api/speech/stream."
