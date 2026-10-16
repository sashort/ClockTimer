# Cinematic Robot Pulse

An original nonverbal moving-vowel instrument derived from `cinematic-pulse-bass`. The separate preset has an isolated audition and replaces most of the pulse in Part I only. Revision 19 retains the original cinematic pulse for the first four pulse notes and the final held bass/reference note; the moving-vowel voice begins on the fifth pulse note at 8 seconds. Part II retains the original cinematic pulse. It contains no speech recording and does not restore the rejected spoken vocoder phrase.

`scripts/synthesize-cinematic-robot.cjs` builds a carrier from the existing pulse's two saw waves detuned by +/-3 cents, half-frequency square sub and quiet second-harmonic sine. Three bandpass resonators move smoothly through OH, AH and EE formants over two seconds. A small dry carrier component preserves the bass body. The result is a robotic vowel effect rather than intelligible vocoded lyrics.

Three original 48 kHz mono samples at C2, C3 and C4 limit the pitch shifting of the formants. Each has a crossfaded two-second sustain loop from 0.04 to 2.04 seconds. The preset retains the original pulse's attack/decay/sustain/release and mild distortion/delay/reverb, with a wider output filter so the upper formants remain audible. Small chorus movement adds width. No AudioEngine changes are required: its existing expressive sample model selects the nearest root and loops held notes.

Regenerate the samples, preset and audition score with `node scripts/synthesize-cinematic-robot.cjs`. This also registers the separate `cinematic-robot-pulse` preset in the audio catalog. Render the audition using:

```powershell
node scripts/render-neon-countdown.cjs <output-directory> api/audio/instruments/cinematic-robot-demo.json cinematic-robot-pulse-demo
```

The 18-second stereo audition plays the original pulse at 0-4 seconds, the same figure on the new preset at 4-8, a held note at 8-12, a minor chord at 12-16 and short ending pulses at 16-18. Both use the same dynamics and one shared master normalization. Perceived loudness can still differ with the spectrum. The audition peaks at 0.65 with headroom.
