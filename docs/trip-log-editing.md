# Trip Log and deferred trips

The hamburger menu and Trip Log share the persisted range, custom dates, and productive/non-productive filter. Predefined boundaries come from calendar rules supplied by the database at login. Changing the selection refreshes the open log and goal aggregates.

The log lists newest trips first, groups longer ranges by month/week/day, and uses week/day groups for pay periods. Group percentages divide summed earned time (Standard plus allowance credit and any official adjustment) by summed productive Actual. Durations use unlimited hours in `h:mm:ss` format.

Expand a trip to access its single actions menu. Edit entries makes each entry selectable; time and duration fields open the existing number pad. Adding and removing intervals changes both boundaries together. Trip settings allow timing, standard duration, and productive status to be changed. Running-trip edits reload the same ClockTimer, preserving automatic goal settings and the active trip ID.

`api/trip-editor/` requires trip ownership; writes also require CSRF and an event revision. Concurrent edits fail with a conflict instead of overwriting newer events. Event appends and edits lock the same trip row. Entries must fit within the trip and cannot overlap.

Defer Trip retains the prepared trip ID and creation time without starting it. Scheduled start initially matches creation time; actual start is blank. Resuming uses the same reservation, permits scheduled-start changes, and sets actual start when Start Trip is pressed. Canceling a prepared trip uses the existing reservation cancellation path.

Every numberpad session uses an inclusive Start/Stop digit anchor. Percentages default to ones, times and durations to seconds ones, and Official Percentage to tenths (`101` enters `10.1%`). Tap a digit or drag across digits to select a range; a 550 ms long press selects all digits. Selected digits are underlined without changing their color. Typing rolls into the selected range; Backspace clears that range while preserving other fields. Select All followed by Backspace clears the value. Reset reloads the original value (including an initially blank value) and restores the default single anchor. The readout stays on one line and fits the available width. AM/PM conversion normalizes valid hours and compares the represented time rather than its notation.

Verification uses PHP calendar/editor/migration tests and JavaScript calendar, Trip Log, number-pad, deferred-trip, and full-app DOM integration tests. The DOM integration covers editing the active clock; graphical browser verification is separate.


## English trip terminology and summary presentation

Use **Active trip** for the assigned/active trip and **Last trip** for the most
recently completed trip. The summary has rows named for the selected scope (Day, Week, Money, Month or Year), Last trip, and
Active trip, with Standard, Actual, and Percent columns. Unavailable values show
`---` and are omitted from announcements. Auto/Trip mode implies day totals.
When automatic database assignment is implemented, the end-of-trip summary can
show the new active assignment’s standard time before its actual/percent exist.
TripSummary.build/render now implement this presentation contract. English
resource UUIDs and saved runtime bindings remain stable during terminology edits.


## Trip Summary class and interaction contract (Version 2)

TripSummary.js owns pure row/announcement construction and accessible table
rendering. app.js owns cancellable lookups, modal lifetime and workflow actions.
Both the Trip Summary command and trip completion use the same renderer.
Auto/Trip summary totals use day; other modes use the selected total range.
The aggregate row displays that localized scope label instead of Total.
Actual means counted elapsed, never raw wall duration. Total excludes the active
assignment; Last is the most recent completed trip, with IDs deduplicated and
UTC timestamps normalized. Missing values display --- and are omitted from speech.

English announcement: “Actual time for your last trip was {duration}. Your
performance was {lastPercent}, and your {scope} performance is {totalPercent}.
Standard time for this trip is {standard}.” The final sentence requires an
active assignment with known standard time. Unknown percentages omit their
clauses without announcing placeholder values. With no available measurements,
announce the localized no-data message.

Only OK is visible. Voice OK and button OK dismiss; if neither a running trip
nor a server assignment exists, they open manual trip entry using the original
voice/pointer input preference. A known assignment suppresses manual entry.
Close/Cancel only dismiss. Other valid root or underlying-context commands
dismiss and execute once; malformed/provisional speech keeps the summary open.
OK is unavailable while lookup is pending; a failed lookup can be dismissed but
cannot create a trip on an unverified absence of assignment. Closing cancels
lookup/queued speech ownership so late responses cannot reopen the window.

The trips-list response may optionally supply activeTrip with assignment ID
and standardTimeMilliseconds. The current server does not automatically create
these assignments; that future backend work remains separate. Explicit null
clears that optional assignment. Do not treat a client-prepared trip ID alone
as proof of a server assignment. The class also supports assignment data
without actual/percent yet, so those cells show ---.

SpeechMenu surface handlers can declare inheritCommands and beforeCommand.
Inherited commands come from the immediately underlying surface; the summary's
OK keeps priority. beforeCommand runs only after matching/preprocessing and
execution authorization, never during provisional grammar probes. This keeps
noise from dismissing informational windows and avoids consuming the command
that follows them. Tests cover exact English wording, missing/assigned rows,
root/Voicepad command continuation, both triggers, dismissal and manual fallback.

Summary percentages display exactly one decimal place, truncating further
digits (123.49% becomes 123.4%). Spoken summary percentages use the same
truncated value. This presentation rule does not change stored precision or
percent formatting elsewhere.


## Official percentage for completed trips

Click a completed trip's percentage to enter the official system result. Active trips and standalone breaks cannot be corrected. The shared numberpad shows the calculated percentage and signed adjustment; an existing override also offers **Clear Official Percentage**. Official results are measurements, so the 150% goal-input cap does not apply.

The entered percentage is authoritative. For productive time P, Standard S and official fraction q, the effective bank credit is qP - S. The displayed adjustment is this credit minus the original unused-break/buffer credit. Standard, work or interval edits recalculate the adjustment while preserving the entered percentage. Trip Log and aggregates use the same effective credit, including signed adjustments; factual timestamps and productive Actual are unchanged.

The database appends `trip.official-percent-set` (integer `percentTenths`, authenticated actor) or `trip.official-percent-cleared` events after Trip End. Existing installations register fixed event types 15/16 on first use. Ownership, CSRF, revision checks and trip-row locking apply. History cannot be edited or deleted, including by deleting/restarting the trip; Clear appends history and restores the original calculation. The log marks corrected percentages Official and displays locked adjustment history after the ordinary entries.

Verification: `tests/numberpad-anchors.mjs`, `tests/official-percent.mjs`, `tests/official-percent.php` and `tests/official-percent-browser.cjs` cover range edits, Reset, time and duration editors, Apply/change/Clear, accounting parity and immutable history. Trip Log settings enroll in the shared modal host before opening; nested numberpads follow its dialog order.
