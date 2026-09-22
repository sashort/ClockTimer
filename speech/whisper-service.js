import {spawn} from "node:child_process";
import {mkdir, unlink, writeFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import path from "node:path";

import {
    AUDIO_CHANNELS,
    AUDIO_SAMPLE_RATE
} from "./protocol.js";

function createWaveFile(pcm) {
    const data =
        Buffer.isBuffer(pcm)
            ? pcm
            : Buffer.from(pcm);

    const header =
        Buffer.alloc(44);

    const byteRate =
        AUDIO_SAMPLE_RATE *
        AUDIO_CHANNELS *
        2;

    header.write("RIFF", 0);
    header.writeUInt32LE(36 + data.length, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(AUDIO_CHANNELS, 22);
    header.writeUInt32LE(AUDIO_SAMPLE_RATE, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(AUDIO_CHANNELS * 2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(data.length, 40);

    return Buffer.concat([header, data]);
}

export class WhisperService {
    #binary;
    #model;
    #tmpDirectory;
    #threads;

    constructor({
        binary =
            process.env.WHISPER_BIN ||
            "/opt/clocktimer-speech/bin/whisper-cli",
        model =
            process.env.WHISPER_MODEL ||
            "/var/lib/clocktimer/speech/models/ggml-base.en.bin",
        tmpDirectory =
            process.env.SPEECH_TMP ||
            "/var/lib/clocktimer/speech/tmp",
        threads =
            Number(process.env.WHISPER_THREADS) || 4
    } = {}) {
        this.#binary = binary;
        this.#model = model;
        this.#tmpDirectory = tmpDirectory;
        this.#threads = Math.max(1, Math.round(threads));
    }

    async transcribe(pcm, {
        language = "en-US"
    } = {}) {
        if (!pcm?.length) return "";

        await mkdir(
            this.#tmpDirectory,
            {recursive: true}
        );

        const filename =
            path.join(
                this.#tmpDirectory,
                `${randomUUID()}.wav`
            );

        try {
            await writeFile(
                filename,
                createWaveFile(pcm)
            );

            const transcript =
                await this.#run([
                    "-m", this.#model,
                    "-f", filename,
                    "-l", String(language || "en")
                        .split("-")[0],
                    "-t", String(this.#threads),
                    "-nt",
                    "-np"
                ]);

            return transcript
                .replace(/\s+/g, " ")
                .trim();
        }
        finally {
            await unlink(filename)
                .catch(() => {});
        }
    }

    #run(args) {
        return new Promise(
            (resolve, reject) => {
                const child =
                    spawn(
                        this.#binary,
                        args,
                        {
                            stdio:
                                ["ignore", "pipe", "pipe"]
                        }
                    );

                let stdout = "";
                let stderr = "";

                child.stdout.setEncoding("utf8");
                child.stderr.setEncoding("utf8");

                child.stdout.on(
                    "data",
                    value => {
                        stdout += value;
                    }
                );

                child.stderr.on(
                    "data",
                    value => {
                        stderr += value;
                    }
                );

                child.once(
                    "error",
                    reject
                );

                child.once(
                    "close",
                    code => {
                        if (code === 0) {
                            resolve(stdout);
                            return;
                        }

                        reject(
                            new Error(
                                stderr.trim() ||
                                `whisper-cli exited with code ${code}.`
                            )
                        );
                    }
                );
            }
        );
    }
}
