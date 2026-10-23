/* A bounded, sample-addressed copy of the ONE microphone capture. */
(() => {
    'use strict';
    class PcmSampleBuffer {
        #data; #end = 0;
        constructor(capacity) {
            if (!Number.isSafeInteger(capacity) || capacity < 1) throw RangeError('PCM capacity must be a positive sample count.');
            this.#data = new Float32Array(capacity);
        }
        get start() { return Math.max(0, this.#end - this.#data.length); }
        get end() { return this.#end; }
        get capacity() { return this.#data.length; }
        append(samples) {
            const start = this.#end;
            for (let i = Math.max(0, samples.length-this.capacity); i < samples.length; i++)
                this.#data[(start+i)%this.capacity] = samples[i];
            this.#end += samples.length;
            return {start, end:this.#end};
        }
        read(start, end = this.#end) {
            if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < this.start || end > this.end || end < start)
                throw RangeError('Requested PCM span is no longer retained.');
            const result = new Float32Array(end-start);
            for (let i=0;i<result.length;i++) result[i]=this.#data[(start+i)%this.capacity];
            return result;
        }
    }
    globalThis.PcmSampleBuffer = PcmSampleBuffer;
})();
