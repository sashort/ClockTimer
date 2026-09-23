import http from "node:http";
import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";

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

function multipartPart(
    boundary,
    name,
    value,
    {
        filename,
        contentType
    } = {}
) {
    const disposition =
        filename
            ? `form-data; name="${name}"; filename="${filename}"`
            : `form-data; name="${name}"`;

    const headers = [
        `--${boundary}`,
        `Content-Disposition: ${disposition}`
    ];

    if (contentType) {
        headers.push(
            `Content-Type: ${contentType}`
        );
    }

    headers.push("", "");

    return Buffer.concat([
        Buffer.from(
            headers.join("\r\n"),
            "utf8"
        ),
        Buffer.isBuffer(value)
            ? value
            : Buffer.from(
                String(value),
                "utf8"
            ),
        Buffer.from("\r\n")
    ]);
}

export function whisperServerArgs({
    host,
    port,
    model,
    threads,
    tmpDir
}) {
    return [
        "--host",
        host,
        "--port",
        String(port),
        "-m",
        model,
        "-t",
        String(threads),
        "--tmp-dir",
        tmpDir,
        "-nt"
    ];
}

export class WhisperService {
    #binary;
    #model;
    #host;
    #port;
    #threads;
    #tmpDir;
    #child;
    #startPromise;

    constructor({
        binary =
            process.env.WHISPER_SERVER_BIN ||
            "/opt/clocktimer-speech/bin/whisper-server",
        model =
            process.env.WHISPER_MODEL ||
            "/var/lib/clocktimer/speech/models/ggml-tiny.en.bin",
        host =
            process.env.WHISPER_HOST ||
            "127.0.0.1",
        port =
            Number(process.env.WHISPER_PORT) ||
            8766,
        threads =
            Number(process.env.WHISPER_THREADS) ||
            2,
        tmpDir =
            process.env.WHISPER_TMP_DIR ||
            "/var/lib/clocktimer/speech/tmp"
    } = {}) {
        this.#binary = binary;
        this.#model = model;
        this.#host = host;
        this.#port = port;
        this.#threads =
            Math.max(
                1,
                Math.round(threads)
            );
        this.#tmpDir =
            tmpDir;
    }

    get started() {
        return Boolean(
            this.#child &&
            !this.#child.killed
        );
    }

    async start() {
        if (this.started) return true;
        if (this.#startPromise) {
            return this.#startPromise;
        }

        this.#startPromise =
            this.#startProcess();

        try {
            await this.#startPromise;
            return true;
        }
        finally {
            this.#startPromise =
                undefined;
        }
    }

    async stop() {
        const child =
            this.#child;

        this.#child =
            undefined;

        if (
            !child ||
            child.killed
        ) {
            return;
        }

        await new Promise(resolve => {
            const timer =
                setTimeout(
                    () => {
                        try {
                            child.kill("SIGKILL");
                        }
                        catch {}
                        resolve();
                    },
                    3000
                );

            timer.unref?.();

            child.once(
                "exit",
                () => {
                    clearTimeout(timer);
                    resolve();
                }
            );

            try {
                child.kill("SIGTERM");
            }
            catch {
                clearTimeout(timer);
                resolve();
            }
        });
    }

    async transcribe(
        pcm,
        {
            language = "en-US",
            prompt = "",
            grammar = "",
            grammarRule = "root",
            grammarPenalty
        } = {}
    ) {
        if (!pcm?.length) return "";

        await this.start();

        const wave =
            createWaveFile(pcm);

        const boundary =
            `clocktimer-${randomUUID()}`;

        const body =
            Buffer.concat([
                multipartPart(
                    boundary,
                    "file",
                    wave,
                    {
                        filename:
                            "utterance.wav",
                        contentType:
                            "audio/wav"
                    }
                ),
                multipartPart(
                    boundary,
                    "response_format",
                    "text"
                ),
                multipartPart(
                    boundary,
                    "language",
                    String(
                        language || "en"
                    ).split("-")[0]
                ),
                ...(String(prompt || "").trim()
                    ? [
                        multipartPart(
                            boundary,
                            "prompt",
                            String(prompt).trim()
                        )
                    ]
                    : []),
                ...(String(grammar || "").trim()
                    ? [
                        multipartPart(
                            boundary,
                            "grammar",
                            String(grammar).trim()
                        ),
                        multipartPart(
                            boundary,
                            "grammar_rule",
                            String(
                                grammarRule ||
                                "root"
                            ).trim()
                        ),
                        multipartPart(
                            boundary,
                            "grammar_penalty",
                            Number.isFinite(
                                Number(
                                    grammarPenalty
                                )
                            )
                                ? Number(
                                    grammarPenalty
                                )
                                : 100
                        )
                    ]
                    : []),
                multipartPart(
                    boundary,
                    "no_timestamps",
                    "true"
                ),
                multipartPart(
                    boundary,
                    "token_timestamps",
                    "false"
                ),
                Buffer.from(
                    `--${boundary}--\r\n`,
                    "utf8"
                )
            ]);

        return new Promise(
            (resolve, reject) => {
                const request =
                    http.request(
                        {
                            hostname:
                                this.#host,
                            port:
                                this.#port,
                            path:
                                "/inference",
                            method:
                                "POST",
                            headers: {
                                "content-type":
                                    `multipart/form-data; boundary=${boundary}`,
                                "content-length":
                                    body.length
                            }
                        },
                        response => {
                            const chunks = [];

                            response.on(
                                "data",
                                chunk =>
                                    chunks.push(
                                        Buffer.from(
                                            chunk
                                        )
                                    )
                            );

                            response.on(
                                "end",
                                () => {
                                    const text =
                                        Buffer.concat(
                                            chunks
                                        )
                                            .toString(
                                                "utf8"
                                            )
                                            .trim();

                                    if (
                                        response.statusCode >=
                                            200 &&
                                        response.statusCode <
                                            300
                                    ) {
                                        resolve(text);
                                        return;
                                    }

                                    reject(
                                        new Error(
                                            text ||
                                            `whisper-server returned HTTP ${response.statusCode}.`
                                        )
                                    );
                                }
                            );
                        }
                    );

                request.setTimeout(
                    30000,
                    () => {
                        request.destroy(
                            new Error(
                                "whisper-server inference timed out."
                            )
                        );
                    }
                );

                request.once(
                    "error",
                    reject
                );

                request.end(body);
            }
        );
    }

    async #startProcess() {
        const child =
            spawn(
                this.#binary,
                whisperServerArgs({
                    host:
                        this.#host,
                    port:
                        this.#port,
                    model:
                        this.#model,
                    threads:
                        this.#threads,
                    tmpDir:
                        this.#tmpDir
                }),
                {
                    stdio:
                        ["ignore", "pipe", "pipe"]
                }
            );

        this.#child =
            child;

        child.stdout.pipe(
            process.stdout
        );
        child.stderr.pipe(
            process.stderr
        );

        let exited = false;
        let exitError;

        child.once(
            "error",
            error => {
                exitError = error;
            }
        );

        child.once(
            "exit",
            (code, signal) => {
                exited = true;

                if (
                    this.#child === child
                ) {
                    this.#child =
                        undefined;
                }

                if (!exitError) {
                    exitError =
                        new Error(
                            `whisper-server exited before becoming ready (code=${code}, signal=${signal}).`
                        );
                }
            }
        );

        const deadline =
            Date.now() + 60000;

        while (
            Date.now() < deadline
        ) {
            if (exited) {
                throw exitError;
            }

            try {
                await this.#probe();
                return;
            }
            catch {
                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            250
                        )
                );
            }
        }

        try {
            child.kill("SIGTERM");
        }
        catch {}

        throw new Error(
            "whisper-server did not become ready within 60 seconds."
        );
    }

    #probe() {
        return new Promise(
            (resolve, reject) => {
                const request =
                    http.get(
                        {
                            hostname:
                                this.#host,
                            port:
                                this.#port,
                            path:
                                "/"
                        },
                        response => {
                            response.resume();

                            if (
                                response.statusCode >=
                                    200 &&
                                response.statusCode <
                                    500
                            ) {
                                resolve();
                            }
                            else {
                                reject(
                                    new Error(
                                        `whisper-server readiness returned HTTP ${response.statusCode}.`
                                    )
                                );
                            }
                        }
                    );

                request.setTimeout(
                    1000,
                    () =>
                        request.destroy(
                            new Error(
                                "whisper-server readiness timed out."
                            )
                        )
                );

                request.once(
                    "error",
                    reject
                );
            }
        );
    }
}
