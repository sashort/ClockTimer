# Historical aggregate ranges

The existing Start date in the hamburger Trip Log submenu and Trip Log settings
is editable for Day, Week, Money/pay-period, Month and Year. Selecting a date
resolves the verified employer period containing that operating date. Start is
snapped back to the period boundary when needed; End is derived and read-only.
Custom ranges retain independent editable Start and End fields. No new date
picker is added.

The selected anchor date is shared by the main aggregate view and Trip Log and
saved as `wmof.clock.tripLogAnchorDate`. Period resolution honors the calendar's
timezone, cutoff and fiscal/pay-period anchor, including DST. Missing calendar
coverage is reported through the existing range error instead of guessing.

Ranges not containing now show a Historical indicator with their dates and a
**Return to Active** action in the selector/menu and Trip Log. That action clears
the anchor and resolves the active period containing now. While browsing a past
period, a running trip outside the range is excluded from historical aggregate
work, percentage, banked time and inferred-goal calculations. Its actual trip
state, events, controls and clock remain intact. The historical bar uses the
historical aggregate performance, and the historical Standard readout uses that
aggregate's Standard Time.

Tests: `calendar-historical.mjs`, `historical-range-browser.cjs`,
`calendar-ranges.mjs`, `calendar-login.mjs`, and the timer accounting/FSM suite.
