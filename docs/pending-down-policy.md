# Pending Down Time policy and presentation

Show Pending Down Time is a stored master preference. Show Trips With Down Time
Only forces its effective value on while leaving that preference editable.
A diagonal checkbox mark and caption strikethrough appear only when the stored
and effective values differ. Removing the filter restores the stored choice.
The override must be resolved from the incoming dataset before projecting rows.

Pending time is deducted from productive work when effectively on. When off,
it counts as work. Both Down intervals are applied in a single projection;
policy switching cannot change the break allowance or late-return accounting.
A planned break/lunch excludes at most its length plus buffers. Its late return
continues to count as work. Unused allowance is a separate bank credit.

The sanitized pending-down-late-lunch fixture reproduces two pending intervals,
a buffered Lunch and a late return: 3,154,944 ms productive with Pending applied
(98.45%), 5,055,619 ms without (61.44%). The prior server projection mistakenly
excluded an additional 501,495 ms of late Lunch when Pending was off. Reapplying
Pending locally then produced 117.06% before the canonical response restored
98.45%; a filter override could leave that incorrect result displayed.

Down-only ledgers get a darker background and muted text when none of their
recorded time is applied. Recorded timeline entries remain available. In the
editor, only the unapplied Pending amount is muted; timestamps, camera and
editing controls remain usable. Multiple-interval footer Pending uses the same
category fill. Approved time remains normally styled.

Tests cover PHP/client parity, repeated policy changes, immediate cached versus
later server renders, incoming filter overrides, editable preferences and
pending-only ledger styling. Production trip records are not modified by these
read-side changes.


## Tri-state preference and category shortcuts

`wmof.clock.pendingDownTimeMode` stores `pending-only`, `all`, or
`ignore-pending`. Legacy true maps to `all`; legacy false maps to
`ignore-pending`. The shared hamburger and Trip Log control cycles checked
(Pending only), mixed (All), unchecked (Ignore). Down-only filtering never
changes this preference or its appearance. ClockTimer and API calculations
continue to use the derived Boolean: pending is included except in Ignore.

Pending-only hides finalized-only Down trips from individual trip rows, with a
count notice, while retaining mixed and no-Down trips. The separate Down-only
filter still hides no-Down trip rows, without changing scope counts, aggregate
headers, totals, the goal bar, or Clock Timer. Aggregate rows with no visible
trips are also hidden; visible parent totals still include those trips. Hidden finalized trips continue to contribute
to aggregate counts and totals.

Ledger category shortcuts search the 24 combinations of the three-state mode,
Include Active Trip, Adjusted Trips Only, and Down-only filtering. They retain
all contributors, minimize extra trips, and use ordinary user-visible settings.
The Down dialog closes before changed checks are highlighted in Settings;
Settings then closes automatically. No changes means no Settings interruption.

## Down interval navigation

Individual Down interval labels in Trip Log open the exact interval in the
editor. Double-tapping also opens its approved-duration numberpad. Pending
intervals prefill recorded Pending duration; approved intervals prefill their
approved value.

The trip's Down ledger opens the editor at its summary for multiple intervals,
or its only Down interval. Double-tapping also opens total approval entry.
The editor's summary opens total approval entry when clicked anywhere.
An all-Pending group prefills total Pending; other groups prefill total Approved.

Combined approval fills Down intervals in chronological order up to each
recorded duration, then moves to the next. Any surplus is retained on the final
interval so the entered total is preserved. Intervals receiving no allocation
become Unapproved. Clearing the group prompts for Pending or Unapproved and
applies that state to every interval. All changes remain drafts until Save.
