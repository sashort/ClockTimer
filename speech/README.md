# ClockTimer streaming speech service

This directory contains the authored server-side pieces for WMOF speech recognition. It is source code, not the production runtime location.

## Runtime layout

Production should keep the service outside Apache's document root:

```text
/opt/clocktimer-speech/
├── bin/
│   └── whisper-server
├── src/
│   ├── server.js
│   ├── protocol.js
│   └── whisper-service.js
├── package.json
└── node_modules/

/var/lib/clocktimer/speech/
└── models/
    └── ggml-base.en.bin
```

Do not put Whisper model files, compiled Whisper binaries, `node_modules`, or runtime audio in Git.

The checked-in `speech/.htaccess` denies direct HTTP access if this source tree is present under the current Apache checkout. Production deployment should still copy the server files to `/opt/clocktimer-speech`.

## Browser protocol

The browser connects to:

```text
wss://wmof.sashort-apps.com/api/speech/stream
```

Apache reverse-proxies that path to:

```text
ws://127.0.0.1:8765/api/speech/stream
```

Control and transcript messages are JSON. PCM is binary.

Browser audio is mono, 16 kHz, signed 16-bit little-endian PCM. Each binary WebSocket message is:

```text
bytes 0..3   uint32 LE utteranceId
bytes 4..7   uint32 LE packet sequence
bytes 8..N   PCM s16le
```

The browser emits 20 ms packets from `SpeechAudioWorklet.js`. Local VAD owns utterance boundaries. It sends approximately 350 ms of pre-roll when speech starts and does not keep sending silence after VAD falls below the threshold. The microphone MediaStreamTrack remains open until `SpeechMenu.stop()`.

Control messages currently include:

```text
session-start
session-end
utterance-start
utterance-end
utterance-cancel
ping
pong
```

Server transcript messages are:

```json
{"type":"partial","utteranceId":42,"text":"start at five"}
{"type":"final","utteranceId":42,"text":"start at five thirty"}
```

## Recognition process

`server.js` owns the public-to-private WebSocket protocol. It keeps an internal `whisper-server` child process alive on `127.0.0.1:8766`, so the model stays resident instead of being reloaded for every partial transcript.

For each utterance, the Node service:

1. collects binary PCM packets by `utteranceId`;
2. periodically transcribes a new cumulative audio snapshot;
3. emits changed partial transcripts;
4. emits one final transcript on `utterance-end`;
5. rejects stale/duplicate packet sequence numbers and caps utterance size.

The internal Whisper HTTP server is never exposed publicly.

## One-time Lightsail setup

Install build dependencies appropriate for the Lightsail image, then build current whisper.cpp:

```bash
cd /opt
sudo git clone https://github.com/ggml-org/whisper.cpp.git
cd /opt/whisper.cpp
sudo cmake -B build
sudo cmake --build build -j --config Release
```

Create the runtime directories:

```bash
sudo install -d -o root -g root -m 755 /opt/clocktimer-speech/bin
sudo install -d -o root -g root -m 755 /opt/clocktimer-speech/src
sudo install -d -o daemon -g daemon -m 750 /var/lib/clocktimer/speech
sudo install -d -o daemon -g daemon -m 750 /var/lib/clocktimer/speech/models
```

Install the persistent Whisper server binary:

```bash
sudo install -m 755 /opt/whisper.cpp/build/bin/whisper-server \
  /opt/clocktimer-speech/bin/whisper-server
```

Download the English base model once, then keep it outside deployments:

```bash
cd /opt/whisper.cpp
sudo sh ./models/download-ggml-model.sh base.en
sudo install -o daemon -g daemon -m 640 \
  ./models/ggml-base.en.bin \
  /var/lib/clocktimer/speech/models/ggml-base.en.bin
```

Deploy the authored Node files from the ClockTimer checkout:

```bash
sudo install -m 644 speech/server.js /opt/clocktimer-speech/src/server.js
sudo install -m 644 speech/protocol.js /opt/clocktimer-speech/src/protocol.js
sudo install -m 644 speech/whisper-service.js /opt/clocktimer-speech/src/whisper-service.js
sudo install -m 644 speech/package.json /opt/clocktimer-speech/package.json

cd /opt/clocktimer-speech
sudo npm install --omit=dev
```

Install the service unit:

```bash
sudo install -m 644 speech/clocktimer-speech.service \
  /etc/systemd/system/clocktimer-speech.service
sudo systemctl daemon-reload
sudo systemctl enable --now clocktimer-speech.service
sudo systemctl status clocktimer-speech.service
```

The service runs as `daemon`, listens only on loopback, and automatically restarts on failure.

## Apache

Enable the proxy modules required by the Bitnami Apache build, then add the rules from `speech/apache-websocket.conf` to the TLS virtual host for `wmof.sashort-apps.com`:

```apache
ProxyPass        "/api/speech/stream" "ws://127.0.0.1:8765/api/speech/stream"
ProxyPassReverse "/api/speech/stream" "ws://127.0.0.1:8765/api/speech/stream"
```

Restart Apache after validating its configuration.

Do not expose ports 8765 or 8766 through the public firewall. Only Apache should accept the browser connection.

## Health and logs

The Node daemon exposes a loopback-only health endpoint:

```text
http://127.0.0.1:8765/health
```

Use systemd/journald for logs:

```bash
sudo journalctl -u clocktimer-speech.service -f
```

## Browser provider selection

`SpeechMenu.recognitionProvider` supports:

```text
browser
streaming
```

The WMOF app currently selects `streaming` on Android/iPhone/iPad and keeps `browser` on desktop. The desktop browser provider preserves the existing `SpeechRecognition.start(micTrack)` path for comparison while the server implementation is proven.

Do not merge/deploy the mobile provider switch until the Lightsail speech daemon and Apache WebSocket route are online.

## Tests

From `tests/`:

```bash
npm run test:speech-pipeline
```

That covers the existing mic-bar pipeline, provider boundary, WebSocket binary framing, transcript message routing, and syntax checks for the speech client/server files.
