# Dedicated trip editor

Trip Log has one **Edit Trip** action in a trip's menu. During a trip, the
hamburger menu also opens that same editor. The former inline editing mode,
long-press insertion/deletion controls and separate saved-trip settings dialog
have been removed.

The **Timeline** tab groups each interval's start and end in a single card.
New cards stand out, valid times determine their chronological position, and
invalid or overlapping times appear red. Actual trip boundaries are edited
only in Timeline. **Details** contains scheduled start, Standard Time and
production. Both tabs share one isolated draft and one **Save Changes** action.

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
Save locks/rechecks the revision and applies Details, Timeline and official
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
