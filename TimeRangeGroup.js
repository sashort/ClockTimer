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
        this._listeners = new Set();
        this._reached = new WeakMap();
        this._accountingKey = undefined;
        this.addAll(timeRanges);
    }

    addEventListener(type, listener) {
        if (type === "boundary-reached") this._listeners.add(listener);
    }

    removeEventListener(type, listener) {
        if (type === "boundary-reached") this._listeners.delete(listener);
    }

    checkBoundary(before, now, after = undefined) {
        const boundary = before?.endTime?.getTime() ?? after?.startTime?.getTime();
        if (!Number.isFinite(now) || !Number.isFinite(boundary) || now < boundary) return false;
        const range = before ?? after;
        const reached = this._reached.get(range) ?? new Set();
        if (!reached.has(boundary)) {
            reached.add(boundary);
            this._reached.set(range, reached);
            const event = { type: "boundary-reached", now };
            if (before) event.before = before;
            if (after) event.after = after;
            for (const listener of [...this._listeners]) listener(event);
        }
        return true;
    }

    // Exclusions arrive normalized by ClockTimer's approval/overwrite policy.
    // Members represent earned time plus the remaining productive allowance,
    // which is independent of wall-clock deadlines while an interval is open.
    updateAccounting(start, end, exclusions = [], required = 0) {
        const key = JSON.stringify([start, end, exclusions, required]);
        if (key === this._accountingKey) return this;
        this.timeRanges.length = 0;
        let cursor = start;
        const add = (left, right, now) => {
            if (right > left) this.timeRanges.push(
                customElements.get("time-range").createCountedRange(left, right, now));
        };
        for (const [left, right] of exclusions) {
            if (left >= end) break;
            if (right <= cursor) continue;
            add(cursor, Math.min(left, end), end);
            cursor = Math.max(cursor, right);
        }
        add(cursor, end, end);
        this.recalculateCountedTime();
        const remaining = Math.max(0, required - this.elapsedCountedTime);
        add(end, end + remaining, end);
        this.recalculateCountedTime();
        this._accountingKey = key;
        return this;
    }

    add(timeRange) {
        if (!timeRange || this.timeRanges.includes(timeRange)) return;
        this._accountingKey = undefined;
        this.timeRanges.push(timeRange);
        this.recalculateCountedTime();
    }

    addAll(timeRanges) {
        for (const timeRange of timeRanges) this.add(timeRange);
    }

    remove(timeRange) {
        const index = this.timeRanges.indexOf(timeRange);
        if (index !== -1) {
            this._accountingKey = undefined;
            this._reached.delete(timeRange);
            this.timeRanges.splice(index, 1);
            this.recalculateCountedTime();
        }
    }

    clear() {
        this.timeRanges.length = 0;
        this._reached = new WeakMap();
        this._accountingKey = undefined;
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

if (typeof globalThis !== "undefined") {
    globalThis.TimeRangeGroup = TimeRangeGroup;
}

if (typeof module !== "undefined") {
    module.exports = { TimeRangeGroup };
}
