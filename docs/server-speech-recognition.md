# Shared server speech recognition

The `vosk-server` backend sends audio to our own Vosk worker. Test and live
versions can use the same service. This does not use Google's Web Speech
recognizer or incur a vendor per-minute recognition charge. Hosting, CPU,
memory, bandwidth, and maintenance still have costs. Accuracy must be measured
on actual command recordings; transport tests do not establish accuracy.

## Language routing

`POST /api/speech/session/` requires `{"language":"en-US"}` and the browser's
session CSRF token. `GET` on that endpoint returns a CSRF token and the
configured locale list. A session grant is bound to one language, origin, and
anonymous browser session. Voice login works before account authentication;
the speech grant gives no permission to read or modify account data.

Keep that speech-only socket open when login succeeds or PHP regenerates its
session ID/CSRF token. The socket does not become an account-authorized channel.
Login and all account/trip mutations continue through their normal authenticated
HTTP endpoints using the current CSRF token. A later socket connection obtains a
new speech ticket from the current PHP session; it must not reuse a consumed
ticket. CSRF protects ticket issuance, not each binary WebSocket frame.

The first WebSocket frame to `/speech-ws` is:

```json
{"type":"start","ticket":"<short-lived grant>","language":"en-US","sampleRate":16000,"format":"pcm_s16le"}
```

Locale matching is case-insensitive and returns the configured canonical tag.
There is no automatic region fallback: `en` does not implicitly select `en-US`.
Unknown locales return `unsupported_language`. The initial production manifest
installs only `en-US` with `vosk-model-en-us-0.22` (the 1.8 GiB server model).
Additional locales require reviewed model entries in `deploy/speech-models.json`
and a corresponding server configuration mapping. The French model in transport
tests is a fake route used to verify isolation, not an installed language model.

## Capture and command processing

The existing worklet keeps microphone capture open and supplies mono 16 kHz PCM.
`VoskServerRecognizer` converts Float32 frames to signed little-endian 16-bit PCM
and sends them over one secure WebSocket. The server keeps a recognizer per
connection and shares each loaded language model across connections. Native
recognition runs in a bounded executor, outside the WebSocket event loop.

The remote transport implements the existing Vosk decoder bridge, so
`VoskRecognizer` still owns audio ordering, reply fences, cumulative segments,
and logical utterance collection. Decoder endpoints do not settle a duration or
command continuation. Our adaptive silence policy establishes a logical
boundary, flushes the native result, and assumes no further continuations will
follow. The microphone and WebSocket remain open for the next command.

Interim/final text continues through the same shared collectors and validated
command buffer. No independent server implementation of command interpretation,
FSM actions, login handling, or transcript display is introduced.

## Protocol and failure behavior

After the `ready` response, binary frames contain PCM. Responses have type
`partial` or `result`, a Vosk `result` object, and cumulative `acceptedSamples`
for audio replies. `{"type":"boundary"}` returns a `result` with `boundary:true`;
this flushes/resets the recognizer without replacing the model or socket.

TCP/WebSocket ordering supplies transport ordering; frames are not replayed or
duplicated after a disconnect. Network loss is an explicit fatal recognition
failure rather than a false Listening indication. Accepted command-buffer work
remains governed by its existing ownership/cancellation rules. Seamless
cross-server acoustic recovery is not implemented; never claim a reconnect
preserved audio unless the server has acknowledged and retained that audio.

The browser caps outbound WebSocket backlog and retains the existing 30-second
adapter limit. The server bounds frame size, pending receive frames, concurrent
connections, concurrent authenticated sessions, worker count, and live-audio
upload rate. One-use grants expire after 60 seconds; established sessions may
last up to eight hours. A connection can host many logical utterances.

## Access and privacy

Apache terminates TLS and proxies `/speech-ws` to `127.0.0.1:8766`. That port is
not exposed publicly. The first-frame ticket avoids credentials in proxy URLs.
PHP and the worker share `/etc/clocktimer/speech.json`, readable by root/daemon
only. Exact origin allowlists, CSRF, per-IP issuance limits and session admission
apply to anonymous sessions too. Tickets are consumed once within the worker.
Clients cannot select filesystem paths, upload grammar, or request arbitrary
models. Audio/transcripts are processed in memory and never recorded or logged.

Test/live deployments under the same origin need no cross-origin exception.
A local test deployment uses its own same-origin ticket endpoint or a trusted
development proxy with the shared service configured. Merely setting a remote
URL does not bypass session cookies, CSRF, or origin checks. Do not enable
wildcard CORS or embed the signing secret in JavaScript.

## Installation and rollout

From the checked-out application on the server:

```sh
sudo python3 deploy/install_speech_model.py --check-only
sudo bash deploy/install-speech-server.sh
```

The conservative preflight requires a 16 GiB machine, 12 GiB currently available
RAM, and 10 GiB free disk. This reserves capacity for the existing web/database
services. The installer does not resize infrastructure or purchase resources.
It verifies the pinned archive size and official catalog MD5 over HTTPS, safely
extracts outside the document root, creates the private signing configuration,
installs a constrained systemd service, waits for model readiness, then enables
the Apache proxy. The package catalog is at <https://alphacephei.com/vosk/models>.
For stronger supply-chain pinning, record a separately reviewed SHA-256 when
updating model artifacts; MD5 is the upstream archive integrity identifier.

`GET http://127.0.0.1:8766/health` reports readiness, language keys and session
counts. Health is private and does not expose model paths, credentials or text.
Existing secrets/model/origin configuration is preserved; add models/origins explicitly and
restart the worker. Loaded model memory must be budgeted per configured model.

Once installed and verified, select `?speech-backend=vosk-server` on either test
or live Order Filler. `WMOF_VOSK_SERVER_CONFIG.sessionUrl` can target a configured
ticket endpoint. The existing local backend remains the default until the host
capacity check and real command/latency checks pass. Installing the service does
not itself change the client default.

## Verification

- `python tests/speech-server.py`: tickets, language routing, replay/admission,
  PCM validation and persistent boundaries over actual WebSockets, fake decoder.
- `php tests/speech-sessions.php`: PHP ticket and canonical-language contract.
- `node tests/vosk-server-browser.cjs`: browser ticket exchange and remote
  adapter/collector lifecycle against the real Python transport, fake decoder.
- Existing collector, sleep/wake, FSM and shared percentage layout tests remain
  applicable to both recognition transports.

Install `services/speech/requirements.txt` before the Python/browser tests.
`CLOCKTIMER_SPEECH_PYTHON` selects the Python interpreter for the browser fixture.
Before making this the live default, benchmark real recorded commands with the
large model, including Wake, Break Start, fast login, growing durations and
percentages, simultaneous users, and network interruption. Bluetooth duplex
playback quality remains a separate device-routing issue.

## Pre-login deadline and authentication upgrade

Anonymous sockets have a hard 10-second lease starting at `ready`. The server
includes `preloginSeconds` in ready/authentication replies. Audio, partial digits,
failed login attempts and repeated deauthenticate controls cannot extend it.
The client shows a countdown in the login status, warns once at three seconds,
and on `login_timeout` stops capture without canceling accepted login HTTP work.
Entered ID/PIN values remain available for touch login. The message is “Voice
login timed out. Tap the microphone to retry.” There is no anonymous reconnect
loop: the user must retry explicitly. Successful login after expiry may open an
authenticated replacement connection.

Successful login fetches a new CSRF-protected signed ticket from the current PHP
session and sends `{type:"authenticate",ticket}` on the existing socket. Only a
server-signed authenticated grant removes the anonymous lease; account actions
remain HTTP-only. Logout downgrades the connection and starts a new 10-second
lease. Limits default to four total sessions, two anonymous sessions and two per
subject. These bounds reduce resource exhaustion; they do not replace upstream
rate limiting or distributed denial-of-service protection. Installer upgrades
preserve the secret/model/origin configuration and enforce the 10-second lease.
