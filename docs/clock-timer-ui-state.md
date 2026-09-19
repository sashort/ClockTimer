# ClockTimer configuration and UI state

`ClockTimer.configure()` applies a partial configuration. Omitted keys remain unchanged; `null` clears a goal or external aggregate.

```js
clockTimer.configure({
    rendered_time_type: "calculated_end_time",
    goal_type: "auto",
    auto_goal: true,
    trip_goal: "105%",
    total_goal: "100%",
    external_standard_time: "6:30:00",
    external_counted_time: "6:42:15"
});
```

Accepted `rendered_time_type` values are `calculated_start_time`, `calculated_end_time`, and `time_remaining`. Accepted `goal_type` values are `trip`, `total`, and `auto`. Goal values may be ratios or percentage strings. External time values may be milliseconds or `h:mm:ss` strings.

The return value and `clockTimer.uiState` are immutable `ClockTimerUIState` objects. ClockTimer also emits `uiStateChanged` after ticks, configuration changes, trip lifecycle changes, and interval changes.

```js
clockTimer.addEventListener("uiStateChanged", event => {
    const state = event.detail;
    standardLabel.textContent = state.standard_time_header_text;
    standardValue.textContent = state.standard_time_component.text;
    timeLabel.textContent = state.time_header_text;
    timeValue.textContent = state.time_component.text;
});
```

Every display component has the same shape:

```js
{
    text: "14:37:09",
    value: 52629000,
    date: new Date("2026-09-19T14:37:09"),
    available: true
}
```

`date` is populated for absolute times and is `null` for durations and percentages. Unavailable components provide `text: "---"`, `value: null`, `date: null`, and `available: false`.

State objects include `state`, `state_class`, `previous_state`, `transition`, `transition_phase`, `transition_id`, `state_entered_at`, `transition_started_at`, `transition_ended_at`, and `changed_fields`. A state-changing event first emits an `active` transition and then a `settled` transition with the same identifier. Ticks retain the current state and use a settled `tick` transition.
