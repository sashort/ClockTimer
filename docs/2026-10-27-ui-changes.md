# UI and goal contract audit — 27 October 2026

Status: implementation and scoped evidence for this release batch. Deployment
status comes from the workflow and live build-version.json, not this document.
This change audit does not extend the historical commit reconciliation or renew
approval of the older mainline graph.

| Change | Authoritative current contract | Evidence |
| --- | --- | --- |
| Main Standard Time | Trip-only in every selected scope, label “Standard Time”; edit available during active production and pauses; standalone break has no standard | goal-bar-interactions-browser, clock-timer-ui-state --standard-time |
| Auto | Idle `[Auto]`; active target in brackets; displayed goal is the inferred trip requirement, editor is configured goal | app-state-transactions --auto-selector, goal-bar |
| Display preference | Classic default; Goal bar under Settings after Clock/Timer; saved account preference and Drop-In mirroring | goal-bar-browser, drop-in-page |
| Idle bar | 0 to highest configured goal, up to 150%; no inferred values, times or Current | goal-bar, goal-bar-browser |
| Active bar | Standard 100%, manual Trip goal, aggregate inferred trip goal, Current counted trip percentage | goal-bar |
| Time semantics | Standard-zero Remaining; trip-counted Elapsed; existing End Time semantics | goal-bar |
| Geometry | Opaque touching outer borders; pulse grows inward; separate label fitting and leaders; tick transforms with node | goal-bar-browser |
| Typography | Time/percent share preferred 16px; captions 10px; names 11px; shrink together when required | goal-bar-browser |
| Failure | Labels disappear, node exits right; final failed goal remains on right; zero-based all-failed scale | goal-bar-browser |
| Colors | Productive Trip/B-game/Overtime palette, ignore Break/Lunch; Down included; elapsed color on right; all-failed Current-to-last-goal Overtime | goal-bar, goal-bar-browser |
| Compression | Left-pointing triangle for leading compression; right-pointing triangle when one or more goals fail | goal-bar-browser |
| Actions | Circle/caption/time/percent/name share one action; Standard edits time, others configured goals | goal-bar-interactions-browser |
| Failed selector | One failure edits directly; several supply failed-only choices to existing configurable selector; no origin memory; Classic entry resets normal choices | goal-bar-interactions-browser, drop-in-page |
| Goal cap | User input above 150 becomes 150; inferred calculations exempt; correction-first audio; passive notice cannot own command focus | app-state-transactions --goal-limit --voice-feedback |
| Observer | Shared rendering and configured publisher attributes; existing permissions retained; publisher Standard remains read-only | drop-in-view, drop-in-page |
| Clock centering | Center between upper actions and visible Log/Mic/content boundary, including short screens and resizing | clock-centering-browser |

Scenario names above refer to files under `tests/`; the goal-bar guide lists full
commands. Test evidence is scoped to those checks, not a claim of exhaustive
state reachability, physical microphone accuracy or successful deployment.

## FSM and generated documentation

The current inventory has 126 regions / 470 named values / 33 surface types.
Presentation dimensions remain orthogonal to trip/recognizer state. Numerical
values and configured choice lists are payload. The coupled-state contract adds
the same invariants. The working FSM adds `GOAL-SELECT`, `GOAL-PERCENT`, guarded
editor edges, and structured GOAL-DISPLAY and lifecycle-animation contracts.
Fourteen new v2 vectors capture the current and proposed rules. Historical approved
JSON/HTML is preserved with a supersession pointer to the current working model.
The searchable inventory and working SVG/HTML are regenerated from these sources.

## Specified next, not implemented

Cold idle load, cold active restoration, committed trip start, committed trip end,
rejection and interrupted/reduced-motion choreography remain proposed sequences
in [goal-bar.md](goal-bar.md). Cold active restoration must not flash idle values
or replay historical start/failure animations. Planned motion must never block
command execution or persistence. Do not label these sequences as tested runtime
behavior until the next animation implementation pass supplies that evidence.

Validation scope: `clock-timer-ui-state.mjs --standard-time` is the focused shared
projection check. The default legacy UI-state suite contains older End Time/
interval fixture assumptions and is not claimed as passing evidence for this
working update. No production code was changed to satisfy those unrelated
assumptions. Use the dedicated browser interaction and counted-time tests for the
current active/pause workflows.

Regeneration commands:

```text
node scripts/build-pages.cjs
node scripts/build-application-state-inventory.cjs
node scripts/export-fsm-docs.cjs
node tests/fsm-reference.mjs
node tests/application-state-inventory.mjs
node tests/order-filler-state-contract.mjs --validate-only
```

## Follow-up: mode-specific bar nodes

Trip mode now excludes aggregate nodes; aggregate modes exclude Trip. Auto
retains both. Idle follows the same visibility rule. Failure markers and editor
choices use only visible goals. Active values remain trip-based: inferred
aggregate requirements, counted trip elapsed and Standard-based Remaining.
Current End Time now derives from its own trip position instead of copying the
main selected-scope deadline. Model and rendered interaction regressions cover
mode changes, idle reset and shared-node value parity.

Active main time readouts also stay trip-scoped in every percentage mode: Trip
Time Elapsed, Trip Time Remaining and Trip End Time. Remaining retains the active
goal-based trip budget; the bar retains Standard-based Remaining. Idle aggregate
banked/over summaries and aggregate accounting remain unchanged.

Shared bar detail consolidation: only the next target and Current show time and
percentage labels. Other unfailed nodes retain names and click targets. All-failed
state restores Standard at the right with its time and 100% reference details.
