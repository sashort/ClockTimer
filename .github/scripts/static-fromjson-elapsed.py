from pathlib import Path

clock_path = Path('ClockTimer.js')
clock = clock_path.read_text()
old = '''                        elapsedRange.setAttribute(
                            "overlapping",
                            ""
                        );

                        ring.appendChild(
                            elapsedRange
                        );'''
new = '''                        elapsedRange.setAttribute(
                            "overlapping",
                            ""
                        );

                        elapsedRange.setAttribute(
                            "static-elapsed",
                            ""
                        );

                        elapsedRange.timeRangeFullEntry =
                            true;

                        ring.appendChild(
                            elapsedRange
                        );'''
if old not in clock:
    raise SystemExit('fromJSON elapsed append block not found')
clock = clock.replace(old, new, 1)
clock_path.write_text(clock)

time_path = Path('TimeRange.js')
time = time_path.read_text()
old = ''':host([type="elapsed"]) #elapsed-wave {
                animation: elapsed-wave-sweep 4.5s linear infinite;
            }'''
new = ''':host([type="elapsed"]:not([static-elapsed])) #elapsed-wave {
                animation: elapsed-wave-sweep 4.5s linear infinite;
            }

            :host([type="elapsed"][static-elapsed]) #elapsed-wave {
                display: none;
            }'''
if old not in time:
    raise SystemExit('elapsed wave animation rule not found')
time = time.replace(old, new, 1)
time_path.write_text(time)
