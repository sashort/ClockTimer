# Release cleanup audit

Scope: redundant code, obsolete experiments, unused assets, test/debug artifacts,
stale documentation, and irrelevant API endpoints. An optional backend with
reachable callers is not yet proven unused. Remove dependent routes, clients,
service deployment, tests, and documentation together when retiring a feature.
Do not delete recorded speech, account data, or database history as cleanup.

## Verified changes

- Removed the unused production `commandAlternatives` configuration placeholder.
  Shared hypothesis selection remains; the regression that old per-command
  tuning has no effect remains useful.

## Endpoint findings

| Endpoint | Verified caller or dependency | Audit disposition |
| --- | --- | --- |
| `/api/command-check/` | ClockTimer mutation preflight | Active; retain |
| `/api/speech-timing/` | Account speech-rate settings in app.js | Active; retain |
| `/api/speech-corrections/` | SpeechMenu, app.js, speech editor | Active; retain |
| `/api/speech-editor-config/` | SpeechEditorRuntime and editor.js | Active; retain |
| `/api/speech/session/` | Explicit vosk-server backend and configuration | Optional backend; audit retirement as a unit |
| `/api/live-stream/` and `/live-stream-ws` | Publisher/viewer sessions, grants, and signaling | Active; investigate failure rather than remove |
| `/api/inbound/` | External developer upload utility | No browser caller found; external use not yet ruled out |

## Deployed issue evidence (2026-10-23)

Live build: GEPWL0, commit 7d324be164f58056ba166c7a2ad06269090dd6ce.
Public deployed ClockTimer.js, TimerSummaryView.js, and LiveTripStream.js match
that commit. app.js is transformed at deployment; do not assume byte equality.

`tests/aggregate-percent-history-browser.cjs` supplies nine dated synthetic
trips through a range-filtered mock API. It verifies distinct Day, Week, Money,
and Year totals and checks the visible #currentPercentValue after starting in
Trip mode and switching scope. It passes against local and public deployed
JavaScript. Authentication, data, and audio feedback are mocked; this does not
reproduce or disprove the reported account-specific freeze. Sync and Override
are off in these runs; their matrix remains to be checked.

Public HTTP request to /live-stream-ws returns 400 (upgrade required). An
unauthenticated upgrade request reaches authorization and returns 401. This
establishes proxy/service reachability only, not a valid authenticated socket.
Authenticated diagnostics and the user's actual aggregate response are still
needed. Neither deployed bug is considered fixed.
