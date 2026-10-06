// Shared conversion and lookup helpers keep dates at the public API boundary.
function timeRangeMilliseconds(value, message = "Time must be a valid date.") {
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) throw new TypeError(message);
    return time;
}

function timeRangeLowerBound(times, target) {
    let left = 0, right = times.length;
    while (left < right) {
        const middle = (left + right) >>> 1;
        if (times[middle] < target) left = middle + 1;
        else right = middle;
    }
    return left;
}

class TimeRangeTick {
    #currentTime;
    #lastTickTime;
    #cursorTime;
    constructor(currentTime, lastTickTime) {
        this.#currentTime = TimeRangeTick.#time(currentTime);
        this.#lastTickTime = TimeRangeTick.#time(lastTickTime);
        if (this.#currentTime < this.#lastTickTime) throw new RangeError("currentTime must not precede lastTickTime.");
        this.#cursorTime = this.#lastTickTime;
    }
    get currentTime() { return new Date(this.#currentTime); }
    get lastTickTime() { return new Date(this.#lastTickTime); }
    get cursorTime() { return new Date(this.#cursorTime); }
    get currentMilliseconds() { return this.#currentTime; }
    get previousMilliseconds() { return this.#lastTickTime; }
    get cursorMilliseconds() { return this.#cursorTime; }
    get totalDelta() { return this.#currentTime - this.#lastTickTime; }
    get remainingDelta() { return this.#currentTime - this.#cursorTime; }
    advanceTo(time) {
        const value = TimeRangeTick.#time(time);
        if (value < this.#cursorTime || value > this.#currentTime) throw new RangeError("Tick cursor must remain within the clock interval.");
        this.#cursorTime = value;
        return this;
    }
    static #time(value) { return timeRangeMilliseconds(value, "Tick times must be valid dates."); }
}

// The group owns collection rules and clock-driven transitions, not presentation.
class TimeRangeGroup extends EventTarget {
    #head = null;
    #tail = null;
    #rangeCount = 0;
    #clock = null;
    #clockListener;
    #boundaries = [];
    #splitTimeSet = new Set();
    #orderedSplitPoints = [];
    #updateDepth = 0;
    #needsValidation = false;
    #tickData = null;
    #lastValidTickTime = null;
    #boundaryStates = new Map();
    #startBoundaryKeys = new Map();
    #processingBoundaries = null;
    #editedBoundaryResets = new Set();
    #processingSplitPoints = null;
    #splitPoints = [];
    #reachedSplitPoints = new Map();
    static #nextSplitPointId = 0;
    #hasProcessedTick = false;
    #rangeObservers = new EventTarget();
    #accountingKey;
    constructor(clock = null, splitPoints = []) {
        super();
        this.#clock = clock;
        this.setSplitPoints(splitPoints);
        if (clock) this.#attachClock(clock);
    }
    get head() { return this.#head; }
    get tail() { return this.#tail; }
    get startTime() { return this.#head?.start ?? null; }
    get endTime() { return this.#tail?.end ?? null; }
    get duration() { return this.#head ? this.#tail.endMilliseconds - this.#head.startMilliseconds : 0; }
    get rangeCount() { return this.#rangeCount; }
    get size() { return this.#rangeCount; }
    get boundaries() { return this.#splitPoints.map(point => new Date(TimeRangeGroup.#time(point.time))); }
    get splitPoints() { return [...this.#splitPoints]; }
    get tickData() { return this.#tickData; }
    get lastTickTime() { return this.#lastValidTickTime === null ? null : new Date(this.#lastValidTickTime); }
    get validationSuspended() { return this.#updateDepth > 0 || this.#needsValidation; }

    // Counted intervals are model members, independent of their DOM presentation.
    get timeRanges() { return this.#ranges(); }
    get totalCountedTime() { return this.#sumCounted("total"); }
    get elapsedCountedTime() { return this.#sumCounted("elapsed"); }
    get remainingCountedTime() { return this.#sumCounted("remaining"); }
    #sumCounted(field) { return this.#ranges().reduce((sum, range) => sum + range.counted[field], 0); }
    updateAccounting(start, end, exclusions = [], required = 0) {
        const key = JSON.stringify([start, end, exclusions, required]);
        if (key === this.#accountingKey) return this;
        this.beginUpdate();
        try {
            this.clear();
            let cursor = start, earned = 0;
            const add = (left, right, elapsed) => {
                if (!(right > left)) return;
                const range = TimeRange.create({group: this, type: "Fixed", start: left, end: right}).ranges[0];
                range.setCountedTime(right - left, elapsed ? right - left : 0);
                if (elapsed) earned += right - left;
            };
            for (const [left, right] of exclusions) {
                if (left >= end) break;
                if (right <= cursor) continue;
                add(cursor, Math.min(left, end), true);
                cursor = Math.max(cursor, right);
            }
            add(cursor, end, true);
            add(end, end + Math.max(0, required - earned), false);
        } finally {
            this.endUpdate();
        }
        this.tick(end, end);
        this.#accountingKey = key;
        return this;
    }
    clear() {
        for (const range of this.#ranges()) this._removePiece(range);
        this.#boundaryStates.clear();
        this.#startBoundaryKeys.clear();
        this.#reachedSplitPoints.clear();
        this.#tickData = this.#lastValidTickTime = null;
        this.#hasProcessedTick = false;
        this.#accountingKey = undefined;
        return this;
    }

    // Views observe committed collection state independently of boundary events.
    // In particular, normalization may change the view without crossing a boundary.
    observeRanges(listener) {
        if (typeof listener !== "function") throw new TypeError("A range observer must be a function.");
        const observers = this.#rangeObservers;
        observers.addEventListener("change", listener);
        return () => observers.removeEventListener("change", listener);
    }
    #notifyRangeObservers() {
        if (!this.validationSuspended && !this.#processingBoundaries) {
            this.#rangeObservers.dispatchEvent(new Event("change"));
        }
    }

    // Suspended edits resume validation on the next valid tick.
    beginUpdate() {
        this.#updateDepth++;
        return this;
    }
    endUpdate() {
        if (!this.#updateDepth) throw new Error("No TimeRangeGroup update is active.");
        this.#updateDepth--;
        if (!this.#updateDepth) this.#needsValidation = true;
        return this;
    }
    dispatchEvent(event) {
        return this.#updateDepth ? true : super.dispatchEvent(event);
    }

    // Mutable split-point collection and sorted lookup data.
    setBoundaries(boundaries = []) { return this.setSplitPoints(boundaries); }
    setSplitPoints(splitPoints = []) {
        if (!Array.isArray(splitPoints)) throw new TypeError("splitPoints must be an array.");
        const points = [], ids = new Set();
        for (const value of splitPoints) {
            let point;
            if (value !== null && typeof value === "object" && "time" in value) {
                point = value;
                if (point.id === undefined) point.id = globalThis.crypto?.randomUUID?.() ?? `split-point-${++TimeRangeGroup.#nextSplitPointId}`;
            } else {
                const time = TimeRangeGroup.#time(value);
                // Date-based callers retain identity when replacing an unchanged cut.
                point = this.#splitPoints.find(existing => TimeRangeGroup.#time(existing.time) === time)
                    ?? {id: globalThis.crypto?.randomUUID?.() ?? `split-point-${++TimeRangeGroup.#nextSplitPointId}`, time: new Date(time)};
                if (ids.has(point.id) || points.some(existing => TimeRangeGroup.#time(existing.time) === time)) continue;
            }
            if (typeof point.id !== "string" || !point.id.length || ids.has(point.id)) throw new TypeError("Split point IDs must be unique non-empty strings.");
            TimeRangeGroup.#time(point.time);
            ids.add(point.id);
            points.push(point);
        }
        this.#splitPoints = points;
        this.#refreshSplitPoints();
        if (this.#head) this.#needsValidation = true;
        return this;
    }
    addSplitPoint(point) {
        this.setSplitPoints([...this.#splitPoints, point]);
        return this.#splitPoints.at(-1);
    }
    removeSplitPoint(pointOrId) {
        const id = typeof pointOrId === "string" ? pointOrId : pointOrId?.id;
        const points = this.#splitPoints.filter(point => point.id !== id);
        if (points.length === this.#splitPoints.length) return false;
        this.setSplitPoints(points);
        return true;
    }
    #refreshSplitPoints() {
        const times = [], ids = new Set();
        for (const point of this.#splitPoints) {
            if (typeof point.id !== "string" || !point.id.length || ids.has(point.id)) throw new TypeError("Split point IDs must be unique non-empty strings.");
            ids.add(point.id);
            times.push(TimeRangeGroup.#time(point.time));
        }
        const sorted = [...new Set(times)].sort((left, right) => left - right);
        if (this.#head && (sorted.length !== this.#boundaries.length || sorted.some((time, index) => time !== this.#boundaries[index]))) this.#needsValidation = true;
        this.#boundaries = sorted;
        this.#splitTimeSet = new Set(sorted);
        this.#orderedSplitPoints = this.#splitPoints.map(point => ({point, time: TimeRangeGroup.#time(point.time)}))
            .sort((left, right) => left.time - right.time);
    }

    // Membership changes and entity-preserving splits.
    setRangeInterval(rangeId, start, end, type) {
        const members = this.#ranges().filter(range => range.rangeId === rangeId);
        if (!members.length) return false;
        start = TimeRangeGroup.#time(start);
        end = TimeRangeGroup.#time(end);
        type ??= members[0].entityType;
        if (!Object.values(TimeRange.Type).includes(type)) throw new TypeError("Unknown TimeRange type.");
        TimeRange._validateInterval({startMilliseconds: start, endMilliseconds: end, type});
        const pieces = TimeRange._splitInterval(type, start, end, this.boundaries);
        if (members.length === 1 && pieces.length === 1) {
            members[0].setInterval(start, end, type);
            return true;
        }
        const replacements = pieces.map(piece => TimeRange._fromValidated(piece.type,
            piece.start, piece.end, this, rangeId, type));
        if (!this.validationSuspended) {
            this.#validateChain([...this.#ranges().filter(range => range.rangeId !== rangeId), ...replacements]
                .sort((left, right) => left.startMilliseconds - right.startMilliseconds));
        }
        // Preserve the logical ending's crossing history across physical replacement.
        const endState = this.#boundaryStates.get(members.at(-1));
        const startKey = this.#startBoundaryKeys.get(members[0]);
        const counted = members.reduce((sum, range) => ({total: sum.total + range.counted.total,
            elapsed: sum.elapsed + range.counted.elapsed, remaining: sum.remaining + range.counted.remaining}),
            {total: 0, elapsed: 0, remaining: 0});
        this.#updateDepth++;
        try {
            for (const member of members) {
                this._removePiece(member);
                this.#startBoundaryKeys.delete(member);
            }
            let elapsed = counted.elapsed, remaining = counted.remaining, allocated = 0;
            for (const [index, range] of replacements.entries()) {
                this.insert(range);
                const total = index === replacements.length - 1 ? counted.total - allocated
                    : counted.total * range.duration / (end - start);
                const earned = Math.min(total, elapsed);
                const pending = Math.min(total - earned, remaining);
                range.setCountedTime(total, earned, pending);
                allocated += total; elapsed -= earned; remaining -= pending;
            }
            if (endState) this.#boundaryStates.set(replacements.at(-1), endState);
            if (startKey) this.#startBoundaryKeys.set(replacements[0], startKey);
        } finally {
            this.#updateDepth--;
        }
        this.notifyRangeChanged(replacements[0]);
        return true;
    }
    insert(range, before = undefined) {
        if (!(range instanceof TimeRange) || range.group !== this) throw new TypeError("Range must belong to this group.");
        if (range.previous || range.next || this.#head === range) return range;
        let reference = before;
        if (reference === undefined) {
            reference = this.#head;
            while (reference && reference.startMilliseconds <= range.startMilliseconds) reference = reference.next;
        }
        if (reference !== null && reference !== undefined && (!(reference instanceof TimeRange) || reference.group !== this)) throw new TypeError("before must belong to this group.");
        const previous = reference ? reference.previous : this.#tail;
        if (previous) TimeRange._setNext(previous, range); else this.#head = range;
        if (reference) TimeRange._setPrevious(reference, range); else this.#tail = range;
        TimeRange._setPrevious(range, previous || null);
        TimeRange._setNext(range, reference || null);
        this.#rangeCount++;
        this.#accountingKey = undefined;
        this.dispatchEvent(new CustomEvent("insert", {detail: {range, previous: range.previous, next: range.next}}));
        this.#notifyRangeObservers();
        return range;
    }
    // Public removal addresses the logical range, including all its split pieces.
    remove(rangeId) {
        if (typeof rangeId !== "string") throw new TypeError("Removal requires a rangeId.");
        let removed = false;
        for (const piece of this.#ranges()) {
            if (piece.rangeId === rangeId) removed = this._removePiece(piece) || removed;
        }
        return removed;
    }
    // Internal collapse/merge operations unlink one piece, not its logical range.
    _removePiece(range) {
        if (!(range instanceof TimeRange) || range.group !== this) return false;
        if (range !== this.#head && !range.previous && !range.next) return false;
        const previous = range.previous, next = range.next;
        if (previous) TimeRange._setNext(previous, next);
        else this.#head = next;
        if (next) TimeRange._setPrevious(next, previous);
        else this.#tail = previous;
        TimeRange._setPrevious(range, null);
        TimeRange._setNext(range, null);
        this.#rangeCount--;
        this.#accountingKey = undefined;
        this.dispatchEvent(new CustomEvent("remove", {detail: {range, previous, next}}));
        this.#notifyRangeObservers();
        return true;
    }
    notifyRangeChanged(range) {
        if (!(range instanceof TimeRange) || range.group !== this) throw new TypeError("Range must belong to this group.");
        this.#accountingKey = undefined;
        this.dispatchEvent(new CustomEvent("change", {detail: {group: this, range}}));
        this.#notifyRangeObservers();
    }
    split(range, boundary) {
        if (!(range instanceof TimeRange) || range.group !== this) throw new TypeError("Range does not belong to this group.");
        const point = TimeRangeGroup.#time(boundary);
        if (point <= range.startMilliseconds || point >= range.endMilliseconds) throw new RangeError("Split boundary must be inside the range.");
        const right = TimeRange._fromValidated(TimeRange.Type.EXPANDABLE, point, range.endMilliseconds,
            this, range.entityId, range.entityType);
        const previousType = range.type;
        const counted = range.counted;
        const fraction = (point - range.startMilliseconds) / range.duration;
        // Splitting creates an interior boundary; the original end belongs to right.
        const endState = this.#boundaryStates.get(range);
        if (endState) {
            this.#boundaryStates.set(right, endState);
            this.#boundaryStates.delete(range);
        }
        if (this.#editedBoundaryResets.delete(range)) this.#editedBoundaryResets.add(right);
        const endBoundary = this.#processingBoundaries?.get(range);
        if (endBoundary) {
            this.#processingBoundaries.set(right, {...endBoundary, before: right});
            this.#processingBoundaries.delete(range);
        }
        TimeRange._setTypeAndEnd(range, TimeRange.Type.COLLAPSABLE, point);
        this.insert(right, range.next);
        if (counted.total > 0) {
            const leftTotal = counted.total * fraction, rightTotal = counted.total - leftTotal;
            const leftElapsed = Math.min(leftTotal, counted.elapsed);
            const rightRemaining = Math.min(rightTotal, counted.remaining);
            range.setCountedTime(leftTotal, leftElapsed, counted.remaining - rightRemaining);
            right.setCountedTime(rightTotal, counted.elapsed - leftElapsed, rightRemaining);
        }
        this.dispatchEvent(new CustomEvent("split", {detail: {original: range,
            ranges: [range, right], boundary: new Date(point), previousType}}));
        return [range, right];
    }

    // Normalize edited pieces, then validate the resulting chain.
    validateRanges() {
        // Normalization is part of the suspended edit. Publish boundary batches
        // only after splitting, merging, and checking the resulting chain.
        this.#updateDepth++;
        try {
            this.#sortRanges();
            const entities = new Map();
            for (let range = this.#head; range; range = range.next) {
                TimeRange._validateInterval(range);
                const entity = entities.get(range.entityId) ?? {start: range.startMilliseconds, end: range.endMilliseconds, type: range.entityType};
                entity.start = Math.min(entity.start, range.startMilliseconds);
                entity.end = Math.max(entity.end, range.endMilliseconds);
                entities.set(range.entityId, entity);
            }
            for (const entity of entities.values()) {
                const last = this.#boundaries[timeRangeLowerBound(this.#boundaries, entity.end) - 1];
                entity.lastSplit = last > entity.start ? last : undefined;
            }
            for (let range = this.#head; range; range = range.next) {
                for (let index = timeRangeLowerBound(this.#boundaries, range.startMilliseconds); index < this.#boundaries.length; index++) {
                    const boundary = this.#boundaries[index];
                    if (boundary >= range.endMilliseconds) break;
                    if (boundary > range.startMilliseconds && boundary < range.endMilliseconds) {
                        range = this.split(range, boundary)[1];
                    }
                }
            }
            for (let range = this.#head; range; range = range.next) {
                const entity = entities.get(range.entityId);
                const type = entity.lastSplit === undefined ? entity.type : range.startMilliseconds < entity.lastSplit
                    ? TimeRange.Type.COLLAPSABLE : TimeRange.Type.EXPANDABLE;
                TimeRange._setTypeAndEnd(range, type, range.endMilliseconds);
            }
            this.#sortRanges();
            let range = this.#head;
            while (range?.next) {
                const next = range.next;
                const overlap = next.startMilliseconds < range.endMilliseconds;
                const touches = next.startMilliseconds === range.endMilliseconds;
                const protectedBoundary = touches && this.#splitTimeSet.has(next.startMilliseconds);
                if (range.entityId === next.entityId && range.type === next.type && (overlap || (touches && !protectedBoundary))) {
                    this.#merge(range, next);
                } else {
                    range = next;
                }
            }
            this.#validateChain(this.#ranges());

        } finally {
            this.#updateDepth--;
        }
        return this;
    }
    #sortRanges() {
        const ranges = [];
        for (let range = this.#head; range; range = range.next) ranges.push(range);
        ranges.sort((left, right) => left.startMilliseconds - right.startMilliseconds);
        for (let index = 0; index < ranges.length; index++) {
            TimeRange._setPrevious(ranges[index], ranges[index - 1] ?? null);
            TimeRange._setNext(ranges[index], ranges[index + 1] ?? null);
        }
        this.#head = ranges[0] ?? null;
        this.#tail = ranges.at(-1) ?? null;
    }
    // Factory insertion and resumed updates share the same collection rules.
    _validateInsertion(ranges) {
        this.#validateChain([...this.#ranges(), ...ranges].sort((left, right) => left.startMilliseconds - right.startMilliseconds));
    }
    _validateEdit(range, candidate) {
        if (!this.validationSuspended) {
            this.#validateChain(this.#ranges().map(member => member === range ? candidate : member)
                .sort((left, right) => left.startMilliseconds - right.startMilliseconds));
        }
    }
    #validateChain(ranges) {
        const types = TimeRange.Type;
        let previous = null, chainRoot = null, zeroLengthExpandables = 0;
        for (const range of ranges) {
            TimeRange._validateInterval(range);
            if (previous && range.startMilliseconds < previous.endMilliseconds) throw new Error("TimeRange overlap is a contract violation.");
            if (previous?.type === types.EXPANDABLE && range.type === types.EXPANDABLE) throw new Error("Adjacent Expandable ranges are illegal.");
            if (previous?.type === types.MOVEABLE && range.type === types.FIXED) throw new Error("Moveable followed by Fixed is illegal.");
            if (range.type === types.MOVEABLE && chainRoot !== types.EXPANDABLE && chainRoot !== types.MOVEABLE) throw new Error("A Moveable must be rooted in an Expandable/Moveable chain.");
            if (range.type === types.EXPANDABLE && range.duration === 0 && ++zeroLengthExpandables > 1) throw new Error("Only one zero-length Expandable is allowed in a group.");
            if (range.type !== types.COLLAPSABLE) chainRoot = range.type;
            previous = range;
        }
    }
    #merge(left, right) {
        const counted = {total: left.counted.total + right.counted.total,
            elapsed: left.counted.elapsed + right.counted.elapsed,
            remaining: left.counted.remaining + right.counted.remaining};
        // The surviving end keeps the reached/pending state of its original owner.
        if (right.endMilliseconds >= left.endMilliseconds) {
            const state = this.#boundaryStates.get(right);
            this.#boundaryStates.delete(left);
            if (state) this.#boundaryStates.set(left, state);
            TimeRange._setTypeAndEnd(left, left.type, right.endMilliseconds);
        }
        this.#boundaryStates.delete(right);
        this._removePiece(right);
        left.setCountedTime(counted.total, counted.elapsed, counted.remaining);
        this.notifyRangeChanged(left);
    }

    // Tick processing starts from the last successfully processed time.
    tick(currentTime, lastTickTime = undefined) {
        // Suspended ticks cannot shorten the interval resumed after endUpdate().
        if (this.#updateDepth) return;
        const suppliedTick = currentTime instanceof TimeRangeTick ? currentTime : null;
        const now = suppliedTick?.currentMilliseconds ?? TimeRangeGroup.#time(currentTime);
        const previous = this.#lastValidTickTime ?? lastTickTime ?? suppliedTick?.previousMilliseconds ?? now;
        const tick = suppliedTick && suppliedTick.previousMilliseconds === previous
            ? suppliedTick : new TimeRangeTick(now, previous);
        this.#refreshSplitPoints();
        // Validate the completed edit before advancing ranges or emitting boundary events.
        // A failure retains the pending validation and the last successful tick.
        if (this.#needsValidation) this.validateRanges();
        this.#needsValidation = false;
        this.#processingBoundaries = this.#snapshotBoundaries();
        this.#processingSplitPoints = this.#snapshotSplitPoints();
        this.#editedBoundaryResets = new Set();
        for (const [key, boundary] of this.#processingBoundaries) {
            const previous = this.#boundaryStates.get(key);
            const time = boundary.time.getTime();
            if (previous?.reached && time !== previous.time && time > tick.previousMilliseconds) this.#editedBoundaryResets.add(key);
        }
        if (!this.#hasProcessedTick) {
            for (const [key, boundary] of this.#processingBoundaries) {
                this.#boundaryStates.set(key, {reached: boundary.time.getTime() <= tick.previousMilliseconds, time: boundary.time.getTime()});
            }
        }
        try {
            if (this.#head) this.#propagate(this.#head, tick);
            this.#reconcileBoundaries(tick);
            this.#tickData = tick;
            this.#lastValidTickTime = now;
        } finally {
            this.#processingBoundaries = null;
            this.#processingSplitPoints = null;
        }
        this.#notifyRangeObservers();
    }

    // Propagate the shared tick cursor through member ranges.
    #propagate(range, tick) {
        let current = range;
        while (current) {
            const boundary = this.#nextBoundaryWithin(current, tick);
            if (boundary !== null) {
                const pieces = this.split(current, boundary);
                this.#captureBoundaries(pieces);
            }
            const next = current.next;
            const outcome = current._handleTick(tick);
            if (outcome === "stop" || !next) return;
            current = next;
        }
    }
    #nextBoundaryWithin(range, tick) {
        const start = Math.max(tick.cursorMilliseconds, range.startMilliseconds);
        let index = timeRangeLowerBound(this.#boundaries, start);
        if (this.#boundaries[index] === start) index++;
        const point = this.#boundaries[index];
        return point < range.endMilliseconds && point <= tick.currentMilliseconds ? point : null;
    }

    // Collect snapshots once and batch reset/reached transitions.
    #snapshotBoundaries(ranges = this.#ranges()) {
        const boundaries = new Map();
        for (const range of ranges) {
            const previous = range.previous;
            if (!previous || previous.endMilliseconds !== range.startMilliseconds) {
                const identity = previous ? range : range.entityId;
                let key = this.#startBoundaryKeys.get(identity);
                if (!key) this.#startBoundaryKeys.set(identity, key = {});
                boundaries.set(key, {time: range.start, after: range});
            }
            if (range.next?.startMilliseconds === range.endMilliseconds && range.next.entityId === range.entityId) continue;
            const boundary = {time: range.end, before: range};
            if (range.next?.startMilliseconds === range.endMilliseconds) boundary.after = range.next;
            boundaries.set(range, boundary);
        }
        return boundaries;
    }
    #snapshotSplitPoints(ranges = this.#ranges()) {
        const points = new Map();
        const times = this.#orderedSplitPoints.map(entry => entry.time);
        for (const {point, time} of this.#orderedSplitPoints) {
            if (this.#reachedSplitPoints.get(point.id)?.reached) points.set(point.id, {splitPoint: point, time: new Date(time)});
        }
        for (const range of ranges) {
            const start = range.startMilliseconds, end = range.endMilliseconds;
            for (let index = timeRangeLowerBound(times, start); index < times.length && times[index] <= end; index++) {
                const {point, time} = this.#orderedSplitPoints[index];
                const entry = points.get(point.id) ?? {splitPoint: point, time: new Date(time)};
                if (start < time) entry.before = range;
                if (time < end) entry.after = range;
                if (entry.before || entry.after) points.set(point.id, entry);
            }
        }
        return points;
    }
    #ranges() {
        const ranges = [];
        for (let range = this.#head; range; range = range.next) ranges.push(range);
        return ranges;
    }
    #captureBoundaries(ranges) {
        if (!this.#processingBoundaries) return;
        for (const [key, boundary] of this.#snapshotBoundaries(ranges)) this.#processingBoundaries.set(key, boundary);
        for (const [point, entry] of this.#snapshotSplitPoints(ranges)) this.#processingSplitPoints.set(point, {...this.#processingSplitPoints.get(point), ...entry});
    }
    #reconcileBoundaries(tick) {
        if (this.#updateDepth) return;
        const current = this.#snapshotBoundaries();
        for (const [key, boundary] of current) this.#processingBoundaries.set(key, boundary);
        const boundaries = this.#collectTransitions(this.#processingBoundaries, this.#boundaryStates,
            tick, new Set(current.keys()), this.#editedBoundaryResets);
        for (const [point, entry] of this.#snapshotSplitPoints()) this.#processingSplitPoints.set(point, {...this.#processingSplitPoints.get(point), ...entry});
        const activeIds = new Set(this.#splitPoints.map(point => point.id));
        const entries = new Map([...this.#processingSplitPoints].filter(([id]) => activeIds.has(id)));
        const points = this.#collectTransitions(entries, this.#reachedSplitPoints, tick, activeIds);
        this.#boundaryStates = boundaries.states;
        this.#reachedSplitPoints = points.states;
        this.#hasProcessedTick = true;
        this.#emitBatches(tick, [
            ["split-point-reset", "splitPoints", points.reset],
            ["split-point-reached", "splitPoints", points.reached],
            ["boundary-reset", "boundaries", boundaries.reset],
            ["boundary-reached", "boundaries", boundaries.reached]
        ]);
    }
    #collectTransitions(entries, previousStates, tick, retainedKeys, editedKeys = null) {
        const reached = [], reset = [];
        const states = new Map([...previousStates].filter(([key]) => retainedKeys.has(key)));
        for (const [key, entry] of entries) {
            const time = entry.time.getTime(), previous = previousStates.get(key);
            const wasReached = previous?.reached ?? (!this.#hasProcessedTick && time <= tick.previousMilliseconds);
            const isReached = time <= tick.currentMilliseconds;
            const movedAhead = editedKeys?.has(key) ?? (previous?.time !== undefined && time !== previous.time && time > tick.previousMilliseconds);
            const wasReset = wasReached && (!isReached || movedAhead);
            if (wasReset) reset.push(entry);
            if ((!wasReached || wasReset) && isReached) reached.push(entry);
            if (retainedKeys.has(key)) states.set(key, {reached: isReached, time});
        }
        return {reached, reset, states};
    }
    #emitBatches(tick, batches) {
        for (const [type, field, entries] of batches) {
            if (!entries.length) continue;
            entries.sort((left, right) => left.time.getTime() - right.time.getTime());
            this.dispatchEvent(new CustomEvent(type, {detail: {tick, [field]: entries}}));
        }
    }

    // Clock subscription and lifecycle cleanup.
    #attachClock(clock) {
        if (this.#clockListener) return;
        const listener = event => {
            const detail = event?.detail ?? event;
            if (detail?.currentTime !== undefined && detail?.lastTickTime !== undefined) {
                this.tick(detail.currentTime, detail.lastTickTime);
            }
        };
        if (typeof clock.addEventListener === "function") clock.addEventListener("tick", listener);
        else if (typeof clock.on === "function") clock.on("tick", listener);
        else return;
        this.#clockListener = listener;
    }
    #detachClock() {
        if (!this.#clock || !this.#clockListener) return;
        if (typeof this.#clock.removeEventListener === "function") this.#clock.removeEventListener("tick", this.#clockListener);
        else if (typeof this.#clock.off === "function") this.#clock.off("tick", this.#clockListener);
        this.#clockListener = undefined;
    }
    dispose() {
        this.#detachClock();
        for (const range of this.#ranges()) {
            TimeRange._setPrevious(range, null);
            TimeRange._setNext(range, null);
        }
        this.#head = this.#tail = this.#tickData = this.#lastValidTickTime = null;
        this.#rangeCount = this.#updateDepth = 0;
        this.#boundaryStates.clear();
        this.#startBoundaryKeys.clear();
        this.#reachedSplitPoints.clear();
        this.#editedBoundaryResets.clear();
        this.#processingBoundaries = this.#processingSplitPoints = null;
        this.#needsValidation = this.#hasProcessedTick = false;
        this.#accountingKey = undefined;
        this.#notifyRangeObservers();
        this.#rangeObservers = new EventTarget();
    }
    static #time(value) { return timeRangeMilliseconds(value); }
}


// A range owns its interval, logical identity, and per-type tick behavior.
// The group owns links, collection validation, split points, and notifications.
class TimeRange {
    static Type = Object.freeze({FIXED: "Fixed", MOVEABLE: "Moveable", EXPANDABLE: "Expandable", COLLAPSABLE: "Collapsable"});
    static Events = Object.freeze({
        SPLIT: "split", INSERT: "insert", REMOVE: "remove", CHANGE: "change",
        SPLIT_POINT_REACHED: "split-point-reached", SPLIT_POINT_RESET: "split-point-reset",
        BOUNDARY_REACHED: "boundary-reached", BOUNDARY_RESET: "boundary-reset"
    });
    static #newGroup;
    static #secret = Symbol("TimeRange");
    static #nextId = 0;
    #type; #start; #end; #group;
    #previous = null; #next = null;
    #pieceId; #entityId; #entityType;
    #counted = Object.freeze({total: 0, elapsed: 0, remaining: 0});

    constructor(secret, type, start, end, group, entityId = null, entityType = type) {
        if (secret !== TimeRange.#secret) throw new TypeError("TimeRange constructor is private; use TimeRange.create().");
        this.#pieceId = globalThis.crypto?.randomUUID?.() ?? `time-range-${++TimeRange.#nextId}`;
        this.#entityId = entityId ?? this.#pieceId;
        this.#entityType = entityType;
        this.#type = type;
        this.#start = start;
        this.#end = end;
        this.#group = group;
    }

    // Build and validate the whole insertion before exposing any of its pieces.
    static create({type, group = null, clock = null, splitPoints, boundaries, start, end} = {}) {
        type = TimeRange.#normalizeType(type);
        start = timeRangeMilliseconds(start, "TimeRange times must be valid dates.");
        end = timeRangeMilliseconds(end, "TimeRange times must be valid dates.");
        TimeRange._validateInterval({startMilliseconds: start, endMilliseconds: end, type});
        if (!group) {
            group = new TimeRangeGroup(clock, splitPoints ?? boundaries ?? []);
            TimeRange.#newGroup = group;
        } else if (!(group instanceof TimeRangeGroup)) {
            throw new TypeError("group must be a TimeRangeGroup.");
        }
        const ranges = [];
        for (const piece of TimeRange.#splitAtPoints(type, start, end, group.boundaries)) {
            ranges.push(TimeRange._fromValidated(piece.type, piece.start, piece.end, group,
                ranges[0]?.entityId, type));
        }
        if (!group.validationSuspended) group._validateInsertion(ranges);
        for (const range of ranges) group.insert(range);
        return {group, ranges};
    }

    // Dates are defensive copies; numeric accessors avoid allocations internally.
    static get lastCreatedGroup() { return TimeRange.#newGroup; }
    static createCountedRange(start, end, now = end) {
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || !Number.isFinite(now)) {
            throw new RangeError("Invalid counted interval.");
        }
        const range = TimeRange.create({type: end > start ? "Fixed" : "Expandable", start, end}).ranges[0];
        range.setCountedTime(end - start, Math.max(0, Math.min(end, now) - start));
        return range;
    }
    get rangeId() { return this.#entityId; }
    get pieceId() { return this.#pieceId; }
    get entityId() { return this.#entityId; }
    get entityType() { return this.#entityType; }
    get type() { return this.#type; }
    get start() { return new Date(this.#start); }
    get end() { return new Date(this.#end); }
    get startMilliseconds() { return this.#start; }
    get endMilliseconds() { return this.#end; }
    get duration() { return this.#end - this.#start; }
    get group() { return this.#group; }
    get previous() { return this.#previous; }
    get next() { return this.#next; }
    get counted() { return this.#counted; }

    // Controllers edit interval data here; elements never store authoritative times.
    setInterval(start, end, type = this.#type) {
        start = timeRangeMilliseconds(start);
        end = timeRangeMilliseconds(end);
        type = TimeRange.#normalizeType(type);
        const candidate = {startMilliseconds: start, endMilliseconds: end, type, duration: end - start};
        TimeRange._validateInterval(candidate);
        this.#group._validateEdit(this, candidate);
        this.#start = start;
        this.#end = end;
        this.#type = type;
        if (this.#group.timeRanges.filter(range => range.rangeId === this.rangeId).length === 1) this.#entityType = type;
        this.#group.notifyRangeChanged(this);
        return this;
    }
    setCountedTime(total, elapsed = 0, remaining = total - elapsed) {
        if (!Number.isFinite(total) || total < 0 || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > total ||
            !Number.isFinite(remaining) || remaining < 0 || remaining > total) throw new RangeError("Invalid counted time.");
        this.#counted = Object.freeze({total, elapsed, remaining});
        this.#group.notifyRangeChanged(this);
        return this.#counted;
    }
    updateCountedTime(now) {
        if (!Number.isFinite(now)) throw new RangeError("Invalid counted interval.");
        return this.setCountedTime(this.duration, Math.max(0, Math.min(this.#end, now) - this.#start));
    }

    // Each member consumes or advances the shared cursor according to its type.
    _handleTick(tick) {
        const cursor = tick.cursorMilliseconds, now = tick.currentMilliseconds;
        switch (this.#type) {
            case TimeRange.Type.FIXED:
                if (now <= this.#end) return "stop";
                tick.advanceTo(Math.max(cursor, this.#end));
                break;
            case TimeRange.Type.EXPANDABLE: {
                if (now < this.#start) return "stop";
                if (cursor < this.#start) tick.advanceTo(this.#start);
                const delta = tick.remainingDelta;
                if (delta > 0) {
                    this.#end += delta;
                    tick.advanceTo(now);
                    this.#group.notifyRangeChanged(this);
                }
                break;
            }
            case TimeRange.Type.MOVEABLE: {
                const delta = tick.remainingDelta;
                if (delta > 0) {
                    this.#start += delta;
                    this.#end += delta;
                    tick.advanceTo(now);
                    this.#group.notifyRangeChanged(this);
                }
                break;
            }
            case TimeRange.Type.COLLAPSABLE: {
                if (now < this.#start) return "stop";
                // A gap advances the cursor before consuming this interval.
                if (cursor < this.#start) tick.advanceTo(this.#start);
                const active = tick.cursorMilliseconds;
                const remaining = Math.max(0, this.#end - active);
                const consumed = Math.min(tick.remainingDelta, remaining);
                if (consumed > 0) tick.advanceTo(active + consumed);
                if (consumed < remaining) return "stop";
                this.#group._removePiece(this);
                break;
            }
        }
        return "continue";
    }

    // These bridges let the group maintain private links and logical split pieces.
    static _setPrevious(range, previous) { range.#previous = previous; }
    static _setNext(range, next) { range.#next = next; }
    static _setTypeAndEnd(range, type, end) { range.#type = type; range.#end = end; }
    static _splitInterval(type, start, end, points) { return TimeRange.#splitAtPoints(type, start, end, points); }
    static _fromValidated(type, start, end, group, entityId = null, entityType = type) {
        return new TimeRange(TimeRange.#secret, type, start, end, group, entityId, entityType);
    }
    static _validateInterval(range) {
        const start = range.startMilliseconds, end = range.endMilliseconds;
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new RangeError("TimeRange end must not precede start and times must be valid.");
        if (start === end && range.type !== TimeRange.Type.EXPANDABLE) throw new RangeError("Only Expandable ranges may have zero length.");
    }
    static #splitAtPoints(type, start, end, dates) {
        const points = [...new Set(dates.map(date => date.getTime()))].filter(point => point > start && point < end).sort((left, right) => left - right);
        if (!points.length) return [{type, start, end}];
        const pieces = [];
        for (const point of points) {
            pieces.push({type: TimeRange.Type.COLLAPSABLE, start, end: point});
            start = point;
        }
        pieces.push({type: TimeRange.Type.EXPANDABLE, start, end});
        return pieces;
    }
    static #normalizeType(value) {
        const type = Object.values(TimeRange.Type).find(type => type.toLowerCase() === String(value ?? "").trim().toLowerCase());
        if (!type) throw new TypeError(`Unknown TimeRange type: ${value}`);
        return type;
    }
}

if (typeof globalThis !== "undefined") {
    globalThis.TimeRangeTick = TimeRangeTick;
    globalThis.TimeRangeGroup = TimeRangeGroup;
    globalThis.TimeRange = TimeRange;
}
