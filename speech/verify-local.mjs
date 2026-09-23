import fs from "node:fs";
import WebSocket from "file:///opt/clocktimer-speech/node_modules/ws/wrapper.mjs";

const wav = fs.readFileSync(process.env.JFK_WAV);

if (
    wav.toString("ascii", 0, 4) !== "RIFF" ||
    wav.toString("ascii", 8, 12) !== "WAVE"
) {
    throw new Error("Unexpected JFK WAV container.");
}

let offset = 12;
let pcm;
let channels;
let sampleRate;
let bitsPerSample;

while (offset + 8 <= wav.length) {
    const id =
        wav.toString(
            "ascii",
            offset,
            offset + 4
        );

    const size =
        wav.readUInt32LE(
            offset + 4
        );

    const start =
        offset + 8;

    if (id === "fmt ") {
        channels =
            wav.readUInt16LE(
                start + 2
            );
        sampleRate =
            wav.readUInt32LE(
                start + 4
            );
        bitsPerSample =
            wav.readUInt16LE(
                start + 14
            );
    }
    else if (id === "data") {
        pcm =
            wav.subarray(
                start,
                start + size
            );
    }

    offset =
        start +
        size +
        (size % 2);
}

if (
    channels !== 1 ||
    sampleRate !== 16000 ||
    bitsPerSample !== 16 ||
    !pcm?.length
) {
    throw new Error(
        "JFK sample is not mono 16 kHz PCM16."
    );
}

const socket =
    new WebSocket(
        "ws://127.0.0.1:8765/api/speech/stream",
        {
            headers: {
                Origin:
                    "https://wmof.sashort-apps.com"
            }
        }
    );

const result =
    await new Promise(
        (resolve, reject) => {
            const timer =
                setTimeout(
                    () => {
                        reject(
                            new Error(
                                "Timed out waiting for end-to-end speech transcription."
                            )
                        );
                    },
                    90000
                );

            socket.on(
                "open",
                () => {
                    socket.send(
                        JSON.stringify({
                            type:
                                "session-start",
                            sessionId:
                                "provision-e2e",
                            language:
                                "en-US",
                            context: {},
                            audio: {
                                encoding:
                                    "pcm_s16le",
                                sampleRate:
                                    16000,
                                channels:
                                    1
                            }
                        })
                    );

                    socket.send(
                        JSON.stringify({
                            type:
                                "utterance-start",
                            sessionId:
                                "provision-e2e",
                            utteranceId:
                                1
                        })
                    );

                    let sequence = 0;

                    for (
                        let index = 0;
                        index < pcm.length;
                        index += 640
                    ) {
                        const chunk =
                            pcm.subarray(
                                index,
                                Math.min(
                                    pcm.length,
                                    index + 640
                                )
                            );

                        const packet =
                            Buffer.allocUnsafe(
                                8 +
                                chunk.length
                            );

                        packet.writeUInt32LE(
                            1,
                            0
                        );
                        packet.writeUInt32LE(
                            sequence++,
                            4
                        );
                        chunk.copy(
                            packet,
                            8
                        );
                        socket.send(packet);
                    }

                    socket.send(
                        JSON.stringify({
                            type:
                                "utterance-end",
                            sessionId:
                                "provision-e2e",
                            utteranceId:
                                1,
                            reason:
                                "test"
                        })
                    );
                }
            );

            socket.on(
                "message",
                data => {
                    const message =
                        JSON.parse(
                            data.toString()
                        );

                    if (
                        message.type ===
                        "ping"
                    ) {
                        socket.send(
                            JSON.stringify({
                                type:
                                    "pong",
                                at:
                                    message.at
                            })
                        );
                        return;
                    }

                    if (
                        message.type ===
                        "error"
                    ) {
                        reject(
                            new Error(
                                message.message ||
                                message.error
                            )
                        );
                        return;
                    }

                    if (
                        message.type ===
                        "final"
                    ) {
                        clearTimeout(timer);
                        resolve(
                            String(
                                message.text ||
                                ""
                            )
                        );
                    }
                }
            );

            socket.on(
                "error",
                reject
            );
        }
    );

socket.close();

if (
    !/(ask not|fellow americans|your country)/i
        .test(result)
) {
    throw new Error(
        "Unexpected JFK transcription: " +
        result
    );
}

console.log(
    "End-to-end transcript:",
    result
);
