(() => {
    'use strict';

    // A logical value, independent of recognition sessions, language and UI.
    class SpeechValueCollector {
        #segments = new Map();
        #state = 'incomplete';
        #completed = false;
        #digitRange;
        constructor({id, classify, maxSegments = 64, continuation, digitRange, toDigits = text => /^\d*$/.test(text.replace(/\s/g,'')) ? text.replace(/\s/g,'') : undefined} = {}) {
            if (digitRange !== undefined && (!Array.isArray(digitRange) || digitRange.length !== 2 ||
                !digitRange.every(Number.isInteger) || digitRange[0] < 1 || digitRange[1] < digitRange[0]))
                throw RangeError('Digit range must be [minimum, maximum] with positive integer counts.');
            this.#digitRange = digitRange && Object.freeze([...digitRange]);
            this.id = id;
            this.toDigits = toDigits;
            this.classify = classify || (digitRange ? text => ({status:toDigits(text) == null ? 'malformed' : 'valid',value:toDigits(text)}) : () => ({status:'incomplete'}));
            this.maxSegments = maxSegments;
            this.continuation = continuation;
        }
        get transcript() { return [...this.#segments.values()].map(s => s.text).filter(Boolean).join(' '); }
        get status() { return this.#state; }
        get completed() { return this.#completed; }
        get digitRange() { return this.#digitRange; }
        get segments() { return [...this.#segments.values()].map(s => Object.freeze({...s})); }
        project(segments) {
            const projected = new Map(this.#segments);
            const incoming = new Set(segments.map(s => s.id));
            for (const [id, segment] of projected) if (!segment.final && !segment.sealed && !incoming.has(id)) projected.delete(id);
            for (const segment of segments) {
                const previous = projected.get(segment.id);
                // Native final slots are immutable; replay is not another span.
                if (!previous?.final && !previous?.sealed) projected.set(segment.id, {...segment});
            }
            return [...projected.values()].map(s => s.text).filter(Boolean).join(' ');
        }
        update(segments) {
            if (this.#completed || this.#state === 'cancelled') return false;
            const incoming = new Set(segments.map(s => s.id));
            // A browser may remove its trailing interim slot on revision.
            for (const [id, segment] of this.#segments) {
                if (!segment.final && !segment.sealed && !incoming.has(id)) this.#segments.delete(id);
            }
            for (const segment of segments) {
                if (segment.id === undefined || typeof segment.text !== 'string') throw TypeError('Value segments require identity and text.');
                if (!this.#segments.has(segment.id) && this.#segments.size >= this.maxSegments) throw RangeError('Value collection exceeded its segment bound.');
                const previous=this.#segments.get(segment.id);
                if (!previous?.final && !previous?.sealed) this.#segments.set(segment.id, {...segment});
            }
            return true;
        }
        sealCapture() {
            if (this.#completed || this.#state === 'cancelled') return false;
            for (const segment of this.#segments.values()) segment.sealed = true;
            return true;
        }
        evaluate({boundary = false, canContinue, ...options} = {}) {
            if (this.#state === 'cancelled' || this.#completed) return Object.freeze({status: this.#state, transcript: this.transcript, settled: this.#completed});
            let result = this.classify(this.transcript, {final: boundary, ...options}) || {status: 'incomplete'};
            if (this.#digitRange) {
                const digits = this.toDigits(this.transcript);
                if (digits !== undefined) {
                    const [minimum, maximum] = this.#digitRange;
                    const invalid = digits === null || !/^\d*$/.test(digits) || digits.length > maximum;
                    const short = !invalid && digits.length < minimum;
                    result = {...result, digitCount:digits?.length ?? 0,
                        status:invalid || (short && boundary) ? 'malformed' : short ? 'incomplete' : result.status,
                        canContinue:!invalid && digits.length < maximum};
                }
            }
            if (!['valid', 'incomplete', 'defer', 'malformed'].includes(result.status)) throw TypeError('Unknown value classification.');
            this.#state = result.status;
            return Object.freeze({...result, transcript: this.transcript,
                settled: boundary || result.status === 'defer' || (result.status === 'valid' && !(canContinue ?? result.canContinue ?? true))});
        }
        complete(options = {}) {
            if (this.#completed || this.#state === 'cancelled') return undefined;
            const result = this.evaluate({...options, boundary: true});
            this.continuation?.cancelSilence();
            this.#completed = true;
            return result;
        }
        cancel() { this.#state = 'cancelled'; this.continuation?.cancel(); this.#segments.clear(); }
    }
    globalThis.SpeechValueCollector = SpeechValueCollector;
})();
