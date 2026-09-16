from pathlib import Path

path = Path('ClockTimer.js')
text = path.read_text()


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 match, found {count}')
    text = text.replace(old, new, 1)

replace_once(
'''        #getScopePercentGoal(scope) {
            const goal = scope === "total"
                ? this.#getTotalGoal()
                : this.#getTripGoal();
            return Number.isFinite(goal) && goal > 0 ? goal : undefined;
        }

        #getTotalSummary(timelineNow, nowDate) {''',
'''        #getScopePercentGoal(scope) {
            const goal = scope === "total"
                ? this.#getTotalGoal()
                : this.#getTripGoal();
            return Number.isFinite(goal) && goal > 0 ? goal : undefined;
        }

        #formatSummaryEndTime(value) {
            if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
                return undefined;
            }

            return [
                value.getHours(),
                value.getMinutes(),
                value.getSeconds()
            ]
                .map(part => String(part).padStart(2, "0"))
                .join(":");
        }

        #getTotalSummary(timelineNow, nowDate) {''',
'add end-time formatter')

replace_once(
'''            const countedPercent = actualTimeMilliseconds > 0
                ? countedTimeMilliseconds / actualTimeMilliseconds
                : 0;''',
'''            const countedPercent = countedTimeMilliseconds > 0
                ? standardTimeMilliseconds / countedTimeMilliseconds
                : undefined;''',
'total counted percent')

replace_once(
'''            else if (this.#renderedTimeMode === "calculated-end") {
                renderedTime = this.#formatClockDisplayTime(
                    new Date(nowDate.getTime() + remainingMilliseconds)
                );
            }''',
'''            else if (this.#renderedTimeMode === "calculated-end") {
                renderedTime = this.#formatSummaryEndTime(
                    new Date(nowDate.getTime() + remainingMilliseconds)
                );
            }''',
'total end-time format')

replace_once(
'''            const tripCountedPercent = tripActualTimeElapsedMilliseconds > 0
                ? tripCountedTimeElapsedMilliseconds / tripActualTimeElapsedMilliseconds
                : 0;''',
'''            const tripCountedPercent =
                tripCountedTimeElapsedMilliseconds > 0 &&
                Number.isFinite(this.#standardDuration)
                    ? this.#standardDuration / tripCountedTimeElapsedMilliseconds
                    : undefined;''',
'trip counted percent')

replace_once(
'''                if (!creationDate) {
                    return this.#formatClockDisplayTime(
                        synchronizedNow
                    );
                }''',
'''                if (!creationDate) {
                    return this.#formatSummaryEndTime(
                        synchronizedNow
                    );
                }''',
'calculated-end fallback format')

replace_once(
'''                return this.#formatClockDisplayTime(
                    new Date(
                        creationDate.getTime() +
                        effectiveEnd
                    )
                );''',
'''                return this.#formatSummaryEndTime(
                    new Date(
                        creationDate.getTime() +
                        effectiveEnd
                    )
                );''',
'calculated-end format')

path.write_text(text)
print('summary percent and end-time patch complete')
