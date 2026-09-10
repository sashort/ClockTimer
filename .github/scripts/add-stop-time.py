from pathlib import Path
p=Path('ClockTimer.js')
s=p.read_text()
old='''        stop() {
            const stopTime =
                this.#dateToTimelineTime(
                    new Date()
                );'''
new='''        stop(stopTime) {
            const parsedStop =
                stopTime === undefined
                    ? this.#dateToStandardTime(
                        new Date()
                    )
                    : stopTime;

            const parsed =
                this.#parseStandardTime(
                    parsedStop,
                    {
                        duration: false,
                        name: "stopTime"
                    }
                );

            stopTime =
                this.#resolveNear(
                    parsed.total,
                    this.#getCurrentTimelineTime()
                );'''
if old not in s:
    raise SystemExit('stop method pattern not found')
s=s.replace(old,new,1)
p.write_text(s)
