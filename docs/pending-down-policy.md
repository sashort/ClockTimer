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
