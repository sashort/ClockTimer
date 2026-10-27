# Announcement queue

Each dictionary entry owns one announcement ID and a set of independently scheduled components. IDs are positive integers, separate from priority. Built-in type keys map to explicit stable positive IDs in AnnouncementCatalog.js; custom keys use fallback IDs within the running page. The dictionary retains `pointer: 0`, `length: 0`, and `announced: new Set()`; additions use keys `0`, `-1`, `-2`, etc. Pointer decreases as completed entries at the front are removed. Completed entries farther back remain until pointer reaches them.

After each component completes, dispatch selects the highest-priority remaining component across all announcements. Equal priorities use announcement arrival order, then original component order. There is no required chime → summary → details dependency: explicit priorities can put details before summary or chime. Native speech or a chime already playing finishes before another component starts. A suspended announcement resumes only its unplayed components.

`runSemanticAnnouncement(name, components, {id, priority, phasePriorities})` accepts descriptors `{phase, play, priority?}`. A component's explicit priority takes precedence over `phasePriorities[phase]`, followed by the announcement default. Existing single playback callbacks remain supported as one summary component. `announcementComponents` creates separate chime and speech components and retains summary/details identity when one is disabled. Catalog songs play tones without embedded speech; English announcement summaries load from lang/en-US/announcements.json as separate components.

In the trip-start batch, chime and summary have priority 100; details have priority 0. Sync outcome components use priority 50. This permits Trip Started → sync outcome → Time Remaining. Sync is represented by `syncTry`, carrying validity and failure reason, rather than an assumed Sync On event. The legacy `syncGoalRecalculated` event remains available. Sync announcements retain the existing saved Sync State/Sync Goal audio preferences, and their spoken output reflects the runtime outcome.

IDs enter announced when the first component starts. Duplicates stay blocked while that announcement is suspended or completed during the same nonempty queue cycle. Pending duplicates are skipped after the original starts. Failed, unperformed, or canceled announcements release their ID. Once the dictionary drains, pointer and length reset and announced clears. There is no pool.

`beginAnnouncementBatch(context)` holds dispatch while related events are collected and returns an idempotent release function. `cancelQueuedAnnouncement(id)` marks waiting or active announcements canceled: an active component finishes, then its remaining components are discarded. No automatic command cancellation rules are assigned yet.

The margin between consecutive components of the same announcement is 300 ms divided by its speech rate. Switching announcements uses twice the previous announcement's component margin, including when resuming a suspended announcement. Time already spent idle counts toward the margin. The queue rechecks priorities and cancellation after waiting.

Verification: `announcement-priority.mjs`, `announcement-queue.mjs`, `announcement-phases.mjs`, `announcement-pauses.mjs`, `sync-try.mjs`, and `speech-trip-transition.mjs` under `tests/`.

## Scope and range selection

The `range-change` family covers date scopes and the Trip/Auto view modes. Both
pointer and voice selection announce `Viewing {scope}` once, even when switching
to Trip/Auto leaves the date filter unchanged. Pointer selection suppresses the
underlying date-filter announcement and emits feedback after the mode is applied.
Trip Log filter changes continue to use this same family independently.

Its `scope-change` song uses the existing Cinematic Pulse Bass instrument:
C2 → E2 → D2 at 300 BPM, each lasting two-thirds of a beat (0.4 seconds plus
natural release/effect tails). It uses the approved audition's instrument and
score. Ordinary setting on/off songs remain separate. Unchanged voice selections
use `setting-unchanged`; reselecting a pointer option produces no duplicate cue.

## Goal limit correction

Goal input above 150% is clamped before feedback. A `goal-limit` batch holds audio
while scope totals settle; the correction and its recalculation feedback use
priority 1000 so the cap sentence precedes later chain announcements. The batch
only holds audio dispatch. Independent command slots continue executing. The
notice is speech-passive and does not become an active command surface. See
[goal-bar.md](goal-bar.md).
