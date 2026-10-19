# Current release: approved solo installed (revision 58)

The approved string feature is now installed in the 6:27 full song. Its cello
fades in while the backing fades out, retains natural decay and the approved
+5 dB mix boost, and ends with the matching sixteenth-note contour. Original
upper chords, contours and sparse bell remain. Backing returns over the last
chord; seeded vinyl pops are retained. Parts I/II and all audio outside the
replacement window remain unchanged from the revision 57 base render.

The score's `song.events` describes the base arrangement. Its explicit
`render.postprocess` points to `api/audio/instruments/neon-solo-insert.json`;
the canonical solo performance and arrangement/provenance are stored in
`api/audio/samples/neon-solo-approved.wav` and
`api/audio/instruments/neon-solo-approved.json`. This frozen approved performance
preserves the exact audition balance rather than silently rendering the base
score without its solo. It is scaled to the surrounding full-song master level.

To rebuild the final audio: compose the base score, render it into a scratch
folder with `scripts/render-neon-countdown.cjs`, then run
`node scripts/install-neon-approved-solo.cjs <base-render-folder>`. The installer
validates the approved passage checksum, crossfades into/out of it outside its
musical transition, updates the full mix/checksum/catalog, and records hashes
proving the rest of the base WAV is unchanged. Do not use an already processed
installed WAV as the base. Tests verify placement, exact core PCM, gain and
unchanged surrounding audio. Historical audition notes below are superseded
by this installed release status.

The separate Midnight Signal song is aborted and removed from the active
catalog and release files. Its local experiments are archived outside Git.

---

# Neon Countdown / Midnight Passage

There is no fixed runtime target. The user removed the length constraint; durations below describe the current render. Future changes should follow musical structure and complete instrument decays.

Arrangement revision 57: **6:27**, 48 kHz stereo. The score has three parts; all event times are stored on the engine's 120-BPM grid, with explicit timing conversion for the other tempos.

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

There is no tempo ramp. The tempo changes immediately from 64 to 114 BPM at Part III's entrance, over sustained A/E pulse notes. The final A/E pulse chord attacks at 4:29.0625 and holds 5.625 seconds (six slow beats). Its .65-second release begins at 4:34.6875; Part III enters at 4:35, with only .3375 seconds of release overlap. This gives the final note its sullen weight while avoiding masking the new entrance. The bridge excludes organ; the recorded bell tails may ring across the entrance. There is no closing wind. All Part II attacks, bell phrases, organ answers, boundaries and tail calculations move together when its entrance changes.

## Part III: orchestral themes with Dark 80s hip-hop drums, 4:35-6:21

D minor, approved 114 BPM: 48 bars and a concise final chord. Recorded cellos, violin spiccato and legato strings carry the orchestral texture; horns, trumpets and flute add accents and answers. The cinematic pulse keeps its original short rhythmic values (retimed to 114 BPM), .76 sustain and .16-second release. The longer-gate experiment was explicitly reverted: steady percussion should carry motion between the short bass hits.

The user replaced orchestral percussion, then tambourine/maracas trials, with the exact Dark 80s hip-hop kit. Four one-shots were recovered from the original isolated Dark-80s-Hip-Hop-v12 stems: low 808-style kick with pitch snap, noise/body snare, triple-burst clap and metallic closed hat. Kick plays each beat; snare and clap play beats two/four. Closed hat plays continuous sixteenths at f/mp/mf/p accents, with gain 1.6. Original snare fills and orchestral cymbal punctuation remain. The whole hip-hop kit is raised 6 dB relative to the first transplant: kick 3.2, snare 2.6, clap 2.2, hat 1.6. This targets a clear percussion bed alongside the pulse bass, rather than a faint background tick. There is no active tambourine or maracas. This intentionally makes the drums electronic while the melodic ensemble remains sampled orchestra.

The kit manifest is api/audio/instruments/dark-eighties-hiphop-kit.json. It records the original stem archive hash, extraction beats/velocities, root frequencies, durations and individual checksums. scripts/import-dark-eighties-kit.py recovers original tones using only Python's standard library; pass a path to the preserved percussion-stems.npz if its location differs. scripts/synthesize-dark-eighties-kit.py preserves the original synthesis recipe and seed; regenerating it requires NumPy. Both methods write mono 48 kHz one-shots, never excerpts of mixed music. Playback compensates different recording levels with sample gain .75/peakAmplitude; intact source files are retained.

Orchestra levels are raised relative to the 1.1 pulse gain: cello/spiccato/trumpet 1.9, legato violin 2.4, tremolo/horn/flute 2.6, short-bow violin approaches 4.8. These are mix settings; source samples have different perceived loudness. High recorded violin tremolo and E6/F6 horror accents recur through the build. The opening E6/F6 cluster at 4:35.25 retains its original .75-second hold, then begins a 1.75-second release at 4:36. A separate opening articulation extends the fading tail without changing the later tremolo accents. Woodwind/brass call-and-answer provides contrast.

Most broad held tremolo-chord entrances receive four sixteenth-note approaches: most changing chord entrances, plus the final cadence. scripts/string-chord-approach.cjs chooses a chord tone near the incoming melodic pitch, then generates a diatonic rising/falling approach from that pitch's side. The tracked melody includes both flute calls and horn answers as well as the violin hook; accompaniment chords are excluded. Equal pitches retain the preceding melodic direction. The held chord owns the arrival note. Final dominant/cadence approaches use D harmonic minor; other approaches use D natural minor. There are 12 four-note lead-ins, with both directions represented. The original twelve contour entrance times remain fixed; eleven other broad held-string entrances use one quarter-note legato pickup instead. Quarter pickups use a separate long-violin voice at gain2.4, a35ms attack and80ms release; they do not use the short-bow attack skip. Any target pitch already present in the preceding held violin/tremolo chord is excluded; common tones do not receive another lead-in. This rule takes precedence over adding approaches to most changing chords. Short-bow violin samples replace the soft sustained articulation for the fast notes, with a 3 ms attack, .012-second release and gain 4.8 so the lead-ins are audible alongside the held strings. Measured source attacks peak about 150-200 ms into the recording, longer than a 125 ms sixteenth. Each approach event therefore starts 120 ms into the intact short-bow recording. Gates occupy 84% of a sixteenth, with only 12 ms release and .025/.35-second room reverb, so each pitch speaks distinctly before the next. The final arrival uses a sustained violin sample. Percussion settings are frozen at the user-approved revision 45 balance.

Bell phrases follow a separate authored schedule. Pairs use two quarter notes at lead-in and chord arrival; singles strike only at chord arrival, usually an octave below the string target. Revision 54 replaces the earlier 30-strike/20-phrase bell line with sparse section accents: five phrases, seven strikes total. At Part III-relative 0:16 and 1:04, two quarter-note strikes punctuate the lead-in beat and arrival; at 0:40, 1:20 and the final chord at 1:36, a single strike marks the arrival. The string melody, held chords, contours, accompaniment and steady percussion are unchanged. Bell gain remains 5.2 in Part III and 1.2 in Part II. Full recorded decay remains intact, with one additional second at the file end for the final D5 accent.

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

After rendering, install the full WAV as api/audio/samples/neon-countdown.wav and update api/audio/instruments/neon-countdown-mix.json and the catalog's renderedMix metadata/checksum. The native-player event length is durationSeconds*BPM/60: 774 beats for 387 seconds at the catalog's 120 BPM. Source score is api/audio/instruments/neon-countdown-score.json. Earlier previews remain available for comparison.

## Verification

Run tests/neon-countdown-song.mjs, tests/cinematic-robot-pulse.mjs and tests/orchestral-finale.mjs and tests/beat-tempo-ramp.mjs with Node. These check source reproducibility, original layer identities, requested balances and gates, complete recorded assets and tail bounds, continuous tempo handoff, three-part registration, finale instrumentation, horror accents, native-player duration, stereo file integrity, checksum, headroom, continuous audio until the final release, and source licensing/hash integrity. Existing expressive-instrument and Dark 80s checks protect unrelated behavior. These checks establish arrangement and file integrity; listening feedback determines musical balance.

Revision 51 corrects the contour bells to two quarter-note strikes: the start of the four-sixteenth run, then its sustained-chord arrival. Four independent callbacks remain. Full recorded decays are preserved, including the final chord bell tail.

## Approved checkpoint and thematic direction

Revision52 integrates the approved auditions. Part II upper pulse chords now coincide with bass accents; intra-chord12/24ms staggering is removed. Organ answers and the opening bell phrase sit on the sixteenth grid. Eleven bell notes within one sixteenth of a pulse accent align with that accent. The instrument recordings start within0–5ms; this correction changes event placement, not sample trimming.

scripts/neon-countdown-phrasing.cjs revoices held strings without changing their gates or attack positions, preserves the original twelve four-sixteenth entrance times, and supplies legato quarter pickups elsewhere. It owns the separate bell phrase schedule and explicit approved exceptions. tests/fixtures/neon-approved-phrasing.json protects the exact opening audition at its new entrance, including drums, all accompaniment and the pickup/bell edits. The same placement policy extends through the remaining phrases.

Part I establishes the themes; Part II darkens/develops them; Part III is derived from both. Part I edits must develop its existing hook and rhythm, while the finale retains their thematic relationship. Do not reverse that direction by deriving Part I from Part III.


Revision 54 supersedes the earlier alternating contour-bell schedule. Bells are
section punctuation, with three single-hit phrases and two double-hit phrases;
they do not follow the melody or every sustained-string entrance. The historical
opening-audition fixture continues to protect all non-bell accompaniment.


Revision 55 restores the original first double bell accent, C5 then F4, at
Part III-relative 15.5/16 seconds. Its pitches and quarter-note timing now match
the approved original audition fixture. The sparse seven-strike arrangement and
all other events remain unchanged from revision 54.


## Approved 114-BPM finale

The user selected 114 BPM after hearing 108 and 100 BPM comparisons. Revision56
retimes only Part III. `scripts/neon-countdown-tempo.cjs` converts authored120-BPM
finale offsets and written gates onto the existing engine grid, preserving all
pitches, instruments, sample playback rates and physical release envelopes.
Parts I/II, the wind and the 4:35 handoff remain unchanged. Metadata, section
boundaries and natural sample/reverb tails are recalculated. Full duration is
387 seconds. Historical fixture checks operate on the authored score; separate
checks compare every performed event with its114-BPM timing.

## Vintage five-chord solo — separate audition

The user specified that the solo keeps only the higher held string chords,
their contours and the existing sparse bell accent. Percussion, pulse bass,
lower strings, brass and the separate melodic line drop out for the feature.
The same chords/inversions remain: Dm, Bb, F, E diminished, Dm. At the original
two-bar chord spacing, these five arrivals span ten bars including the final
Dm hold. No replacement progression or new melody is used.

`scripts/audition-neon-vintage-solo.cjs` builds the114-BPM prototype from original
Part III bars12–30. The dropout begins with the first chord's contour, one beat
before the first held chord. Only the original sustained upper tremolo-chord
notes, original string runs/quarter pickups and original `finale-bells` events
remain until the five-chord feature ends. Backing returns afterward. Potential
backing tails are shortened/faded just before entry. Upper chords use a vintage
bandpass/light saturation voice; pitches, inversions and onsets stay unchanged. The latest audition extends each
held chord from about2.9 to4.01 seconds, leaving a0.2-second gap before the next
arrival and a0.65-second release that overlaps it gently. Attack is0.12 seconds.
The narrow bandpass and distortion were removed; a mild6kHz rolloff and modest
room tone retain the recorded strings. Every selected source recording has
enough real duration at its performed pitch for the gate and release; no loops
were introduced. The middle F-chord bell keeps its natural recorded decay.
Assertions enforce five chord arrivals and the allowed solo voices.

Latest output:
`tests/artifacts/neon-legato-chord-solo/legato-chords-bell-114.wav`.
This replaces the earlier full-accompaniment chord-accent audition and the
rejected isolated-violin-melody prototype. Solo insertion remains a listening
preview; the installed full song remains the approved114-BPM revision57.

## Original cinematic pulse with softened buzz

The user rejected the triangle/sine replacement because it changed the sound's
identity. `cinematic-rounded-pulse` is removed from the active catalog; its source
and old audition remain available as historical records.

The new **Cinematic Pulse — Softened** (`cinematic-pulse-softened`), stored in
`api/audio/instruments/cinematic-pulse-softened.json`, clones the ORIGINAL pulse.
Its saw/square/sine layers, detuning, pitch envelope, amplitude envelope, gain,
sub weight and timing remain intact. Only the lowpass treatment and saturation
are softened:620Hz resting cutoff,850Hz sweep, Q0.6, distortion0.012. It has no
fallback to the harsher original voice. The untouched original remains available.
The solo preview uses this version before/after the dropout, with the finale's
own short pulse envelope preserved. Pulse bass is absent inside the string solo.

`scripts/audition-softened-pulse.cjs` renders the same riff first with the original,
then the softened ORIGINAL instrument, switching at8.421 seconds. Output:
`tests/artifacts/softened-pulse/softened-original-pulse.wav`. Instrument identity
assertions compare unchanged oscillator, detuning, pitch, envelope and gain
fields. A rendered-note high-frequency proportion check confirms the reduction;
listening determines whether the amount is right. The user approved this voice for Part III. Revision57 applies it to
`finale-pulse` and `finale-last-pulse` only, keeping their approved gain and
amplitude envelopes. Parts I and II retain their existing bass definitions.
The solo arrangement remains an audition; it is not in the installed full song.


Revision57 uses the approved softened original pulse in Part III. Chord-solo
feedback requested longer sustains and less synthetic entrances/exits; the
separate legato audition above supersedes its earlier short, bandpassed version.
The same five chords, contours and natural bell accent remain, with percussion
and lower strings absent during the focus. Solo entry backing fades are0.18
seconds rather than the earlier0.04-second cuts. The full song's duration remains
387 seconds; only its approved Part III bass timbre is newly installed.


## Solo transition correction: accompaniment overlaps the chords

The earlier cut-at-entry and pre-chord fades are superseded. The requested
transition keeps the upper held chords, contours and bell audible throughout.
Backing remains present at the first held chord, fades down across that chord,
and returns across the final held chord. There is no inserted silent gap.

`scripts/neon-solo-chord-transitions.cjs` builds two separate full-length stems:
upper strings/contours/bell, and original backing with its original note lengths.
It restores each stem to a common render gain before mixing, then applies a
smoothstep volume envelope only to the backing. Entry spans 8.421–12.632 seconds
of the excerpt; return spans 25.263–29.474 seconds. The same smooth filter curve
closes and reopens over those chord-aligned windows. The user's preferred exit
shape is retained, with its timing moved onto the last chord as clarified.

Reproduce: run the helper without arguments, render `upper-score.json` and
`backing-score.json` from `tests/artifacts/neon-chord-transitions` with the shared
renderer, run the helper with `mix`, then apply `scripts/apply-neon-filter-fade.cjs`
to `chord-transitions-dry.wav` using `transition-score.json`.
Latest listening preview: `tests/artifacts/neon-chord-transitions/chord-transitions-filter.wav`.
This is an audition, not an approved insertion into the full song.

Revision 57's full 6:27 mix with the approved softened Part III pulse is now
installed locally. Score reproducibility, mix checksums and orchestral audio
checks pass. No deployment or commit was performed.


### Vinyl pops in the string solo (audition)

User requested random record-popping noises specifically in Neon Countdown,
not Midnight Signal. `scripts/add-neon-vinyl-pops.cjs` adds 21 irregular synthetic
transients to the chord-transition preview, confined to 8.421–29.474 seconds.
Timing, levels, pan and short 3–13 ms shapes vary; a few closely spaced double
pops mimic record dust. Seed 0x1835ad91 preserves reproducibility. The layer
fades in across the first chord and out across the last; there is no constant
hiss. The original music is unchanged and samples outside the solo are verified
byte-identical. Output remains unclipped, peak 0.8104.

Latest preview: `tests/artifacts/neon-chord-transitions/chord-transitions-vinyl.wav`.
Its companion `-mix.json` records each pop, timing, seed and checksum. No full-song
insertion or deployment; awaiting listening feedback on the texture.


The first vinyl layer was too quiet in listening feedback. The next audition
raises only the pops by 6x (15.56 dB), preserving the same 21 irregular timings,
stereo positions, envelopes and musical source. Latest output:
`tests/artifacts/neon-chord-transitions/chord-transitions-vinyl-louder.wav`.
Music outside the solo remains byte-identical; the output remains unclipped.


### Lower-string pulse and stronger vinyl audition

User revised the earlier upper-only solo: add a steady lower-string beat,
repeating the SAME pitch throughout each held chord, switching only when the
chord switches. The five groups are D3 / Bb2 / F3 / E3 / D3, aligned exactly to
the original Dm / Bb / F / E-diminished / Dm arrivals. Each group has sixteen
regular eighth notes at 114 BPM, accents every four attacks, with no moving
bass line. Recorded short cellos use controlled gates/releases for separation.
`scripts/neon-solo-lower-strings.cjs` prepares and mixes that separate stem.
This supersedes the earlier exclusion of lower strings, without restoring drums.

The pop layer is now 24x its first level, 4x (+12.04 dB) the previous louder
preview. The same random timings and shapes are retained. New layered audition:
`tests/artifacts/neon-chord-transitions/solo-low-strings-vinyl.wav`.
The full-song insertion is still pending listening approval; no deployment.


### Bass-register correction

Listening feedback requested a substantially lower, louder pulse and corrected
the next-to-last group. Original source events at that chord have `finale-pulse`
C2 and `finale-cellos` C3 under upper E/G/Bb: the full harmony is C7, whose upper
three notes alone had been labelled E diminished in the solo preview. The bass
must be C, not E. Upper chord pitches remain unchanged.

Latest repeated groups: D1 / Bb0 / F1 / C1 / D1, two octaves below the prior
D3 / Bb2 / F3 / E3 / D3 (with the fourth pitch class corrected). Quieter octave
reinforcement D2 / Bb1 / F2 / C2 / D2 improves audibility on small speakers.
The fundamental cello layer gain rises from 2.2 to 5.5; reinforcement uses 2.2.
Each layer repeats one pitch for sixteen eighth notes per chord. The bass stem
is mixed AFTER the vintage filter, preserving the low fundamentals instead of
passing them through its 140 Hz highpass. Existing upper-string/filter/backing
transitions and 24x vinyl layer remain intact. Output peak remains below 0.85.

Latest listening preview:
`tests/artifacts/neon-chord-transitions/solo-bass-strings-vinyl.wav`.
Reproduce: prepare/render the lower-string stem, run the helper with `mix`, then
run `add-neon-vinyl-pops.cjs` with `bass-strings-mix.wav` as input. Do not apply
the vintage filter again to the combined mix. This supersedes the earlier
lower-string audition instructions. No full-song insertion or deployment.


### Clarified bass timbre: low bowed cello

The user meant the sound of a bass cello, not an extremely low sub layer.
Latest audition uses one recorded cello-short (bowed spiccato) layer in D2 /
Bb1 / F2 / C2 / D2, removing the D1/Bb0 sub-octave doubling. Most notes are near
the native C2 recording, retaining its bow attack and string harmonics rather
than slowing it by an octave or more. Gate is 0.221 seconds, release 0.065,
attack 0.012, gain 4.8. Each group still repeats one pitch on a steady eighth-note
beat and switches only with its chord; fourth group remains corrected to C.
Mix this cello after the vintage highpass. Existing strings, backing transitions,
bells and stronger vinyl pops remain. Latest preview:
`tests/artifacts/neon-chord-transitions/solo-bowed-cello-vinyl.wav`.
Reproduce with the lower-string helper, shared renderer, helper `mix`, then
vinyl generator using `bowed-cello-mix.wav`. No full-song insertion/deployment.


Cello balance follow-up: raise only the existing bowed-cello stem by 3 dB
at mix time; pitches, rhythm, voice, upper strings, transitions and pop layer
remain unchanged. Latest preview: `tests/artifacts/neon-chord-transitions/solo-bowed-cello-louder-vinyl.wav`.


### Natural cello decay comparison

User approved trying preserved recorded decay. Set the short bowed cello samples'
`naturalDecay` to true: the audio engine plays each recording to its natural end,
ignoring the written gate for sample release. New attacks remain at exactly the
same eighth-note times and pitches; decay tails can overlap subsequent attacks.
The cello still bypasses the vintage filter and retains the prior 3 dB mix boost.
No reverb, timbre, pattern, pop or upper-string changes were added.

Render `lower-strings-score.json` as `natural-cello`, then run the lower-string
helper with `mix` and the vinyl generator on `natural-cello-mix.wav`. Latest
comparison: `tests/artifacts/neon-chord-transitions/solo-natural-cello-vinyl.wav`.
Prior gated comparison remains `solo-bowed-cello-louder-vinyl.wav`. Natural mix
peak 0.8966, no clipping. Listening review pending; not installed in full song.


User approved the longer cello tails and requested more level. Preserve natural
decay, increase cello mix boost from +3 to +5 dB (another +2 dB), with the rest
unchanged. A +6 dB total boost exceeded PCM headroom; +5 remains unclipped.
Latest preview: `tests/artifacts/neon-chord-transitions/solo-natural-cello-louder-vinyl.wav`.


User requested replacing the final four repeated cello notes with a contour
leading into the normal accompaniment. Use E2–F2–G2–A2 on the existing last four
eighth-note attacks, resolving to the original arrangement’s Bb2 cello at the
return. The first 76 notes retain their repeated groups; natural sample decay,
+5 dB cello mix boost, unfiltered cello, backing/filter transitions and vinyl
remain. Latest preview: `tests/artifacts/neon-chord-transitions/solo-cello-return-contour.wav`.
Render the prepared lower-string score as `contour-cello`, helper `mix`, then
vinyl generator on `contour-cello-mix.wav`. No full-song installation/deployment.


Cello entrance softened on request: fade ONLY the cello stem from zero to its
existing level over exactly the backing fade-out interval, 8.421–12.632 seconds
of the excerpt. Use the same smoothstep curve for a complementary crossfade.
Natural sample tails, +5 dB final cello level, last-four contour and vinyl remain.
Samples after the entrance interval are verified byte-identical to the prior
contour preview. Latest: `tests/artifacts/neon-chord-transitions/solo-cello-fade-in.wav`.
Reproduce helper `mix` to `contour-cello-fade-mix.wav`, then vinyl postprocess.


Contour timing correction: user approved the entrance fade but requested the
return run use the same lengths as the existing contours. Restore the first
14 repeated D2 eighth notes of the last group, then play E2/F2/G2/A2 as four
sixteenths within the final beat. Copy the existing contour’s 0.110526-second
gates and 0.131579-second spacing. Only these four passing notes use a short
0.012-second release and gated samples; ordinary cello pulses retain approved
natural tails. The final run resolves to the normal Bb2 cello. Entrance fade,
+5 dB cello balance and vinyl remain. Preview: `tests/artifacts/neon-chord-transitions/solo-cello-sixteenth-contour.wav`.
Render the lower-string score as `sixteenth-contour-cello`, run helper `mix`,
then vinyl generator on `sixteenth-contour-cello-mix.wav`. Not inserted into full song.
