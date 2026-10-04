class TimeRangeTick {
    #currentTime;
    #lastTickTime;
    #cursorTime;
    constructor(currentTime, lastTickTime) { this.#currentTime = TimeRangeTick.#time(currentTime); this.#lastTickTime = TimeRangeTick.#time(lastTickTime); if (this.#currentTime < this.#lastTickTime) throw new RangeError("currentTime must not precede lastTickTime."); this.#cursorTime = this.#lastTickTime; }
    get currentTime() { return new Date(this.#currentTime); }
    get lastTickTime() { return new Date(this.#lastTickTime); }
    get cursorTime() { return new Date(this.#cursorTime); }
    get totalDelta() { return this.#currentTime - this.#lastTickTime; }
    get remainingDelta() { return this.#currentTime - this.#cursorTime; }
    advanceTo(time) { const value = TimeRangeTick.#time(time); if (value < this.#cursorTime || value > this.#currentTime) throw new RangeError("Tick cursor must remain within the clock interval."); this.#cursorTime = value; return this; }
    static #time(value) { const date = value instanceof Date ? value : new Date(value); if (!Number.isFinite(date.getTime())) throw new TypeError("Tick times must be valid dates."); return date.getTime(); }
}

class TimeRangeGroup extends EventTarget {
    #head = null; #tail = null; #clock; #clockListener; #boundaries = []; #startTime = null; #endTime = null; #rangeCount = 0;
    constructor(clock = null, boundaries = []) { super(); this.#clock = clock; this.setBoundaries(boundaries); if (clock) this.#attachClock(clock); }
    get head() { return this.#head; }
    get tail() { return this.#tail; }
    get startTime() { return this.#startTime === null ? null : new Date(this.#startTime); }
    get endTime() { return this.#endTime === null ? null : new Date(this.#endTime); }
    get duration() { return this.#startTime === null ? 0 : this.#endTime - this.#startTime; }
    get rangeCount() { return this.#rangeCount; }
    get size() { return this.#rangeCount; }
    get boundaries() { return this.#boundaries.map(value => new Date(value)); }
    setBoundaries(boundaries = []) { if (!Array.isArray(boundaries)) throw new TypeError("boundaries must be an array."); this.#boundaries = [...new Set(boundaries.map(TimeRangeGroup.#time))].sort((a,b)=>a-b); return this; }
    tick(currentTime, lastTickTime) { if (!this.#head) return; const tick = currentTime instanceof TimeRangeTick ? currentTime : new TimeRangeTick(currentTime, lastTickTime); this.#propagate(this.#head, tick); }
    insert(range, before = undefined) {
        if (!(range instanceof TimeRange) || range.group !== this) throw new TypeError("Range must belong to this group.");
        if (range.previous || range.next || this.#head === range) return range;
        let reference = before;
        if (reference === undefined) { reference = this.#head; while (reference && reference.start.getTime() <= range.start.getTime()) reference = reference.next; }
        if (reference !== null && reference !== undefined && (!(reference instanceof TimeRange) || reference.group !== this)) throw new TypeError("before must belong to this group.");
        const previous = reference ? reference.previous : this.#tail;
        if (previous) previous.#next = range; else this.#head = range;
        if (reference) reference.#previous = range; else this.#tail = range;
        range.#previous = previous || null; range.#next = reference || null; this.#rangeCount++; this.#recalculateExtent();
        this.dispatchEvent(new CustomEvent("insert", {detail:{range,previous:range.previous,next:range.next}})); return range;
    }
    remove(range) {
        if (!(range instanceof TimeRange) || range.group !== this) return false;
        const previous=range.previous,next=range.next; if(previous) previous.#next=next; else this.#head=next; if(next) next.#previous=previous; else this.#tail=previous; range.#previous=null; range.#next=null; this.#rangeCount--; this.#recalculateExtent(); this.dispatchEvent(new CustomEvent("remove",{detail:{range,previous,next}})); if(!this.#head)this.#detachClock(); return true;
    }
    notifyRangeChanged(range) { if(!(range instanceof TimeRange)||range.group!==this) throw new TypeError("Range must belong to this group."); this.#recalculateExtent(); this.dispatchEvent(new CustomEvent("change",{detail:{group:this,range}})); }
    split(range,boundary) { if(!(range instanceof TimeRange)||range.group!==this) throw new TypeError("Range does not belong to this group."); const point=TimeRangeGroup.#time(boundary); if(point<=range.#start||point>=range.#end) throw new RangeError("Split boundary must be inside the range."); const right=TimeRange.#fromValidated(TimeRange.Type.EXPANDABLE,point,range.#end,this); const previousType=range.#type; range.#type=TimeRange.Type.COLLAPSABLE; range.#end=point; this.insert(right,range.next); this.#recalculateExtent(); this.dispatchEvent(new CustomEvent("split",{detail:{original:range,ranges:[range,right],boundary:new Date(point),previousType}})); return [range,right]; }
    #propagate(range,tick) { let current=range; while(current){ const outcome=current.#handleTick(tick); if(outcome==="stop")return; const next=current.next; if(!next){ if(outcome==="end") this.dispatchEvent(new CustomEvent("end",{detail:{group:this,range:current,tick,overrun:tick.currentTime.getTime()>current.#end}})); return;} current=next; } }
    #recalculateExtent() { if(!this.#head){this.#startTime=null;this.#endTime=null;return;} this.#startTime=this.#head.#start; this.#endTime=this.#tail.#end; }
    #attachClock(clock) { if(this.#clockListener)return; const listener=event=>{const detail=event?.detail??event;if(detail?.currentTime!==undefined&&detail?.lastTickTime!==undefined)this.tick(detail.currentTime,detail.lastTickTime);}; if(typeof clock.addEventListener==="function"){clock.addEventListener("tick",listener);this.#clockListener=listener;} else if(typeof clock.on==="function"){clock.on("tick",listener);this.#clockListener=listener;} }
    #detachClock() { if(!this.#clock||!this.#clockListener)return; if(typeof this.#clock.removeEventListener==="function")this.#clock.removeEventListener("tick",this.#clockListener); else if(typeof this.#clock.off==="function")this.#clock.off("tick",this.#clockListener); this.#clockListener=undefined; }
    dispose() { this.#detachClock(); this.#head=null; this.#tail=null; this.#rangeCount=0; this.#startTime=null; this.#endTime=null; }
    static #time(value){const date=value instanceof Date?value:new Date(value);if(!Number.isFinite(date.getTime()))throw new TypeError("Time must be a valid date.");return date.getTime();}
}

class TimeRange {
    static Type=Object.freeze({FIXED:"Fixed",MOVEABLE:"Moveable",EXPANDABLE:"Expandable",COLLAPSABLE:"Collapsable"});
    static Events=Object.freeze({SPLIT:"split",INSERT:"insert",REMOVE:"remove",CHANGE:"change",END:"end"});
    static #newGroup; static #secret=Symbol("TimeRange");
    #type;#start;#end;#group;#element;#previous=null;#next=null;
    constructor(secret,type,start,end,group,element=null){if(secret!==TimeRange.#secret)throw new TypeError("TimeRange constructor is private; use TimeRange.create().");this.#type=type;this.#start=start;this.#end=end;this.#group=group;this.#element=element;}
    static create({type,group=null,clock=null,boundaries=undefined,start,end,element=null}={}){
        const normalizedType=TimeRange.#normalizeType(type),startMs=TimeRange.#time(start),endMs=TimeRange.#time(end); if(endMs<startMs)throw new RangeError("TimeRange end must not precede start."); if(startMs===endMs&&normalizedType!==TimeRange.Type.EXPANDABLE)throw new RangeError("Only Expandable ranges may have zero length.");
        if(!group){group=new TimeRangeGroup(clock,boundaries??[]);TimeRange.#newGroup=group;} else if(!(group instanceof TimeRangeGroup))throw new TypeError("group must be a TimeRangeGroup.");
        const pieces=TimeRange.#splitAtBoundaries(normalizedType,startMs,endMs,group.boundaries),ranges=[]; for(const piece of pieces){TimeRange.#validatePlacement(piece.type,piece.start,piece.end,group);const range=TimeRange.#fromValidated(piece.type,piece.start,piece.end,group,ranges.length===0?element:null);group.insert(range);ranges.push(range);} TimeRange.#validateZeroLengthExpandables(group); return {group,ranges};
    }
    static get lastCreatedGroup(){return TimeRange.#newGroup;}
    get type(){return this.#type;} get start(){return new Date(this.#start);} get end(){return new Date(this.#end);} get duration(){return this.#end-this.#start;} get group(){return this.#group;} get element(){return this.#element;} get previous(){return this.#previous;} get next(){return this.#next;}
    setElement(element){if(this.#element!==null&&this.#element!==element)throw new Error("A TimeRange element can only be assigned once.");this.#element=element;return this;}
    #handleTick(tick){const cursor=tick.cursorTime.getTime(),now=tick.currentTime.getTime();
        if(this.#type===TimeRange.Type.FIXED){if(now<=this.#end)return "stop";tick.advanceTo(Math.max(cursor,this.#end));return "continue";}
        if(this.#type===TimeRange.Type.EXPANDABLE){if(now<this.#start)return "continue";if(cursor<this.#start)tick.advanceTo(this.#start);const delta=tick.remainingDelta;if(delta>0){this.#end+=delta;tick.advanceTo(now);this.#group.notifyRangeChanged(this);}return "continue";}
        if(this.#type===TimeRange.Type.MOVEABLE){const delta=tick.remainingDelta;if(delta>0){this.#start+=delta;this.#end+=delta;tick.advanceTo(now);this.#group.notifyRangeChanged(this);}return "continue";}
        if(this.#type===TimeRange.Type.COLLAPSABLE){const activeStart=Math.max(cursor,this.#start),remaining=Math.max(0,this.#end-activeStart),consumed=Math.min(tick.remainingDelta,remaining);if(consumed>0)tick.advanceTo(cursor+consumed);if(consumed>=remaining){this.#group.remove(this);return "stop";}return "stop";}
        return "continue";
    }
    static #fromValidated(type,start,end,group,element=null){return new TimeRange(TimeRange.#secret,type,start,end,group,element);}
    static #validatePlacement(type,start,end,group){for(let range=group.head;range;range=range.next){if(start===end&&range.start.getTime()===start&&range.end.getTime()===end)throw new Error("Only one zero-length range may occupy a given instant.");if(end<=range.#start||start>=range.#end)continue;throw new Error("TimeRange overlap is a contract violation.");}const previous=TimeRange.#findPrevious(group,start),next=previous?.next??group.head;TimeRange.#validateAdjacent(previous,type,next);}
    static #findPrevious(group,start){let previous=null;for(let range=group.head;range&&range.start.getTime()<=start;range=range.next)previous=range;return previous;}
    static #validateAdjacent(previous,type,next){if(previous&&previous.#type===TimeRange.Type.EXPANDABLE&&type===TimeRange.Type.EXPANDABLE)throw new Error("Adjacent Expandable ranges are illegal.");if(previous&&previous.#type===TimeRange.Type.MOVEABLE&&type===TimeRange.Type.FIXED)throw new Error("Moveable followed by Fixed is illegal.");if(previous&&previous.#type===TimeRange.Type.MOVEABLE&&type===TimeRange.Type.EXPANDABLE)throw new Error("Moveable followed by Expandable is illegal.");if(next&&type===TimeRange.Type.EXPANDABLE&&next.#type===TimeRange.Type.EXPANDABLE)throw new Error("Adjacent Expandable ranges are illegal.");if(next&&type===TimeRange.Type.MOVEABLE&&next.#type===TimeRange.Type.FIXED)throw new Error("Moveable followed by Fixed is illegal.");if(next&&type===TimeRange.Type.MOVEABLE&&next.#type===TimeRange.Type.EXPANDABLE)throw new Error("Moveable followed by Expandable is illegal.");if(type===TimeRange.Type.MOVEABLE){let cursor=previous;while(cursor&&cursor.#type===TimeRange.Type.COLLAPSABLE)cursor=cursor.previous;if(!cursor||(cursor.#type!==TimeRange.Type.EXPANDABLE&&cursor.#type!==TimeRange.Type.MOVEABLE))throw new Error("A Moveable must be rooted in an Expandable/Moveable chain.");}}
    static #validateZeroLengthExpandables(group){let count=0;for(let range=group.head;range;range=range.next)if(range.#type===TimeRange.Type.EXPANDABLE&&range.#start===range.#end&&++count>1)throw new Error("Only one zero-length Expandable is allowed in a group.");}
    static #splitAtBoundaries(type,start,end,boundaries){const points=boundaries.map(value=>value.getTime()).filter(point=>point>start&&point<end);if(!points.length)return[{type,start,end}];const sorted=[...new Set(points)].sort((a,b)=>a-b),pieces=[];let cursor=start;for(const boundary of sorted){if(boundary>cursor)pieces.push({type:TimeRange.Type.COLLAPSABLE,start:cursor,end:boundary});cursor=boundary;}if(end>cursor)pieces.push({type:TimeRange.Type.EXPANDABLE,start:cursor,end});return pieces;}
    static #normalizeType(type){const value=String(type??"").trim().toLowerCase(),match=Object.values(TimeRange.Type).find(candidate=>candidate.toLowerCase()===value);if(!match)throw new TypeError(`Unknown TimeRange type: ${type}`);return match;}
    static #time(value){const date=value instanceof Date?value:new Date(value);if(!Number.isFinite(date.getTime()))throw new TypeError("TimeRange times must be valid dates.");return date.getTime();}
}

if(typeof globalThis!=="undefined"){globalThis.TimeRangeTick=TimeRangeTick;globalThis.TimeRangeGroup=TimeRangeGroup;globalThis.TimeRange=TimeRange;}
