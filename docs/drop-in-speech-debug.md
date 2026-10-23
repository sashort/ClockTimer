# Live speech debugging through Drop-In

Open **Developer Tools → Drop-In** in Order Filler. This launches
`drop-in.php?debug=speech`. Select the user and begin viewing as usual. The
server requires Drop-In plus Developer or Developer Preview permission
(Superuser also qualifies). The usual account lookup permission is needed
to select users. An ordinary Drop-In launch does not subscribe to diagnostics.

The publisher sends diagnostic events only while an authorized debug viewer
is connected. The existing authenticated WebSocket routes them only to debug
subscribers. They are not written to the database. Closing the session stops
forwarding; revoking permission closes the peer during the existing two-second
permission sweep. No new authentication endpoint or command execution path is used.

In the viewer console, filter for `[Drop-In speech]`. Each record includes a source
timestamp, sequence number, observed user ID and event name. Diagnostics include:

- Recognizer interim/final text before command scoping and the scoped transcript.
- Returned recognition alternatives, confidence values when supplied, and selected index.
- Validated command-buffer entries, execution status, contexts and dependencies.
- Parsed time/duration hours, minutes and seconds, with defaulted values in brackets.
- Command dispatches, rejections, failures, handoffs and listening state.
- Selected mode and IDs/titles of open dialogs as context.

Partial updates are coalesced over 100 milliseconds, preserving the latest partial;
finals and command events are sent immediately. Text and alternative counts are
bounded. No audio samples, form values or arbitrary handler arguments are serialized.
Diagnostic publication is suppressed while the login dialog is open. Alternatives
are available only when the active recognizer supplies them; they are not fabricated
when the runtime supports only one result.

Components retain value provenance separately from unit interpretation. For
“an hour and five”, the diagnostic display is `hours: 1, minutes: 5, seconds: [0]`.
Five was explicitly supplied despite its omitted unit; only the missing seconds
value is defaulted. An explicitly spoken zero remains unbracketed. Time and
duration retain their distinct meanings for a phrase such as “four twelve”.

The shared clock view, microphone/program audio and trainer messaging use normal
Drop-In behavior. A developer can send spoken instructions through the existing
messaging controls while comparing recognition and execution events. This is not
screen sharing: local dialogs and browser console errors are not visually mirrored.
Dialog context is logged separately. Network delivery of events and WebRTC audio
can have different delays; timestamps identify event order but do not guarantee
synchronized audio playback.
