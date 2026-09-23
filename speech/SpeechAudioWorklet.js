class WMOFSpeechCaptureProcessor extends AudioWorkletProcessor {
    static targetSampleRate = 16000;

    #sourceRate = sampleRate;
    #ratio =
        this.#sourceRate /
        WMOFSpeechCaptureProcessor
            .targetSampleRate;
    #pending =
        new Float32Array(0);
    #position = 0;

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
        const mono =
            new Float32Array(
                length
            );

        let squareTotal = 0;

        for (
            let index = 0;
            index < length;
            index++
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

            sample /=
                input.length;

            mono[index] =
                sample;

            squareTotal +=
                sample * sample;
        }

        const level =
            Math.sqrt(
                squareTotal /
                Math.max(
                    1,
                    length
                )
            );

        const combined =
            new Float32Array(
                this.#pending.length +
                mono.length
            );

        combined.set(
            this.#pending
        );

        combined.set(
            mono,
            this.#pending.length
        );

        const output = [];

        while (
            this.#position + 1 <
            combined.length
        ) {
            const left =
                Math.floor(
                    this.#position
                );

            const fraction =
                this.#position -
                left;

            output.push(
                combined[left] +
                (
                    combined[left + 1] -
                    combined[left]
                ) *
                fraction
            );

            this.#position +=
                this.#ratio;
        }

        const consumed =
            Math.floor(
                this.#position
            );

        this.#position -=
            consumed;

        this.#pending =
            combined.slice(
                consumed
            );

        if (output.length > 0) {
            const samples =
                Float32Array.from(
                    output
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
        }

        return true;
    }
}

registerProcessor(
    "wmof-speech-capture",
    WMOFSpeechCaptureProcessor
);