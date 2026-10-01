# Announcement queue

Each numeric entry contains a complete announcement playback operation, a positive integer ID, a priority, an arrival sequence, and its speech-rate-scaled component margin. ID and priority are independent. Named announcement keys are mapped to stable positive IDs within the running page; explicit numeric IDs must be positive safe integers.

The dictionary starts with `pointer: 0`, `length: 0`, and `announced: new Set()`. New entries use keys `0`, `-1`, `-2`, etc. Length counts actual additions, while pointer decreases after an entry is consumed. At dispatch the highest-priority waiting entry is swapped into the pointer position. Equal priorities retain arrival order. Current playback is never reordered or interrupted.

IDs enter announced when playback starts, blocking duplicates during playback and afterward. Pending duplicates may be added; dispatch skips them if their ID was already announced. Failed or unperformed playback removes its ID from announced. There is no pool. When the dictionary drains, pointer and length reset to zero and announced clears, allowing the same announcement in a later cycle.

`runSemanticAnnouncement(name, playback, {id, priority})` schedules playback. `beginAnnouncementBatch(context)` temporarily holds pending dispatch and returns an idempotent release function. The trip-start workflow uses a batch to collect its events before dispatch; Trip Started leads related confirmations/readbacks only in that context. Other callers can supply situational priorities. IDs for informational announcements include their spoken content, avoiding collisions between unrelated confirmations.

`cancelQueuedAnnouncement(id)` cancels waiting entries without marking them announced. It does not interrupt an entry already playing. No automatic command cancellation rules are assigned yet.

An announcement's chime, pause, summary and details finish together. Component pauses are 300 ms divided by speech rate; the minimum separation between whole announcements is twice the previous entry's component pause. Time already spent idle counts toward that separation.

Tests: `node tests/announcement-priority.mjs`, `node tests/announcement-queue.mjs`, and `node tests/announcement-pauses.mjs`.
