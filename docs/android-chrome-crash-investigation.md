# Android Chrome renderer crash — deferred

The user explicitly deferred investigation/fixing on November 4, 2026. This is
separate from the confirmed preview projection and legend positioning defects.
Do not describe an Order Filler memory leak as established or this crash as fixed.

Captured on the connected Pixel 6 (Android 17, Chrome 155):

- Chrome displayed its Aw, Snap crash page; Runtime.evaluate stopped responding.
- Android recorded renderer PID 23133 exiting at 19:47:34 local time.
- The native crash was SIGSEGV / SEGV_MAPERR on ThreadPoolForeg in libchrome.so.
- Renderer RSS at exit was approximately 887 MB; process uptime was 4659 seconds.
- The data filesystem reported 374 MB available out of 110 GB (100% used).
- Available RAM measured after the crash was approximately 1.8 GB; this does not
  establish available memory at the time of the crash.

Local evidence is under outputs/fitted-preview-phone in the parent workspace:
error-device.png, chrome-exit-info.txt, crash-buffer.txt and chrome-events.txt.
Raw diagnostics are not committed, uploaded or part of the application.

Low storage may contribute to instability, but it does not establish the cause
of this native fault. A possible application memory leak remains unconfirmed.
When resumed: compare clean idle, preview activity and repeated open/close
cycles using JavaScript heap, DOM/listener counts and renderer native memory,
with a storage-controlled repeat. Avoid retaining unbounded diagnostic samples.
