# Halloween keypad audio

The current preset uses low Cinematic Pulse Bass plus the existing recorded
Neon Countdown Part 3 tremolo strings. Each chord is derived from the two bass
pitches using octaves and a fifth. The key tone is four octaves below the original
telephone-frequency pair; it retains the selected low register.

After one second without another keypad action, a single low note uses the exact
Neon Countdown Part 2 `midnight-pulse` preset through AudioEngine, including its
low-pass filter, envelope, delay and reverb. It holds for 1.2 seconds. Further
button activity resets a pending response. Hard cancellation and switching the
Halloween theme off stop all pending/ringing seasonal voices. The note follows
the last key's bass root; normal announcement cues and saved instruments are
unchanged. Shared volume/mute remain in effect.

Settings → Themes → Halloween controls the audio with the visuals. See
[halloween-theme.md](halloween-theme.md) for persistence and date precedence.

Build the preset with `node scripts/build-halloween-audio.cjs`. Render the actual
engine with `node scripts/render-part-three-touchtones.cjs`; the comparison uses
250 ms and 400 ms key holds and 150 ms gaps. These audition holds do not change
pointer handling. Recorded strings are cached and preloaded on audio unlock;
ordinary tones are the fallback if seasonal assets cannot load.

Tests: `tests/halloween-audio.cjs`, `tests/halloween-idle-audio.cjs`,
`tests/audio-volume.mjs`, `tests/scheduled-audio-cue.mjs` and
`tests/halloween-theme-browser.cjs`.

The earlier organ, bell and alternative-instrument auditions are historical
outputs, not part of the current mix. No new sound library was downloaded; the
existing sample provenance and license files remain applicable.
