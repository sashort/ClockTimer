# Live autosync and reconstruction regression test

Install the pinned Happy DOM dependency with npm install in tests/.
Set CLOCKTIMER_LIVE_TEST=1, CLOCKTIMER_TEST_USERNAME and
CLOCKTIMER_TEST_PASSWORD to a dedicated test account, then run
npm run test:trip-sync. CLOCKTIMER_BASE_URL and CLOCKTIMER_TEST_OUTPUT
can select the deployment and output directory.

This test creates three mock trips in the live account, intentionally retains
them, and writes mock-trip-data.json and trip-autosync-test-report.json.
It covers online property autosync, offline buffering/reconnect, an interruption
between stop-event acceptance and timing-row update, idempotent retry, event
replay, and equality of persisted and reconstructed timing.
Mock times are September 17, 2026; interval mock-label attributes identify the
online and offline scenarios. Created IDs are listed in the report.

The existing client code runs in a DOM simulation. CSS registration and visual
animations are stubbed, while persistence uses real HTTPS APIs. This test
does not validate browser rendering or the app's reconnect controls.
Credentials come from environment variables and are never written to artifacts.
