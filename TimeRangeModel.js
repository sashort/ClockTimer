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
    get totalDelta() { return this.#currentTime - this.#lastTickTime; }
    get remainingDelta() { return this.#currentTime - this.#cursorTime; }
    advanceTo(time) {
        const value = TimeRangeTick.#time(time);
        if (value < this.#cursorTime || value > this.#currentTime) throw new RangeError("Tick cursor must remain within the clock interval.");
        this.#cursorTime = value;
        return this;
    }
    static #time(value) { const date = value instanceof Date ? value : new Date(value); if (!Number.isFinite(date.getTime())) throw new TypeError("Tick times must be valid dates."); return date.getTime(); }
}

class TimeRangeGroup extends EventTarget {
    #head = null; #tail = null; #clock = null; #clockListener; #boundaries = []; #startTime = null; #endTime = null; #rangeCount = 0;
    #updateDepth = 0;
    #needsValidation = false;
    #tickData = null;
    #boundaryStates = new Map();
    #startBoundaryKeys = new Map();
    #processingBoundaries = null;
    #processingSplitPoints = null;
    #reachedSplitPoints = new Set();
    #hasProcessedTick = false;
    constructor(clock = null, boundaries = []) { super(); this.#clock = clock; this.setBoundaries(boundaries); if (clock) this.#attachClock(clock); }
    get head() { return this.#head; }
    get tail() { return this.#tail; }
    get startTime() { return this.#startTime === null ? null : new Date(this.#startTime); }
    get endTime() { return this.#endTime === null ? null : new Date(this.#endTime); }
    get duration() { return this.#startTime === null ? 0 : this.#endTime - this.#startTime; }
    get rangeCount() { return this.#rangeCount; }
    get size() { return this.#rangeCount; }
    get boundaries() { return this.#boundaries.map(v => new Date(v)); }
    get splitPoints() { return this.boundaries; }
    get tickData() { return this.#tickData; }
    get lastTickTime() { return this.#tickData?.currentTime ?? null; }
    get validationSuspended() { return this.#updateDepth > 0 || this.#needsValidation; }
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
    validateRanges() {
        // Normalization is part of the suspended edit. Publish boundary batches
        // only after splitting, merging, and checking the resulting chain.
        this.#updateDepth++;
        try {
            this.#sortRanges();
            const entities = new Map();
            for (let range = this.#head; range; range = range.next) {
                TimeRange._validateInterval(range);
                const entity = entities.get(range.entityId) ?? {start: range.start.getTime(), end: range.end.getTime(), type: range.entityType};
                entity.start = Math.min(entity.start, range.start.getTime());
                entity.end = Math.max(entity.end, range.end.getTime());
                entities.set(range.entityId, entity);
            }
            for (let range = this.#head; range; range = range.next) {
                for (const boundary of this.#boundaries) {
                    if (boundary > range.start.getTime() && boundary < range.end.getTime()) {
                        range = this.split(range, boundary)[1];
                    }
                }
            }
            for (let range = this.#head; range; range = range.next) {
                const entity = entities.get(range.entityId);
                const points = this.#boundaries.filter(point => point > entity.start && point < entity.end);
                const type = !points.length ? entity.type : range.start.getTime() < points.at(-1)
                    ? TimeRange.Type.COLLAPSABLE : TimeRange.Type.EXPANDABLE;
                TimeRange._setTypeAndEnd(range, type, range.end.getTime());
            }
            this.#sortRanges();
            let range = this.#head;
            while (range?.next) {
                const next = range.next;
                const overlap = next.start.getTime() < range.end.getTime();
                const touches = next.start.getTime() === range.end.getTime();
                const protectedBoundary = touches && this.#boundaries.includes(next.start.getTime());
                if (range.entityId === next.entityId && range.type === next.type && (overlap || (touches && !protectedBoundary))) {
                    this.#merge(range, next);
                } else {
                    range = next;
                }
            }
            TimeRange._validateGroup(this);
            this.#recalculateExtent();
        } finally {
            this.#updateDepth--;
        }
        return this;
    }
    #sortRanges() {
        const ranges = [];
        for (let range = this.#head; range; range = range.next) ranges.push(range);
        ranges.sort((left, right) => left.start.getTime() - right.start.getTime());
        for (let index = 0; index < ranges.length; index++) {
            TimeRange._setPrevious(ranges[index], ranges[index - 1] ?? null);
            TimeRange._setNext(ranges[index], ranges[index + 1] ?? null);
        }
        this.#head = ranges[0] ?? null;
        this.#tail = ranges.at(-1) ?? null;
    }
    #merge(left, right) {
        // The surviving end keeps the reached/pending state of its original owner.
        if (right.end.getTime() >= left.end.getTime()) {
            const state = this.#boundaryStates.get(right);
            this.#boundaryStates.delete(left);
            if (state) this.#boundaryStates.set(left, state);
            TimeRange._setTypeAndEnd(left, left.type, right.end.getTime());
        }
        this.#boundaryStates.delete(right);
        if (left.element === null && right.element !== null) left.setElement(right.element);
        this.remove(right);
        this.notifyRangeChanged(left);
    }
    setBoundaries(boundaries = []) { return this.setSplitPoints(boundaries); }
    setSplitPoints(splitPoints = []) {
        if (!Array.isArray(splitPoints)) throw new TypeError("splitPoints must be an array.");
        this.#boundaries = [...new Set(splitPoints.map(TimeRangeGroup.#time))].sort((a,b)=>a-b);
        if (this.#head) this.#needsValidation = true;
        return this;
    }
    tick(currentTime, lastTickTime = this.lastTickTime ?? currentTime) {
        const tick = currentTime instanceof TimeRangeTick ? currentTime : new TimeRangeTick(currentTime, lastTickTime);
        if (this.#updateDepth) {
            this.#tickData = tick;
            return;
        }
        // Validate the completed edit before advancing ranges or emitting boundary events.
        // A failure retains the pending validation and the last successful tick.
        if (this.#needsValidation) this.validateRanges();
        this.#needsValidation = false;
        this.#tickData = tick;
        this.#processingBoundaries = this.#snapshotBoundaries();
        this.#processingSplitPoints = this.#snapshotSplitPoints();
        if (!this.#hasProcessedTick) {
            for (const [key, boundary] of this.#processingBoundaries) {
                this.#boundaryStates.set(key, {reached: boundary.time.getTime() <= tick.lastTickTime.getTime()});
            }
        }
        try {
            if (this.#head) this.#propagate(this.#head, tick);
            this.#reconcileBoundaries(tick);
        } finally {
            this.#processingBoundaries = null;
            this.#processingSplitPoints = null;
        }
    }
    #snapshotBoundaries() {
        const boundaries = new Map();
        for (let range = this.#head; range; range = range.next) {
            const previous = range.previous;
            if (!previous || previous.end.getTime() !== range.start.getTime()) {
                const identity = previous ? range : range.entityId;
                let key = this.#startBoundaryKeys.get(identity);
                if (!key) this.#startBoundaryKeys.set(identity, key = {});
                boundaries.set(key, {time: range.start, after: range});
            }
            if (range.next?.start.getTime() === range.end.getTime() && range.next.entityId === range.entityId) continue;
            const boundary = {time: range.end, before: range};
            if (range.next?.start.getTime() === range.end.getTime()) boundary.after = range.next;
            boundaries.set(range, boundary);
        }
        return boundaries;
    }
    #snapshotSplitPoints() {
        const points = new Map();
        for (const point of this.#boundaries) {
            const entry = {time: new Date(point)};
            for (let range = this.#head; range; range = range.next) {
                if (range.start.getTime() < point && range.end.getTime() >= point) entry.before = range;
                if (range.start.getTime() <= point && range.end.getTime() > point) entry.after = range;
            }
            if (entry.before || entry.after) points.set(point, entry);
        }
        return points;
    }
    #captureBoundaries() {
        if (!this.#processingBoundaries) return;
        for (const [key, boundary] of this.#snapshotBoundaries()) this.#processingBoundaries.set(key, boundary);
        for (const [point, entry] of this.#snapshotSplitPoints()) this.#processingSplitPoints.set(point, {...this.#processingSplitPoints.get(point), ...entry});
    }
    #reconcileBoundaries(tick) {
        if (this.#updateDepth) return;
        const current = this.#snapshotBoundaries();
        for (const [key, boundary] of current) this.#processingBoundaries.set(key, boundary);
        const reached = [], reset = [], states = new Map();
        const now = tick.currentTime.getTime(), last = tick.lastTickTime.getTime();
        for (const [key, boundary] of this.#processingBoundaries) {
            const time = boundary.time.getTime();
            const wasReached = this.#boundaryStates.get(key)?.reached ?? (!this.#hasProcessedTick && time <= last);
            const isReached = time <= now;
            if (!wasReached && isReached) reached.push(boundary);
            if (wasReached && !isReached) reset.push(boundary);
            if (current.has(key)) states.set(key, {reached: isReached});
        }
        this.#boundaryStates = states;
        const splitPoints = [];
        for (const [point, entry] of this.#snapshotSplitPoints()) this.#processingSplitPoints.set(point, {...this.#processingSplitPoints.get(point), ...entry});
        for (const [point, entry] of this.#processingSplitPoints) {
            const wasReached = this.#reachedSplitPoints.has(point) || (!this.#hasProcessedTick && point <= last);
            if (!wasReached && point <= now) splitPoints.push(entry);
            if (point <= now) this.#reachedSplitPoints.add(point);
        }
        this.#reachedSplitPoints = new Set([...this.#reachedSplitPoints].filter(point => this.#boundaries.includes(point)));
        this.#hasProcessedTick = true;
        if (splitPoints.length) {
            splitPoints.sort((left, right) => left.time.getTime() - right.time.getTime());
            this.dispatchEvent(new CustomEvent("split-point-reached", {detail: {tick, splitPoints}}));
        }
        for (const [type, boundaries] of [["boundary-reached", reached], ["boundary-reset", reset]]) {
            if (!boundaries.length) continue;
            boundaries.sort((a, b) => a.time.getTime() - b.time.getTime());
            this.dispatchEvent(new CustomEvent(type, {detail: {tick, boundaries}}));
        }
    }
    insert(range, before = undefined) {
        if (!(range instanceof TimeRange) || range.group !== this) throw new TypeError("Range must belong to this group.");
        if (range.previous || range.next || this.#head === range) return range;
        let reference = before;
        if (reference === undefined) { reference = this.#head; while (reference && reference.start.getTime() <= range.start.getTime()) reference = reference.next; }
        if (reference !== null && reference !== undefined && (!(reference instanceof TimeRange) || reference.group !== this)) throw new TypeError("before must belong to this group.");
        const previous = reference ? reference.previous : this.#tail;
        if (previous) TimeRange._setNext(previous, range); else this.#head = range;
        if (reference) TimeRange._setPrevious(reference, range); else this.#tail = range;
        TimeRange._setPrevious(range, previous || null); TimeRange._setNext(range, reference || null); this.#rangeCount++; this.#recalculateExtent();
        this.dispatchEvent(new CustomEvent("insert", {detail:{range,previous:range.previous,next:range.next}})); return range;
    }
    remove(range) {
        if (!(range instanceof TimeRange) || range.group !== this) return false;
        if (range !== this.#head && !range.previous && !range.next) return false;
        this.#captureBoundaries();
        const previous=range.previous,next=range.next; if(previous) TimeRange._setNext(previous,next); else this.#head=next; if(next) TimeRange._setPrevious(next,previous); else this.#tail=previous; TimeRange._setPrevious(range,null); TimeRange._setNext(range,null); this.#rangeCount--; this.#recalculateExtent(); this.dispatchEvent(new CustomEvent("remove",{detail:{range,previous,next}})); return true;
    }
    notifyRangeChanged(range) { if(!(range instanceof TimeRange)||range.group!==this) throw new TypeError("Range must belong to this group."); this.#recalculateExtent(); this.dispatchEvent(new CustomEvent("change",{detail:{group:this,range}})); }
    split(range,boundary) {
        if(!(range instanceof TimeRange)||range.group!==this) throw new TypeError("Range does not belong to this group.");
        const point=TimeRangeGroup.#time(boundary); if(point<=range.start.getTime()||point>=range.end.getTime()) throw new RangeError("Split boundary must be inside the range.");
        const right=TimeRange._fromValidated(TimeRange.Type.EXPANDABLE,point,range.end.getTime(),this,range.element,range.entityId,range.entityType); const previousType=range.type;
        // Splitting creates an interior boundary; the original end belongs to right.
        const endState = this.#boundaryStates.get(range);
        if (endState) {
            this.#boundaryStates.set(right, endState);
            this.#boundaryStates.delete(range);
        }
        const endBoundary = this.#processingBoundaries?.get(range);
        if (endBoundary) {
            this.#processingBoundaries.set(right, {...endBoundary, before: right});
            this.#processingBoundaries.delete(range);
        }
        TimeRange._setTypeAndEnd(range,TimeRange.Type.COLLAPSABLE,point); this.insert(right,range.next); this.#recalculateExtent();
        this.dispatchEvent(new CustomEvent("split",{detail:{original:range,ranges:[range,right],boundary:new Date(point),previousType}})); return [range,right];
    }
    #propagate(range,tick) {
        let current=range;
        while(current){
            const boundary = this.#nextBoundaryWithin(current, tick);
            if (boundary !== null) {
                this.split(current, boundary);
                this.#captureBoundaries();
            }
            const next=current.next;
            const outcome=current._handleTick(tick);
            if(outcome==="stop") return;
            if(!next) return;
            current=next;
        }
    }
    #nextBoundaryWithin(range, tick) { const cursor=tick.cursorTime.getTime(), now=tick.currentTime.getTime(), start=Math.max(cursor,range.start.getTime()), end=range.end.getTime(); for(const boundary of this.#boundaries){ if(boundary>start&&boundary<end&&boundary<=now)return boundary; } return null; }
    #recalculateExtent(){if(!this.#head){this.#startTime=null;this.#endTime=null;return;}this.#startTime=this.#head.start.getTime();this.#endTime=this.#tail.end.getTime();}
    #attachClock(clock){if(this.#clockListener)return;const listener=e=>{const d=e?.detail??e;if(d?.currentTime!==undefined&&d?.lastTickTime!==undefined)this.tick(d.currentTime,d.lastTickTime);};if(typeof clock.addEventListener==="function"){clock.addEventListener("tick",listener);this.#clockListener=listener;}else if(typeof clock.on==="function"){clock.on("tick",listener);this.#clockListener=listener;}}
    #detachClock(){if(!this.#clock||!this.#clockListener)return;if(typeof this.#clock.removeEventListener==="function")this.#clock.removeEventListener("tick",this.#clockListener);else if(typeof this.#clock.off==="function")this.#clock.off("tick",this.#clockListener);this.#clockListener=undefined;}
    dispose(){this.#detachClock();this.#head=null;this.#tail=null;this.#rangeCount=0;this.#startTime=null;this.#endTime=null;this.#tickData=null;this.#boundaryStates.clear();this.#startBoundaryKeys.clear();this.#reachedSplitPoints.clear();this.#updateDepth=0;this.#needsValidation=false;this.#hasProcessedTick=false;}
    static #time(v){const d=v instanceof Date?v:new Date(v);if(!Number.isFinite(d.getTime()))throw new TypeError("Time must be a valid date.");return d.getTime();}
}

class TimeRange {
    static Type=Object.freeze({FIXED:"Fixed",MOVEABLE:"Moveable",EXPANDABLE:"Expandable",COLLAPSABLE:"Collapsable"});
    static Events=Object.freeze({SPLIT:"split",INSERT:"insert",REMOVE:"remove",CHANGE:"change",SPLIT_POINT_REACHED:"split-point-reached",BOUNDARY_REACHED:"boundary-reached",BOUNDARY_RESET:"boundary-reset"});
    static #newGroup; static #secret=Symbol("TimeRange"); static #nextId=0;
    #type;#start;#end;#group;#element;#previous=null;#next=null;
    #rangeId;#entityId;#entityType;
    constructor(secret,type,start,end,group,element=null,entityId=null,entityType=type){if(secret!==TimeRange.#secret)throw new TypeError("TimeRange constructor is private; use TimeRange.create().");this.#rangeId=globalThis.crypto?.randomUUID?.()??`time-range-${++TimeRange.#nextId}`;this.#entityId=entityId??this.#rangeId;this.#entityType=entityType;this.#type=type;this.#start=start;this.#end=end;this.#group=group;this.#element=element;}
    static create({type,group=null,clock=null,splitPoints=undefined,boundaries=undefined,start,end,element=null}={}){
        const t=TimeRange.#normalizeType(type),s=TimeRange.#time(start),e=TimeRange.#time(end);
        if(e<s)throw new RangeError("TimeRange end must not precede start.");
        if(s===e&&t!==TimeRange.Type.EXPANDABLE)throw new RangeError("Only Expandable ranges may have zero length.");
        if(!group){group=new TimeRangeGroup(clock,splitPoints??boundaries??[]);TimeRange.#newGroup=group;}else if(!(group instanceof TimeRangeGroup))throw new TypeError("group must be a TimeRangeGroup.");
        const pieces=TimeRange.#splitAtBoundaries(t,s,e,group.boundaries),ranges=[];
        for(const p of pieces){if(!group.validationSuspended)TimeRange.#validatePlacement(p.type,p.start,p.end,group);const r=TimeRange._fromValidated(p.type,p.start,p.end,group,ranges.length===0?element:null,ranges[0]?.entityId,t);group.insert(r);ranges.push(r);}
        if(!group.validationSuspended)TimeRange.#validateZeroLengthExpandables(group);return{group,ranges};
    }
    static get lastCreatedGroup(){return TimeRange.#newGroup;}
    get rangeId(){return this.#rangeId;}
    get entityId(){return this.#entityId;}
    get entityType(){return this.#entityType;}
    get type(){return this.#type;} get start(){return new Date(this.#start);} get end(){return new Date(this.#end);} get duration(){return this.#end-this.#start;} get group(){return this.#group;} get element(){return this.#element;} get previous(){return this.#previous;} get next(){return this.#next;}
    setElement(e){if(this.#element!==null&&this.#element!==e)throw new Error("A TimeRange element can only be assigned once.");this.#element=e;return this;}
    _handleTick(tick){
        const cursor=tick.cursorTime.getTime(),now=tick.currentTime.getTime();
        if(this.#type===TimeRange.Type.FIXED){if(now<=this.#end)return"stop";tick.advanceTo(Math.max(cursor,this.#end));return"continue";}
        if(this.#type===TimeRange.Type.EXPANDABLE){if(now<this.#start)return"stop";if(cursor<this.#start)tick.advanceTo(this.#start);const delta=tick.remainingDelta;if(delta>0){this.#end+=delta;tick.advanceTo(now);this.#group.notifyRangeChanged(this);}return"continue";}
        if(this.#type===TimeRange.Type.MOVEABLE){const delta=tick.remainingDelta;if(delta>0){this.#start+=delta;this.#end+=delta;tick.advanceTo(now);this.#group.notifyRangeChanged(this);}return"continue";}
        if(this.#type===TimeRange.Type.COLLAPSABLE){const active=Math.max(cursor,this.#start),remaining=Math.max(0,this.#end-active),consumed=Math.min(tick.remainingDelta,remaining);if(consumed>0)tick.advanceTo(cursor+consumed);if(consumed>=remaining){this.#group.remove(this);return"continue";}return"stop";}
        return"continue";
    }
    static _setPrevious(range, previous) { range.#previous = previous; }
    static _setNext(range, next) { range.#next = next; }
    static _setTypeAndEnd(range, type, end) { range.#type = type; range.#end = end; }
    static _fromValidated(t,s,e,g,el=null,entityId=null,entityType=t){return new TimeRange(TimeRange.#secret,t,s,e,g,el,entityId,entityType);}
    static _validateInterval(range) {
        const start = range.start.getTime(), end = range.end.getTime();
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new RangeError("TimeRange end must not precede start and times must be valid.");
        if (start === end && range.type !== TimeRange.Type.EXPANDABLE) throw new RangeError("Only Expandable ranges may have zero length.");
    }
    static _validateGroup(group) {
        let previous = null;
        for (let range = group.head; range; range = range.next) {
            const start = range.start.getTime(), end = range.end.getTime();
            TimeRange._validateInterval(range);
            if (previous && start < previous.end.getTime()) throw new Error("TimeRange overlap is a contract violation.");
            TimeRange.#validateAdjacent(previous, range.type, range.next);
            previous = range;
        }
        TimeRange.#validateZeroLengthExpandables(group);
    }
    static #validatePlacement(type,start,end,group){for(let r=group.head;r;r=r.next){if(start===end&&r.start.getTime()===start&&r.end.getTime()===end)throw new Error("Only one zero-length range may occupy a given instant.");if(end<=r.start.getTime()||start>=r.end.getTime())continue;throw new Error("TimeRange overlap is a contract violation.");}const prev=TimeRange.#findPrevious(group,start),next=prev?.next??group.head;TimeRange.#validateAdjacent(prev,type,next);}
    static #findPrevious(group,start){let p=null;for(let r=group.head;r&&r.start.getTime()<=start;r=r.next)p=r;return p;}
    static #validateAdjacent(prev,type,next){if(prev&&prev.type===TimeRange.Type.EXPANDABLE&&type===TimeRange.Type.EXPANDABLE)throw new Error("Adjacent Expandable ranges are illegal.");if(next&&next.type===TimeRange.Type.EXPANDABLE&&type===TimeRange.Type.EXPANDABLE)throw new Error("Adjacent Expandable ranges are illegal.");if(prev&&prev.type===TimeRange.Type.MOVEABLE&&type===TimeRange.Type.FIXED)throw new Error("Moveable followed by Fixed is illegal.");if(type===TimeRange.Type.MOVEABLE){let c=prev;while(c&&c.type===TimeRange.Type.COLLAPSABLE)c=c.previous;if(!c||(c.type!==TimeRange.Type.EXPANDABLE&&c.type!==TimeRange.Type.MOVEABLE))throw new Error("A Moveable must be rooted in an Expandable/Moveable chain.");}}
    static #validateZeroLengthExpandables(group){let n=0;for(let r=group.head;r;r=r.next)if(r.type===TimeRange.Type.EXPANDABLE&&r.start.getTime()===r.end.getTime()&&++n>1)throw new Error("Only one zero-length Expandable is allowed in a group.");}
    static #splitAtBoundaries(type,start,end,boundaries){const points=boundaries.map(v=>v.getTime()).filter(p=>p>start&&p<end);if(!points.length)return[{type,start,end}];const sorted=[...new Set(points)].sort((a,b)=>a-b),pieces=[];let cursor=start;for(const b of sorted){if(b>cursor)pieces.push({type:TimeRange.Type.COLLAPSABLE,start:cursor,end:b});cursor=b;}if(end>cursor)pieces.push({type:TimeRange.Type.EXPANDABLE,start:cursor,end});return pieces;}
    static #normalizeType(v){const s=String(v??"").trim().toLowerCase(),m=Object.values(TimeRange.Type).find(x=>x.toLowerCase()===s);if(!m)throw new TypeError(`Unknown TimeRange type: ${v}`);return m;}
    static #time(v){const d=v instanceof Date?v:new Date(v);if(!Number.isFinite(d.getTime()))throw new TypeError("TimeRange times must be valid dates.");return d.getTime();}
}
if(typeof globalThis!=="undefined"){globalThis.TimeRangeTick=TimeRangeTick;globalThis.TimeRangeGroup=TimeRangeGroup;globalThis.TimeRange=TimeRange;}
