# Speech command chains

SpeechMenu consumes utterances from left to right. `#planDigest` probes prefixes against eligible DOM speech items, then follows `speech-chain-next` to items with matching `speech-chain-context`. `#queueDigestStep` serializes accepted actions; `#processElement` invokes the resolved `speech-function` with parsed arguments.

For example, “ready at four fifteen standard time one hour” schedules Ready before applying Standard Time. Follow-up items receive temporary `primed` attributes while their projected workflow is valid, allowing recognition before the associated dialog renders. Disabled actions and authorization checks remain enforced. Priming is cleared when the utterance finishes, fails, or is canceled.

Typed preprocessors receive `provisional: true` during matching. They must reject invalid typed values rather than let wildcard patterns absorb later commands. Actual actions still validate their arguments and workflow state. A failed prerequisite prevents dependent actions; revising an already consumed prefix cancels the chain without replaying it.

Run `npm run test:speech-chain` from `tests` to verify incremental consumption, UI lag, parameter boundaries, ordered execution, cancellation, permissions, and the real Ready/Standard Time and Break handlers.

## Sequence collector

`#collectSpeechSequence` is an ancillary stage enabled by `speech-collect`. It probes growing prefixes through the item’s own regex and optional preprocessor, retaining the longest valid sequence. It assumes no language, number format, or parameter type. The planner receives that boundary rather than splitting one value into multiple commands. For example, “twenty two fifty six” remains one duration, `0:22:56`.

Collector state belongs to the utterance. Unconsumed recognition revisions replace it, accepted commands release it, and completion or invalidation clears it. A following command releases a valid prefix; otherwise the trailing parameter waits for the final decode. Final decodes after VAD closure collect locally without recreating persistent state. Existing fail-fast rules continue to decide whether an invalid tail is stable enough to reject.

## Command trees and surfaces

Commands are indexed by safe literal prefixes, with separate trees for each modal or popover scope. Complex regexes retain a fallback path. MutationObserver updates attach, detach, and rebase nodes when commands or scopes change; pending mutations are flushed before matching. Branch accessibility is evaluated against current eligibility. `speech-noun` provides literal aliases, using the same modal and authorization rules as ordinary commands.

Priming is owned by each tree and reflected through temporary DOM attributes. Removing a node or finishing an utterance clears its priming. Projected surface stacks let planning follow a command into a dialog and back to its parent without waiting for UI painting. Accepted actions still execute sequentially and verify actual state.

Close and Cancel are reserved system commands (`SpeechMenu.close` and `SpeechMenu.cancel`). Their spoken patterns belong to the language configuration. Open is not reserved: ordinary noun commands open surfaces. Surface handlers register through `registerSurface`; `surfaceOpened` and `surfaceClosed` track activation order. Close/Cancel resolve the actually open top surface, fail if it differs from the projected target, and stop subsequent commands on failure. Individual dialogs do not need close/cancel speech nodes.

Trip Log and the speech pad are native dialogs. Opening Trip Log preserves the underlying speech pad or scheduled-trip dialog, and closing it restores the prior surface. The log header returns to its original layout position. Training, options, help, and other existing popovers retain their surface types. The tested sequence “ready at 4:15 log close” returns to the scheduled-trip dialog.

## Validation and performance

`npm run test:speech-index` checks dynamic indexing, scope migration, eligibility, noun aliases, priming, native dialog handlers, header positioning, and surface activation order. Chain tests run with indexed and baseline matching. DOM tests use happy-dom; native browser rendering was not verified because the Chromium download failed.

`npm run bench:speech-index` measures full chain planning in Node v24.19.0/happy-dom, using 20 alternating measured plans after warmup. The baseline disables only prefix filtering, preserving eligibility and collector logic. Recognition, audio, and model latency are excluded. The app workload copies 27 static command definitions into an all-eligible scope; it is not a live UI latency measurement.

| Workload | Baseline median | Indexed median | Speedup | Regex probes before → after |
| --- | ---: | ---: | ---: | ---: |
| 64 synthetic commands | 4.811 ms | 0.981 ms | 4.90× | 192 → 3 |
| 256 synthetic commands | 18.500 ms | 4.226 ms | 4.38× | 768 → 3 |
| 1,024 synthetic commands | 72.556 ms | 17.658 ms | 4.11× | 3,072 → 3 |
| App definitions | 0.961 ms | 0.756 ms | 1.27× | 27 → 12 |

## Optimistic state changes and persistence

Every registered state-changing action participates in the shared `StateTransactions` checkpoint and rollback mechanism. UI changes occur before the asynchronous result. A rejection or persistence failure restores the checkpoint and cancels dependent actions.

`speech-persist` declares that a speech command may access the server. Omission or `speech-persist="false"` keeps the command client-only; the flag does not itself cause a request. Opening a local menu or selecting a value needs no server check. A command that actually persists a trip change calls `api/command-check/` with its request payload, waits for the server's explicit read-only decision, and sends the write only after acceptance. Event writes validate authoritative state again under the trip lock before inserting, covering changes between the check and write. The server owns business validation; the client enforces only the declared routing boundary.

The speech editor preserves this attribute. Browser preferences and offline queues use asynchronous worker storage with staged writes and rollback; they remain on the client.

Run `npm run test:state-transactions` from `tests`, and `php tests/command_checks.php` from the repository root, for the optimistic UI, persistence routing, rejection, failure, and dependent cancellation checks.

## Release identification

Developer tools shows `Version` with six random uppercase letters and digits. The Lightsail deploy workflow runs `python3 scripts/stamp-version.py` after checking out each release. Both page templates, script and style cache keys, and the speech runtime cache key use the same ID. `build-version.json` records the ID, Git commit, and UTC timestamp. Ask for the visible Version ID when investigating a live bug; a cached page retains its previous ID. Local updates can be stamped with the same command.
