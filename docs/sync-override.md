# Sync Override

Sync Override is a persisted user option, off by default. Sync normally clamps its
calculated trip goal to the manual/default trip goal. Override allows the original
calculated value below that floor. Keep the raw calculated value separate from the
applied goal so both announcements and UI can explain the floor condition.

- `sync override`: announce “Sync override on/off.” without changing it.
- `sync override on/off`: set the option and recalculate.
- `sync on override`: enable Sync and Override together.

The menu keeps the existing Sync arrows and badges. A separate Sync Override switch
appears beneath Sync. It shows the saved state while disabled when Sync cannot
currently calculate a goal. Voice commands may configure the saved option even
while it is inapplicable. Changing it runs the normal goal recalculation path,
including Auto dependencies, remaining time and end-time rendering. Keep this
option in transaction checkpoints and mirrored observer snapshots too.

Sync announcements include “Sync override on/off” whenever the raw calculation is
below the floor. Explicit option changes announce the option state and the new trip
goal when it changes; suppress duplicate automatic feedback during that operation.
The initial login Sync announcement remains suppressed.

The shared percentage layout in TimerSummaryView.js and app.css remains common to
Order Filler and Drop-In: four columns, equal percentage track widths, independently
fitted fonts, fixed-size Sync aligned to the cloud, and an animated zero-width Sync
track when hidden.

Validation: sync-try.mjs, custom-range-goals.mjs, vosk-collector-browser.cjs and
percent-summary-layout-browser.cjs in tests/ cover floor calculation, override
recalculation/rollback, voice forms, touch switch behavior and both page layouts.
