/**
 * TimeRangeGroup
 *
 * Owns aggregate counted-time state for its member TimeRanges.
 * TimeRange owns individual interval semantics; the group owns aggregate
 * counted time; ClockTimer owns lifecycle/orchestration.
 */
class TimeRangeGroup {
    constructor(timeRanges = []) {
        this.timeRanges = [];
        this.totalCountedTime = 0;
        this.elapsedCountedTime = 0;
        this.remainingCountedTime = 0;
        this.addAll(timeRanges);
    }

    add(timeRange) {
        if (!timeRange || this.timeRanges.includes(timeRange)) return;
        this.timeRanges.push(timeRange);
        this.recalculateCountedTime();
    }

    addAll(timeRanges) {
        for (const timeRange of timeRanges) this.add(timeRange);
    }

    remove(timeRange) {
        const index = this.timeRanges.indexOf(timeRange);
        if (index !== -1) {
            this.timeRanges.splice(index, 1);
            this.recalculateCountedTime();
        }
    }

    clear() {
        this.timeRanges.length = 0;
        this.recalculateCountedTime();
    }

    recalculateCountedTime() {
        this.totalCountedTime = this.timeRanges.reduce(
            (sum, range) => sum + Number(range.counted?.total || 0), 0
        );
        this.elapsedCountedTime = this.timeRanges.reduce(
            (sum, range) => sum + Number(range.counted?.elapsed || 0), 0
        );
        this.remainingCountedTime = this.timeRanges.reduce(
            (sum, range) => sum + Number(range.counted?.remaining || 0), 0
        );
        return this;
    }
}

if (typeof module !== "undefined") {
    module.exports = { TimeRangeGroup };
}
