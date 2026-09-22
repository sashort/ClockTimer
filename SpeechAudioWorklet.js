"use strict";

class SpeechAudioWorkletProcessor extends AudioWorkletProcessor {
    #targetRate = 16000;
    #packetSamples = 320;
    #source = [];
    #sourcePosition = 0;
    #packet = new Int16Array(320);
    #packetOffset = 0;

    process(inputs) {
        const input = inputs?.[0];
        if (!input?.length || !input[0]?.length) {
            return true;
        }

        const length = input[0].length;
        const mono = new Float32Array(length);
        let squareTotal = 0;

        for (let index = 0; index < length; index++) {
            let value = 0;
            for (let channel = 0; channel < input.length; channel++) {
                value += input[channel]?.[index] || 0;
            }
            value /= input.length;
            mono[index] = value;
            squareTotal += value * value;
        }

        const level =
            Math.sqrt(squareTotal / Math.max(1, length));

        this.#source.push(mono);
        this.#drain(level);

        return true;
    }

    #drain(level) {
        const ratio = sampleRate / this.#targetRate;
        const source = this.#flattenSource();

        while (
            this.#sourcePosition + 1 < source.length
        ) {
            const leftIndex =
                Math.floor(this.#sourcePosition);
            const fraction =
                this.#sourcePosition - leftIndex;
            const left = source[leftIndex];
            const right =
                source[leftIndex + 1] ?? left;
            const sample =
                left + (right - left) * fraction;

            const clamped =
                Math.max(-1, Math.min(1, sample));

            this.#packet[this.#packetOffset++] =
                clamped < 0
                    ? Math.round(clamped * 0x8000)
                    : Math.round(clamped * 0x7fff);

            this.#sourcePosition += ratio;

            if (
                this.#packetOffset ===
                this.#packetSamples
            ) {
                const packet = this.#packet;
                this.#packet =
                    new Int16Array(this.#packetSamples);
                this.#packetOffset = 0;

                this.port.postMessage(
                    {
                        type: "audio",
                        level,
                        sampleRate: this.#targetRate,
                        pcm: packet.buffer
                    },
                    [packet.buffer]
                );
            }
        }

        const consumed =
            Math.floor(this.#sourcePosition);

        if (consumed > 0) {
            this.#sourcePosition -= consumed;
            this.#consumeSource(consumed);
        }
    }

    #flattenSource() {
        let total = 0;
        for (const block of this.#source) {
            total += block.length;
        }

        const result = new Float32Array(total);
        let offset = 0;

        for (const block of this.#source) {
            result.set(block, offset);
            offset += block.length;
        }

        return result;
    }

    #consumeSource(count) {
        let remaining = count;

        while (
            remaining > 0 &&
            this.#source.length
        ) {
            const block = this.#source[0];

            if (remaining >= block.length) {
                remaining -= block.length;
                this.#source.shift();
                continue;
            }

            this.#source[0] =
                block.slice(remaining);
            remaining = 0;
        }
    }
}

registerProcessor(
    "speech-audio-worklet",
    SpeechAudioWorkletProcessor
);
