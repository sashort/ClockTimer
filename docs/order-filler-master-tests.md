# Order Filler master tests and diagnostics

Run from `tests/` after `npm install` and `npx playwright install chromium`.

| When | Command | Coverage |
| --- | --- | --- |
| Ordinary changes | `npm run test:order-filler:press` | Browser presses, pointer FSM contract cases, supporting UI/model tests |
| Ordinary changes | `npm run test:order-filler:voice` | Fast → Medium → Slow progressive transcript journeys, voice FSM contract cases, supporting speech/UI/model tests |
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
Each phrase arrives as growing partials at that cadence, followed by its final
result. Traces retain partial timestamps, and the test checks that every word was
actually delivered at the configured pace. This exercises continuation/FSM timing;
it does not test acoustic recognition or a physical microphone. Announcement rate
is not changed. `CLOCKTIMER_SPEECH_DELIVERY=fast` selects one rate for diagnosis.
`--journey-only` omits supporting suites during development; full masters are the gate.

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
      voice/fast/report.json
      voice/medium/report.json
      voice/slow/report.json
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
log links and stale-update notices. Quiet runs are never inferred to have passed.

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
cache and acoustic decoding need separate tests. Local supporting model tests still
run against the checked-out code, not against production APIs.

For server reports, configure the existing permitted token as the GitHub secret
`CLOCKTIMER_DIAGNOSTICS_TOKEN`. Without it, deployed checks still run and their logs
are CI artifacts, but the restricted server log cannot be written. For repeated
CI runs the credential needs sufficient uses/expiry; one-use credentials are suitable
for a single run exchange. Pass credentials in environment variables, not commands
or URLs. `CLOCKTIMER_TEST_LOCALES=en-US,en-GB` selects multiple available corpora;
only installed/reviewed corpora should be listed. `ORDER_FILLER_TEST_BASE_URL`
selects the deployed application; `CLOCKTIMER_DIAGNOSTICS_URL` can select its report
endpoint. `BROWSER_EXECUTABLE` selects a local Chromium/Edge binary if necessary.

Ordinary pushes/PRs run both masters. Separate path-filtered jobs run numeric
matrices for recognizer/language/corpus changes or manual dispatch. PHP diagnostics
and existing database/access-token checks remain deployment gates. The PHP class,
report client and status page have dedicated storage/protocol/browser regressions.
