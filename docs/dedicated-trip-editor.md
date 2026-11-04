# Dedicated trip editor

Trip Log has one **Edit Trip** action in a trip's menu. During a trip, the
hamburger menu also opens that same editor. The former inline editing mode,
long-press insertion/deletion controls and separate saved-trip settings dialog
have been removed.

The single-view **Timeline** groups each interval's start and end in a single card.
New cards stand out, valid times determine their chronological position, and
invalid or overlapping times appear red. Actual trip boundaries are edited
only in Timeline. Scheduled start appears in the timeline. The two-column header contains editable Standard Time and a Productive checkbox. All controls share one isolated draft and one **Save Changes** action.

Down cards have a monochrome camera button opening the existing Down Details
window for picture/description access. There are no camera buttons in Trip Log.
New intervals must be saved before they have a server key for attachments.
Existing photo capture restrictions are retained; the description can be edited
for completed Down intervals. Down Details has its own Save button.

The header percentage opens the official-percentage editor for completed trips.
Applying/clearing a percentage, deriving/editing/deleting Official Start and
other changes can be committed in one transaction. Clearing a newly staged
percentage simply removes that staged change.

`editor-preview` is owner/CSRF/revision checked, uses the same validation and
accounting as `editor`, and performs no database write or live-timer reload.
Save locks/rechecks the revision and applies header settings, Timeline and official
changes atomically. Invalid saves retain the draft. Scheduled-start changes
rebase offsets while preserving the factual event instants.

Offline buffered trips use an isolated local batch, canonical factual boundary
instants and one storage write on Save. Preview and invalid batches leave the
stored queue unchanged. Photos and official-percentage changes still require
a connection. The active timer continues running while its draft is open.

The window uses Order Filler's existing gradients, borders, colors and shared
modal host. Its footer, and the Down Details footer, stay above the Mic Bar.
The Halloween palette uses the same layout. Menu toggles retain saved values
and use strikethrough while disabled; the existing pending stopwatch states and
Goal Bounding icon remain consistent with that convention.

Times in the editor use 24-hour notation with smaller milliseconds; the top
summary keeps its existing precision. Each Down card shows Recorded and its
applicable review values. Pending cards omit Approved, Unapproved and Net.
Reviewed cards show the signed Net (Approved minus Recorded). With multiple
Down intervals, a bottom Timeline summary always shows Recorded, shows Pending
when present, and adds Approved/Unapproved/Net only after a review decision.

Read-only previews bypass mutation-command preflight. The preflight validator
also recognizes previews for older clients; it must not send `editor-preview`
directly to the mutation dispatcher. Both routes remain owner/CSRF/revision
checked. Trip Log uses circles/lines for its read-only entries, omits the
Trip Entries heading, and labels its effective deduction Applied when Pending
is included, otherwise Approved.

Validation blockers are shown beside Save and on the affected fields. Save remains actionable for invalid drafts: tapping it explains the blocker and focuses the first invalid field. During a request, it displays Saving; a failed request restores Save for retry. Timeline connectors run only between adjacent circles, with no line beyond either terminal, in both the editor and Trip Log.

Migration-era integer strings in canonical millisecond offsets are normalized by the storage reader, editor settings reader, encoder and scheduled-start rebase. This prevents missing scheduled/creation instants from silently blocking edits on older trips, while retaining exact instants and leaving unrelated string values unchanged.

DST editing regression coverage is in `tests/trip-editor-dst-matrix.cjs`: 6,912 combinations cover fall-back/spring-forward, interval placements before/across/after the transition, both Down/break orderings, edit dates on either side, New York/UTC rendering, approval states and editing/removal of interval and trip boundaries. Each result checks exact instants, counted milliseconds, percentage and a clean editor reload. `tests/dst-completion.mjs` also completes running, Down and Break trips across both transitions after API replay, checking event and aggregate scheduled anchors. Each completion scenario runs in a fresh process so unrelated timer instances cannot interfere.

Trips beginning in Down cannot start before Scheduled Start. The scheduler and new-trip controls disable early starting, and editor validation applies the same rule on the client and server. Editing a first-Down trip start into that range offers OK/Cancel to move Scheduled Start as well; cancellation keeps the draft unchanged.

The timeline body reserves a stable scrollbar gutter and a separate right inset, so long timelines retain space beside the scrollbar. Pending completed trip summaries retain local accounting until final persistence is acknowledged; subsequent server reads regain precedence, including official-percentage edits.

Scheduled Start sorts before Actual Start at equal instants and has a dashed accent with a clock marker. Add Entry aligns with the timeline cards, excluding the circle gutter. Unsaved intervals use Cancel; saved intervals use Delete. Underlined timeline and approval values are editable; derived accounting values are plain.

Trip Log separates aggregate navigation above a keyboard/pointer-resizable splitter from an independently scrolling trip list below. A sticky scope path returns to parent scopes or the full date range. Selecting an aggregate updates the overview, main Down Time ledger and trip list together. The aggregate pane is capped at 40% of the split region, leaving at least 150px for trips; single-day views omit aggregate navigation. Range changes reset the selected scope, while refreshes preserve it when available.
