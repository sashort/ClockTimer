import http from "node:http";
import {WebSocketServer, WebSocket} from "ws";

import {
    AUDIO_CHANNELS,
    AUDIO_ENCODING,
    AUDIO_SAMPLE_RATE,
    decodeAudioPacket,
    errorMessage,
    parseControlMessage,
    transcriptMessage
} from "./protocol.js";
import {WhisperService} from "./whisper-service.js";
import {
    buildRecognitionGrammar,
    buildRecognitionPrompt
} from "./grammar.js";

const HOST =
    process.env.SPEECH_HOST ||
    "127.0.0.1";

const PORT =
    Number(process.env.SPEECH_PORT) ||
    8765;

const WEBSOCKET_PATH =
    process.env.SPEECH_WEBSOCKET_PATH ||
    "/api/speech/stream";

const ALLOWED_ORIGIN =
    process.env.SPEECH_ALLOWED_ORIGIN ||
    "https://wmof.sashort-apps.com";

const PARTIAL_INTERVAL_MS =
    Math.max(
        100,
        Number(process.env.SPEECH_PARTIAL_MS) ||
        250
    );

const PARTIAL_MIN_AUDIO_MS =
    Math.max(
        1000,
        Number(
            process.env
                .SPEECH_PARTIAL_MIN_AUDIO_MS
        ) || 2200
    );

const MAX_PARTIAL_PASSES =
    Math.max(
        0,
        Number(
            process.env
                .SPEECH_MAX_PARTIAL_PASSES
        ) || 1
    );

const PARTIAL_MIN_AUDIO_BYTES =
    Math.round(
        AUDIO_SAMPLE_RATE *
        AUDIO_CHANNELS *
        2 *
        PARTIAL_MIN_AUDIO_MS /
        1000
    );

const MAX_UTTERANCE_SECONDS =
    Math.max(
        5,
        Number(process.env.SPEECH_MAX_UTTERANCE_SECONDS) ||
        60
    );

const MAX_UTTERANCE_BYTES =
    AUDIO_SAMPLE_RATE *
    AUDIO_CHANNELS *
    2 *
    MAX_UTTERANCE_SECONDS;

const whisper =
    new WhisperService();

const PARTIAL_GRAMMAR_PENALTY =
    Math.max(
        0,
        Number(
            process.env
                .SPEECH_PARTIAL_GRAMMAR_PENALTY
        ) || 10
    );

const FINAL_GRAMMAR_PENALTY =
    Math.max(
        PARTIAL_GRAMMAR_PENALTY,
        Number(
            process.env
                .SPEECH_FINAL_GRAMMAR_PENALTY
        ) || 100
    );

const server =
    http.createServer(
        (request, response) => {
            if (
                request.method === "GET" &&
                request.url === "/health"
            ) {
                response.writeHead(
                    200,
                    {"content-type": "application/json"}
                );
                response.end(
                    JSON.stringify({
                        ok: true,
                        service: "clocktimer-speech"
                    })
                );
                return;
            }

            response.writeHead(404);
            response.end();
        }
    );

const sockets =
    new WebSocketServer({
        noServer: true,
        maxPayload:
            MAX_UTTERANCE_BYTES +
            8
    });

server.on(
    "upgrade",
    (request, socket, head) => {
        let pathname;

        try {
            pathname =
                new URL(
                    request.url || "/",
                    "http://localhost"
                ).pathname;
        }
        catch {
            socket.destroy();
            return;
        }

        const origin =
            String(
                request.headers.origin ||
                ""
            );

        if (
            pathname !==
                WEBSOCKET_PATH ||
            origin !==
                ALLOWED_ORIGIN
        ) {
            socket.write(
                "HTTP/1.1 403 Forbidden\r\n" +
                "Connection: close\r\n" +
                "\r\n"
            );
            socket.destroy();
            return;
        }

        sockets.handleUpgrade(
            request,
            socket,
            head,
            webSocket => {
                sockets.emit(
                    "connection",
                    webSocket,
                    request
                );
            }
        );
    }
);

const send =
    (socket, message) => {
        if (
            socket.readyState ===
            WebSocket.OPEN
        ) {
            socket.send(
                JSON.stringify(message)
            );
        }
    };

const fail =
    (socket, options) => {
        send(
            socket,
            errorMessage(options)
        );
    };

function makeUtterance(id) {
    return {
        id,
        chunks: [],
        byteLength: 0,
        lastSequence: -1,
        partialTimer: undefined,
        recognitionRunning: false,
        partialDirty: false,
        partialPasses: 0,
        lastTranscript: "",
        lastRecognizedBytes: 0,
        ended: false,
        cancelled: false
    };
}

function clearPartialTimer(utterance) {
    if (!utterance?.partialTimer) return;
    clearTimeout(utterance.partialTimer);
    utterance.partialTimer = undefined;
}

function schedulePartial(
    socket,
    state,
    utterance
) {
    if (
        utterance.ended ||
        utterance.cancelled ||
        utterance.partialTimer ||
        utterance.partialPasses >=
            MAX_PARTIAL_PASSES ||
        utterance.byteLength <
            PARTIAL_MIN_AUDIO_BYTES ||
        utterance.byteLength <=
            utterance.lastRecognizedBytes
    ) {
        return;
    }

    utterance.partialTimer =
        setTimeout(
            () => {
                utterance.partialTimer =
                    undefined;

                void recognize(
                    socket,
                    state,
                    utterance,
                    false
                );
            },
            PARTIAL_INTERVAL_MS
        );
}

async function recognize(
    socket,
    state,
    utterance,
    final
) {
    const recognitionGrammar =
        buildRecognitionGrammar(
            state.recognitionContext
        );
    if (
        utterance.cancelled ||
        !state.utterances.has(
            utterance.id
        )
    ) {
        return;
    }

    if (utterance.recognitionRunning) {
        utterance.partialDirty = true;
        return;
    }

    if (!utterance.byteLength) {
        if (final) {
            send(
                socket,
                transcriptMessage(
                    "final",
                    utterance.id,
                    ""
                )
            );
            state.utterances.delete(
                utterance.id
            );
        }
        return;
    }

    if (
        final &&
        utterance.lastTranscript &&
        utterance.byteLength ===
            utterance.lastRecognizedBytes &&
        !recognitionGrammar
    ) {
        send(
            socket,
            transcriptMessage(
                "final",
                utterance.id,
                utterance.lastTranscript
            )
        );

        state.utterances.delete(
            utterance.id
        );
        return;
    }

    utterance.recognitionRunning = true;
    utterance.partialDirty = false;

    if (!final) {
        utterance.partialPasses++;
    }

    const snapshot =
        Buffer.concat(
            utterance.chunks,
            utterance.byteLength
        );

    const snapshotBytes =
        snapshot.length;

    try {
        const text =
            await whisper.transcribe(
                snapshot,
                {
                    language:
                        state.language,
                    prompt:
                        buildRecognitionPrompt(
                            state.recognitionContext
                        ),
                    grammar:
                        recognitionGrammar
                            ?.grammar,
                    grammarRule:
                        recognitionGrammar
                            ?.rule,
                    grammarPenalty:
                        recognitionGrammar
                            ? (
                                final
                                    ? FINAL_GRAMMAR_PENALTY
                                    : PARTIAL_GRAMMAR_PENALTY
                            )
                            : undefined
                }
            );

        if (
            utterance.cancelled ||
            !state.utterances.has(
                utterance.id
            )
        ) {
            return;
        }

        utterance.lastRecognizedBytes =
            Math.max(
                utterance.lastRecognizedBytes,
                snapshotBytes
            );

        if (text) {
            utterance.lastTranscript =
                text;
        }

        if (final) {
            send(
                socket,
                transcriptMessage(
                    "final",
                    utterance.id,
                    recognitionGrammar
                        ? text
                        : (
                            text ||
                            utterance.lastTranscript
                        )
                )
            );

            state.utterances.delete(
                utterance.id
            );
            return;
        }

        if (
            text &&
            text !==
                utterance.lastSentTranscript
        ) {
            utterance.lastSentTranscript =
                text;

            send(
                socket,
                transcriptMessage(
                    "partial",
                    utterance.id,
                    text
                )
            );
        }
    }
    catch (error) {
        fail(
            socket,
            {
                utteranceId:
                    utterance.id,
                error:
                    error?.name ||
                    "WhisperError",
                message:
                    error?.message ||
                    String(error)
            }
        );

        if (final) {
            state.utterances.delete(
                utterance.id
            );
        }
    }
    finally {
        utterance.recognitionRunning =
            false;

        if (
            !final &&
            !utterance.ended &&
            !utterance.cancelled &&
            state.utterances.has(
                utterance.id
            ) &&
            (
                utterance.partialDirty ||
                utterance.byteLength >
                    utterance.lastRecognizedBytes
            )
        ) {
            schedulePartial(
                socket,
                state,
                utterance
            );
        }
    }
}

async function finalize(
    socket,
    state,
    utterance
) {
    if (
        !utterance ||
        utterance.cancelled
    ) {
        return;
    }

    utterance.ended = true;
    clearPartialTimer(utterance);

    while (
        utterance.recognitionRunning
    ) {
        await new Promise(
            resolve =>
                setTimeout(resolve, 25)
        );
    }

    await recognize(
        socket,
        state,
        utterance,
        true
    );
}

sockets.on(
    "connection",
    socket => {
        const state = {
            sessionId: undefined,
            language: "en-US",
            recognitionContext: {},
            utterances: new Map(),
            alive: true
        };

        socket.__clockTimerSpeechState =
            state;

        socket.on(
            "message",
            (data, isBinary) => {
                state.alive = true;

                if (
                    isBinary &&
                    !state.sessionId
                ) {
                    fail(
                        socket,
                        {
                            error:
                                "SessionNotStarted",
                            message:
                                "session-start is required before audio."
                        }
                    );
                    socket.close(
                        1008,
                        "session not started"
                    );
                    return;
                }

                if (isBinary) {
                    let packet;

                    try {
                        packet =
                            decodeAudioPacket(data);
                    }
                    catch (error) {
                        fail(
                            socket,
                            {
                                error:
                                    "InvalidAudioPacket",
                                message:
                                    error.message
                            }
                        );
                        return;
                    }

                    const utterance =
                        state.utterances.get(
                            packet.utteranceId
                        );

                    if (
                        !utterance ||
                        utterance.ended ||
                        utterance.cancelled
                    ) {
                        return;
                    }

                    if (
                        packet.sequence <=
                        utterance.lastSequence
                    ) {
                        return;
                    }

                    utterance.lastSequence =
                        packet.sequence;

                    if (
                        utterance.byteLength +
                            packet.pcm.length >
                        MAX_UTTERANCE_BYTES
                    ) {
                        fail(
                            socket,
                            {
                                utteranceId:
                                    utterance.id,
                                error:
                                    "UtteranceTooLong",
                                message:
                                    `Utterance exceeded ${MAX_UTTERANCE_SECONDS} seconds.`
                            }
                        );

                        utterance.cancelled =
                            true;
                        clearPartialTimer(
                            utterance
                        );
                        state.utterances.delete(
                            utterance.id
                        );
                        return;
                    }

                    utterance.chunks.push(
                        Buffer.from(packet.pcm)
                    );

                    utterance.byteLength +=
                        packet.pcm.length;

                    schedulePartial(
                        socket,
                        state,
                        utterance
                    );

                    return;
                }

                let message;

                try {
                    message =
                        parseControlMessage(
                            data.toString("utf8")
                        );
                }
                catch (error) {
                    fail(
                        socket,
                        {
                            error:
                                "InvalidControlMessage",
                            message:
                                error.message
                        }
                    );
                    return;
                }

                if (
                    message.type !==
                        "session-start" &&
                    message.type !==
                        "ping" &&
                    message.type !==
                        "pong" &&
                    !state.sessionId
                ) {
                    fail(
                        socket,
                        {
                            error:
                                "SessionNotStarted",
                            message:
                                "session-start is required before speech control messages."
                        }
                    );
                    socket.close(
                        1008,
                        "session not started"
                    );
                    return;
                }

                if (
                    message.type ===
                    "session-start"
                ) {
                    const audio =
                        message.audio || {};

                    if (
                        audio.encoding !==
                            AUDIO_ENCODING ||
                        Number(audio.sampleRate) !==
                            AUDIO_SAMPLE_RATE ||
                        Number(audio.channels) !==
                            AUDIO_CHANNELS
                    ) {
                        fail(
                            socket,
                            {
                                error:
                                    "UnsupportedAudioFormat",
                                message:
                                    "Speech stream must be mono 16 kHz 16-bit PCM."
                            }
                        );
                        socket.close(
                            1003,
                            "unsupported audio format"
                        );
                        return;
                    }

                    state.sessionId =
                        String(
                            message.sessionId ||
                            ""
                        ).trim();

                    if (!state.sessionId) {
                        fail(
                            socket,
                            {
                                error:
                                    "InvalidSessionId",
                                message:
                                    "sessionId is required."
                            }
                        );
                        socket.close(
                            1008,
                            "invalid session id"
                        );
                        return;
                    }

                    state.language =
                        String(
                            message.language ||
                            "en-US"
                        );

                    state.recognitionContext =
                        message.context &&
                        typeof message.context === "object"
                            ? message.context
                            : {};

                    return;
                }

                if (
                    message.type ===
                    "context-update"
                ) {
                    state.recognitionContext =
                        message.context &&
                        typeof message.context === "object"
                            ? message.context
                            : {};
                    return;
                }

                if (
                    message.type ===
                    "session-end"
                ) {
                    for (
                        const utterance of
                        state.utterances.values()
                    ) {
                        utterance.cancelled =
                            true;
                        clearPartialTimer(
                            utterance
                        );
                    }

                    state.utterances.clear();
                    state.sessionId = undefined;
                    return;
                }

                if (
                    message.type ===
                    "utterance-start"
                ) {
                    const id =
                        Number(
                            message.utteranceId
                        );

                    if (
                        !Number.isInteger(id) ||
                        id < 0
                    ) {
                        fail(
                            socket,
                            {
                                error:
                                    "InvalidUtteranceId",
                                message:
                                    "utteranceId must be a non-negative integer."
                            }
                        );
                        return;
                    }

                    const previous =
                        state.utterances.get(id);

                    if (previous) {
                        previous.cancelled =
                            true;
                        clearPartialTimer(
                            previous
                        );
                    }

                    state.utterances.set(
                        id,
                        makeUtterance(id)
                    );
                    return;
                }

                if (
                    message.type ===
                    "utterance-end"
                ) {
                    const id =
                        Number(
                            message.utteranceId
                        );

                    const utterance =
                        state.utterances.get(id);

                    if (utterance) {
                        void finalize(
                            socket,
                            state,
                            utterance
                        );
                    }
                    return;
                }

                if (
                    message.type ===
                    "utterance-cancel"
                ) {
                    const id =
                        Number(
                            message.utteranceId
                        );

                    const utterance =
                        state.utterances.get(id);

                    if (utterance) {
                        utterance.cancelled =
                            true;
                        clearPartialTimer(
                            utterance
                        );
                        state.utterances.delete(
                            id
                        );
                    }
                    return;
                }

                if (
                    message.type === "ping"
                ) {
                    send(
                        socket,
                        {
                            type: "pong",
                            at: message.at
                        }
                    );
                    return;
                }

                if (
                    message.type === "pong"
                ) {
                    state.alive = true;
                }
            }
        );

        socket.on(
            "close",
            () => {
                for (
                    const utterance of
                        state.utterances.values()
                ) {
                    utterance.cancelled =
                        true;
                    clearPartialTimer(
                        utterance
                    );
                }

                state.utterances.clear();
            }
        );
    }
);

const heartbeat =
    setInterval(
        () => {
            for (
                const socket of
                    sockets.clients
            ) {
                if (
                    socket.readyState !==
                    WebSocket.OPEN
                ) {
                    continue;
                }

                const state =
                    socket.__clockTimerSpeechState;

                if (
                    state &&
                    state.alive === false
                ) {
                    try {
                        socket.terminate();
                    }
                    catch {}
                    continue;
                }

                if (state) {
                    state.alive = false;
                }

                send(
                    socket,
                    {
                        type: "ping",
                        at: Date.now()
                    }
                );
            }
        },
        20000
    );

heartbeat.unref?.();

await whisper.start();

server.listen(
    PORT,
    HOST,
    () => {
        console.log(
            `ClockTimer speech service listening on http://${HOST}:${PORT}`
        );
    }
);

let shuttingDown = false;

const shutdown = signal => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(
        `ClockTimer speech service received ${signal}; shutting down.`
    );

    for (
        const socket of
            sockets.clients
    ) {
        try {
            socket.close(
                1001,
                "server shutting down"
            );
        }
        catch {}
    }

    sockets.close(() => {
        server.close(() => {
            void whisper
                .stop()
                .finally(
                    () =>
                        process.exit(0)
                );
        });
    });

    setTimeout(
        () => {
            void whisper
                .stop()
                .finally(
                    () =>
                        process.exit(1)
                );
        },
        5000
    ).unref?.();
};

process.once(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

process.once(
    "SIGINT",
    () => shutdown("SIGINT")
);
