# Clock/Timer settings previews

Timer, Time and Style occupy the first tab row. Preview 1 and Preview 2 occupy
the second, in a more saturated version of the same blue. Buttons have individual
rounded borders and transparent gaps. One tab panel is visible; the header,
actions and both tab rows stay outside its scrolling region. ClockTimer keeps
its aspect ratio and sizes itself within the preview panel. No overlap fading
or settings accordion is used.

Both preview clocks share the same unsaved graphical settings. Preview 1 replays
an early start, lunch with start/end buffers, a late return, pending Down Time
and a B-Game target. Preview 2 replays approved Down intervals with surplus and
deficit, plus tolerance and overtime. The blue question button in the upper-right
of each pane opens an opaque legend for that sample. The normal visibility
settings still control how each range is shown.

Each selection restarts a model whose actual start/creation is 1:59:55 earlier.
The visible sample advances on a bounded one-second timer and crosses two hours five
seconds after selection. Overflow advances the active ring from 1 to 2; Fitted
keeps one ring and projects the same event model to its fitted scale. Switching
tabs or closing settings stops the previous loop. No sample calls connect,
start, persistence or account APIs: it uses ClockTimer's read-only observer
snapshot/event replay and the normal rendering/tick path. The development
preview module is separate from the production account timer.

Verification includes both sample event types, boundary timing, both timer modes,
shared drafts, legend accessibility, keyboard navigation, phone-size panels,
scroll-independent tab bounds, Default/Halloween styling, cancellation and
native/embedded settings parity.
