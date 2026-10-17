# Neon Countdown / Midnight Passage

There is no fixed runtime target. The user removed the length constraint; durations below describe the current render. Future changes should follow musical structure and complete instrument decays.

Arrangement revision 53: **6:21**, 48 kHz stereo. The score has three parts; all event times are stored on the engine's 120-BPM grid, with explicit timing conversion for the other tempos.

## Part I: original themes, 0:00-2:00

D minor, 120 BPM. Revision 53 installs the approved Part I arrangement while retaining the approved wind and all Part II/III events and instruments. scripts/neon-countdown-part-one.cjs develops the original Part I theme; Part III remains derived from Parts I and II.

The original cinematic pulse replaces the moving-vowel/vocoder voice. Gain is .6, in its original register, with four-beat whole notes and selected eight-beat holds across unchanged roots. Sustain .8, decay .3 and release .18 carry those written notes. The original four opening cinematic notes and final reference remain.

The original warm-chorus-poly backing is .9, increased from .36; flute and fantasy pad trials were rejected. The original lead/arp/brass and chorus rhythm guitar remain. The verse develops Part I's existing chorus hook and leaves more space in the answering arpeggio. The clean picked layer is replaced with sustained electric guitar at the same gain: original D3/D4 strings through RMS sustain compensation, gentle saturation and a 75 Hz/3.2 kHz amp/cab filter; .82 sustain and .35 release. scripts/synthesize-neon-electric-guitar.cjs reproduces the two original processed samples.

An original FM/analogue-layered keyboard line adds weight in a lower register. Its sound and source script are recorded in api/audio/instruments/neon-approved-part-one-sounds.json. scripts/synthesize-neon-layered-keys.cjs generates two four-second D3/D4 samples: decaying FM index for attack, detuned warm harmonics for body and a short tine transient. The reference was a 1985 Mike Lindup interview documenting DX7/Prophet-600 layering, not an identified patch from Something About You. No audio from that song was sampled.

The Dark 80s kick, snare and closed hat replace Part I's corresponding drums. Kick plays each beat with an alternate-bar pickup, snare on two/four and accented sixteenth hats. Gains 2.6/2.2/1.4 with .75/source-peak compensation use the same original samples as Part III. Original clap/tom fills remain. Tambourine trials were rejected. The drums enter with the existing intro build and stop before the ending transition.

The approved 32-second audition is protected by tests/fixtures/neon-approved-part-one.json; the same instrumental and phrasing policies continue through Part I. Late melodic source material, closing reference and wind remain intact.

## Transition: wind starts decaying on the first slow downbeat

The final Part I ensemble attacks at 1:56. The wind starts at that exact attack, from silence, and crescendos to full level over the closing note's 1.5-second gate, reaching full at 1:57.5. It then carries the instrumental gap continuously and starts decaying with Part II's first note at 2:00. That 3.525-second fade matches the opening note's entire gate, ending at 2:03.525 before the next pulse at 2:03.75.

This latest request makes the wind one continuous bridge between sections. Its span is now 7.525 seconds, extending the earlier 5.5-second trial back to the final Part I attack. The musical entrances and note holds determine its timing. The synthesis script reads windTransition, windCrescendo and windOverlap from the saved score instead of duplicating timing constants; run the composer before regenerating the wind WAV. The noise sample remains original stereo synthesis. Short mastering transitions preserve the intended swell and fade.

## Part II: dark pulse, 2:00-4:30

C-sharp minor, constant 64 BPM for 40 bars. Cinematic pulse gain 1.6, upper pulse chords .88, organ 2.0 and recorded tubular bells 1.2. Revision 51 lowers Part II pulse voices and bells by about 2 dB; organ levels stay unchanged. Revision 51: Part III bells and pulse also drop by about 2 dB, to 5.2 and 1.1 respectively; the closing pulse drops from 1.6 to 1.25. Pulse gates occupy 94% of the interval to the next attack, with sustain .86 and release .5 seconds. Pulse chords hold 3.5 slow beats with sustain .84.

The organ has a clear 35 ms onset, .92 sustain, upper drawbars through the eighth harmonic, a 3.2 kHz filter, light modulation and f/ff dynamics. Dark backing, distant reed and sparse percussion remain. There are 39 recorded tubular-bell strikes, each retaining its full decay.

There is no tempo ramp. The tempo changes immediately from 64 to 120 BPM at Part III's entrance, over sustained A/E pulse notes. The final A/E pulse chord attacks at 4:29.0625 and holds 5.625 seconds (six slow beats). Its .65-second release begins at 4:34.6875; Part III enters at 4:35, with only .3375 seconds of release overlap. This gives the final note its sullen weight while avoiding masking the new entrance. The bridge excludes organ; the recorded bell tails may ring across the entrance. There is no closing wind. All Part II attacks, bell phrases, organ answers, boundaries and tail calculations move together when its entrance changes.

## Part III: orchestral themes with Dark 80s hip-hop drums, 4:35-6:21

D minor, 120 BPM matching Part I: 48 bars and a concise final chord. Recorded cellos, violin spiccato and legato strings carry the orchestral texture; horns, trumpets and flute add accents and answers. The cinematic pulse keeps its ORIGINAL short note lengths, .76 sustain and .16-second release. The longer-gate experiment was explicitly reverted: steady percussion should carry motion between the short bass hits.

The user replaced orchestral percussion, then tambourine/maracas trials, with the exact Dark 80s hip-hop kit. Four one-shots were recovered from the original isolated Dark-80s-Hip-Hop-v12 stems: low 808-style kick with pitch snap, noise/body snare, triple-burst clap and metallic closed hat. Kick plays each beat; snare and clap play beats two/four. Closed hat plays continuous sixteenths at f/mp/mf/p accents, with gain 1.6. Original snare fills and orchestral cymbal punctuation remain. The whole hip-hop kit is raised 6 dB relative to the first transplant: kick 3.2, snare 2.6, clap 2.2, hat 1.6. This targets a clear percussion bed alongside the pulse bass, rather than a faint background tick. There is no active tambourine or maracas. This intentionally makes the drums electronic while the melodic ensemble remains sampled orchestra.

The kit manifest is api/audio/instruments/dark-eighties-hiphop-kit.json. It records the original stem archive hash, extraction beats/velocities, root frequencies, durations and individual checksums. scripts/import-dark-eighties-kit.py recovers original tones using only Python's standard library; pass a path to the preserved percussion-stems.npz if its location differs. scripts/synthesize-dark-eighties-kit.py preserves the original synthesis recipe and seed; regenerating it requires NumPy. Both methods write mono 48 kHz one-shots, never excerpts of mixed music. Playback compensates different recording levels with sample gain .75/peakAmplitude; intact source files are retained.

Orchestra levels are raised relative to the 1.1 pulse gain: cello/spiccato/trumpet 1.9, legato violin 2.4, tremolo/horn/flute 2.6, short-bow violin approaches 4.8. These are mix settings; source samples have different perceived loudness. High recorded violin tremolo and E6/F6 horror accents recur through the build. The opening E6/F6 cluster at 4:35.25 retains its original .75-second hold, then begins a 1.75-second release at 4:36. A separate opening articulation extends the fading tail without changing the later tremolo accents. Woodwind/brass call-and-answer provides contrast.

Most broad held tremolo-chord entrances receive four sixteenth-note approaches: most changing chord entrances, plus the final cadence. scripts/string-chord-approach.cjs chooses a chord tone near the incoming melodic pitch, then generates a diatonic rising/falling approach from that pitch's side. The tracked melody includes both flute calls and horn answers as well as the violin hook; accompaniment chords are excluded. Equal pitches retain the preceding melodic direction. The held chord owns the arrival note. Final dominant/cadence approaches use D harmonic minor; other approaches use D natural minor. There are 12 four-note lead-ins, with both directions represented. The original twelve contour entrance times remain fixed; eleven other broad held-string entrances use one quarter-note legato pickup instead. Quarter pickups use a separate long-violin voice at gain2.4, a35ms attack and80ms release; they do not use the short-bow attack skip. Any target pitch already present in the preceding held violin/tremolo chord is excluded; common tones do not receive another lead-in. This rule takes precedence over adding approaches to most changing chords. Short-bow violin samples replace the soft sustained articulation for the fast notes, with a 3 ms attack, .012-second release and gain 4.8 so the lead-ins are audible alongside the held strings. Measured source attacks peak about 150-200 ms into the recording, longer than a 125 ms sixteenth. Each approach event therefore starts 120 ms into the intact short-bow recording. Gates occupy 84% of a sixteenth, with only 12 ms release and .025/.35-second room reverb, so each pitch speaks distinctly before the next. The final arrival uses a sustained violin sample. Percussion settings are frozen at the user-approved revision 45 balance.

Bell phrases follow a separate authored schedule. Pairs use two quarter notes at lead-in and chord arrival; singles strike only at chord arrival, usually an octave below the string target. The approved opening phrases omit bells at relative 8,12 and32 seconds; preserve the pair at15.5/16, lower the second pair's arrival at24 toF4 and the following single at28 toC4. Alternation continues through the later phrases. There are30 recorded strikes in20 phrases; all natural decays remain intact. Bell gain is5.2 in Part III and1.2 in Part II.

The final ensemble hit is at 6:11. Pulse, bowed strings, horns, sustained cello and sustained trumpet hold 1.5 seconds instead of the previous 0.3-0.65-second accents. Long cello/trumpet samples support the cadence; extending a natural-decay short sample's written gate would not lengthen its sound. The organ retains its exact two-second hold and three-second release. Percussion and bells retain natural decays. The full file retains all sample/reverb tails and ends with a 35 ms click guard.

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

Regenerate guitar/robot synthesis assets if needed. Run node scripts/compose-neon-countdown.cjs, then node scripts/synthesize-neon-wind.cjs so the wind follows the saved note timing, then node scripts/render-neon-countdown.cjs <output-directory>. The recorded bell assets are retained intact; use the manifest URLs/checksums to restore them if needed.

The renderer removes the 15 ms engine lead, masters each part independently to .85 peak and smooths boundary gains. A louder finale cannot reduce the earlier parts. The only final master fade is a 35 ms click guard; instruments own their musical releases. Mix metadata records section gains, duration, source checksums and arrangement details. Reverb/noise can change fresh-render checksums.

After rendering, install the full WAV as api/audio/samples/neon-countdown.wav and update api/audio/instruments/neon-countdown-mix.json and the catalog's renderedMix metadata/checksum. The native-player event length is durationSeconds*BPM/60: 762 beats for 381 seconds at the catalog's 120 BPM. Source score is api/audio/instruments/neon-countdown-score.json. Earlier previews remain available for comparison.

## Verification

Run tests/neon-countdown-song.mjs, tests/cinematic-robot-pulse.mjs and tests/orchestral-finale.mjs and tests/beat-tempo-ramp.mjs with Node. These check source reproducibility, original layer identities, requested balances and gates, complete recorded assets and tail bounds, continuous tempo handoff, three-part registration, finale instrumentation, horror accents, native-player duration, stereo file integrity, checksum, headroom, continuous audio until the final release, and source licensing/hash integrity. Existing expressive-instrument and Dark 80s checks protect unrelated behavior. These checks establish arrangement and file integrity; listening feedback determines musical balance.

Revision 51 corrects the contour bells to two quarter-note strikes: the start of the four-sixteenth run, then its sustained-chord arrival. Four independent callbacks remain. Full recorded decays are preserved, including the final chord bell tail.

## Approved checkpoint and thematic direction

Revision52 integrates the approved auditions. Part II upper pulse chords now coincide with bass accents; intra-chord12/24ms staggering is removed. Organ answers and the opening bell phrase sit on the sixteenth grid. Eleven bell notes within one sixteenth of a pulse accent align with that accent. The instrument recordings start within0–5ms; this correction changes event placement, not sample trimming.

scripts/neon-countdown-phrasing.cjs revoices held strings without changing their gates or attack positions, preserves the original twelve four-sixteenth entrance times, and supplies legato quarter pickups elsewhere. It owns the separate bell phrase schedule and explicit approved exceptions. tests/fixtures/neon-approved-phrasing.json protects the exact opening audition at its new entrance, including drums, all accompaniment and the pickup/bell edits. The same placement policy extends through the remaining phrases.

Part I establishes the themes; Part II darkens/develops them; Part III is derived from both. Part I edits must develop its existing hook and rhythm, while the finale retains their thematic relationship. Do not reverse that direction by deriving Part I from Part III.
