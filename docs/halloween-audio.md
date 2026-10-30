# Halloween audio

Settings → Themes → Halloween switches these arrangements with the visual skin.
Normal-theme audio and saved instrument preferences remain unchanged. Shared
volume and mute settings apply to seasonal playback.

Opening the numberpad plays the first Neon Countdown Part 3 tremolo-string
chord (E6/F6). Digit presses cycle through Part 3 Cinematic Pulse Bass notes
D2, D2, A2, D2, A2, then repeat. Notes sustain while held and release smoothly.
One second of inactivity silently resets the sequence. Reset also silently
resets it; OK is silent. The normal ambient dual tone is suppressed in this theme.
Releasing a key during asynchronous preparation cancels its pending voice.

Trip start, including early and late starts, uses the original full-ensemble
last five Part 3 onsets: G5, A5, Bb5, C#6, D6 and the D-minor final hit.
Trip end descends D6, C#6, Bb5, A5, D5 and resolves with the original D-minor
ensemble chord. These replace the normal trip songs. Speech begins two seconds
after the cue starts while its tail continues underneath.

Other seasonal events use the approved orchestral cue family: break start and
resume, Down start and resume, missed goals, setting on/off/unchanged, scope
changes, microphone activation/deactivation, rejected speech and Drop In messages.
Resume from Down retains the originally approved arrangement unchanged.
Full Easter Egg songs are unchanged. Turning the theme off stops seasonal
songs, opening chords and held voices, including pending asynchronous playback.

`api/audio/instruments/halloween-event-cues.json` and
`halloween-trip-ending.json` retain the approved audition scores. Build the
runtime catalog with `node scripts/build-halloween-audio.cjs`. Existing recorded
samples and their provenance remain applicable; no new sound library is used.
The four-minute Night Signal audition remains shelved outside the application.

Verification: `tests/halloween-audio.cjs`, `tests/halloween-idle-audio.cjs` and
`tests/halloween-keypad-browser.cjs` cover sustained notes, silent resets and OK,
sequence timing, catalog caching, theme cancellation, event mappings and the
two-second speech handoff. Existing volume, scheduled-cue and theme checks apply.

## Phone trip-cue playback

Trip Start (including early/late) and Trip End use pre-rendered stereo clips at
Slow 0.8×, Medium 1× and Fast 1.2×. Each rate is rendered from the approved score,
so changing speed does not shift pitch or cut off the final chord. A single
natural-decay source plays the complete cue, including its baked effects; no
live ensemble oscillators or convolution are allocated during these cues.
Speech still begins two seconds after actual audio start. Volume, mute,
cancellation and theme-off behavior remain governed by the shared engine.
Custom API speeds or BPM use the original score as a compatibility fallback.

Unlock warms the opening strings, then the selected speed's Start/End clips
sequentially. Changing speed warms the new pair. Shared per-context/per-URL
promises deduplicate fetch/decode across warmup and separate instrument models;
failed loads can retry. Repeated playback reuses decoded buffers. Other speeds
are not decoded until selected. The six compressed assets total about 1.36 MB.
The shared render gain retains headroom at maximum volume, including the finale.

`node scripts/render-halloween-trip-cues.cjs` regenerates the six clips using
Playwright and FFmpeg (`FFMPEG_PATH` may specify the encoder). Then run
`node scripts/build-halloween-audio.cjs`. The clip manifest records rates,
durations, levels and source files. These clips derive only from existing sounds
and samples; their original provenance still applies.

`tests/audio-sample-cache.mjs` covers concurrent cache reuse and retry.
`tests/halloween-trip-playback-browser.cjs` exercises both cues at all three
speeds in a mobile browser profile: one source per play, zero live oscillators
or convolvers, no repeated decode, safe peaks, theme cancellation and the
unchanged speech mark. Actual phone playback remains the final user check.
