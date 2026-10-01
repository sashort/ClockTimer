(() => {
    "use strict";

    const clamp01 = value =>
        Math.max(
            0,
            Math.min(
                1,
                Number(value) || 0
            )
        );

    class WMOFLiveTripStream extends EventTarget {
        #baseUrl;
        #endpoint;
        #userEndpoint;
        #csrfToken;
        #snapshotProvider;
        #iceServers = [];

        #socket;
        #socketConnectPromise;
        #socketRequests = new Map();
        #socketRequestSequence = 0;
        #socketReconnectTimer;
        #closing = false;

        #publishing = false;
        #publisherPeers = new Map();
        #publisherCandidateQueues = new Map();
        #publisherMicrophoneStream;
        #publisherProgramStream;

        #viewing = false;
        #targetUserId;
        #viewerPeerId;
        #viewerPeer;
        #viewerCandidateQueue = [];
        #viewerRemoteCandidateQueue = [];
        #viewerMicTransceiver;
        #viewerProgramTransceiver;
        #viewerMicAudio;
        #viewerProgramAudio;
        #viewerMuted = false;
        #viewerMasterVolume = 1;
        #viewerMicVolume = 1;
        #viewerProgramVolume = 1;

        constructor({
            baseUrl =
                document.baseURI,
            snapshotProvider
        } = {}) {
            super();

            this.#baseUrl =
                new URL(
                    baseUrl,
                    document.baseURI
                );

            this.#endpoint =
                new URL(
                    "api/live-stream/",
                    this.#baseUrl
                );

            this.#userEndpoint =
                new URL(
                    "api/users/",
                    this.#baseUrl
                );

            this.#snapshotProvider =
                typeof snapshotProvider ===
                    "function"
                    ? snapshotProvider
                    : () => undefined;
        }

        get publishing() {
            return this.#publishing;
        }

        get viewing() {
            return this.#viewing;
        }

        get targetUserId() {
            return this.#targetUserId;
        }

        get viewerMuted() {
            return this.#viewerMuted;
        }

        get viewerMasterVolume() {
            return this.#viewerMasterVolume;
        }

        get viewerMicrophoneVolume() {
            return this.#viewerMicVolume;
        }

        get viewerProgramVolume() {
            return this.#viewerProgramVolume;
        }

        setSnapshotProvider(
            provider
        ) {
            this.#snapshotProvider =
                typeof provider ===
                    "function"
                    ? provider
                    : () => undefined;
        }

        #emit(
            type,
            detail
        ) {
            this.dispatchEvent(
                new CustomEvent(
                    type,
                    {
                        detail
                    }
                )
            );
        }

        #snapshot() {
            try {
                return this
                    .#snapshotProvider?.();
            }
            catch (error) {
                console.warn(
                    "Live stream snapshot failed:",
                    error
                );

                return undefined;
            }
        }

        #preferOpus(
            transceiver
        ) {
            const capabilities =
                globalThis
                    .RTCRtpReceiver
                    ?.getCapabilities?.(
                        "audio"
                    );

            const codecs =
                capabilities
                    ?.codecs ||
                [];

            const opus =
                codecs.filter(
                    codec =>
                        String(
                            codec
                                ?.mimeType ||
                            ""
                        )
                            .toLowerCase() ===
                            "audio/opus"
                );

            if (
                opus.length &&
                typeof transceiver
                    ?.setCodecPreferences ===
                    "function"
            ) {
                try {
                    transceiver
                        .setCodecPreferences(
                            [
                                ...opus,
                                ...codecs.filter(
                                    codec =>
                                        !opus.includes(
                                            codec
                                        )
                                )
                            ]
                        );
                }
                catch {}
            }
        }

        async #ensureCsrf(
            force = false
        ) {
            if (
                this.#csrfToken &&
                !force
            ) {
                return this.#csrfToken;
            }

            const response =
                await fetch(
                    this.#userEndpoint,
                    {
                        credentials:
                            "same-origin",
                        cache:
                            "no-store",
                        headers: {
                            Accept:
                                "application/json"
                        }
                    }
                );

            const data =
                await response.json()
                    .catch(
                        () => ({})
                    );

            if (
                !response.ok ||
                typeof data.csrfToken !==
                    "string" ||
                data.csrfToken.length <
                    32
            ) {
                throw new Error(
                    data.message ||
                    "Unable to authorize live streaming."
                );
            }

            this.#csrfToken =
                data.csrfToken;

            return this.#csrfToken;
        }

        async #requestToken(
            retry = true
        ) {
            const response =
                await fetch(
                    this.#endpoint,
                    {
                        method:
                            "POST",
                        credentials:
                            "same-origin",
                        cache:
                            "no-store",
                        headers: {
                            Accept:
                                "application/json",
                            "Content-Type":
                                "application/json",
                            "X-CSRF-Token":
                                await this
                                    .#ensureCsrf()
                        },
                        body:
                            JSON.stringify({
                                action:
                                    "socket-token"
                            })
                    }
                );

            const data =
                await response.json()
                    .catch(
                        () => ({})
                    );

            if (
                !response.ok &&
                retry &&
                data.error ===
                    "invalid_csrf"
            ) {
                await this
                    .#ensureCsrf(
                        true
                    );

                return this
                    .#requestToken(
                        false
                    );
            }

            if (
                !response.ok ||
                typeof data.token !==
                    "string" ||
                !data.token
            ) {
                const error =
                    new Error(
                        data.message ||
                        data.error ||
                        "Unable to authorize live streaming."
                    );

                error.code =
                    data.error;
                error.status =
                    response.status;

                throw error;
            }

            this.#iceServers =
                Array.isArray(
                    data.iceServers
                )
                    ? data.iceServers
                    : [];

            return data;
        }

        #webSocketUrl(
            data
        ) {
            const path =
                String(
                    data?.websocketPath ||
                    "/live-stream-ws"
                );

            const url =
                new URL(
                    path,
                    this.#baseUrl
                );

            url.protocol =
                url.protocol ===
                    "https:"
                    ? "wss:"
                    : "ws:";

            return url;
        }

        async #ensureSocket() {
            if (
                this.#socket &&
                this.#socket.readyState ===
                    globalThis.WebSocket
                        ?.OPEN
            ) {
                return this.#socket;
            }

            if (
                this
                    .#socketConnectPromise
            ) {
                return this
                    .#socketConnectPromise;
            }

            if (
                typeof globalThis
                    .WebSocket !==
                    "function"
            ) {
                throw new Error(
                    "WebSocket is not supported by this browser."
                );
            }

            this.#closing =
                false;

            this.#socketConnectPromise =
                (async () => {
                    const data =
                        await this
                            .#requestToken();

                    const socket =
                        new WebSocket(
                            this
                                .#webSocketUrl(
                                    data
                                ),
                            [
                                "clocktimer-live",
                                "clocktimer-auth." +
                                    data.token
                            ]
                        );

                    this.#socket =
                        socket;

                    socket.addEventListener(
                        "message",
                        event =>
                            this
                                .#handleSocketMessage(
                                    event
                                )
                    );

                    socket.addEventListener(
                        "close",
                        () =>
                            this
                                .#handleSocketClose()
                    );

                    socket.addEventListener(
                        "error",
                        () =>
                            this.#emit(
                                "error",
                                {
                                    role:
                                        this.#viewing
                                            ? "viewer"
                                            : "publisher",
                                    error:
                                        new Error(
                                            "Live stream WebSocket failed."
                                        )
                                }
                            )
                    );

                    await new Promise(
                        (
                            resolve,
                            reject
                        ) => {
                            const timeout =
                                setTimeout(
                                    () => {
                                        reject(
                                            new Error(
                                                "Live stream WebSocket timed out."
                                            )
                                        );
                                    },
                                    10000
                                );

                            socket.addEventListener(
                                "open",
                                () => {
                                    clearTimeout(
                                        timeout
                                    );
                                    resolve();
                                },
                                {
                                    once:
                                        true
                                }
                            );

                            socket.addEventListener(
                                "close",
                                () => {
                                    clearTimeout(
                                        timeout
                                    );
                                    reject(
                                        new Error(
                                            "Live stream WebSocket closed before connecting."
                                        )
                                    );
                                },
                                {
                                    once:
                                        true
                                }
                            );
                        }
                    );

                    return socket;
                })()
                    .finally(
                        () => {
                            this.#socketConnectPromise =
                                undefined;
                        }
                    );

            return this
                .#socketConnectPromise;
        }

        #socketSend(
            message
        ) {
            const socket =
                this.#socket;

            if (
                !socket ||
                socket.readyState !==
                    WebSocket.OPEN
            ) {
                throw new Error(
                    "The live stream WebSocket is not connected."
                );
            }

            socket.send(
                JSON.stringify(
                    message
                )
            );
        }

        async #socketRequest(
            type,
            payload = {}
        ) {
            await this
                .#ensureSocket();

            const requestId =
                ++this
                    .#socketRequestSequence;

            return new Promise(
                (
                    resolve,
                    reject
                ) => {
                    const timeout =
                        setTimeout(
                            () => {
                                this
                                    .#socketRequests
                                    .delete(
                                        requestId
                                    );

                                reject(
                                    new Error(
                                        "Live stream request timed out."
                                    )
                                );
                            },
                            10000
                        );

                    this
                        .#socketRequests
                        .set(
                            requestId,
                            {
                                resolve,
                                reject,
                                timeout
                            }
                        );

                    try {
                        this.#socketSend({
                            type,
                            requestId,
                            ...payload
                        });
                    }
                    catch (error) {
                        clearTimeout(
                            timeout
                        );

                        this
                            .#socketRequests
                            .delete(
                                requestId
                            );

                        reject(
                            error
                        );
                    }
                }
            );
        }

        #resolveSocketRequest(
            message
        ) {
            const requestId =
                Number(
                    message
                        ?.requestId
                );

            if (
                !Number.isInteger(
                    requestId
                )
            ) {
                return false;
            }

            const pending =
                this
                    .#socketRequests
                    .get(
                        requestId
                    );

            if (!pending) {
                return false;
            }

            clearTimeout(
                pending.timeout
            );

            this
                .#socketRequests
                .delete(
                    requestId
                );

            if (
                message.ok ===
                    false
            ) {
                const error =
                    new Error(
                        message.message ||
                        message.error ||
                        "Live stream request failed."
                    );

                error.code =
                    message.error;

                if (
                    message.error ===
                        "permission_required"
                ) {
                    error.status =
                        403;
                }

                pending.reject(
                    error
                );
            }
            else {
                pending.resolve(
                    message
                );
            }

            return true;
        }

        #handleSocketMessage(
            event
        ) {
            let message;

            try {
                message =
                    JSON.parse(
                        event.data
                    );
            }
            catch {
                return;
            }

            if (
                !message ||
                typeof message !==
                    "object"
            ) {
                return;
            }

            if (
                message.type ===
                    "response"
            ) {
                this
                    .#resolveSocketRequest(
                        message
                    );

                return;
            }

            if (
                message.type ===
                    "peer.offer"
            ) {
                void this
                    .#createPublisherPeer(
                        message
                    )
                    .catch(
                        error =>
                            this.#emit(
                                "error",
                                {
                                    role:
                                        "publisher",
                                    error
                                }
                            )
                    );

                return;
            }

            if (
                message.type ===
                    "peer.answer"
            ) {
                void this
                    .#handleViewerAnswer(
                        message
                    );

                return;
            }

            if (
                message.type ===
                    "peer.candidate"
            ) {
                void this
                    .#handleRemoteCandidate(
                        message
                    );

                return;
            }

            if (
                message.type ===
                    "peer.closed"
            ) {
                this
                    .#handlePeerClosed(
                        message
                    );

                return;
            }

            if (
                message.type ===
                    "publisher.event"
            ) {
                this
                    .#handlePublisherEvent(
                        message
                    );

                return;
            }

            if (
                message.type ===
                    "trainer.tts"
            ) {
                this.#emit(
                    "publisherMessage",
                    {
                        peerId:
                            Number(
                                message.peerId
                            ),
                        type:
                            "trainer.tts",
                        payload: {
                            text:
                                message.text
                        }
                    }
                );
            }
        }

        #handleSocketClose() {
            const wasPublishing =
                this.#publishing;
            const wasViewing =
                this.#viewing;

            this.#socket =
                undefined;

            for (
                const [
                    requestId,
                    pending
                ] of
                this
                    .#socketRequests
            ) {
                clearTimeout(
                    pending.timeout
                );

                pending.reject(
                    new Error(
                        "The live stream WebSocket disconnected."
                    )
                );

                this
                    .#socketRequests
                    .delete(
                        requestId
                    );
            }

            for (
                const [
                    peerId,
                    entry
                ] of
                this
                    .#publisherPeers
            ) {
                this
                    .#closePublisherPeer(
                        peerId,
                        entry
                    );
            }

            if (wasViewing) {
                void this
                    .stopViewing({
                        notifyServer:
                            false
                    });
            }

            if (
                wasPublishing &&
                !this.#closing
            ) {
                clearTimeout(
                    this
                        .#socketReconnectTimer
                );

                this.#socketReconnectTimer =
                    setTimeout(
                        () => {
                            this
                                .#reconnectPublisher()
                                .catch(
                                    error =>
                                        this.#emit(
                                            "error",
                                            {
                                                role:
                                                    "publisher",
                                                error
                                            }
                                        )
                                );
                        },
                        1000
                    );
            }
        }

        async #reconnectPublisher() {
            if (
                !this.#publishing ||
                this.#closing
            ) {
                return;
            }

            await this
                .#ensureSocket();

            await this
                .#socketRequest(
                    "presence.start",
                    {
                        snapshot:
                            this.#snapshot()
                    }
                );

            this.broadcast(
                "snapshot",
                this.#snapshot()
            );
        }

        async listTargets() {
            const data =
                await this
                    .#socketRequest(
                        "targets.request"
                    );

            return Array.isArray(
                data.targets
            )
                ? data.targets
                : [];
        }

        async #acquirePublisherMedia({
            requestMicrophone =
                false
        } = {}) {
            let microphoneStream =
                globalThis
                    .SpeechMenu
                    ?.createMicrophoneStream?.();

            if (
                !microphoneStream &&
                requestMicrophone &&
                navigator
                    .mediaDevices
                    ?.getUserMedia
            ) {
                try {
                    microphoneStream =
                        await navigator
                            .mediaDevices
                            .getUserMedia({
                                audio: {
                                    echoCancellation:
                                        true,
                                    noiseSuppression:
                                        false,
                                    autoGainControl:
                                        false
                                }
                            });
                }
                catch {}
            }

            let programStream;

            try {
                programStream =
                    await globalThis
                        .WMOFAudio
                        ?.createProgramStream?.();
            }
            catch (error) {
                console.warn(
                    "ClockTimer program audio is unavailable:",
                    error
                );
            }

            this.#publisherMicrophoneStream =
                microphoneStream;
            this.#publisherProgramStream =
                programStream;
        }

        #stopStream(
            stream
        ) {
            for (
                const track of
                stream
                    ?.getTracks?.() ||
                []
            ) {
                try {
                    track.stop();
                }
                catch {}
            }
        }

        #stopPublisherMedia() {
            this
                .#stopStream(
                    this
                        .#publisherMicrophoneStream
                );

            this
                .#stopStream(
                    this
                        .#publisherProgramStream
                );

            this.#publisherMicrophoneStream =
                undefined;
            this.#publisherProgramStream =
                undefined;
        }

        async startPublishing({
            requestMicrophone =
                false
        } = {}) {
            if (
                typeof globalThis
                    .RTCPeerConnection !==
                    "function"
            ) {
                throw new Error(
                    "WebRTC is not supported by this browser."
                );
            }

            if (
                this.#publishing
            ) {
                return true;
            }

            await this
                .#ensureSocket();

            await this
                .#acquirePublisherMedia({
                    requestMicrophone
                });

            try {
                await this
                    .#socketRequest(
                        "presence.start",
                        {
                            snapshot:
                                this.#snapshot()
                        }
                    );
            }
            catch (error) {
                this
                    .#stopPublisherMedia();

                throw error;
            }

            this.#publishing =
                true;

            this.#emit(
                "publishingChanged",
                {
                    publishing:
                        true,
                    microphone:
                        Boolean(
                            this
                                .#publisherMicrophoneStream
                                ?.getAudioTracks?.()
                                .length
                        ),
                    programAudio:
                        Boolean(
                            this
                                .#publisherProgramStream
                                ?.getAudioTracks?.()
                                .length
                        )
                }
            );

            return true;
        }

        async refreshPublisherMicrophone() {
            if (
                !this.#publishing
            ) {
                return false;
            }

            const stream =
                globalThis
                    .SpeechMenu
                    ?.createMicrophoneStream?.();

            const track =
                stream
                    ?.getAudioTracks?.()[0];

            if (!track) {
                this
                    .#stopStream(
                        stream
                    );

                return this
                    .clearPublisherMicrophone();
            }

            const previous =
                this
                    .#publisherMicrophoneStream;

            this.#publisherMicrophoneStream =
                stream;

            for (
                const entry of
                this
                    .#publisherPeers
                    .values()
            ) {
                try {
                    await entry
                        .microphoneSender
                        ?.replaceTrack(
                            track
                        );
                }
                catch {}
            }

            if (
                previous &&
                previous !==
                    stream
            ) {
                this
                    .#stopStream(
                        previous
                    );
            }

            return true;
        }

        async clearPublisherMicrophone() {
            for (
                const entry of
                this
                    .#publisherPeers
                    .values()
            ) {
                try {
                    await entry
                        .microphoneSender
                        ?.replaceTrack(
                            null
                        );
                }
                catch {}
            }

            this
                .#stopStream(
                    this
                        .#publisherMicrophoneStream
                );

            this.#publisherMicrophoneStream =
                undefined;

            return true;
        }

        async #createPublisherPeer(
            message
        ) {
            if (
                !this.#publishing
            ) {
                return;
            }

            const peerId =
                Number(
                    message.peerId
                );

            if (
                !Number.isInteger(
                    peerId
                ) ||
                !message.offer
            ) {
                return;
            }

            const existing =
                this
                    .#publisherPeers
                    .get(
                        peerId
                    );

            if (existing) {
                return;
            }

            const pc =
                new RTCPeerConnection({
                    iceServers:
                        this.#iceServers
                });

            const entry = {
                pc,
                microphoneSender:
                    undefined,
                programSender:
                    undefined
            };

            this
                .#publisherPeers
                .set(
                    peerId,
                    entry
                );

            pc.addEventListener(
                "icecandidate",
                event => {
                    if (
                        !event.candidate
                    ) {
                        return;
                    }

                    try {
                        this.#socketSend({
                            type:
                                "peer.candidate",
                            peerId,
                            candidate:
                                event
                                    .candidate
                                    .toJSON()
                        });
                    }
                    catch {}
                }
            );

            await pc
                .setRemoteDescription(
                    message.offer
                );

            const transceivers =
                pc
                    .getTransceivers()
                    .filter(
                        transceiver =>
                            transceiver
                                .receiver
                                ?.track
                                ?.kind ===
                                "audio"
                    );

            const tracks = [
                this
                    .#publisherMicrophoneStream
                    ?.getAudioTracks?.()[0],
                this
                    .#publisherProgramStream
                    ?.getAudioTracks?.()[0]
            ];

            for (
                let index = 0;
                index <
                    tracks.length;
                index++
            ) {
                let transceiver =
                    transceivers[
                        index
                    ];

                if (!transceiver) {
                    transceiver =
                        pc.addTransceiver(
                            "audio",
                            {
                                direction:
                                    "sendonly"
                            }
                        );
                }
                else {
                    transceiver.direction =
                        "sendonly";
                }

                this
                    .#preferOpus(
                        transceiver
                    );

                await transceiver
                    .sender
                    .replaceTrack(
                        tracks[
                            index
                        ] ||
                        null
                    );

                if (
                    index ===
                        0
                ) {
                    entry.microphoneSender =
                        transceiver.sender;
                }
                else {
                    entry.programSender =
                        transceiver.sender;
                }
            }

            const answer =
                await pc
                    .createAnswer();

            await pc
                .setLocalDescription(
                    answer
                );

            this.#socketSend({
                type:
                    "peer.answer",
                peerId,
                answer:
                    pc
                        .localDescription
                        .toJSON()
            });

            const queued =
                this
                    .#publisherCandidateQueues
                    .get(
                        peerId
                    ) ||
                [];

            this
                .#publisherCandidateQueues
                .delete(
                    peerId
                );

            for (
                const candidate of
                queued
            ) {
                await pc
                    .addIceCandidate(
                        candidate
                    );
            }
        }

        #closePublisherPeer(
            peerId,
            entry =
                this
                    .#publisherPeers
                    .get(
                        peerId
                    )
        ) {
            if (!entry) {
                return;
            }

            try {
                entry.pc?.close();
            }
            catch {}

            this
                .#publisherPeers
                .delete(
                    peerId
                );

            this
                .#publisherCandidateQueues
                .delete(
                    peerId
                );
        }

        async #handleViewerAnswer(
            message
        ) {
            const peerId =
                Number(
                    message.peerId
                );

            if (
                !this.#viewing ||
                peerId !==
                    this.#viewerPeerId ||
                !this.#viewerPeer ||
                !message.answer
            ) {
                return;
            }

            if (
                !this
                    .#viewerPeer
                    .remoteDescription
            ) {
                await this
                    .#viewerPeer
                    .setRemoteDescription(
                        message.answer
                    );

                for (
                    const candidate of
                    this
                        .#viewerRemoteCandidateQueue
                        .splice(
                            0
                        )
                ) {
                    await this
                        .#viewerPeer
                        .addIceCandidate(
                            candidate
                        );
                }
            }
        }

        async #handleRemoteCandidate(
            message
        ) {
            const peerId =
                Number(
                    message.peerId
                );
            const candidate =
                message.candidate;

            if (
                !Number.isInteger(
                    peerId
                ) ||
                !candidate
            ) {
                return;
            }

            if (
                this.#viewing &&
                peerId ===
                    this.#viewerPeerId &&
                this.#viewerPeer
            ) {
                if (
                    this
                        .#viewerPeer
                        .remoteDescription
                ) {
                    await this
                        .#viewerPeer
                        .addIceCandidate(
                            candidate
                        );
                }
                else {
                    this
                        .#viewerRemoteCandidateQueue
                        .push(
                            candidate
                        );
                }

                return;
            }

            const entry =
                this
                    .#publisherPeers
                    .get(
                        peerId
                    );

            if (
                entry?.pc
                    ?.remoteDescription
            ) {
                await entry.pc
                    .addIceCandidate(
                        candidate
                    );

                return;
            }

            const queue =
                this
                    .#publisherCandidateQueues
                    .get(
                        peerId
                    ) ||
                [];

            queue.push(
                candidate
            );

            this
                .#publisherCandidateQueues
                .set(
                    peerId,
                    queue
                );
        }

        #handlePeerClosed(
            message
        ) {
            const peerId =
                Number(
                    message.peerId
                );

            if (
                this
                    .#publisherPeers
                    .has(
                        peerId
                    )
            ) {
                this
                    .#closePublisherPeer(
                        peerId
                    );
            }

            if (
                this.#viewing &&
                peerId ===
                    this.#viewerPeerId
            ) {
                void this
                    .stopViewing({
                        notifyServer:
                            false,
                        reason:
                            message.reason
                    });
            }
        }

        broadcast(
            type,
            payload
        ) {
            if (
                !this.#publishing ||
                !this.#socket ||
                this.#socket.readyState !==
                    WebSocket.OPEN
            ) {
                return false;
            }

            try {
                this.#socketSend({
                    type:
                        "publisher.event",
                    eventType:
                        String(type),
                    payload
                });

                return true;
            }
            catch {
                return false;
            }
        }

        async startViewing(
            targetUserId
        ) {
            const target =
                Number(
                    targetUserId
                );

            if (
                !Number.isInteger(
                    target
                ) ||
                target <
                    1
            ) {
                throw new TypeError(
                    "A target user is required."
                );
            }

            if (
                typeof globalThis
                    .RTCPeerConnection !==
                    "function"
            ) {
                throw new Error(
                    "WebRTC is not supported by this browser."
                );
            }

            await this
                .stopViewing();

            await this
                .#ensureSocket();

            const pc =
                new RTCPeerConnection({
                    iceServers:
                        this.#iceServers
                });

            this.#viewerPeer =
                pc;
            this.#targetUserId =
                target;
            this.#viewerCandidateQueue =
                [];
            this.#viewerRemoteCandidateQueue =
                [];

            this.#viewerMicTransceiver =
                pc.addTransceiver(
                    "audio",
                    {
                        direction:
                            "recvonly"
                    }
                );

            this.#viewerProgramTransceiver =
                pc.addTransceiver(
                    "audio",
                    {
                        direction:
                            "recvonly"
                    }
                );

            this
                .#preferOpus(
                    this
                        .#viewerMicTransceiver
                );

            this
                .#preferOpus(
                    this
                        .#viewerProgramTransceiver
                );

            pc.addEventListener(
                "track",
                event =>
                    this
                        .#attachViewerTrack(
                            event
                        )
            );

            pc.addEventListener(
                "icecandidate",
                event => {
                    if (
                        !event.candidate
                    ) {
                        return;
                    }

                    const candidate =
                        event
                            .candidate
                            .toJSON();

                    if (
                        !this
                            .#viewerPeerId
                    ) {
                        this
                            .#viewerCandidateQueue
                            .push(
                                candidate
                            );

                        return;
                    }

                    try {
                        this.#socketSend({
                            type:
                                "peer.candidate",
                            peerId:
                                this
                                    .#viewerPeerId,
                            candidate
                        });
                    }
                    catch {}
                }
            );

            pc.addEventListener(
                "connectionstatechange",
                () =>
                    this.#emit(
                        "viewerChanged",
                        {
                            viewing:
                                this.#viewing,
                            targetUserId:
                                this
                                    .#targetUserId,
                            state:
                                pc.connectionState
                        }
                    )
            );

            const offer =
                await pc
                    .createOffer();

            await pc
                .setLocalDescription(
                    offer
                );

            let data;

            try {
                data =
                    await this
                        .#socketRequest(
                            "peer.join",
                            {
                                targetUserId:
                                    target,
                                offer:
                                    pc
                                        .localDescription
                                        .toJSON()
                            }
                        );
            }
            catch (error) {
                try {
                    pc.close();
                }
                catch {}

                this.#viewerPeer =
                    undefined;
                this.#targetUserId =
                    undefined;

                throw error;
            }

            this.#viewerPeerId =
                Number(
                    data.peerId
                );
            this.#viewing =
                true;

            for (
                const candidate of
                this
                    .#viewerCandidateQueue
                    .splice(
                        0
                    )
            ) {
                this.#socketSend({
                    type:
                        "peer.candidate",
                    peerId:
                        this
                            .#viewerPeerId,
                    candidate
                });
            }

            if (
                data.snapshot
            ) {
                this
                    .#emit(
                        "snapshot",
                        {
                            targetUserId:
                                target,
                            snapshot:
                                data.snapshot
                        }
                    );
            }

            this
                .#emit(
                    "viewerChanged",
                    {
                        viewing:
                            true,
                        targetUserId:
                            target,
                        peerId:
                            this
                                .#viewerPeerId,
                        state:
                            pc.connectionState
                    }
                );

            return true;
        }

        #handlePublisherEvent(
            message
        ) {
            if (
                !this.#viewing ||
                Number(
                    message.peerId
                ) !==
                    this.#viewerPeerId
            ) {
                return;
            }

            const type =
                String(
                    message.eventType ||
                    ""
                );
            const payload =
                message.payload;

            if (
                type ===
                    "snapshot"
            ) {
                this.#emit(
                    "snapshot",
                    {
                        targetUserId:
                            this
                                .#targetUserId,
                        snapshot:
                            payload
                    }
                );
            }

            if (
                type ===
                    "tts"
            ) {
                this
                    .#playRemoteTts(
                        payload
                    );
            }

            this.#emit(
                "message",
                {
                    targetUserId:
                        this
                            .#targetUserId,
                    type,
                    payload,
                    timestamp:
                        message.timestamp
                }
            );
        }

        #playRemoteTts(
            payload
        ) {
            if (
                this.#viewerMuted ||
                !payload?.text
            ) {
                return;
            }

            const volume =
                clamp01(
                    (
                        Number(
                            payload.volume
                        ) ||
                        1
                    ) *
                    this
                        .#viewerMasterVolume *
                    this
                        .#viewerProgramVolume
                );

            globalThis
                .WMOFAudio
                ?.speak?.(
                    payload.text,
                    {
                        lang:
                            payload.lang,
                        rate:
                            payload.rate,
                        pitch:
                            payload.pitch,
                        volume,
                        speechVolume:
                            1,
                        speechVelocity:
                            1,
                        voiceProvider:
                            payload
                                .voiceProvider,
                        voice:
                            payload.voice,
                        broadcast:
                            false
                    }
                );
        }

        #attachViewerTrack(
            event
        ) {
            const microphone =
                event.transceiver ===
                    this
                        .#viewerMicTransceiver;

            const audio =
                document
                    .createElement(
                        "audio"
                    );

            audio.autoplay =
                true;
            audio.playsInline =
                true;
            audio.hidden =
                true;
            audio.srcObject =
                new MediaStream([
                    event.track
                ]);

            document.body
                .append(
                    audio
                );

            if (microphone) {
                this.#viewerMicAudio
                    ?.remove?.();

                this.#viewerMicAudio =
                    audio;
            }
            else {
                this.#viewerProgramAudio
                    ?.remove?.();

                this.#viewerProgramAudio =
                    audio;
            }

            this
                .#applyViewerVolumes();

            void audio
                .play?.()
                .catch(
                    () => {}
                );
        }

        #applyViewerVolumes() {
            if (
                this
                    .#viewerMicAudio
            ) {
                this
                    .#viewerMicAudio
                    .muted =
                    this
                        .#viewerMuted;

                this
                    .#viewerMicAudio
                    .volume =
                    clamp01(
                        this
                            .#viewerMasterVolume *
                        this
                            .#viewerMicVolume
                    );
            }

            if (
                this
                    .#viewerProgramAudio
            ) {
                this
                    .#viewerProgramAudio
                    .muted =
                    this
                        .#viewerMuted;

                this
                    .#viewerProgramAudio
                    .volume =
                    clamp01(
                        this
                            .#viewerMasterVolume *
                        this
                            .#viewerProgramVolume
                    );
            }
        }

        setViewerMuted(
            value
        ) {
            this.#viewerMuted =
                Boolean(
                    value
                );

            this
                .#applyViewerVolumes();

            this.#emit(
                "volumeChanged",
                {}
            );
        }

        setViewerMasterVolume(
            value
        ) {
            this.#viewerMasterVolume =
                clamp01(
                    value
                );

            this
                .#applyViewerVolumes();

            this.#emit(
                "volumeChanged",
                {}
            );
        }

        setViewerMicrophoneVolume(
            value
        ) {
            this.#viewerMicVolume =
                clamp01(
                    value
                );

            this
                .#applyViewerVolumes();

            this.#emit(
                "volumeChanged",
                {}
            );
        }

        setViewerProgramVolume(
            value
        ) {
            this.#viewerProgramVolume =
                clamp01(
                    value
                );

            this
                .#applyViewerVolumes();

            this.#emit(
                "volumeChanged",
                {}
            );
        }

        async sendToPublisher(
            type,
            payload
        ) {
            if (
                !this.#viewing ||
                !this.#viewerPeerId ||
                !this.#targetUserId
            ) {
                throw new Error(
                    "The live stream is not connected."
                );
            }

            if (
                type !==
                    "trainer.tts"
            ) {
                throw new TypeError(
                    "Unsupported viewer message type."
                );
            }

            const text =
                String(
                    payload?.text ||
                    ""
                )
                    .trim()
                    .slice(
                        0,
                        500
                    );

            if (!text) {
                throw new TypeError(
                    "Trainer TTS text is required."
                );
            }

            return this
                .#socketRequest(
                    "trainer.tts",
                    {
                        peerId:
                            this
                                .#viewerPeerId,
                        targetUserId:
                            this
                                .#targetUserId,
                        text
                    }
                );
        }

        async stopViewing({
            notifyServer =
                true,
            reason =
                "closed"
        } = {}) {
            const wasViewing =
                this.#viewing;
            const peerId =
                this.#viewerPeerId;
            const targetUserId =
                this.#targetUserId;

            this.#viewing =
                false;

            if (
                notifyServer &&
                peerId &&
                this.#socket?.readyState ===
                    WebSocket.OPEN
            ) {
                try {
                    this.#socketSend({
                        type:
                            "peer.leave",
                        peerId
                    });
                }
                catch {}
            }

            try {
                this
                    .#viewerPeer
                    ?.close();
            }
            catch {}

            for (
                const audio of [
                    this.#viewerMicAudio,
                    this.#viewerProgramAudio
                ]
            ) {
                if (!audio) {
                    continue;
                }

                try {
                    audio.pause();
                }
                catch {}

                audio.srcObject =
                    null;
                audio.remove();
            }

            this.#viewerPeer =
                undefined;
            this.#viewerPeerId =
                undefined;
            this.#targetUserId =
                undefined;
            this.#viewerMicTransceiver =
                undefined;
            this.#viewerProgramTransceiver =
                undefined;
            this.#viewerMicAudio =
                undefined;
            this.#viewerProgramAudio =
                undefined;
            this.#viewerCandidateQueue =
                [];
            this.#viewerRemoteCandidateQueue =
                [];

            if (
                wasViewing
            ) {
                this.#emit(
                    "viewerChanged",
                    {
                        viewing:
                            false,
                        targetUserId,
                        peerId,
                        state:
                            reason
                    }
                );
            }
        }

        async stopPublishing() {
            const wasPublishing =
                this.#publishing;

            this.#publishing =
                false;

            if (
                this.#socket?.readyState ===
                    WebSocket.OPEN
            ) {
                try {
                    await this
                        .#socketRequest(
                            "presence.stop"
                        );
                }
                catch {}
            }

            for (
                const [
                    peerId,
                    entry
                ] of
                this
                    .#publisherPeers
            ) {
                this
                    .#closePublisherPeer(
                        peerId,
                        entry
                    );
            }

            this
                .#stopPublisherMedia();

            if (
                wasPublishing
            ) {
                this.#emit(
                    "publishingChanged",
                    {
                        publishing:
                            false
                    }
                );
            }
        }

        #closeSocket() {
            clearTimeout(
                this
                    .#socketReconnectTimer
            );

            this.#socketReconnectTimer =
                undefined;
            this.#closing =
                true;

            try {
                this
                    .#socket
                    ?.close();
            }
            catch {}

            this.#socket =
                undefined;
        }

        async close() {
            this.#closing =
                true;

            await Promise.all([
                this.stopViewing(),
                this.stopPublishing()
            ]);

            this
                .#closeSocket();
        }
    }

    globalThis.WMOFLiveTripStream =
        WMOFLiveTripStream;
})();
