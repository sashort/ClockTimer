export const AUDIO_SAMPLE_RATE = 16000;
export const AUDIO_CHANNELS = 1;
export const AUDIO_ENCODING = "pcm_s16le";
export const AUDIO_HEADER_BYTES = 8;

const CONTROL_TYPES = new Set([
    "session-start",
    "session-end",
    "context-update",
    "utterance-start",
    "utterance-end",
    "utterance-cancel",
    "ping",
    "pong"
]);

export function parseControlMessage(value) {
    const message =
        typeof value === "string"
            ? JSON.parse(value)
            : value;

    if (
        !message ||
        typeof message !== "object" ||
        !CONTROL_TYPES.has(message.type)
    ) {
        throw new Error("Unsupported speech control message.");
    }

    return message;
}

export function decodeAudioPacket(buffer) {
    const bytes =
        Buffer.isBuffer(buffer)
            ? buffer
            : Buffer.from(buffer);

    if (bytes.length <= AUDIO_HEADER_BYTES) {
        throw new Error("Speech audio packet is too short.");
    }

    const utteranceId =
        bytes.readUInt32LE(0);

    const sequence =
        bytes.readUInt32LE(4);

    const pcm =
        bytes.subarray(AUDIO_HEADER_BYTES);

    if (pcm.length % 2 !== 0) {
        throw new Error("Speech PCM payload must contain 16-bit samples.");
    }

    return {
        utteranceId,
        sequence,
        pcm
    };
}

export function transcriptMessage(
    type,
    utteranceId,
    text
) {
    if (
        type !== "partial" &&
        type !== "final"
    ) {
        throw new Error("Transcript type must be partial or final.");
    }

    return {
        type,
        utteranceId,
        text: String(text || "")
    };
}

export function errorMessage({
    utteranceId,
    error = "SpeechServerError",
    message
} = {}) {
    return {
        type: "error",
        ...(Number.isInteger(utteranceId)
            ? {utteranceId}
            : {}),
        error,
        message:
            String(message || "Speech recognition failed.")
    };
}
