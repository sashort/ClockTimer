// Presentation adapter for the typed model. Load after TimeRangeModel.js,
// in place of the legacy TimeRange.js custom element.
class TimeRangeElement extends HTMLElement {
    #model = null;
    #unsubscribe = null;
    #snapshot;

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
    get model() { return this.#model; }
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
        for (const [name, value] of [
            ["range-id", this.rangeId],
            ["range-type", snapshot?.type],
            ["start-time", snapshot ? new Date(snapshot.start).toISOString() : null],
            ["end-time", snapshot ? new Date(snapshot.end).toISOString() : null],
            ["range-length", snapshot ? snapshot.end - snapshot.start : null]
        ]) {
            if (value === null || value === undefined) this.removeAttribute(name);
            else this.setAttribute(name, String(value));
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
