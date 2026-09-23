#!/usr/bin/env bash
set -euo pipefail

STATUS=/tmp/clocktimer-speech-provision.status
STAGE=/tmp/clocktimer-speech-release
WHISPER_SRC="$HOME/.cache/clocktimer-whisper"
MODEL=/var/lib/clocktimer/speech/models/ggml-base.en.bin
VERIFY_SCRIPT=/tmp/verify-speech-local.mjs

finish() {
  code=$?
  if [ "$code" -eq 0 ]; then
    printf 'success\n' > "$STATUS"
  else
    printf 'failure:%s\n' "$code" > "$STATUS"
  fi
}
trap finish EXIT

printf 'running\n' > "$STATUS"

rm -rf "$STAGE"
mkdir -p "$STAGE"
tar -xzf /tmp/clocktimer-speech-deploy.tgz -C "$STAGE"

missing=0
for command in git cmake g++ make curl python3 node npm; do
  if ! command -v "$command" >/dev/null 2>&1; then
    missing=1
    break
  fi
done

if [ "$missing" -eq 1 ]; then
  sudo -n apt-get update
  sudo -n env DEBIAN_FRONTEND=noninteractive \
    apt-get install -y \
      git \
      cmake \
      build-essential \
      curl \
      ca-certificates \
      python3 \
      nodejs \
      npm
fi

mkdir -p "$HOME/.cache"

echo "Memory before whisper.cpp build:"
free -h || true
echo "Disk before whisper.cpp build:"
df -h / || true

SWAP_FILE=/swapfile-clocktimer-speech
SWAP_KB=$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo)

if [ "${SWAP_KB:-0}" -lt 1048576 ]; then
  AVAILABLE_KB=$(df -Pk / | awk 'NR == 2 {print $4}')

  if [ "${AVAILABLE_KB:-0}" -ge 3145728 ]; then
    SWAP_MB=2048
  elif [ "${AVAILABLE_KB:-0}" -ge 2097152 ]; then
    SWAP_MB=1024
  else
    echo "Not enough free disk to create safe build swap." >&2
    exit 1
  fi

  if [ ! -f "$SWAP_FILE" ]; then
    echo "Creating ${SWAP_MB} MiB ClockTimer speech swap file."
    sudo -n fallocate -l "${SWAP_MB}M" "$SWAP_FILE"
    sudo -n chmod 600 "$SWAP_FILE"
    sudo -n mkswap "$SWAP_FILE"
  fi

  if ! grep -qF "$SWAP_FILE" /proc/swaps; then
    sudo -n swapon "$SWAP_FILE"
  fi

  if ! grep -qE '^/swapfile-clocktimer-speech[[:space:]]' /etc/fstab; then
    printf '%s\n' \
      '/swapfile-clocktimer-speech none swap sw 0 0' |
      sudo -n tee -a /etc/fstab >/dev/null
  fi
fi

echo "Memory after swap check:"
free -h || true

if [ ! -d "$WHISPER_SRC/.git" ]; then
  rm -rf "$WHISPER_SRC"
  git clone \
    https://github.com/ggml-org/whisper.cpp.git \
    "$WHISPER_SRC"
fi

git -C "$WHISPER_SRC" fetch origin
git -C "$WHISPER_SRC" reset --hard "$WHISPER_CPP_REF"

if git -C "$WHISPER_SRC" apply --check \
  "$STAGE/speech/whisper-server-grammar.patch"
then
  git -C "$WHISPER_SRC" apply \
    "$STAGE/speech/whisper-server-grammar.patch"
fi

cmake \
  -S "$WHISPER_SRC" \
  -B "$WHISPER_SRC/build" \
  -DWHISPER_BUILD_TESTS=OFF

nice -n 10 cmake \
  --build "$WHISPER_SRC/build" \
  --target whisper-server \
  -j 1

sudo -n install -d \
  -o root -g root -m 755 \
  /opt/clocktimer-speech/bin \
  /opt/clocktimer-speech/src

sudo -n install -d \
  -o daemon -g daemon -m 750 \
  /var/lib/clocktimer/speech \
  /var/lib/clocktimer/speech/models \
  /var/lib/clocktimer/speech/tmp

sudo -n install -m 755 \
  "$WHISPER_SRC/build/bin/whisper-server" \
  /opt/clocktimer-speech/bin/whisper-server

if [ ! -s "$MODEL" ]; then
  (
    cd "$WHISPER_SRC"
    sh ./models/download-ggml-model.sh base.en
  )

  sudo -n install \
    -o daemon -g daemon -m 640 \
    "$WHISPER_SRC/models/ggml-base.en.bin" \
    "$MODEL"
fi

for file in \
  server.js \
  protocol.js \
  grammar.js \
  whisper-service.js
do
  sudo -n install -m 644 \
    "$STAGE/speech/$file" \
    "/opt/clocktimer-speech/src/$file"
done

sudo -n install -m 644 \
  "$STAGE/speech/package.json" \
  /opt/clocktimer-speech/package.json

(
  cd /opt/clocktimer-speech
  sudo -n npm install \
    --omit=dev \
    --ignore-scripts
)

sudo -n install -m 644 \
  "$STAGE/speech/clocktimer-speech.service" \
  /etc/systemd/system/clocktimer-speech.service

sudo -n systemctl daemon-reload
sudo -n systemctl enable clocktimer-speech.service
sudo -n systemctl restart clocktimer-speech.service

healthy=0
for attempt in $(seq 1 180); do
  if curl \
    --fail \
    --silent \
    --show-error \
    http://127.0.0.1:8765/health \
    >/tmp/clocktimer-speech-health.json
  then
    healthy=1
    break
  fi
  sleep 1
done

if [ "$healthy" -ne 1 ]; then
  sudo -n systemctl status \
    clocktimer-speech.service \
    --no-pager || true
  sudo -n journalctl \
    -u clocktimer-speech.service \
    -n 160 \
    --no-pager || true
  exit 1
fi

cat /tmp/clocktimer-speech-health.json

JFK_WAV="$WHISPER_SRC/samples/jfk.wav" \
  node "$VERIFY_SCRIPT"

sudo -n systemctl is-active \
  --quiet \
  clocktimer-speech.service
