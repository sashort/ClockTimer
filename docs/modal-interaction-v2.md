# SharedModal and viewport ownership

`SharedModal.js` implements `SharedModal`, `TripLogModal` and `SharedModalHost`.
`SpeechMicBar` inherits from `SharedModal`; Trip Log uses `<trip-log-modal>`.
Every other native dialog has a `<shared-modal>` owner. The wrappers preserve
existing dialog IDs, native open/close events and command-scope selectors.

## Interaction ownership

One `<shared-modal-host popover="manual">` owns the active interaction region.
Registered dialogs open with native `show()` inside it. The host makes the
background inert while leaving every registered open dialog and persistent mic
interactive. Independent native `showModal()` calls would make older dialogs
and the mic inert. Calls through that API are enrolled by a document-scoped
adapter, including dialogs appended and opened in the same synchronous turn.

The host records each surface's original parent, insertion point and focus.
Closing one restores only that surface. Background inertness ends after the
last dialog closes; pre-existing inert state is preserved. Escape dispatches a
cancellable event to the focused dialog, or the most recently opened dialog.
A removed open surface also releases ownership.

The persistent mic moves into the shared host and returns to its app parent
when the last modal closes. Its layout always measures the original app host,
including when speech starts after Login has opened. Moving it preserves its
subscriptions, Commands panel, response columns and independent result TTLs.
Fullscreen numberpad height reserves the mic's safe region. On fullscreen
changes, reinsert the open host into the browser top layer, then promote the
mic. Fullscreen can cover an already-open popover even when it still reports
`:popover-open`; layout refresh alone cannot restore pointer access.

## Input session transfer and announcement ordering

Turning the mic off with Voicepad open transfers the complete numberpad session
to touch input. Preserve mode, source/context, current pending digits, original
initial digits, date/meridiem, workflow, return targets and callbacks. Reset must
still restore the original value, and confirmation must invoke the original
callback exactly once. Muting must not erase these values or bypass validation.

When the mic becomes active with a numberpad open, show and announce exactly
“Switch to voice input?” with OK/Cancel. Both speech and physical buttons work.
OK transfers the same session to Voicepad; Cancel keeps the numberpad. Closing
or replacing that session invalidates any pending prompt.

`microphoneFeedbackCompletion` resolves after both the mic chime and mic speech.
Input-switch announcements wait for this promise and then recheck ownership.
The modal's `announce(text, {after})` owns a cancellable pending announcement;
`cancelAnnouncement()` suppresses a stale queued start. A playback adapter may
return a stop handle for scoped active cancellation. The current AudioEngine
returns a boolean, so already-playing speech has no per-call stop handle.
Neither optional announcement playback nor an input choice holds a persistence
transaction open.

## Viewport ownership

`ViewportLayout` batches fullscreen, rotation, window resize and visual-viewport
resize/scroll over two animation frames. It publishes visible viewport width
and height and refreshes mic, Login, settings, Trip Log and voice editor bounds.
Keyboard/fullscreen events can arrive on different frames; stale pre-login
geometry must not survive the final resize.

## Regression evidence and limits

`tests/shared-modal-browser.cjs` uses actual pointer/keyboard input across two
open dialogs and the mic, checks inert background, independent closing, Escape,
focus restoration and immediate dynamic enrollment. Synthetic event dispatch
alone cannot test browser inertness.

`tests/mic-modal-browser.cjs` exercises the complete page with mobile-emulated
Chromium: real mic taps through Login, Voicepad and Trip Log, value-preserving
mode transfers, spoken/button choices, announcement ordering and fullscreen
viewport changes. Audio and recognizer hypotheses are controlled test adapters.
Physical Android Chrome geometry and acoustic recognition remain live checks.
