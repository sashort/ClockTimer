# ClockTimer configuration and UI state

UI persistence behavior uses four terms:

| Behavior | Execution | UI outcome |
| --- | --- | --- |
| Wait Sync | Synchronous | Complete before control returns; update only after acceptance. |
| Wait Async | Asynchronous | Keep UI responsive and show pending status; update only after acceptance. Authentication uses this behavior. |
| Optimistic | Asynchronous | Update immediately; restore the previous UI on rejection or failure. |
| Enforce | Asynchronous | Update immediately and retain that UI while retrying a valid action until acceptance. Cancellation or invalidation ends retries. |

Every server write must pass validation first. These behaviors describe UI timing and failure handling; they are independent of pointer/voice input, announcements, and pending-operation status.

Every UI component touching persistence must declare `persistenceBehavior` as `Wait Sync`, `Wait Async`, `Optimistic`, or `Enforce` for each operation. There is no implicit default. A component may have different policies for loading and saving; pointer and voice entry points for the same operation share one policy. Persistence reads declare the appropriate Wait variant and may retain an existing valid display during loading.

Each declaration needs a test contract:

| Scenario | Wait Sync | Wait Async | Optimistic | Enforce |
| --- | --- | --- | --- | --- |
| Pending operation | Retain accepted state; complete before control returns | Retain accepted state; show pending status; remain responsive | Show proposed state immediately | Show proposed state immediately |
| Accepted | Apply returned state before return | Apply returned state on completion | Confirm proposed state | Confirm proposed state; stop retries |
| Rejected or failed | Retain accepted state; show failure | Retain accepted state; show failure | Restore previous state; show failure | Retain proposed state and retry while action remains valid |
| Cancellation or invalidation | Check validity before applying result | Discard pending result | Restore checkpoint | Stop retries and reconcile to the current valid state |
| Late result after account/target switch | No deferred completion; check ownership before applying | Ignore it | Ignore it | Ignore it; stop old retries |

Wait Async, Optimistic, and Enforce must remain responsive while persistence is pending. Tests should hold persistence unresolved and verify each policy's expected UI before releasing acceptance or rejection. Wait Sync describes an actually synchronous operation; asynchronous server calls cannot be classified as Wait Sync merely because their caller uses `await`.

Tests must cover validation before writes, rejection separately from transport failure, cancellation, duplicate submissions, and account/target changes. Enforce also requires idempotent retries, validity checks before each retry, and proof that retries stop on acceptance. A rejected command that is no longer valid cannot be retried under Enforce.

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


## Account settings and observer provenance

Account preferences live in the versioned `users.settings_json` object, split into
`orderFiller`, `speech`, and `dropIn`. `/api/settings/` authenticates the owner and
checks CSRF, captured owner, namespace, key format and size before any write.
Partial changes merge under a row lock. Local trip caches are separate; settings
have no durable device fallback. Guest changes are memory-only. Logout clears the
settings cache; account changes invalidate outstanding requests and callbacks.
Unknown legacy device settings are not automatically assigned to an account.

Mode/Goal/Sync use one badge with five combinations: Default, Custom, User,
Default + User, Custom + User. Default and Custom cannot coincide. D/C occupy the
center; the person glyph is centered alone or overlays the lower-right corner.
Accessible labels explain each badge. Mirror remains a separate teal option with
the standard icon and the selected publisher's live value. Menus refresh while open.

Settings contains sound controls and read-only publisher ClockTimer presentation,
including colors, range visibility, hand visibility, formats and timer layout.
Appearance follows every publisher snapshot independently of viewer mode/goals.
Migration `011_user_settings` adds the JSON object and revision; the existing
ordered deployment migration runner applies it before the new app is activated.
