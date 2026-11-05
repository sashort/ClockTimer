# Auto goals and Trip Log

Aggregate goals are stored independently for Day, Week, Money, Month, Year, and Custom, starting at 100%. Auto and the matching aggregate mode share that scope's goal. An Auto lock persists the selected goal identity, recalculating its inferred value as trips change. Trip goal is stored separately.

The Derived Trip Goals pane has three rows under Lock (SVG icon), Goal, and Target columns. The first row uses a native aggregate dropdown; the other rows are Trip and Standard. Only aggregate scopes appear in the dropdown. Trip never changes the selected aggregate. Standard displays a plain, borderless 100% that cannot be edited. Percentages are whole values rounded upward. Week labels use the fiscal-year calendar anchor and civil dates.

Native radios select the exclusive draft override, with no selected radio when no override is active. A single tap on a row or its radio toggles that draft lock, including clearing a selected radio. OK applies the draft and closes the pane; Cancel, Back, Escape, or dismissal discards it. Enter and Space on a radio toggle its draft state; Enter on OK confirms. Percentage buttons edit the staged goal separately from radio/confirmation hit areas. The contrasting header and sticky action footer follow the active theme; OK and Cancel remain visible while scrolling. Choosing another aggregate moves an aggregate lock to that scope while preserving Trip or Standard locks.

The popover reduces vertical padding when needed, stays above the microphone bar, and scrolls when minimum control sizes still require it. Draft refreshes retain scroll. Custom range selection opens Trip Log Settings without applying the draft until confirmation.

Trip Log keeps its aggregate and trip panes independent of Settings and Down Time Details. Live ticks reconcile existing elements, preserving scroll and active-trip animation. Closing Trip Log closes child dialogs. All aggregate/day headers remain visible under presentation filters. A hidden-only aggregate has no disclosure triangle. Finalized hidden counts appear beneath individual day headings, with no range-wide hidden summary.

Selecting a Down Time category chooses the closest combination of existing checks and pending-mode states that includes all contributing trips. Extra trips may appear; no invisible category filter is added. If checks change, Down Time Details closes, Settings pulses changed checks, then closes. Otherwise it returns directly to Trip Log. Saved preferences remain distinct from temporary effective overrides.

Regression coverage includes independent goal persistence, staged confirmation/cancel, radio clearing, bar gestures, custom ranges, fiscal weeks, both themes at phone sizes, live pane identity/scroll, category/check combinations, and gray accent contrast. Browser tests do not establish performance on a physical phone.
