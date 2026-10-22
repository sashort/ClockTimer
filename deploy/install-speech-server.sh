#!/usr/bin/env bash
set -euo pipefail
# Run with sudo from this checkout. No instance resize, firewall change or app
# backend switch occurs here. The loopback worker is exposed only through TLS.
test "$(id -u)" = 0
python3 deploy/install_speech_model.py --check-only
python3 -m venv /opt/clocktimer-speech/venv
/opt/clocktimer-speech/venv/bin/python -m pip install -r services/speech/requirements.txt
install -d -o root -g daemon -m 750 /etc/clocktimer /var/lib/clocktimer/speech /var/lib/clocktimer/speech/models /opt/clocktimer-speech/app/services/speech
install -d -o daemon -g daemon -m 700 /var/lib/clocktimer/speech/tickets
python3 deploy/install_speech_model.py
install -o root -g daemon -m 640 services/speech/server.py /opt/clocktimer-speech/app/services/speech/server.py
python3 - <<'PY'
import json, os, secrets
from pathlib import Path
path=Path('/etc/clocktimer/speech.json')
if not path.exists():
    config={'secret':secrets.token_hex(32), 'origins':['https://wmof.sashort-apps.com'],
            'models':{'en-US':'/var/lib/clocktimer/speech/models/vosk-model-en-us-0.22'},
            'workers':2, 'max_alternatives':10, 'max_sessions':4, 'max_anonymous_sessions':2, 'prelogin_seconds':10, 'max_session_seconds':28800}
    with path.open('x') as file: json.dump(config,file)
    os.chmod(path,0o640)
else:
    config=json.loads(path.read_text())
    config['prelogin_seconds']=10
    path.write_text(json.dumps(config))
PY
chown root:daemon /etc/clocktimer/speech.json
chmod 640 /etc/clocktimer/speech.json
install -m 644 deploy/clocktimer-speech.service /etc/systemd/system/clocktimer-speech.service
systemctl daemon-reload
systemctl enable clocktimer-speech.service
systemctl restart clocktimer-speech.service
# Startup loads the model before reporting ready; no client request loads it.
for attempt in $(seq 1 120); do
  if curl -fsS http://127.0.0.1:8766/health >/tmp/clocktimer-speech-health.json; then break; fi
  if ! systemctl is-active --quiet clocktimer-speech.service; then systemctl --no-pager status clocktimer-speech.service; exit 1; fi
  sleep 1
done
curl -fsS http://127.0.0.1:8766/health
apache_conf=/opt/bitnami/apache2/conf/clocktimer-speech.conf
httpd_conf=/opt/bitnami/apache2/conf/httpd.conf
install -m 644 deploy/clocktimer-speech-apache.conf "$apache_conf"
if ! grep -Fq "Include \"$apache_conf\"" "$httpd_conf"; then
  printf 'Include "%s"\n' "$apache_conf" >>"$httpd_conf"
fi
/opt/bitnami/apache2/bin/apachectl -t
/opt/bitnami/ctlscript.sh restart apache
systemctl --no-pager --full status clocktimer-speech.service
