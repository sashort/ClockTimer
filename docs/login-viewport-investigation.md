# Navy gap below the mic bar after login

Reported symptom: after ID/PIN login on Android Chrome, a navy region sometimes
remains below the mic bar. Fullscreen and the software keyboard are suspected
triggers, not established causes. A photo confirms a substantial gap; actual device viewport metrics
have not yet been captured. No application behavior has been changed for this
investigation.

## Photo evidence from the affected device

The supplied phone photo shows a substantial, solid blue region below the entire
mic bar, with the Commands strip and microphone row above it. No software
keyboard or login dialog is visible. This is visibly larger than the normal
8-CSS-pixel inset measured in desktop emulation; the photo is not a reliable
source of CSS-pixel measurements. The current symptom therefore cannot be
explained by that small baseline inset alone.

The photo establishes the post-login appearance, but does not reveal app bounds,
viewport metrics, fullscreen API state or event ordering. A shorter app exposing
the body and a full-height app with a raised mic bar remain distinct hypotheses.
The controlled stale-height experiment below remains a possible mechanism, not
a confirmed diagnosis of this device.

## Measurements from desktop Chromium mobile emulation

Run `node tests/login-viewport-diagnostics.cjs` with Playwright available and,
if needed, `BROWSER_EXECUTABLE` pointing to Edge/Chromium. The fixture mocks the
backend, recognition and audio, using the existing mic-modal browser fixture.
It performs actual login with ID/PIN focus changes, with and without a real
fullscreen transition. A desktop headless browser does not present Android's
software keyboard.

At 390 x 844 CSS pixels, both normal and fullscreen login settled with:

| Measurement | Observed |
| --- | --- |
| Window and visual viewport height | 844 px |
| App height and bottom | 844 px |
| Mic bottom | 836 px |
| App bottom padding | 8 px |
| Gap below app | 0 px |
| Gap below mic | 8 px |

The ordinary 8-pixel gap comes from the current app padding. It does not establish
that the user's reported gap is this size or shares this cause.

## Controlled stale-height mechanism

`ViewportLayout.js` writes visualViewport.height into --app-viewport-height.
`app.css` uses that fixed pixel value for the app's height. SpeechMicBar caps its
bottom position using the app's content bounds. Body background is rgb(0,30,96),
matching navy exposed when the app is shorter than the visible area.

The diagnostic fixture deliberately overrides visualViewport.height to 500 and
sends resize. It then restores the metric to 844 without a resize notification.
This is a synthetic missing-event experiment, not an Android keyboard emulator.
The app remains 500 pixels high and the mic bottom stays at 492, exposing 344
pixels below the app and 352 below the mic. Sending resize recovers the 844-pixel
app and its normal 8-pixel mic inset.

This establishes that stale viewport measurements can produce the reported
appearance. It does not establish that Android misses an event, reports a stale
height, or that fullscreen is the trigger. Ordinary fullscreen login alone did
not reproduce a large gap in this environment.

## Capture the actual affected device

While inspecting the Android Order Filler tab through browser DevTools, paste
`scripts/login-viewport-diagnostics.js` before reproducing login. It installs
`LoginViewportDiagnostics` only in that tab. It makes no network requests and
records geometry, focus identifiers and login open/closed state; never ID/PIN
values, recognition transcripts or API responses. There is no automatic upload.

Immediately after the navy gap appears, evaluate:

```js
LoginViewportDiagnostics.capture('navy-gap-visible');
JSON.stringify(LoginViewportDiagnostics.report(), null, 2);
```

The bounded local timeline samples resize, visual viewport changes, fullscreen,
focus changes and login dialog visibility, including delayed samples at 100,
350 and 1000 milliseconds. `LoginViewportDiagnostics.stop()` removes listeners,
observers and timers; reloading the page also removes the recorder.

Interpretation:

- Visual viewport is full height but app retains a shorter pixel override:
  stale app measurement or missed reconciliation.
- App matches a still-short visual viewport while window/document are taller:
  browser viewport reporting or keyboard state needs investigation.
- App fills the visible viewport but mic has a large inset: investigate mic
  positioning/host bounds independently.
- All geometry fills the viewport and only the 8-pixel padded inset remains:
  distinguish the report from that existing styling before changing sizing.

Raw timeline output is written locally to
`tests/artifacts/login-viewport-diagnostics.json` when the browser fixture runs.
It is diagnostic evidence, not a production-device capture or saved pass claim.
