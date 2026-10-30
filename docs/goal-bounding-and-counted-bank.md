# Goal Bounding and counted-time bank update

Status: implemented. Release verification covers the model, real browser UI, voice commands, persistence and shared rendering.

## Accounting contract

Unused break plus buffer allowance is earned time. Percentage = (Standard + unused allowance credit) / productive counted time. Aggregate numerators and denominators are summed before division; percentages are never averaged. Goal budget = earned time / goal percentage - productive time. Preserve raw trip/event facts and legacy stored fields; no historical database rewrite is required.

The regression trip has Standard 176000ms, productive time 289957ms and credit 1013189ms. It must show 410.13%, and that credit must improve every aggregate that includes it. Cover non-100% budgets as well as 100%.

## Goal Bounding policy

The menu item and commands are Goal Bounding. On is the default. On enforces a preferred 100% floor on inferred Trip requirements, including direct Trip goals, Auto candidates and Sync calculations. Do not compare the saved aggregate percentage to 100% or rewrite it. Existing syncOverride false migrates to goalBounding true; true migrates to false. Retire the old Sync Override command names. Announce Goal Bounding on/off before resulting recalculation announcements.

Each candidate must retain saved goal, raw inferred Trip requirement, bounded target and fallback status. When the bounded target is missed, retain the candidate and recalculate without bounding. If the raw goal remains achievable, use it as a less desirable fallback; only a missed raw goal is an actual goal failure. Rehydration must derive the same state without repeating transition announcements.

## Integration and transition coverage

Use the same projected goal state for time budgets, Auto selection, selector text, goal dialogs/numberpad, bar positions and labels, target border, announcements and Drop-In. Cover toggles, manual and inferred goals below 100%, bounding release, raw goal failure, merge/split and target transfer animations, several goals crossed in one tick, user goal edits, breaks/Down, reload and rapid interruptions. The existing explicit goal input maximum remains separate from this 100% floor policy.

## Fractional-second indicators

Superscripts express the omitted fractional correction to the displayed value, not trends or performance. Remaining truncates toward zero; a positive fraction uses plus and a negative fraction minus. Elapsed rounds magnitude up before restoring sign; its correction is minus for positive durations and plus for negative durations. End Time floors the absolute timestamp to whole seconds and always shows plus for a nonzero fractional second, including while running and on every bar goal time. Exact whole-second values have no suffix. Standalone-break duration readouts retain their no-suffix exception. Normal running duration readouts suppress transient fractions; the goal countdown and main duration readout share this policy. Frozen durations retain their correction, while End Time retains its fractional marker in every state. TemporalFormat.timeReadout owns whole-second rounding and the correction sign for both durations and absolute times, normalizing floating-point residue to millisecond precision. Goal countdowns use productive-time budgets rather than subtracting wall-clock timestamps. Keep caption taps reserved for cycling modes.


Implementation evidence: `ClockTimer.js` owns the projection; `TripAggregates.js`
provides the shared earned/work calculation; `TimerSummaryView.js` renders both
Order Filler and Drop-In. Tests: `goal-bounding.mjs`, `goal-bounding-browser.cjs`,
`fractional-time-indicators.mjs`, `trip-time-bank.mjs`, `trip-time-bank-browser.cjs`,
`trip-log.mjs`, `counted-time-accounting.mjs`, and the voice/touch feedback suites.

The Goal Bounding menu icon is an upward arrow above a horizontal floor line.
The adjacent switch remains the authoritative On/Off control.

Menu state colors: Goal Bounding, Sync Goals, Speech Recognition, Trip Log pin and
Speech Training use light-blue icons/text when On and gray when Off. Goal Bounding
keeps its green enabled switch; it does not use an Off slash. Drop-In's mirror and
mute checkbox options share the same checked/unchecked palette. Disclosure arrows,
radio selections, disabled availability and runtime/network badges remain separate
state cues. A sleeping microphone is still enabled, with its existing Muted status.
