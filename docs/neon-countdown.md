# Neon Countdown / Midnight Passage

There is no fixed runtime target. The user removed the length constraint; durations below describe the current render. Future changes should follow musical structure and complete instrument decays.

Arrangement revision 46: **6:12**, 48 kHz stereo. The score has three parts; all event times are stored on the engine's 120-BPM grid, with explicit timing conversion for the other tempos.

## Part I: original themes, 0:00-2:00

D minor, 120 BPM. Keep the original lead, arpeggio, brass, warm backing, rhythm guitar, soft bending lead and drums. The fantasy pad is removed. The original warm-chorus-poly backing is present under its own name, neon-backing-pad, with 236 harmony events; the final ensemble attack is at 1:56; its gain is now .36, up from .18 at the user's request.

The first four pulse notes at 0/2/4/6 seconds use the original cinematic pulse. The moving-vowel instrument starts on the fifth at 0:08, at gain .48. The final held bass/reference at 1:56 returns to the original pulse. The rejected spoken vocoder phrase and two standalone intro hits remain removed.

The additional clean picked electric guitar is a supporting layer at .25 gain, about 10 dB below the prior .8 setting. It uses two original D3/D4 plucked-string samples, with no distortion and light chorus. Its picking follows the harmony, with sparse figures in quieter sections and fuller chorus figures. Preserve the existing rhythm guitar and bending lead.

Other retained details: main lead starts 25 ms early to align its attack; bend gain .12, sustained arrival pitches and .8-second release; synth/guitar call-and-answer at 1:04-1:20; soft four-note 32nd pickups before two transitions. Repaired bass phrases at 0:24-0:32 and 1:12-1:20 use the established syncopated grid, with bass returning alongside the drums at 1:12.

## Transition: wind starts decaying on the first slow downbeat

The final Part I ensemble attacks at 1:56. Later backing/picking attacks are removed and the closing gates leave room to resolve before the next entrance. Original stereo wind runs for 5.5 seconds, from 1:58.025 to 2:03.525. It rises for 1.5 seconds, holds through the instrumental gap, and starts decaying as Part II's first note sounds at 2:00. The 3.525-second fade matches that note's complete written gate (94% of four beats at 64 BPM), ending at 2:03.525 just before the second pulse at 2:03.75. Changing the first note gate must also change the fade; move the wind start to keep its total duration at 5.5 seconds.

The rest is in the pitched instruments; wind continues through it. The final beat before the entrance is marked as a 64 BPM instrumental rest. There is no all-channel mute or silent audio block. The wind sample owns the rise, hold and decay envelope. Keep its total duration within the user's five-to-six-second limit. The renderer uses short gain smoothing at section boundaries so mastering does not turn the sustained wind into an early four-second fade.

## Part II: dark pulse, 2:00-4:30

C-sharp minor, constant 64 BPM for 40 bars. Cinematic pulse gain 2.0, upper pulse chords 1.1, organ 2.0 and recorded tubular bells 1.5. Pulse gates occupy 94% of the interval to the next attack, with sustain .86 and release .5 seconds. Pulse chords hold 3.5 slow beats with sustain .84.

The organ has a clear 35 ms onset, .92 sustain, upper drawbars through the eighth harmonic, a 3.2 kHz filter, light modulation and f/ff dynamics. Dark backing, distant reed and sparse percussion remain. There are 39 recorded tubular-bell strikes, each retaining its full decay.

There is no tempo ramp. The tempo changes immediately from 64 to 120 BPM at Part III's entrance, over sustained A/E pulse notes. The bridge excludes organ; the recorded bell tails may ring across the entrance. There is no closing wind. All Part II attacks, bell phrases, organ answers, boundaries and tail calculations move together when its entrance changes.

## Part III: orchestral themes with Dark 80s hip-hop drums, 4:30-6:12

D minor, 120 BPM matching Part I: 48 bars and a concise final chord. Recorded cellos, violin spiccato and legato strings carry the orchestral texture; horns, trumpets and flute add accents and answers. The cinematic pulse keeps its ORIGINAL short note lengths, .76 sustain and .16-second release. The longer-gate experiment was explicitly reverted: steady percussion should carry motion between the short bass hits.

The user replaced orchestral percussion, then tambourine/maracas trials, with the exact Dark 80s hip-hop kit. Four one-shots were recovered from the original isolated Dark-80s-Hip-Hop-v12 stems: low 808-style kick with pitch snap, noise/body snare, triple-burst clap and metallic closed hat. Kick plays each beat; snare and clap play beats two/four. Closed hat plays continuous sixteenths at f/mp/mf/p accents, with gain 1.6. Original snare fills and orchestral cymbal punctuation remain. The whole hip-hop kit is raised 6 dB relative to the first transplant: kick 3.2, snare 2.6, clap 2.2, hat 1.6. This targets a clear percussion bed alongside the pulse bass, rather than a faint background tick. There is no active tambourine or maracas. This intentionally makes the drums electronic while the melodic ensemble remains sampled orchestra.

The kit manifest is api/audio/instruments/dark-eighties-hiphop-kit.json. It records the original stem archive hash, extraction beats/velocities, root frequencies, durations and individual checksums. scripts/import-dark-eighties-kit.py recovers original tones using only Python's standard library; pass a path to the preserved percussion-stems.npz if its location differs. scripts/synthesize-dark-eighties-kit.py preserves the original synthesis recipe and seed; regenerating it requires NumPy. Both methods write mono 48 kHz one-shots, never excerpts of mixed music. Playback compensates different recording levels with sample gain .75/peakAmplitude; intact source files are retained.

Orchestra levels are raised relative to the unchanged 1.4 pulse gain: cello/spiccato/trumpet 1.9, legato violin 2.4, tremolo/horn/flute 2.6, short-bow violin approaches 4.8. These are mix settings; source samples have different perceived loudness. High recorded violin tremolo and E6/F6 horror accents recur through the build. Woodwind/brass call-and-answer provides contrast.

Most broad held tremolo-chord entrances receive four sixteenth-note approaches: most changing chord entrances, plus the final cadence. scripts/string-chord-approach.cjs chooses a chord tone near the incoming melodic pitch, then generates a diatonic rising/falling approach from that pitch's side. The tracked melody includes both flute calls and horn answers as well as the violin hook; accompaniment chords are excluded. Equal pitches retain the preceding melodic direction. The held chord owns the arrival note. Final dominant/cadence approaches use D harmonic minor; other approaches use D natural minor. There are 12 four-note lead-ins, with both directions represented. Five scheduled entrances skip their approach because the sustained chord tones repeat. Any target pitch already present in the preceding held violin/tremolo chord is excluded; common tones do not receive another lead-in. This rule takes precedence over adding approaches to most changing chords. Short-bow violin samples replace the soft sustained articulation for the fast notes, with a 3 ms attack, .012-second release and gain 4.8 so the lead-ins are audible alongside the held strings. Measured source attacks peak about 150-200 ms into the recording, longer than a 125 ms sixteenth. Each approach event therefore starts 120 ms into the intact short-bow recording. Gates occupy 84% of a sixteenth, with only 12 ms release and .025/.35-second room reverb, so each pitch speaks distinctly before the next. The final arrival uses a sustained violin sample. Percussion settings are frozen at the user-approved revision 45 balance.

Four sparse tubular-bell callbacks tie this part to Part II. Foreground gain is 6.6 with ff attacks, three times the prior 2.2 setting (about +9.5 dB before mastering), so they cut over accompaniment. Each recorded decay plays completely. Part II bell levels are unchanged.

The final ensemble hit is at 6:06. Pulse, bowed strings, horns, sustained cello and sustained trumpet hold 1.5 seconds instead of the previous 0.3-0.65-second accents. Long cello/trumpet samples support the cadence; extending a natural-decay short sample's written gate would not lengthen its sound. The organ retains its exact two-second hold and three-second release. Percussion and bells retain natural decays. The full file retains all sample/reverb tails and ends with a 35 ms click guard.

Thirty-six CC0 orchestral/percussion recordings are retained in the source library, including earlier unused percussion trials. They come from VSCO 2 Community Edition (commit 440300901dfe9275fd84e0b7763af1f8443ae62e) and VCSL (commit c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e). scripts/import-neon-orchestra.py retains original WAV bytes, source URLs, hashes, measured peaks, root frequencies, durations and both licenses in api/audio/instruments/neon-orchestra-samples.json. VSCO filename octaves are converted to scientific pitch. Short articulations use natural decay; long strings, horns and final organ use written gates. Sampled pitch glides are written as separate supported notes.

## Recorded tubular bells

Nine unmodified stereo, 24-bit, 44.1 kHz tubular-bell recordings come from the [Versilian Community Sample Library](https://github.com/sgossner/VCSL), pinned to commit c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e. The library is CC0. Its license is retained in api/audio/samples/vcsl-tubular-LICENSE.txt; api/audio/instruments/vcsl-tubular-bells.json records original URLs, pitches, durations and SHA-256 checksums.

Both bell voices use naturalDecay:true. Written gates are ignored: each complete recording plays once, with no loop, repeat damping or note-off truncation. Overlapping strikes retain their tails. Duration calculations include the longest equally-near root variant after pitch shifting and room for reverb. Part II's bells may continue into Part III; all decays finish before the end of the song.

## Source and rebuild

- scripts/compose-neon-countdown.cjs builds Part I and invokes both extensions.

- scripts/neon-countdown-part-two.cjs builds the dark section, transition pause, recorded bells and sustained handoff.

- scripts/neon-countdown-part-three.cjs builds the 120 BPM orchestral finale, Dark 80s kit and horror strings.

- scripts/beat-tempo-ramp.cjs is retained as a tested utility; the current arrangement uses no ramp.

- scripts/synthesize-neon-guitar.cjs generates the original distorted rhythm-guitar source.

- scripts/synthesize-neon-picked-electric.cjs generates clean picked D3/D4 strings, four seconds each at 48 kHz.

- scripts/synthesize-neon-wind.cjs generates the original stereo noise transition.

- scripts/synthesize-cinematic-robot.cjs generates the original moving-vowel pulse samples and separate audition; see cinematic-robot-pulse.md.

- scripts/render-neon-countdown.cjs renders through the actual AudioEngine in headless Edge, using its normal scheduling window and offline-time scheduling/cleanup.

Regenerate original synthesis assets if needed, then run node scripts/compose-neon-countdown.cjs and node scripts/render-neon-countdown.cjs <output-directory>. The recorded bell assets are retained intact; use the manifest URLs/checksums to restore them if needed.

The renderer removes the 15 ms engine lead, masters each part independently to .85 peak and smooths boundary gains. A louder finale cannot reduce the earlier parts. The only final master fade is a 35 ms click guard; instruments own their musical releases. Mix metadata records section gains, duration, source checksums and arrangement details. Reverb/noise can change fresh-render checksums.

After rendering, install the full WAV as api/audio/samples/neon-countdown.wav and update api/audio/instruments/neon-countdown-mix.json and the catalog's renderedMix metadata/checksum. The native-player event length is durationSeconds*BPM/60: 744 beats for 372 seconds at the catalog's 120 BPM. Source score is api/audio/instruments/neon-countdown-score.json. Earlier previews remain available for comparison.

## Verification

Run tests/neon-countdown-song.mjs, tests/cinematic-robot-pulse.mjs and tests/orchestral-finale.mjs and tests/beat-tempo-ramp.mjs with Node. These check source reproducibility, original layer identities, requested balances and gates, complete recorded assets and tail bounds, continuous tempo handoff, three-part registration, finale instrumentation, horror accents, native-player duration, stereo file integrity, checksum, headroom, continuous audio until the final release, and source licensing/hash integrity. Existing expressive-instrument and Dark 80s checks protect unrelated behavior. These checks establish arrangement and file integrity; listening feedback determines musical balance.
