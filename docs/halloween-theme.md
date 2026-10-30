# Order Filler themes

Settings → Themes → Halloween switches the visual skin and keypad audio together.
The account preference is `orderFiller["wmof.clock.theme"]`, with values
`halloween` and `default`. A signed-out choice uses separate anonymous browser
storage. Loading or changing accounts uses that account's choice; it does not
copy another user's theme. A failed save restores the previous selection.

Without an explicit choice, Halloween is the October 31 local-date default and
normal styling returns on November 1. Manual on/off overrides that date default.
The local audition query `?halloweenPreview=1` is also supported. Embedded
settings follow their parent's effective theme, including an explicit off choice.

## Files and rendering

- `styles/default/` owns the regular application, menu icons, mode menu and Drop
  In styles. Templates link to these files directly. The original root stylesheet
  URLs remain as small compatibility imports; release stamping versions both
  the direct links and those imports.
- `styles/halloween/index.css` owns the Halloween palette and component overrides:
  orange, yellow and black/brown, gray secondary controls and purple highlights.
- `SeasonalTheme.js` owns selection, account persistence, the calendar fallback,
  temporary color overrides and closed-shadow registration. It maps literal
  legacy colors in stylesheets and dynamic inline/SVG colors without rewriting
  their original values. Generated rules contain color declarations only, so
  they do not copy stale positions, sizes or animation geometry.
- `styles/halloween/SkeletonAvatar.js` decorates the existing animation rig with
  a skull, ribs and bone joints. It uses the same poses, proportions and
  transitions. Skull/ribs follow the seated geometry during break transitions;
  disabling the theme restores the original head and removes all decoration.

The skin covers login, menus, all four layouts, breaks and Down, numberpad,
Voicepad, Trip Log and its official editor, Trip Summary, confirmations, profile,
preferences, audio settings, clock settings and Drop In. The shared settings page
is generated from current Order Filler components instead of a stale HTML copy.
Embedded settings reserve their own viewport height rather than the hidden app's
zero-height layout boundary.

Clock colors are overridden temporarily, including user-customized colors.
Saved graphical settings are never changed. Timing rings, hands, digits, ticks
and indicators remain above the jack-o'-lantern decoration. Break/Down timing,
goal calculation, motion geometry and trip accounting do not change.

## Audio

The Halloween numberpad opens with Part 3 strings and cycles through five held
Cinematic Pulse Bass notes. Inactivity and Reset silently reset the sequence;
OK is silent. Seasonal trip-start/end ensemble arrangements allow speech at the
two-second mark. Trip Start/End play cached pre-rendered clips at each supported
speed to avoid live ensemble load on phones. The approved orchestral event family covers other notifications.
Saved instruments, volume and mute remain governed by existing audio settings.
Turning the theme off cancels seasonal playback and restores normal audio.
See [halloween-audio.md](halloween-audio.md) for scores and event behavior.

## Verification and state references

`tests/halloween-theme-browser.cjs` exercises persistence, on/off restoration,
saved custom colors, the day boundary, closed shadows, embedded settings,
skeleton geometry, the 16 layout/state combinations, dialogs and Drop In. It
captures the actual UI and audits visible colors in all frames for remaining blue.
The audio tests cover five-note sequencing, timeout resets, cancellation,
recording caches and approved ensemble dispatch. Existing layout/avatar,
template, settings and audio-volume checks remain applicable.

The `HALLOWEEN-THEME` version 2 FSM contract and `HALLOWEEN-TOGGLE-RESTORE` case
record this orthogonal appearance/audio setting. The state inventory includes
the Themes pane and effective Default/Halloween states.

Deferred ordinary fixes remain in [post-halloween-follow-ups.md](post-halloween-follow-ups.md).
