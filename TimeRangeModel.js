class TimeRangeTick {
    #currentTime;
    #lastTickTime;
    #cursorTime;

    constructor(currentTime, lastTickTime) {
        this.#currentTime = TimeRangeTick.#time(currentTime);
        this.#lastTickTime = TimeRangeTick.#time(lastTickTime);
        if (this.#currentTime < this.#lastTickTime) {
            throw new RangeError("currentTime must not precede lastTickTime.");
        }
        this.#cursorTime = this.#lastTickTime;
    }

    get currentTime() { return new Date(this.#currentTime); }
    get lastTickTime() { return new Date(this.#lastTickTime); }
    get cursorTime() { return new Date(this.#cursorTime); }
    get totalDelta() { return this.#currentTime - this.#lastTickTime; }
    get remainingDelta() { return this.#currentTime - this.#cursorTime; }

    advanceTo(time) {
        const value = TimeRangeTick.#time(time);
        if (value < this.#cursorTime || value > this.#currentTime) {
            throw new RangeError("Tick cursor must remain within the clock interval.");
        }
        this.#cursorTime = value;
        return this;
    }

    static #time(value) {
        const date = value instanceof Date ? value : new Date(value);
        if (!Number.isFinite(date.getTime())) {
            throw new TypeError("Tick times must be valid dates.");
        }
        return date.getTime();
    }
}

class TimeRangeGroup extends EventTarget {
    #head;
    #tail;
    #clock;
    #clockListener;
    #boundaries = [];
    #active = true;

    constructor(clock = null, boundaries = []) {
        super();
        this.#clock = clock;
        this.setBoundaries(boundaries);
        if (clock) this.#attachClock(clock);
    }

    get head() { return this.#head; }
    get tail() { return this.#tail; }
    get boundaries() { return this.#boundaries.map(value => new Date(value)); }
    get size() {
        let count = 0;
        for (let range = this.#head; range; range = range.next) count++;
        return count;
    }

    setBoundaries(boundaries = []) {
        if (!Array.isArray(boundaries)) throw new TypeError("boundaries must be an array.");
        const values = boundaries.map(TimeRangeGroup.#time);
        values.sort((a, b) => a - b);
        this.#boundaries = [...new Set(values)];
        return this;
    }

    addEventListener(type, listener, options) {
        return super.addEventListener(type, listener, options);
    }

    removeEventListener(type, listener, options) {
        return super.removeEventListener(type, listener, options);
    }

    tick(currentTime, lastTickTime) {
        if (!this.#head) return;
        const tick = currentTime instanceof TimeRangeTick
            ? currentTime
            : new TimeRangeTick(currentTime, lastTickTime);
        this.#propagate(this.#head, tick);
    }

    insert(range, before = null) {
        if (!(range instanceof TimeRange) || range.group !== this) {
            throw new TypeError("Range must belong to this group.");
        }
        if (range.previous || range.next || this.#head === range) {
            return range;
        }
        if (before !== null && (!(before instanceof TimeRange) || before.group !== this)) {
            throw new TypeError("before must belong to this group.");
        }
        if (before === range) return range;

        if (before) {
            range.#previous = before.previous;
            range.#next = before;
            if (before.previous) before.previous.#next = range;
            else this.#head = range;
            before.#previous = range;
        }
        else if (!this.#tail) {
            this.#head = this.#tail = range;
        }
        else {
            range.#previous = this.#tail;
            this.#tail.#next = range;
            this.#tail = range;
        }
        if (!this.#tail) this.#tail = range;
        this.dispatchEvent(new CustomEvent("insert", { detail: { range, previous: range.previous, next: range.next } }));
        return range;
    }

    remove(range) {
        if (!(range instanceof TimeRange) || range.group !== this) return false;
        const previous = range.previous;
        const next = range.next;
        if (previous) previous.#next = next;
        else this.#head = next;
        if (next) next.#previous = previous;
        else this.#tail = previous;
        range.#previous = null;
        range.#next = null;
        this.dispatchEvent(new CustomEvent("remove", { detail: { range, previous, next } }));
        if (!this.#head) this.#detachClock();
        return true;
    }

    split(range, boundary) {
        if (!(range instanceof TimeRange) || range.group !== this) throw new TypeError("Range does not belong to this group.");
        const point = TimeRangeGroup.#time(boundary);
        if (point <= range.#start || point >= range.#end) throw new RangeError("Split boundary must be inside the range.");
        const rightType = TimeRange.Type.EXPANDABLE;
        const leftType = TimeRange.Type.COLLAPSABLE;
        const right = TimeRange.#fromValidated(rightType, point, range.#end, this, range.element);
        const oldType = range.#type;
        range.#type = leftType;
        range.#end = point;
        this.insert(right, range.next);
        this.dispatchEvent(new CustomEvent("split", {
            detail: { original: range, ranges: [range, right], boundary: new Date(point), previousType: oldType }
        }));
        return [range, right];
    }

    #propagate(range, tick) {
        let current = range;
        while (current && tick.remainingDelta >= 0) {
            const next = current.next;
            const outcome = current.#handleTick(tick);
            if (outcome === "stop") return;
            current = current.next || next;
            if (current === null) {
                if (outcome === "end") {
                    const overrun = tick.currentTime.getTime() > range.#end;
                    this.dispatchEvent(new CustomEvent("end", {
                        detail: { group: this, range, tick, overrun }
                    }));
                }
                return;
            }
        }
    }

    #attachClock(clock) {
        if (this.#clockListener) return;
        const listener = event => {
            const detail = event?.detail ?? event;
            if (detail?.currentTime === undefined || detail?.lastTickTime === undefined) return;
            this.tick(detail.currentTime, detail.lastTickTime);
        };
        if (typeof clock.addEventListener === "function") {
            clock.addEventListener("tick", listener);
            this.#clockListener = listener;
        }
        else if (typeof clock.on === "function") {
            clock.on("tick", listener);
            this.#clockListener = listener;
        }
    }

    #detachClock() {
        if (!this.#clock || !this.#clockListener) return;
        if (typeof this.#clock.removeEventListener === "function") {
            this.#clock.removeEventListener("tick", this.#clockListener);
        }
        else if (typeof this.#clock.off === "function") {
            this.#clock.off("tick", this.#clockListener);
        }
        this.#clockListener = undefined;
    }

    static #time(value) {
        const date = value instanceof Date ? value : new Date(value);
        if (!Number.isFinite(date.getTime())) throw new TypeError("Time must be a valid date.");
        return date.getTime();
    }
}

class TimeRange {
    static Type = Object.freeze({
        FIXED: "Fixed",
        MOVEABLE: "Moveable",
        EXPANDABLE: "Expandable",
        COLLAPSABLE: "Collapsable"
    });

    static Events = Object.freeze({
        SPLIT: "split",
        INSERT: "insert",
        REMOVE: "remove",
        END: "end"
    });

    static #newGroup;
    static #secret = Symbol("TimeRange");

    #type;
    #start;
    #end;
    #group;
    #element;
    #previous = null;
    #next = null;

    constructor(secret, type, start, end, group, element = null) {
        if (secret !== TimeRange.#secret) throw new TypeError("TimeRange constructor is private; use TimeRange.create().");
        this.#type = type;
        this.#start = start;
        this.#end = end;
        this.#group = group;
        this.#element = element;
    }

    static create({ type, group = null, clock = null, boundaries = undefined, start, end, element = null } = {}) {
        const normalizedType = TimeRange.#normalizeType(type);
        const startMs = TimeRange.#time(start);
        const endMs = TimeRange.#time(end);
        if (endMs < startMs) throw new RangeError("TimeRange end must not precede start.");

        if (!group) {
            group = new TimeRangeGroup(clock, boundaries ?? []);
            TimeRange.#newGroup = group;
        }
        else if (!(group instanceof TimeRangeGroup)) {
            throw new TypeError("group must be a TimeRangeGroup.");
        }

        const pieces = TimeRange.#splitAtBoundaries(normalizedType, startMs, endMs, group.boundaries);
        const ranges = [];
        for (const piece of pieces) {
            TimeRange.#validatePlacement(piece.type, piece.start, piece.end, group);
            const range = TimeRange.#fromValidated(piece.type, piece.start, piece.end, group, element);
            group.insert(range);
            ranges.push(range);
        }
        return { group, ranges };
    }

    static get lastCreatedGroup() { return TimeRange.#newGroup; }

    get type() { return this.#type; }
    get start() { return new Date(this.#start); }
    get end() { return new Date(this.#end); }
    get duration() { return this.#end - this.#start; }
    get group() { return this.#group; }
    get element() { return this.#element; }
    get previous() { return this.#previous; }
    get next() { return this.#next; }

    setElement(element) {
        if (this.#element !== null && this.#element !== element) throw new Error("A TimeRange element can only be assigned once.");
        this.#element = element;
        return this;
    }

    #handleTick(tick) {
        const cursor = tick.cursorTime.getTime();
        const now = tick.currentTime.getTime();

        if (this.#type === TimeRange.Type.FIXED) {
            if (now <= this.#end) return "stop";
            tick.advanceTo(Math.max(cursor, this.#end));
            return "continue";
        }

        if (this.#type === TimeRange.Type.EXPANDABLE) {
            if (now <= this.#start) return "continue";
            if (cursor < this.#start) tick.advanceTo(this.#start);
            if (tick.remainingDelta > 0) {
                this.#end += tick.remainingDelta;
                tick.advanceTo(now);
            }
            return "continue";
        }

        if (this.#type === TimeRange.Type.MOVEABLE) {
            if (tick.remainingDelta > 0) {
                this.#start += tick.remainingDelta;
                this.#end += tick.remainingDelta;
                tick.advanceTo(now);
            }
            return "continue";
        }

        if (this.#type === TimeRange.Type.COLLAPSABLE) {
            const remaining = Math.max(0, this.#end - Math.max(cursor, this.#start));
            const consumed = Math.min(tick.remainingDelta, remaining);
            if (consumed > 0) tick.advanceTo(cursor + consumed);
            if (consumed >= remaining) {
                this.#group.remove(this);
                return "stop";
            }
            return "stop";
        }

        return "continue";
    }

    static #fromValidated(type, start, end, group, element = null) {
        return new TimeRange(TimeRange.#secret, type, start, end, group, element);
    }

    static #validatePlacement(type, start, end, group) {
        for (let range = group.head; range; range = range.next) {
            if (end <= range.#start || start >= range.#end) continue;
            throw new Error("TimeRange overlap is a contract violation.");
        }
        const previous = group.tail;
        if (!previous) return;
        const previousType = previous.#type;
        if (previousType === TimeRange.Type.EXPANDABLE && type === TimeRange.Type.EXPANDABLE) {
            throw new Error("Adjacent Expandable ranges are illegal.");
        }
        if (previousType === TimeRange.Type.MOVEABLE && type === TimeRange.Type.FIXED) {
            throw new Error("Moveable followed by Fixed is illegal.");
        }
        if (previousType === TimeRange.Type.MOVEABLE && type === TimeRange.Type.EXPANDABLE) {
            throw new Error("Moveable followed by Expandable is illegal.");
        }
        if (type === TimeRange.Type.MOVEABLE && previousType !== TimeRange.Type.EXPANDABLE && previousType !== TimeRange.Type.MOVEABLE && previousType !== TimeRange.Type.COLLAPSABLE) {
            throw new Error("A Moveable must be rooted in an Expandable/Moveable chain.");
        }
    }

    static #splitAtBoundaries(type, start, end, boundaries) {
        const points = boundaries.map(value => value.getTime()).filter(point => point > start && point < end);
        if (!points.length) return [{ type, start, end }];
        const sorted = [...new Set(points)].sort((a, b) => a - b);
        const pieces = [];
        let cursor = start;
        for (const boundary of sorted) {
            pieces.push({ type: TimeRange.Type.COLLAPSABLE, start: cursor, end: boundary });
            pieces.push({ type: TimeRange.Type.EXPANDABLE, start: boundary, end });
            cursor = boundary;
        }
        return pieces;
    }

    static #normalizeType(type) {
        const value = String(type ?? "").trim().toLowerCase();
        const match = Object.values(TimeRange.Type).find(candidate => candidate.toLowerCase() === value);
        if (!match) throw new TypeError(`Unknown TimeRange type: ${type}`);
        return match;
    }

    static #time(value) {
        const date = value instanceof Date ? value : new Date(value);
        if (!Number.isFinite(date.getTime())) throw new TypeError("TimeRange times must be valid dates.");
        return date.getTime();
    }
}

if (typeof globalThis !== "undefined") {
    globalThis.TimeRangeTick = TimeRangeTick;
    globalThis.TimeRangeGroup = TimeRangeGroup;
    globalThis.TimeRange = TimeRange;
}
