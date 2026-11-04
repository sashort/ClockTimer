# Auto goals and Trip Log

Aggregate goals are stored independently for Day, Week, Money, Month, Year, and Custom, starting at 100%. Auto and the matching aggregate mode share that scope's goal. An Auto lock persists the selected goal identity, recalculating its inferred value as trips change.

The Derived Trip Goals pane stages edits and locks until a second tap confirms the selected row. Back, Escape, or dismissal discards pending changes. Fallback and Target use whole percentages rounded upward. Week numbers come from the stored fiscal-year calendar anchor and civil dates.

Trip Log keeps its aggregate and trip panes independent of Settings and Down Time Details. Live ticks reconcile the existing pane elements, preserving scroll positions and active-trip animation. Closing Trip Log also closes its child dialogs.

Selecting a Down Time category chooses the closest combination of the existing four checks that includes all contributing trips. This can include extra trips; it never adds an invisible category filter. When checks change, Down Time Details closes, Settings shows a brief pulse on changed checks, then closes. With no changes needed, it returns directly to Trip Log. Saved preferences remain distinct from temporary effective overrides.

Regression coverage includes independent goal persistence, staged confirmation/cancel, bar gestures, custom ranges, fiscal weeks, both themes at phone widths, live pane identity and scroll, and category/check combinations. Browser tests do not establish performance on a physical phone.
