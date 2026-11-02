# Shared interval countdown and buffer wings

Only one countdown is shown. During the start buffer the caption is **Break
Starts**, **Lunch Starts**, or **Short Break Starts**. During the end buffer it
is **Break Ends**, **Lunch Ends**, or **Short Break Ends**. The break body uses
only its break type and excludes both buffers. Buffer tracks carry no numbers.

A single rounded stepped outline surrounds the center timer and both full
buffer tracks. Tracks extend to the document inset while a buffer is active.
The outline draws attention with a slow gradient sweep. Goal countdowns use
the same treatment; Down uses it only in Compact mode.

The wings collapse with smoothstep easing over the last second before the
start buffer ends. They expand using the reverse motion over the second before
the end buffer starts. The countdown caption changes at the actual boundary.
Motion is scheduled against the absolute boundary rather than waiting for the
next one-second tick. Reloads seek to the correct progress. Reduced Motion
uses the settled shape at the boundary.

After the end buffer, empty wings remain until Resume or Down. In Full mode,
when the overdue Down action shares the row, the retained wings stay within
the End Break action so they do not paint beneath the adjacent button.
The border and tracks ignore pointer input; the existing action remains the
only interactive owner. Timer caption/value bounds must fit their action;
intentional absolute wing paint is not text overflow.

Verification: `tests/buffer-wing-motion-browser.cjs`,
`tests/timer-attention-browser.cjs`, and `tests/break-session-browser.cjs`.
