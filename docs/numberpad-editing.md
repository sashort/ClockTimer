# Numberpad editing and clipboard controls

All numberpad entries select a supplied value on opening. Clear removes that value and restores the same input defaults as an opening without an initial value. A clock-time entry uses its normal default date/midnight/AM-PM state; duration and percentage entries become unspecified. Reset always restores the original opening value, milliseconds, date and meridiem, with the default collapsed caret.

Selections use a translucent theme-colored highlight. Collapsed selections retain the existing caret. Copy, Paste and Close share centered SVG glyphs and 36-pixel controls. The header reserves their space, and date/AM-PM controls retain contrast in the editor palette and Halloween palette.

Copy writes the entire formatted value as plain text, including milliseconds and the percent suffix or clock meridiem when present. It never writes selection markup. Copy feedback uses a checkmark and an accessible status message.

Paste appears only for known valid text in the current mode. Opening, focus and clipboard-change events inspect text only when existing clipboard-read permission is granted; they do not request permission to discover whether Paste should appear. Copy supplies a known value. An explicit Paste click reads the current clipboard again and validates before changing the draft. Native paste events can also provide text without a background clipboard read. Unsupported/denied clipboard operations report a status without altering the value.

Pasting a duration accepts `h:mm:ss.mmm` or `m:ss.mmm`; percentages must fit the session's input precision; clock times accept 24-hour or AM/PM text, optional seconds/milliseconds, and an optional ISO date. Invalid dates, out-of-range clock components, excessive fractional precision and unrelated text are rejected. Pasted clock text without a date preserves the selected date. Pasting never changes the original value used by Reset.

The default and Halloween avatars share a 2x scale for the entire figure, chair, speech bubble and other attached props. Surface clearance and reserved space use that scale too.
