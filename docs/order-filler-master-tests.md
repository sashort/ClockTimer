# Order Filler master tests and diagnostics

Run from `tests/` after `npm install` and `npx playwright install chromium`.

Use the pinned Playwright 1.62.1 dependency and its matching browser. Playwright
1.55 stalled `AudioContext.audioWorklet.addModule()` before Vosk/model startup,
including in a minimal worklet-only reproduction. Switching the driver to 1.62.1
with the same Chromium binary allowed startup and real speech recognition. Keep
the real audio smoke check as a release gate; a timeout is a failure, never a
reason to substitute transcript injection. Startup failures include the audio
source state, latest speech status and browser exceptions for diagnosis.

| When | Command | Coverage |
| --- | --- | --- |
| Ordinary changes | `npm run test:order-filler:press` | Browser presses, pointer FSM contract cases, supporting UI/model tests |
| Ordinary changes | `npm run test:order-filler:voice` | Fast → Medium → Slow audio-driven journeys, voice FSM contract cases, supporting speech/UI/model tests |
| Recognizer/language work | `npm run test:order-filler:duration` | Every second through 1:59:59, across applicable duration phrase paths and Numberpad forms |
| Recognizer/language work | `npm run test:order-filler:time` | Every hour/minute through voice and Numberpad; every second through the absolute Numberpad |
| After deployment | `npm run test:order-filler:deployed` | Served application assets in an isolated browser, per-locale Press/Fast/Medium/Slow results |

## Workflow and FSM coverage

The browser journeys cover ID/PIN login, every preset goal mode, cancel/confirm
entry, trip goal read/set, Sync, all three break types and confirmations,
downtime/resume, Trip Log, mic interaction through an open modal, sleeping-command
rejection/wake, summary/next-entry and standalone breaks. A 40-second trip is used
for ordinary transitions. One 1:05:00 trip uses a virtual clock to cross the hour
boundary and verifies that exactly one indexed overflow ring remains active and
that the active ring changes. No hour-long wall-clock wait is needed.

Each checkpoint asserts resulting behavior, released coordinator locks, no pending
transactions and no browser exceptions. Master runners also select every non-Time
case from `order-filler-state-contract.json` for their input method, plus automatic
cases. Independent reviewed expectations cover state, required/forbidden commands,
ordered announcements/chimes, event writes and rejection/rollback. Setup may seed
an initial state directly; the journey itself uses presses or SpeechMenu inputs.
Support suites cover the clock FSM, inventory, log/aggregates, summary, persistence,
goal cascades, failure consolidation, Sync availability, range permissions, settings,
menu geometry, modal behavior, response columns and diagnostics.

The inventory and behavioral contract remain incremental. Unreviewed families are
included in `fsm-report.json`. Passing these tests does not establish every possible
combination of states; new states/transitions need reviewed contract cases.

Voice delivery runs Fast (240 words/minute), then Medium (160), then Slow (90).
The voice journey now synthesizes audible WAV clips, substitutes only the microphone
source with a Web Audio MediaStream, and leaves SpeechMenu, its AudioWorklet resampler,
VAD, grammar selection and recognizer intact. Expected text stays in Node: it is
never sent to SpeechMenu or to the decoder as a recognition result. A two-second
silent tail gives the normal silence/continuation logic time to finish. A committed
surface transition is also a valid end boundary even when that transition cancels
the old decoder before its final callback. The workflow still asserts actual UI/FSM
results and released locks, rather than treating a recognized word as a passed action.

`DiagnosticSpeechAudio` owns synthesis, rate/voice/locale cache identities, PCM WAV
encoding and virtual-microphone installation. It uses the test-only eSpeak NG
Emscripten port pinned to upstream commit
`7ab07eba2d966ce45040c88d9be953e1d68640e7` (GPL-3.0, with its upstream COPYING).
Source: https://github.com/echogarden-project/espeak-ng-emscripten . The pinned API
accepts rate in words/minute; tests check that 240/160/90 produce different actual
audio lengths. `tests/languages/<locale>/profile.cjs` declares the reviewed synthesis
voice and recognizer/model identity; missing acoustic profiles fail explicitly.
The current profile uses en-US and Vosk small en-US 0.15. Synthetic speech tests one
speaker/pronunciation style; it does not establish accuracy for human speakers,
noise, physical microphones or speaker-to-microphone echo. Announcement audio is
stubbed to prevent it becoming unintended test input; announcement assertions remain
in the separate FSM/model cases. Time/duration matrices remain exhaustive parser/
Numberpad tests, not hundreds of thousands of synthesized recordings.

Root grammar routing keeps a provisional value-first command in competition with
literal heads until its required suffix arrives. A partial `three` must be able
to revise to `trip mode`; a complete number-first goal still follows its declared
suffix. At a mixed root, those alternatives contribute their bounded word
vocabulary rather than hundreds of repeated numeric phrase transitions; typed
collectors retain their full phrase vocabulary. Optional value continuations come only from the matched command, not from
unrelated time/duration commands. Routing also accepts a first partial that already
contains both the command head and its value.

`VoskRecognizer.transcriptMode` declares cumulative hypotheses: SpeechMenu replaces
revised partials directly instead of appending its segment-recovery prefix. Adapters
that emit segment-local text retain the existing recovery behavior. Model tests
cover revisions, duplicate prevention, optional values and segment compatibility;
`node tests/vosk-command-head-browser.cjs` verifies actual Trip mode selection from
Year mode with audio at 240/160/90 WPM. The virtual audio fixture uses a silent
Web Audio output sink so headless runs do not depend on speaker hardware; real
PCM processing and recognition remain active. The full audio workflow remains a
separate gate and can still report other recognition failures.

The same bootstrap constraint applies to projected continuation grammars. Otherwise
opening the break selector reintroduces full numeric phrase weights and can turn
`okay` into a number before confirmation. `node tests/vosk-break-selection-browser.cjs`
uses real audio at all three rates to open the selector, choose Short break and
confirm in one utterance, checking the selected break type and released locks.
Master failures also print their expected/heard synthetic phrase evidence in CI
so failures can be diagnosed without exporting an entire artifact directory.

### Decoder replay boundaries for Version 2

Decoder replacement replays the complete bounded utterance PCM instead of a
320 ms tail plus a guessed text seed. A tail can start inside a word; merging
its hypothesis with an older seed can turn 110 into 610 or duplicate a duration.
The replay grammar includes the consumed literal/value prefix. Decoder-local
endpoints accumulate once, and the adapter strips the exact consumed prefix
before passing the remaining hypothesis to the router. A revision of that
consumed prefix fails closed; uncommitted words remain revisable.

History defaults to 60 seconds (3.84 MB of mono Float32 PCM at 16 kHz), is
configurable from 1 to 300 seconds, and is released on finish, abort and close.
Exceeding the bound rejects the utterance. Full replay costs additional decoding
work at each switch; a future native implementation can replace it with a
sample-aligned handoff while retaining the same ownership and prefix contracts.

An unambiguous optional-value head opens its typed collector while preserving
head-only readback. Atomic digit groups stay revisable until a following token
establishes their boundary. Vosk terminal command effects wait for a final result
or an explicit following command; opening a declared continuation surface keeps
its existing behavior. Sleep is an execution boundary: partial wake hypotheses
cannot activate the UI. `[unk]` gives out-of-grammar sounds a rejection path
instead of forcing every sound into an available command.

The focused command-head audio regression also checks setting 110 percent and
reading it back at all three delivery rates. The virtual audio fixture retains
its AudioContexts throughout browser startup to prevent pending worklet promises
from being collected; it still processes real PCM through VAD and Vosk.

`CLOCKTIMER_SPEECH_DELIVERY=fast` selects one delivery rate. Voice masters default to
real audio. `CLOCKTIMER_VOICE_INPUT=transcript` explicitly selects the older growing-
text simulation for FSM-only debugging; diagnostics workers force `audio` for voice.
Supporting FSM/model cases remain independent deterministic checks and are labeled
`model`, not acoustic coverage. Press cases are labeled `press`.
`--journey-only` omits supporting suites during development; full masters are the gate.

Audio and transcript-simulation journey reports use separate `audio/` and `transcript/` subfolders under each delivery rate, so simulation cannot overwrite acoustic evidence. Generated WAVs and metadata live under
`tests/artifacts/language-tests/<locale>/audio/`. Journey reports retain the expected
phrase, exact waveform SHA256, real partial/final transcripts and capture-end events.
Published per-test records contain bounded `audioClips` replay references plus
`inputLayer` and `recognizer`. The protected results table shows a collapsible Audio
section with players and Expected/Heard text. `GET ?audio=<64-hex-key>&locale=<locale>`
serves only a validated cache file behind the existing diagnostics authorization;
there is no arbitrary file path or remote audio URL. Session credentials never enter
clip metadata. No transcript fallback is allowed when recognition fails, and missing
planned results still end incomplete.

For Version 2, preserve these boundaries: a source adapter supplies PCM sound;
production capture/recognition decides the words; a workflow oracle asserts behavior;
a report adapter preserves the sound, hypotheses and outcome. Keep text-only FSM
fixtures separate so their pass cannot be mistaken for acoustic recognition passing.

Focused verification:
`node tests/diagnostic-speech-audio-test.cjs` checks WAV sound, real rate differences
and exact replay. `node tests/order-filler-acoustic-smoke.cjs` runs all three speeds
through real Vosk, asserts that transcript-injection hooks do not exist, and checks
that a silent waveform produces no recognized words. Install the pinned Vosk assets
first with `python deploy/install_vosk_assets.py` for local runs. Deployment-targeted
runs load the actual served recognizer/model instead.

The first audio-driven Fast workflow run (2026-10-21) failed login because
“zero zero four two okay” was recognized as “zero zero four two”, leaving the ID
unconfirmed. This is retained as a failed acoustic workflow, not patched into a
passing expected result. Medium audio reached goal entry but the goal remained 100% instead of 110%; Slow audio reached Trip mode and failed to select it. The three-rate capture/recognizer smoke tests pass. These workflow failures are not replaced with text injection or relabeled as passes.

## WMOF homepage panes

The homepage remains `index.html`, generated from `templates/pages/index/`; `index.php`
serves the same templates with the selected language. There is no `index2.html` source.
Visible home buttons replace the hamburger popover. `main.js` uses the shared
`PanePage.showView()`/`back()` methods for Admin, Trainer and Dev Tools, including
reduced-motion handling and restored button focus. Each view scrolls within the
available viewport height; its Back/header stays sticky. Permission changes and
logout reset inaccessible panes. Profile and login keep their existing dialogs.

The press master runs `main-page-browser.cjs` for desktop/mobile overflow, group
navigation, Back/Escape, focus restoration, permissions and login/logout. The existing
`main-page.mjs` model test checks rejected login/logout and confirmed session handoff.
Update the shared template source and regenerate static HTML with
`node scripts/build-pages.cjs` rather than editing the generated homepage directly.

## Language corpora and numeric paths

`tests/languages/<locale>/profile.cjs` selects the workflow phrase map and numeric
corpus. The shipped complete corpus is currently en-US. Additional languages need
their own reviewed phrases, generators, expected values, and localized announcement/
state-contract fixtures. A requested locale must match the language actually rendered;
missing corpora fail explicitly. No fallback is reported as another language passing.

English duration paths include explicit word/numeric/mixed units, `a`/`an`, omitted
lower units, `an hour and five`, `one hour 5 minutes`, positional/cardinal groups,
colon notation, raw digits, individual digits, zero synonyms, double/triple digits,
unit abbreviations and Numberpad forms with/without leading zeroes. Time paths cover
24-hour and AM/PM forms, numeric/cardinal forms, zero synonyms, noon/midnight,
relative past/after/to/till/until, today/tomorrow, and Numberpad seconds. Each case is
labelled with its path. These are exhaustive numeric values over finite supported
phrase families, not every possible paraphrase. The clock voice parser currently
accepts minute precision; seconds are checked where supported by Numberpad.

Expected milliseconds and dates come from the generator's integer components,
independently of the application's parsers. Matrices use the actual Voicepad value
implementation and Numberpad digit controller in the full app fixture, bypassing
thousands of unrelated persistence transactions. They do not feed audio through the
recognizer. Workflow masters exercise those wrappers and streaming partials.
The current en-US corpora generate 127,360 duration cases across 30 paths and
108,674 time cases across 24 paths. Counts are derived before execution and checked
against completed cases. Zero rejection/format behavior is tested explicitly.

The expanded tests uncovered and fixed two language-parser defects: complete
cardinals such as “twenty two” were split by an hour/minute fallback; relative times
to twelve AM/PM did not roll the meridiem across noon/midnight. Focused regressions
remain alongside the generated corpus.

## Files and live progress

Local artifacts are organized as:

```text
tests/artifacts/language-tests/
  summary.log
  en-us/
    duration-en-us.log
    time-en-us.log
    duration-summary.json
    time-summary.json
    order-filler/
      touch/press/report.json
      voice/fast/audio/report.json
      voice/medium/audio/report.json
      voice/slow/audio/report.json
```

The server uses `/var/lib/clocktimer/diagnostics/summary.log` plus
`language-tests/<locale>/{order-filler,duration,time}-<locale>.log`.
Names derive from the tested language/region, never a fixed en-US suffix. The
PHP `OrderFillerDiagnostics` class owns validation, sequential numbering, statistics,
file locking, bounded logs, overwrite and stale-run/principal fencing.

A run writes `test-start`, numbered `test` results, `summary`, then `test-end`.
Every line includes completed/total counts, `test N/total`, run ID, locale, build and
run status. Per-delivery counters are available for master logs. Missing planned
results end as `incomplete`; a completed point never marks the run passed without
its end record. Value runs flush batches during execution, so progress is live.
A new run replaces only the corresponding suite/locale report. Replaced runs cannot
append late results. There is no report history archive.

`POST /api/diagnostics/order-filler/` accepts start/append/progress/end operations.
`GET ?suite=duration&locale=en-US&status=1` reads only the final log line. The tail
reader grows its EOF window for a long language summary; it does not scan the whole
report. Full logs are available through an authenticated GET without `status=1`.
`/diagnostics/order-filler/` polls status every two seconds and shows the language
matrix in Press/Fast/Medium/Slow order, live progress, separate numeric results,
log links and stale-update notices. Polling uses `fetch` without document navigation.
A complete snapshot is fetched before patching stable table/progress nodes; page
and panel scroll offsets are retained at render time, including scrolling during
a pending request. Focused controls remain mounted. Quiet runs are never inferred
to have passed.

## Interactive diagnostics controls and result views

The dashboard has six keyboard-accessible result selectors: Press, Fast, Medium,
Slow, Clock times and Durations. Selecting one filters the individual-results table
and targets Start, Stop, Resume and Abort at that category and language/region.
Only one interactive job runs at once to bound server load. Selecting another
category never changes or interrupts the active job. Return to its selector to
control it. Only the initiating principal may stop, resume or abort a job.

Start replaces only that category's report. Workflow categories now have independent
`press-<locale>.log`, `fast-<locale>.log`, `medium-<locale>.log` and `slow-<locale>.log`
files. Full CI runs retain the combined `order-filler-<locale>.log`; the dashboard
uses whichever run started most recently for each category. Existing combined
reports remain readable. Their outcome counts are reconstructed once and cached,
so failed cases are never counted as passed merely because a lane completed.

Stop is cooperative: an ongoing workflow checkpoint/support test finishes before
the runner waits. Numeric tests stop after their current batch of at most 200
cases. The UI shows Stopping until the checkpoint acknowledges Stopped. Resume
keeps the same process, run ID, numbering and completed results. Workflow browser
clocks are frozen at the stop boundary and resumed with the same test; their timers
cannot run ahead during a long pause. The pause boundary permits a one-second clock
settle before freezing, rather than changing the timer in the middle of an action.
Abort terminates
the job's entire process group, closes open reports as aborted and keeps completed
rows. It never turns unrun tests into successes. A stopped process survives page
navigation but not a deployment/service restart; restart marks it incomplete.

`DiagnosticsJobs` owns the private queue, one-job lock, six-category/corpus
allowlist, principal checks and stop/resume/abort flags. Its API actions are
`job-start`, `job-stop`, `job-resume`, `job-abort`; `GET ?job=1` returns sanitized
status and worker availability. Commands, target hosts and executable paths are
fixed in `services/diagnostics-worker.cjs`, never provided by the browser. The
systemd daemon runs as daemon with a private source/history checkout, CPU/memory
limits and write access limited to `/var/lib/clocktimer/diagnostics`. Deployment
installs a Node 22 runtime verified against its official SHA256 manifest, Chromium
and its system dependencies. It does not change the application's Node packages.
The worker uses the initiating diagnostics session's cookie/CSRF grant, held only
in a private request file and process environment. That request file is removed on
completion, abort or recovery. Session expiry is a failure, never a passed run.

`OrderFillerDiagnostics::results` provides bounded pages using byte cursors, optional
delivery/failure filters and a run ID fence. A poll reads at most 1 MiB and returns
at most 50 rows; sparse filters can require Next to continue scanning. Replacement
resets stale cursors instead of mixing runs. No raw JSON is rendered as a results
panel. Counts and page rows are fetched independently; polling preserves existing
DOM nodes, scroll and focus. Completed Remaining and every zero count render `---`.
Running states are amber and explicitly labeled. Logs are bounded at 256 MiB to
accommodate exhaustive numeric corpora with full per-case metadata.

Dedicated checks: `php tests/diagnostics-jobs.php`,
`php tests/order-filler-diagnostics.php`, `node tests/diagnostics-checkpoint.cjs`,
`node tests/diagnostics-reporter.mjs` and `node tests/order-filler-status-browser.cjs`.

## Restricted access and deployment

Both the page and endpoint require HTTPS and Developer or Superuser permission,
using existing sessions/access-token rules. Cookie writes require CSRF. A permitted
one-use token can be exchanged once for a diagnostics session; subsequent batch
writes use its HttpOnly cookie and CSRF token. Raw tokens/PINs are not logged.
Reports are outside the web root. The deployment creates the private directory.

The deployment workflow gates release on both masters, then runs the served-asset
checks after stamping the build. `GITHUB_SHA` must match the published build commit.
Backend trip/auth/settings calls are intercepted in the test browser: fixture trips
are never written to production. Service-worker speech caching is intentionally
bypassed in this fixture so it cannot hide or bypass test instrumentation. That
cache and physical microphone/echo behavior need separate tests. Local supporting model tests still
run against the checked-out code, not against production APIs.

For server reports, configure the existing permitted token as the GitHub secret
`CLOCKTIMER_DIAGNOSTICS_TOKEN`. Without it, deployed checks still run and their logs
are CI artifacts, but the restricted server log cannot be written. For repeated
CI runs the credential needs sufficient uses/expiry; one-use credentials are suitable
for a single run exchange. Supply credentials in environment variables, not commands.
The report client exchanges a one-use token through the supported `access_token`
query parameter exactly once, then discards it and uses cookie/CSRF requests.
`CLOCKTIMER_TEST_LOCALES=en-US,en-GB` selects multiple available corpora;
only installed/reviewed corpora should be listed. `ORDER_FILLER_TEST_BASE_URL`
selects the deployed application; `CLOCKTIMER_DIAGNOSTICS_URL` can select its report
endpoint. `BROWSER_EXECUTABLE` selects a local Chromium/Edge binary if necessary.

Ordinary pushes/PRs run both masters. Separate path-filtered jobs run numeric
matrices for recognizer/language/corpus changes or manual dispatch. PHP diagnostics
and existing database/access-token checks remain deployment gates. The PHP class,
report client and status page have dedicated storage/protocol/browser regressions.
