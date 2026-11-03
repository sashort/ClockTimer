# Down Time review and Trip Log

Down intervals have Pending, Approved or Unapproved status. New intervals and
new timeline entries start Pending. Entering an approved duration sets Approved
(including an explicit zero). Clearing that duration asks for Pending or
Unapproved; cancelling leaves the previous state intact.

The account setting `wmof.clock.includePendingDownTime` defaults on. Its menu
label is **Show Pending Down Time**, shared by the hamburger menu and Trip Log.
Both surfaces read and write the same preference; it controls display and accounting together. It applies to all Pending intervals, both
earlier intervals and the current open interval, and to aggregate projections.
It never changes an interval's review status. Approved uses the entered amount;
Unapproved counts as work. Physical Down state, controls and avatar do not
change when the master is toggled. Elapsed/Remaining tick while open Pending is
counted as work; End Time remains fixed until its normal target expiry. With
Pending deducted, productive time freezes and the projected End Time advances.

Stored counted totals always use Pending deducted, regardless of the viewing
policy. GET `api/trips/?includePendingDownTime=false` reconstructs the read
projection using the already-batched event data; it does not update the trip.
The same policy is applied to cached/offline trips. Snapshots carry the policy.
No database column is required: approval state uses the existing interval audit
metadata and approval-change events.

Trip Log has a collapsible Down Time section. Its summary shows Approved +
Pending when the master is on, otherwise Approved. The expanded section shows
Pending, Approved, Unapproved and Logged. A partially approved interval's
unapproved remainder is included under Unapproved; approved surplus is retained.
When all three categories total zero, the section is hidden and its filter is
disabled in settings with its saved check value retained and its label struck
through. It does not filter while unavailable, and resumes when Down Time
returns to the selected range. Category labels, seconds and `(### ms)` are left aligned. Totals append smaller
milliseconds on the baseline; Logged uses full-size milliseconds.

**Trips with Down Time only** is inside the expanded section. **Adjusted trips
only** is in Trip Log settings. Both combine with existing date and production
filters and intersect when enabled together. Cleared official corrections do
not qualify. Filter and collapse choices are account preferences under
`wmof.clock.tripLogView`. Filtering preserves the underlying source list and
active edit drafts. Zero matching trips leaves controls available.

**Show Pending Down Time** is the same global calculation/display master in
Trip Log and the hamburger menu. While the
Down-only filter is on, Pending is forced visible. The checkbox keeps its stored
check value, becomes disabled, and its label is struck through while overridden. Turning the filter
off restores and re-enables the previous preference without changing the shared calculation/display master.

The completed summary's last-trip percentage opens the same official percentage
editor as Trip Log, including Clear and the optional derived Official Start.
The last-trip elapsed display uses `(Standard + original allowance credit) /
(official percent / 100)`. Clearing restores its calculated value. This is an
accounting display; factual boundaries and durations are never rewritten.
An official zero percent has no finite equivalent elapsed duration and displays
an unavailable elapsed value.

Regression coverage: `pending-down-master.mjs`, `pending-down-accounting.php`,
`pending-down-master-browser.cjs`, `down-approval-editor.mjs`,
`trip-log-down-filters-browser.cjs`, `summary-official-percent-browser.cjs`.
