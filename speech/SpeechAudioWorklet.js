class WMOFSpeechCaptureProcessor extends AudioWorkletProcessor {
    static targetSampleRate = 16000;
    static frameMilliseconds = 40;
    static frameSamples =
        Math.round(
            WMOFSpeechCaptureProcessor
                .targetSampleRate *
            WMOFSpeechCaptureProcessor
                .frameMilliseconds /
            1000
        );

    #sourceRate = sampleRate;
    #ratio =
        this.#sourceRate /
        WMOFSpeechCaptureProcessor
            .targetSampleRate;

    #sourcePosition = 0;
    #nextOutputPosition = 0;
    #previousSample = 0;
    #hasPreviousSample = false;

    #frame =
        new Float32Array(
            WMOFSpeechCaptureProcessor
                .frameSamples
        );
    #frameLength = 0;
    #frameSquareTotal = 0;

    constructor() {
        super();

        this.port.addEventListener(
            "message",
            event => {
                if (
                    event.data?.type ===
                    "reset"
                ) {
                    this.#reset();
                }
            }
        );

        this.port.start?.();
    }

    #reset() {
        this.#sourcePosition = 0;
        this.#nextOutputPosition = 0;
        this.#previousSample = 0;
        this.#hasPreviousSample =
            false;
        this.#frameLength = 0;
        this.#frameSquareTotal = 0;
    }

    #emitFrame() {
        if (
            this.#frameLength === 0
        ) {
            return;
        }

        const samples =
            this.#frameLength ===
                this.#frame.length
                ? this.#frame
                : this.#frame.slice(
                    0,
                    this.#frameLength
                );

        const level =
            Math.sqrt(
                this.#frameSquareTotal /
                this.#frameLength
            );

        this.port.postMessage(
            {
                type: "audio",
                sampleRate:
                    WMOFSpeechCaptureProcessor
                        .targetSampleRate,
                level,
                samples
            },
            [
                samples.buffer
            ]
        );

        this.#frame =
            new Float32Array(
                WMOFSpeechCaptureProcessor
                    .frameSamples
            );
        this.#frameLength = 0;
        this.#frameSquareTotal = 0;
    }

    #appendOutputSample(
        sample
    ) {
        this.#frame[
            this.#frameLength++
        ] = sample;

        this.#frameSquareTotal +=
            sample * sample;

        if (
            this.#frameLength >=
            this.#frame.length
        ) {
            this.#emitFrame();
        }
    }

    #monoSample(
        input,
        index
    ) {
        let sample = 0;

        for (
            let channel = 0;
            channel < input.length;
            channel++
        ) {
            sample +=
                input[channel][index] ||
                0;
        }

        return sample /
            input.length;
    }

    process(inputs) {
        const input =
            inputs?.[0];

        if (
            !input ||
            input.length === 0 ||
            input[0].length === 0
        ) {
            return true;
        }

        const length =
            input[0].length;

        for (
            let index = 0;
            index < length;
            index++
        ) {
            const sample =
                this.#monoSample(
                    input,
                    index
                );

            if (
                !this.#hasPreviousSample
            ) {
                this.#previousSample =
                    sample;
                this.#hasPreviousSample =
                    true;

                this.#appendOutputSample(
                    sample
                );

                this.#nextOutputPosition =
                    this.#ratio;

                continue;
            }

            this.#sourcePosition++;

            while (
                this.#nextOutputPosition <=
                this.#sourcePosition
            ) {
                const fraction =
                    this.#nextOutputPosition -
                    (
                        this.#sourcePosition -
                        1
                    );

                const outputSample =
                    this.#previousSample +
                    (
                        sample -
                        this.#previousSample
                    ) *
                        fraction;

                this.#appendOutputSample(
                    outputSample
                );

                this.#nextOutputPosition +=
                    this.#ratio;
            }

            this.#previousSample =
                sample;
        }

        return true;
    }
}

registerProcessor(
    "wmof-speech-capture",
    WMOFSpeechCaptureProcessor
);
