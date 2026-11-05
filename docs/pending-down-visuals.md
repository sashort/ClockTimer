# Down Time visual presentation

Trip Log and the dedicated editor use the effective Clock Timer range colors,
including user choices and theme overrides. Log/editor accents are mixed with
30% luminance-matched grey. Neutral greys stay unchanged, and Clock Timer's
colors retain their original saturation. Existing theme backgrounds remain;
readout and badge text uses contrasting white/black rather than muted ink.

- Pending and Approved use Down; Unapproved uses Deficit.
- Signed Net uses Surplus when positive, Deficit when negative, Down at zero.
- Break and Lunch markers/brackets use their corresponding range colors.
- Ignore Pending uses Not Applied badges and patterned edges.
- Pending-only leaves finalized values in totals and marks them Totals Only.
  Net is Mixed when the trip combines Pending and finalized Down.
- Adjacent deficit/surplus cells share one patterned edge, keeping their own
  captions, badges, and divider. Mixed remains distinguishable by its badge.
- Accounting rows are flex rows. Recorded/Pending occupy the first row;
  Approved/Unapproved/Net occupy the second when applicable. One/two/three
  items share 100%/50%/one-third respectively.
- Consolidated Trip Log intervals retain separate original start/end timestamps,
  aligned to circles with one bracketed caption. Reviewed Down and Break/Lunch
  adjustments use a second line, with the stopwatch vertically centered.
- Every adjacent timeline node is connected center-to-center using a gradient
  between endpoint colors. There are no disconnected intervals or terminal tails.
  All nodes, including Add Entry, have a 14px outer diameter.

`tests/down-time-visuals-browser.cjs` renders production components in both themes,
checks all three pending modes and Net signs, measures connector geometry and
mobile text fit, verifies equal-width rows, and checks the effective palette.
The test is part of the production deployment gate. Screenshots can be saved by
setting `DOWN_VISUAL_OUTPUT` to an output directory.
