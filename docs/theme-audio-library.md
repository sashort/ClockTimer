# Theme audio library

Product event sounds use `WMOFAudio.playSound`, which resolves a WAV from the active theme and selected instrument/speed. `startSong` remains the score/instrument renderer for development and offline asset generation. Held interaction tones remain live, with immediate attack and release; they are not WAV loops.

## Server files

- `api/audio/themes/default/` and `api/audio/themes/halloween/` contain `catalog.json`, lazy instrument profiles, `windows.json`, and `events.json`.
- `api/audio/instruments/library.json` contains shared synthesis/sample definitions. `instruments/interactions.json` contains shared held-tone presets. Theme configuration references instruments by ID.
- `api/audio/wav/<content-hash>.wav` contains immutable complete-cue recordings. Browsers fetch/decode on demand and reuse buffers; idle decoded buffers are evicted. Apache serves hashed WAVs with a one-year immutable cache policy. These static requests do not synthesize audio or query the database.

## Windows and controls

`windows.json` is version 1 with a `windows` object keyed by stable window ID. A dialog uses `data-audio-window`, falling back to its DOM ID. The main surface uses `main` for button configuration. Omitted windows, phases, and controls are silent.

Each window may specify `opening`, `sustained`, and `closing`. A phase references either `{ "cue": "keypad-open" }` or `{ "instrument": "keypad-dial-tone" }`. Opening plays once, sustained begins after opening, and closing stops opening/sustain before its own cue. Reopening, close-before-ready, theme changes, and page departure cancel old owners.

`controls.buttons` maps `data-audio-control`, DOM ID, or `data-action` to optional `press`, `release`, and `click` phases. A held phase sets `hold: true`; release/cancel stops it. Complete cues are one-shot. Both phases may be defined deliberately, but do not configure press and click for the same cue unless two plays are intended.

The keypad's `controls.press` declares its shared live instrument and positional mapping. Default preserves original DTMF, including the quiet 350/440 Hz window sustain. Halloween plays a D4 tubular-bell WAV, has no sustained drone, and maps rows to D-minor arpeggios D2/F2/A2 through D5/F5/A5. Clear and Reset share the bottom-left pitch; Zero and OK complete the fourth row. Notes sustain while held and release using the pulse envelope.

## Events and language

`events.json` is version 1 with an `events` object. Each event declares `sound` (a cue ID, or `null` for silence) and may declare `speech` references by phase, for example `"summary": "announcements.trip-started.summary"`. The optional `templates` map references other language-template paths. It contains no translated prose. The existing language system supplies wording, locale fallback, placeholders, and speech options. Computed values remain parameters, not theme-specific text.

Both themes use the same semantic speech queue. Recorded-cue handles expose the musical speech handoff separately from the full recorded tail; Halloween Start uses the first four Part III pulse notes, with speech at the fourth attack and no additional queue padding. Its final pulse fades with the strings at every supported speed. Halloween End uses the former Start arrangement and retains its two-second speech mark. Audio activation starts before asynchronous catalog loading. Failed or timed-out sound preparation is reported to the queue so speech can proceed; Android device behavior must still be verified on the user's phone.

## Build and deployment

Run `node scripts/build-wav-catalogs.cjs`, then `node scripts/render-wav-library.cjs`, then `node scripts/verify-wav-library.cjs`. Rendering uses the development engine in an OfflineAudioContext, preserves authored arrangements, and deduplicates aliases. Each supported instrument/speed has a recording; full-song WAVs retain their existing recordings and seeking. When a full-song sample is selected as a short-cue instrument, its envelope gates the note instead of playing the entire song.

CI renders four independent cached shards, tests the complete merged library, and stages the immutable files on the server before activating the new application code. New themes use the same contracts. Source arrangements remain in the development catalogs; theme catalogs describe recorded runtime playback.
