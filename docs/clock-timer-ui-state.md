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

`available_actions` describes the operations allowed by the reconstructed state, including `start_trip`, `end_trip`, `resume_trip`, `end_interval`, `start_break`, `start_down`, and `edit_trip`. `controls` supplies the corresponding visibility, enabled state, action identifier, and button text for the main UI.

After login or session restoration, ClockTimer queries for the user's unfinished trip. If one exists, it replays its persisted events, reconstructs the current running or interval state, and emits `activeTripRestored` followed by `uiStateChanged`. The UI therefore uses the same state path for restored and newly started trips.

## Standard Mirror symbol

`icons/mirror.svg` defines two facing panels separated by a vertical mirror axis.
Use `data-menu-icon="mirror"` for Mirror choices in Mode, Sync and Goal controls.
The symbol means follow the corresponding observed-user setting. It is independent
of the current setting being on or off, and its label comes from the language pack.

For Sync, retain the circular Sync arrows and render the same Mirror glyph as a
13-pixel badge at the lower-left (`left: -2px; bottom: -2px`). Existing cloud/error
status badges retain the lower-right corner. Mirror can coexist with an off Sync
state; it does not imply Sync is on.

Mode, Sync and Goal changes share the Default/User apply confirmation. Matching
user/default values clear the override and inherit future default updates.
