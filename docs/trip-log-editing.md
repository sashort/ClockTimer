# Trip Log and deferred trips

The hamburger menu and Trip Log share the persisted range, custom dates, and productive/non-productive filter. Predefined boundaries come from calendar rules supplied by the database at login. Changing the selection refreshes the open log and goal aggregates.

The log lists newest trips first, groups longer ranges by month/week/day, and uses week/day groups for pay periods. Group percentages divide summed standard time by summed actual time. Durations use unlimited hours in `h:mm:ss` format.

Expand a trip to access its single actions menu. Edit entries makes each entry selectable; time and duration fields open the existing number pad. Adding and removing intervals changes both boundaries together. Trip settings allow timing, standard duration, and productive status to be changed. Running-trip edits reload the same ClockTimer, preserving automatic goal settings and the active trip ID.

`api/trip-editor/` requires trip ownership; writes also require CSRF and an event revision. Concurrent edits fail with a conflict instead of overwriting newer events. Event appends and edits lock the same trip row. Entries must fit within the trip and cannot overlap.

Defer Trip retains the prepared trip ID and creation time without starting it. Scheduled start initially matches creation time; actual start is blank. Resuming uses the same reservation, permits scheduled-start changes, and sets actual start when Start Trip is pressed. Canceling a prepared trip uses the existing reservation cancellation path.

The number pad has a separate backspace control: tap to delete a digit, hold to clear. AM/PM conversion normalizes valid hours and compares the represented time rather than its notation.

Verification uses PHP calendar/editor/migration tests and JavaScript calendar, Trip Log, number-pad, deferred-trip, and full-app DOM integration tests. The DOM integration covers editing the active clock; graphical browser verification is separate.
