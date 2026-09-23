"use strict";

class SpeechAudioWorkletProcessor extends AudioWorkletProcessor {
    #targetRate = 16000;
    #packetSamples = 320;
    #source = new Float32Array(0);
    #sourcePosition = 0;
    #packet = new Int16Array(320);
    #packetOffset = 0;
    #packetSquareTotal = 0;

    process(inputs) {
        const input =
            inputs?.[0];

        if (
            !input?.length ||
            !input[0]?.length
        ) {
            return true;
        }

        const length =
            input[0].length;

        const mono =
            new Float32Array(length);

        for (
            let index = 0;
            index < length;
            index++
        ) {
            let value = 0;

            for (
                let channel = 0;
                channel < input.length;
                channel++
            ) {
                value +=
                    input[channel]?.[index] ||
                    0;
            }

            mono[index] =
                value /
                input.length;
        }

        this.#appendSource(mono);
        this.#drain();

        return true;
    }

    #appendSource(samples) {
        if (!this.#source.length) {
            this.#source = samples;
            return;
        }

        const joined =
            new Float32Array(
                this.#source.length +
                samples.length
            );

        joined.set(
            this.#source,
            0
        );

        joined.set(
            samples,
            this.#source.length
        );

        this.#source = joined;
    }

    #drain() {
        const ratio =
            sampleRate /
            this.#targetRate;

        while (
            this.#sourcePosition + 1 <
            this.#source.length
        ) {
            const leftIndex =
                Math.floor(
                    this.#sourcePosition
                );

            const fraction =
                this.#sourcePosition -
                leftIndex;

            const left =
                this.#source[
                    leftIndex
                ];

            const right =
                this.#source[
                    leftIndex + 1
                ];

            const sample =
                left +
                (
                    right -
                    left
                ) *
                fraction;

            const clamped =
                Math.max(
                    -1,
                    Math.min(
                        1,
                        sample
                    )
                );

            this.#packetSquareTotal +=
                clamped *
                clamped;

            this.#packet[
                this.#packetOffset++
            ] =
                clamped < 0
                    ? Math.round(
                        clamped *
                        0x8000
                    )
                    : Math.round(
                        clamped *
                        0x7fff
                    );

            this.#sourcePosition +=
                ratio;

            if (
                this.#packetOffset ===
                this.#packetSamples
            ) {
                const packet =
                    this.#packet;

                const level =
                    Math.sqrt(
                        this.#packetSquareTotal /
                        this.#packetSamples
                    );

                this.#packet =
                    new Int16Array(
                        this.#packetSamples
                    );

                this.#packetOffset =
                    0;

                this.#packetSquareTotal =
                    0;

                this.port.postMessage(
                    {
                        type: "audio",
                        level,
                        sampleRate:
                            this.#targetRate,
                        pcm:
                            packet.buffer
                    },
                    [packet.buffer]
                );
            }
        }

        if (
            this.#source.length <= 1
        ) {
            return;
        }

        const consumed =
            Math.min(
                Math.floor(
                    this.#sourcePosition
                ),
                this.#source.length - 1
            );

        if (consumed <= 0) return;

        this.#source =
            this.#source.slice(
                consumed
            );

        this.#sourcePosition -=
            consumed;
    }
}

registerProcessor(
    "speech-audio-worklet",
    SpeechAudioWorkletProcessor
);
