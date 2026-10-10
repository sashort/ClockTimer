// Presentation adapter for the typed model. Load after TimeRangeModel.js,
// in place of the legacy TimeRange.js custom element.
class TimeRangeElement extends HTMLElement {
    #model = null;
    #unsubscribe = null;
    #snapshot;
    #reflecting = false;
    static get observedAttributes() { return ["start-time", "end-time", "range-length"]; }

    // One displayed logical range may consist of several split model pieces.
    static create(range) {
        const element = document.createElement("time-range");
        return element.bind(range);
    }
    bind(range) {
        if (!(range instanceof TimeRange)) throw new TypeError("Bind a TimeRange model.");
        this.#unsubscribe?.();
        this.#unsubscribe = null;
        this.#model = range;
        this.#snapshot = undefined;
        if (this.isConnected) this.#observe();
        this.refresh();
        return this;
    }
    get model() { return this.ranges[0] ?? this.#model; }
    get rangeId() { return this.#model?.rangeId ?? null; }
    get ranges() {
        const pieces = [];
        for (let range = this.#model?.group.head; range; range = range.next) {
            if (range.rangeId === this.rangeId) pieces.push(range);
        }
        return pieces;
    }

    // Interval properties expose the last committed view, never an unfinished edit.
    get startTime() { return this.#snapshot ? new Date(this.#snapshot.start) : null; }
    get endTime() { return this.#snapshot ? new Date(this.#snapshot.end) : null; }
    get rangeLength() { return this.#snapshot ? this.#snapshot.end - this.#snapshot.start : 0; }

    // DOM detachment releases the subscription; reconnecting reads current state.
    connectedCallback() {
        if (!this.#model) this.#readIntervalAttributes();
        this.#observe();
        const previous = this.#snapshot;
        this.refresh();
        if (this.#snapshot && previous === this.#snapshot && !this.#model.group.validationSuspended) {
            this.#publishChange(null);
        }
    }
    disconnectedCallback() {
        this.#unsubscribe?.();
        this.#unsubscribe = null;
    }
    #observe() {
        if (this.#model && !this.#unsubscribe) {
            this.#unsubscribe = this.#model.group.observeRanges(() => this.refresh());
        }
    }

    // Declarative times and controller edits are inputs to the model. The DOM
    // keeps no independent interval state and never resolves collection overlaps.
    attributeChangedCallback(name, before, after) {
        if (!this.#reflecting && this.isConnected && before !== after && after !== null) {
            this.#readIntervalAttributes(name);
        }
    }
    #readIntervalAttributes(changed) {
        let start = this.#parseTime(this.getAttribute("start-time"));
        let end = this.#parseTime(this.getAttribute("end-time"));
        const lengthValue = this.getAttribute("range-length");
        const length = lengthValue === null ? undefined : globalThis.TemporalFormat
            ? TemporalFormat.parseDuration(lengthValue) : Number(lengthValue);
        if (Number.isFinite(length) && length >= 0) {
            if (changed === "end-time" && end) start = new Date(end.getTime() - length);
            else if (start) end = new Date(start.getTime() + length);
            else if (end) start = new Date(end.getTime() - length);
        }
        if (start && end && end >= start) this.#setInterval(start, end);
    }
    #parseTime(value) {
        if (value === null || value === undefined) return null;
        const date = globalThis.TemporalFormat?.parseDateTime(value, new Date()) ?? new Date(value);
        return Number.isFinite(date.getTime()) ? date : null;
    }
    #setInterval(start, end) {
        if (!this.#model) {
            const range = TimeRange.create({type: end > start ? "Fixed" : "Expandable", start, end}).ranges[0];
            this.bind(range);
        } else {
            if (!this.#model.group.setRangeInterval(this.rangeId, start, end,
                end > start ? "Fixed" : "Expandable")) return false;
            this.refresh();
        }
        return true;
    }
    transitionTo({startTime, endTime} = {}) {
        this.#assertMutationAllowed();
        const start = this.#parseTime(startTime), end = this.#parseTime(endTime);
        if (!start || !end || end < start) return false;
        return this.#setInterval(start, end);
    }

    // Approval and derived-range policy remain controller decisions. Preserve
    // the existing guard while allowing internal reflection of committed data.
    #assertMutationAllowed(name) {
        if (this.clockTimerInternalMutation === true) return;
        if (this.clockTimerDerivedReadOnly === true) throw new Error("Derived discrepancy ranges cannot be modified.");
        if (this.clockTimerApprovalReadOnly === true && /^(approved|unapproved)$/i.test(name ?? "")) {
            throw new Error("Interval approval attributes must be changed through ClockTimer.");
        }
    }
    setAttribute(name, value) { this.#assertMutationAllowed(name); return super.setAttribute(name, value); }
    removeAttribute(name) { this.#assertMutationAllowed(name); return super.removeAttribute(name); }
    toggleAttribute(name, force) { this.#assertMutationAllowed(name); return super.toggleAttribute(name, force); }
    remove() { this.#assertMutationAllowed(); return super.remove(); }

    // Attributes are output for styling/inspection, not a second interval store.
    // Consumers of the change notification own geometry, layers, and animation.
    refresh() {
        if (this.#model?.group.validationSuspended) return this;
        const pieces = this.ranges;
        const snapshot = pieces.length ? {
            start: pieces[0].startMilliseconds,
            end: pieces.at(-1).endMilliseconds,
            type: this.#model.entityType,
            rangeId: this.rangeId
        } : null;
        const previous = this.#snapshot;
        if (snapshot === previous || (snapshot && previous && snapshot.start === previous.start &&
            snapshot.end === previous.end && snapshot.type === previous.type && snapshot.rangeId === previous.rangeId)) return this;
        this.#snapshot = snapshot;
        let duration = null;
        if (snapshot) {
            duration = snapshot.end - snapshot.start;
            duration = duration === 0 ? "0" : globalThis.TemporalFormat
                ? TemporalFormat.formatDuration(duration) : String(duration);
        }
        this.#reflecting = true;
        try {
            for (const [name, value] of [
                ["range-id", this.rangeId],
                ["range-type", snapshot?.type],
                ["start-time", snapshot ? new Date(snapshot.start).toISOString() : null],
                ["end-time", snapshot ? new Date(snapshot.end).toISOString() : null],
                ["range-length", duration]
            ]) {
                if (value === null || value === undefined) super.removeAttribute(name);
                else super.setAttribute(name, String(value));
            }
        } finally {
            this.#reflecting = false;
        }
        this.hidden = !snapshot;
        this.#publishChange(previous);
        return this;
    }
    #publishChange(previous) {
        const describe = snapshot => snapshot ? {
            rangeId: snapshot.rangeId, type: snapshot.type,
            startTime: new Date(snapshot.start), endTime: new Date(snapshot.end),
            rangeLength: snapshot.end - snapshot.start
        } : null;
        this.dispatchEvent(new CustomEvent("time-range-changed", {
            bubbles: true, composed: true,
            detail: {range: this, before: describe(previous), after: describe(this.#snapshot)}
        }));
    }
}

// Both implementations use <time-range>; silently retaining the old one would
// make a migration appear successful while still using its interval logic.
if (customElements.get("time-range")) {
    throw new Error("Load TimeRangeElement.js instead of legacy TimeRange.js.");
}
customElements.define("time-range", TimeRangeElement);
globalThis.TimeRangeElement = TimeRangeElement;
