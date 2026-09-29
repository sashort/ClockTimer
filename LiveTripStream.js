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
        #sequence = 0;

        #publishing = false;
        #publisherSessionId;
        #publisherPollTimer;
        #publisherHeartbeatTimer;
        #publisherSignalId = 0;
        #publisherPeers = new Map();
        #publisherMicrophoneStream;
        #publisherProgramStream;
        #publisherOwnMicrophone = false;

        #viewing = false;
        #targetUserId;
        #viewerPeerId;
        #viewerPeer;
        #viewerDataChannel;
        #viewerPollTimer;
        #viewerHeartbeatTimer;
        #viewerSignalId = 0;
        #viewerMessageId = 0;
        #viewerLastSequence = 0;
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

        #preferOpus(
            transceiver
        ) {
            const codecs =
                globalThis
                    .RTCRtpReceiver
                    ?.getCapabilities?.(
                        "audio"
                    )
                    ?.codecs;

            const opus =
                Array.isArray(
                    codecs
                )
                    ? codecs
                        .filter(
                            codec =>
                                String(
                                    codec
                                        ?.mimeType ||
                                    ""
                                )
                                    .toLowerCase() ===
                                    "audio/opus"
                        )
                    : [];

            if (
                opus.length &&
                typeof transceiver
                    ?.setCodecPreferences ===
                    "function"
            ) {
                try {
                    transceiver
                        .setCodecPreferences(
                            opus
                        );
                }
                catch {}
            }
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

        async #request(
            method,
            {
                query,
                body,
                retry = true
            } = {}
        ) {
            const url =
                new URL(
                    this.#endpoint
                );

            for (
                const [
                    key,
                    value
                ] of
                Object.entries(
                    query ||
                    {}
                )
            ) {
                if (
                    value !== undefined &&
                    value !== null
                ) {
                    url.searchParams.set(
                        key,
                        String(
                            value
                        )
                    );
                }
            }

            const headers = {
                Accept:
                    "application/json"
            };

            if (
                method !==
                    "GET"
            ) {
                headers[
                    "Content-Type"
                ] =
                    "application/json";

                headers[
                    "X-CSRF-Token"
                ] =
                    await this.#ensureCsrf();
            }

            const response =
                await fetch(
                    url,
                    {
                        method,
                        credentials:
                            "same-origin",
                        cache:
                            "no-store",
                        headers,
                        body:
                            body === undefined
                                ? undefined
                                : JSON.stringify(
                                    body
                                )
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
                method !==
                    "GET" &&
                data.error ===
                    "invalid_csrf"
            ) {
                await this.#ensureCsrf(
                    true
                );

                return this.#request(
                    method,
                    {
                        query,
                        body,
                        retry:
                            false
                    }
                );
            }

            if (!response.ok) {
                const error =
                    new Error(
                        data.message ||
                        data.error ||
                        "Live stream request failed."
                    );

                error.code =
                    data.error;
                error.status =
                    response.status;

                throw error;
            }

            return data;
        }

        async listTargets() {
            const data =
                await this.#request(
                    "GET",
                    {
                        query: {
                            action:
                                "targets"
                        }
                    }
                );

            this.#iceServers =
                Array.isArray(
                    data.iceServers
                )
                    ? data.iceServers
                    : [];

            const targets =
                Array.isArray(
                    data.targets
                )
                    ? data.targets
                    : [];

            this.#emit(
                "targetsChanged",
                {
                    targets
                }
            );

            return targets;
        }

        async #acquirePublisherMedia({
            requestMicrophone =
                true
        } = {}) {
            let microphoneStream =
                globalThis
                    .SpeechMenu
                    ?.createMicrophoneStream?.();

            let ownMicrophone =
                false;

            if (
                !microphoneStream &&
                requestMicrophone &&
                navigator.mediaDevices
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

                    ownMicrophone =
                        true;
                }
                catch (error) {
                    console.warn(
                        "Live microphone audio is unavailable:",
                        error
                    );
                }
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
            this.#publisherOwnMicrophone =
                ownMicrophone;
        }

        #stopPublisherMedia() {
            for (
                const stream of [
                    this.#publisherMicrophoneStream,
                    this.#publisherProgramStream
                ]
            ) {
                for (
                    const track of
                    stream?.getTracks?.() ||
                    []
                ) {
                    try {
                        track.stop();
                    }
                    catch {}
                }
            }

            this.#publisherMicrophoneStream =
                undefined;
            this.#publisherProgramStream =
                undefined;
            this.#publisherOwnMicrophone =
                false;
        }

        async refreshPublisherMicrophone() {
            if (!this.#publishing) {
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
                for (
                    const mediaTrack of
                    stream?.getTracks?.() ||
                    []
                ) {
                    try {
                        mediaTrack.stop();
                    }
                    catch {}
                }

                await this
                    .clearPublisherMicrophone();

                return false;
            }

            const previous =
                this.#publisherMicrophoneStream;

            this.#publisherMicrophoneStream =
                stream;
            this.#publisherOwnMicrophone =
                false;

            for (
                const entry of
                this.#publisherPeers
                    .values()
            ) {
                try {
                    await entry
                        .microphoneSender
                        ?.replaceTrack(
                            track
                        );
                }
                catch (error) {
                    console.warn(
                        "Unable to refresh live microphone track:",
                        error
                    );
                }
            }

            if (
                previous &&
                previous !==
                    stream
            ) {
                for (
                    const mediaTrack of
                    previous.getTracks?.() ||
                    []
                ) {
                    try {
                        mediaTrack.stop();
                    }
                    catch {}
                }
            }

            this.#emit(
                "publisherMediaChanged",
                {
                    microphone:
                        true,
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

        async clearPublisherMicrophone() {
            for (
                const entry of
                this.#publisherPeers
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

            const stream =
                this.#publisherMicrophoneStream;

            this.#publisherMicrophoneStream =
                undefined;
            this.#publisherOwnMicrophone =
                false;

            for (
                const track of
                stream?.getTracks?.() ||
                []
            ) {
                try {
                    track.stop();
                }
                catch {}
            }

            this.#emit(
                "publisherMediaChanged",
                {
                    microphone:
                        false,
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

        async startPublishing({
            requestMicrophone =
                true
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

            if (this.#publishing) {
                return true;
            }

            await this
                .#acquirePublisherMedia({
                    requestMicrophone
                });

            let data;

            try {
                data =
                    await this.#request(
                        "POST",
                        {
                            body: {
                                action:
                                    "publish",
                                snapshot:
                                    this.#snapshot()
                            }
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
            this.#publisherSessionId =
                data.sessionId;
            this.#iceServers =
                Array.isArray(
                    data.iceServers
                )
                    ? data.iceServers
                    : this.#iceServers;
            this.#publisherSignalId =
                0;

            this.#publisherPollTimer =
                setInterval(
                    () =>
                        void this
                            .#publisherTick()
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
                            ),
                    750
                );

            this.#publisherHeartbeatTimer =
                setInterval(
                    () =>
                        void this
                            .#publisherHeartbeat()
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
                            ),
                    15000
                );

            await this
                .#publisherTick();

            this.#emit(
                "publishingChanged",
                {
                    publishing:
                        true,
                    sessionId:
                        this.#publisherSessionId,
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

        async #publisherHeartbeat() {
            if (!this.#publishing) {
                return;
            }

            await this.#request(
                "POST",
                {
                    body: {
                        action:
                            "heartbeat",
                        snapshot:
                            this.#snapshot()
                    }
                }
            );
        }

        async #publisherTick() {
            if (!this.#publishing) {
                return;
            }

            const data =
                await this.#request(
                    "GET",
                    {
                        query: {
                            action:
                                "publisher",
                            afterSignalId:
                                this.#publisherSignalId
                        }
                    }
                );

            if (!data.session) {
                await this.stopPublishing({
                    notifyServer:
                        false
                });

                return;
            }

            this.#iceServers =
                Array.isArray(
                    data.iceServers
                )
                    ? data.iceServers
                    : this.#iceServers;

            const livePeerIds =
                new Set();

            for (
                const peer of
                data.peers ||
                []
            ) {
                livePeerIds.add(
                    Number(
                        peer.peerId
                    )
                );

                if (
                    !this
                        .#publisherPeers
                        .has(
                            Number(
                                peer.peerId
                            )
                        )
                ) {
                    await this
                        .#createPublisherPeer(
                            peer
                        );
                }
            }

            for (
                const [
                    peerId,
                    entry
                ] of
                this.#publisherPeers
            ) {
                if (
                    !livePeerIds
                        .has(
                            peerId
                        )
                ) {
                    this
                        .#closePublisherPeer(
                            peerId,
                            entry
                        );
                }
            }

            for (
                const signal of
                data.signals ||
                []
            ) {
                this.#publisherSignalId =
                    Math.max(
                        this
                            .#publisherSignalId,
                        Number(
                            signal.id
                        ) ||
                        0
                    );

                const entry =
                    this
                        .#publisherPeers
                        .get(
                            Number(
                                signal.peerId
                            )
                        );

                if (
                    !entry ||
                    !signal.candidate
                ) {
                    continue;
                }

                try {
                    await entry.pc
                        .addIceCandidate(
                            signal.candidate
                        );
                }
                catch (error) {
                    console.warn(
                        "Unable to add viewer ICE candidate:",
                        error
                    );
                }
            }

            for (
                const message of
                data.messages ||
                []
            ) {
                this.#publisherSignalId =
                    Math.max(
                        this
                            .#publisherSignalId,
                        Number(
                            message.id
                        ) ||
                        0
                    );

                this.#emit(
                    "publisherMessage",
                    {
                        peerId:
                            Number(
                                message.peerId
                            ),
                        type:
                            message.type,
                        payload:
                            message.payload
                    }
                );
            }
        }

        async #createPublisherPeer(
            peer
        ) {
            const peerId =
                Number(
                    peer.peerId
                );

            const pc =
                new RTCPeerConnection({
                    iceServers:
                        this.#iceServers
                });

            const entry = {
                pc,
                channel:
                    undefined,
                microphoneSender:
                    undefined,
                programSender:
                    undefined,
                viewerUserId:
                    Number(
                        peer.viewerUserId
                    ),
                viewerName:
                    peer.viewerName ||
                    peer.viewerUsername ||
                    "Viewer"
            };

            this.#publisherPeers
                .set(
                    peerId,
                    entry
                );

            pc.addEventListener(
                "icecandidate",
                event => {
                    if (!event.candidate) {
                        return;
                    }

                    void this
                        .#request(
                            "POST",
                            {
                                body: {
                                    action:
                                        "candidate",
                                    peerId,
                                    candidate:
                                        event
                                            .candidate
                                            .toJSON()
                                }
                            }
                        )
                        .catch(
                            error =>
                                console.warn(
                                    "Unable to send publisher ICE candidate:",
                                    error
                                )
                        );
                }
            );

            pc.addEventListener(
                "datachannel",
                event => {
                    entry.channel =
                        event.channel;

                    this
                        .#configurePublisherChannel(
                            entry.channel
                        );
                }
            );

            pc.addEventListener(
                "connectionstatechange",
                () =>
                    this.#emit(
                        "publisherPeerChanged",
                        {
                            peerId,
                            viewerUserId:
                                entry
                                    .viewerUserId,
                            viewerName:
                                entry
                                    .viewerName,
                            state:
                                pc.connectionState
                        }
                    )
            );

            await pc
                .setRemoteDescription(
                    peer.offer
                );

            const audioTransceivers =
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

            const sourceTracks = [
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
                    sourceTracks.length;
                index++
            ) {
                const track =
                    sourceTracks[index];

                let transceiver =
                    audioTransceivers[
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

                this.#preferOpus(
                    transceiver
                );

                await transceiver
                    .sender
                    .replaceTrack(
                        track ||
                        null
                    );

                if (index === 0) {
                    entry.microphoneSender =
                        transceiver.sender;
                }
                else if (
                    index ===
                        1
                ) {
                    entry.programSender =
                        transceiver.sender;
                }
            }

            const answer =
                await pc.createAnswer();

            await pc
                .setLocalDescription(
                    answer
                );

            await this.#request(
                "POST",
                {
                    body: {
                        action:
                            "answer",
                        peerId,
                        answer:
                            pc
                                .localDescription
                                .toJSON()
                    }
                }
            );

            this.#emit(
                "publisherPeerChanged",
                {
                    peerId,
                    viewerUserId:
                        entry.viewerUserId,
                    viewerName:
                        entry.viewerName,
                    state:
                        "answering"
                }
            );
        }

        #configurePublisherChannel(
            channel
        ) {
            channel.addEventListener(
                "open",
                () => {
                    this
                        .#sendChannelEnvelope(
                            channel,
                            "snapshot",
                            this.#snapshot()
                        );
                }
            );
        }

        #closePublisherPeer(
            peerId,
            entry =
                this.#publisherPeers
                    .get(
                        peerId
                    )
        ) {
            if (!entry) {
                return;
            }

            try {
                entry.channel?.close();
            }
            catch {}

            try {
                entry.pc?.close();
            }
            catch {}

            this.#emit(
                "publisherPeerChanged",
                {
                    peerId,
                    viewerUserId:
                        entry.viewerUserId,
                    viewerName:
                        entry.viewerName,
                    state:
                        "closed"
                }
            );

            this.#publisherPeers
                .delete(
                    peerId
                );
        }

        async stopPublishing({
            notifyServer = true
        } = {}) {
            clearInterval(
                this.#publisherPollTimer
            );
            clearInterval(
                this.#publisherHeartbeatTimer
            );
            this.#publisherPollTimer =
                undefined;
            this.#publisherHeartbeatTimer =
                undefined;

            for (
                const [
                    peerId,
                    entry
                ] of
                this.#publisherPeers
            ) {
                this
                    .#closePublisherPeer(
                        peerId,
                        entry
                    );
            }

            const wasPublishing =
                this.#publishing;

            this.#publishing =
                false;
            this.#publisherSessionId =
                undefined;
            this.#publisherSignalId =
                0;

            this
                .#stopPublisherMedia();

            if (
                wasPublishing &&
                notifyServer
            ) {
                try {
                    await this.#request(
                        "DELETE",
                        {
                            body: {
                                action:
                                    "unpublish"
                            }
                        }
                    );
                }
                catch (error) {
                    console.warn(
                        "Unable to close live stream session:",
                        error
                    );
                }
            }

            if (wasPublishing) {
                this.#emit(
                    "publishingChanged",
                    {
                        publishing:
                            false
                    }
                );
            }
        }

        #sendChannelEnvelope(
            channel,
            type,
            payload
        ) {
            if (
                !channel ||
                channel.readyState !==
                    "open"
            ) {
                return false;
            }

            const envelope = {
                sequence:
                    ++this.#sequence,
                type:
                    String(type),
                timestamp:
                    new Date()
                        .toISOString(),
                payload
            };

            try {
                channel.send(
                    JSON.stringify(
                        envelope
                    )
                );

                return envelope;
            }
            catch {
                return false;
            }
        }

        broadcast(
            type,
            payload,
            {
                persist = false
            } = {}
        ) {
            if (!this.#publishing) {
                return false;
            }

            let envelope;

            for (
                const entry of
                this
                    .#publisherPeers
                    .values()
            ) {
                const sent =
                    this
                        .#sendChannelEnvelope(
                            entry.channel,
                            type,
                            payload
                        );

                if (
                    sent &&
                    !envelope
                ) {
                    envelope =
                        sent;
                }
            }

            if (
                persist
            ) {
                const storedEnvelope =
                    envelope || {
                        sequence:
                            ++this.#sequence,
                        type:
                            String(type),
                        timestamp:
                            new Date()
                                .toISOString(),
                        payload
                    };

                void this.#request(
                    "POST",
                    {
                        body: {
                            action:
                                "message",
                            type:
                                String(type),
                            payload:
                                storedEnvelope
                        }
                    }
                ).catch(
                    error =>
                        console.warn(
                            "Unable to persist live stream message:",
                            error
                        )
                );

                envelope =
                    storedEnvelope;
            }

            return envelope || false;
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

            await this.stopViewing();

            if (
                this.#iceServers
                    .length ===
                    0
            ) {
                await this.listTargets();
            }

            const pc =
                new RTCPeerConnection({
                    iceServers:
                        this.#iceServers
                });

            this.#viewerPeer =
                pc;
            this.#targetUserId =
                target;
            this.#viewerSignalId =
                0;
            this.#viewerMessageId =
                0;
            this.#viewerLastSequence =
                0;
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

            this.#preferOpus(
                this
                    .#viewerMicTransceiver
            );

            this.#preferOpus(
                this
                    .#viewerProgramTransceiver
            );

            this.#viewerDataChannel =
                pc.createDataChannel(
                    "clocktimer-live",
                    {
                        ordered:
                            true
                    }
                );

            this
                .#configureViewerChannel(
                    this
                        .#viewerDataChannel
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
                    if (!event.candidate) {
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

                    void this
                        .#sendViewerCandidate(
                            candidate
                        );
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
                await pc.createOffer();

            await pc
                .setLocalDescription(
                    offer
                );

            let data;

            try {
                data =
                    await this.#request(
                        "POST",
                        {
                            body: {
                                action:
                                    "join",
                                targetUserId:
                                    target,
                                offer:
                                    pc
                                        .localDescription
                                        .toJSON()
                            }
                        }
                    );
            }
            catch (error) {
                await this.stopViewing({
                    notifyServer:
                        false
                });

                throw error;
            }

            this.#viewerPeerId =
                Number(
                    data.peerId
                );
            this.#viewerMessageId =
                Math.max(
                    0,
                    Number(
                        data.messageCursor
                    ) ||
                    0
                );
            this.#viewing =
                true;

            for (
                const candidate of
                this
                    .#viewerCandidateQueue
                    .splice(0)
            ) {
                await this
                    .#sendViewerCandidate(
                        candidate
                    );
            }

            if (data.snapshot) {
                this.#emit(
                    "snapshot",
                    {
                        targetUserId:
                            target,
                        snapshot:
                            data.snapshot
                    }
                );
            }

            this.#viewerPollTimer =
                setInterval(
                    () =>
                        void this
                            .#viewerTick()
                            .catch(
                                error => {
                                    this.#emit(
                                        "error",
                                        {
                                            role:
                                                "viewer",
                                            error
                                        }
                                    );

                                    if (
                                        [
                                            403,
                                            404,
                                            410
                                        ].includes(
                                            Number(
                                                error
                                                    ?.status
                                            )
                                        )
                                    ) {
                                        void this
                                            .stopViewing({
                                                notifyServer:
                                                    false
                                            });
                                    }
                                }
                            ),
                    750
                );

            this.#viewerHeartbeatTimer =
                setInterval(
                    () =>
                        void this
                            .#viewerHeartbeat()
                            .catch(
                                error => {
                                    this.#emit(
                                        "error",
                                        {
                                            role:
                                                "viewer",
                                            error
                                        }
                                    );

                                    if (
                                        Number(
                                            error
                                                ?.status
                                        ) ===
                                            403
                                    ) {
                                        void this
                                            .stopViewing({
                                                notifyServer:
                                                    false
                                            });
                                    }
                                }
                            ),
                    15000
                );

            await this
                .#viewerTick();

            this.#emit(
                "viewerChanged",
                {
                    viewing:
                        true,
                    targetUserId:
                        target,
                    peerId:
                        this.#viewerPeerId,
                    state:
                        pc.connectionState
                }
            );

            return true;
        }

        async #sendViewerCandidate(
            candidate
        ) {
            if (
                !this.#viewerPeerId ||
                !this.#targetUserId
            ) {
                return;
            }

            await this.#request(
                "POST",
                {
                    body: {
                        action:
                            "candidate",
                        targetUserId:
                            this
                                .#targetUserId,
                        peerId:
                            this
                                .#viewerPeerId,
                        candidate
                    }
                }
            );
        }

        async #viewerHeartbeat() {
            if (
                !this.#viewing ||
                !this.#viewerPeerId ||
                !this.#targetUserId
            ) {
                return;
            }

            await this.#request(
                "POST",
                {
                    body: {
                        action:
                            "heartbeat",
                        targetUserId:
                            this
                                .#targetUserId,
                        peerId:
                            this
                                .#viewerPeerId
                    }
                }
            );
        }

        async #viewerTick() {
            if (
                !this.#viewing ||
                !this.#viewerPeerId ||
                !this.#targetUserId
            ) {
                return;
            }

            const data =
                await this.#request(
                    "GET",
                    {
                        query: {
                            action:
                                "viewer",
                            targetUserId:
                                this
                                    .#targetUserId,
                            peerId:
                                this
                                    .#viewerPeerId,
                            afterSignalId:
                                this
                                    .#viewerSignalId,
                            afterMessageId:
                                this
                                    .#viewerMessageId
                        }
                    }
                );

            if (
                data.answer &&
                !this
                    .#viewerPeer
                    ?.remoteDescription
            ) {
                await this
                    .#viewerPeer
                    .setRemoteDescription(
                        data.answer
                    );

                for (
                    const candidate of
                    this
                        .#viewerRemoteCandidateQueue
                        .splice(0)
                ) {
                    await this
                        .#viewerPeer
                        .addIceCandidate(
                            candidate
                        );
                }
            }

            for (
                const signal of
                data.signals ||
                []
            ) {
                this.#viewerSignalId =
                    Math.max(
                        this
                            .#viewerSignalId,
                        Number(
                            signal.id
                        ) ||
                        0
                    );

                if (!signal.candidate) {
                    continue;
                }

                if (
                    !this
                        .#viewerPeer
                        ?.remoteDescription
                ) {
                    this
                        .#viewerRemoteCandidateQueue
                        .push(
                            signal.candidate
                        );

                    continue;
                }

                await this
                    .#viewerPeer
                    .addIceCandidate(
                        signal.candidate
                    );
            }

            for (
                const message of
                data.messages ||
                []
            ) {
                this.#viewerMessageId =
                    Math.max(
                        this
                            .#viewerMessageId,
                        Number(
                            message.id
                        ) ||
                        0
                    );

                this
                    .#handleEnvelope(
                        message.payload
                    );
            }

            if (data.snapshot) {
                this.#emit(
                    "snapshot",
                    {
                        targetUserId:
                            this
                                .#targetUserId,
                        snapshot:
                            data.snapshot
                    }
                );
            }
        }

        #configureViewerChannel(
            channel
        ) {
            channel.addEventListener(
                "message",
                event => {
                    try {
                        this
                            .#handleEnvelope(
                                JSON.parse(
                                    event.data
                                )
                            );
                    }
                    catch (error) {
                        console.warn(
                            "Invalid live stream data message:",
                            error
                        );
                    }
                }
            );

            channel.addEventListener(
                "open",
                () =>
                    this.#emit(
                        "viewerChanged",
                        {
                            viewing:
                                true,
                            targetUserId:
                                this
                                    .#targetUserId,
                            peerId:
                                this
                                    .#viewerPeerId,
                            state:
                                "live"
                        }
                    )
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

            return this.#request(
                "POST",
                {
                    body: {
                        action:
                            "trainer-message",
                        targetUserId:
                            this
                                .#targetUserId,
                        peerId:
                            this
                                .#viewerPeerId,
                        type:
                            "trainer.tts",
                        text
                    }
                }
            );
        }

        #handleEnvelope(
            envelope
        ) {
            if (
                !envelope ||
                typeof envelope !==
                    "object"
            ) {
                return;
            }

            const sequence =
                Number(
                    envelope.sequence
                ) ||
                0;

            if (
                sequence &&
                sequence <=
                    this
                        .#viewerLastSequence
            ) {
                return;
            }

            if (sequence) {
                this.#viewerLastSequence =
                    sequence;
            }

            const type =
                String(
                    envelope.type ||
                    ""
                );

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
                            envelope.payload,
                        timestamp:
                            envelope.timestamp
                    }
                );

                return;
            }

            if (
                type ===
                    "tts"
            ) {
                this
                    .#playRemoteTts(
                        envelope.payload
                    );
            }

            this.#emit(
                "message",
                {
                    targetUserId:
                        this
                            .#targetUserId,
                    ...envelope
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
                        0
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
                this
                    .#viewerAudioElement(
                        microphone
                            ? "microphone"
                            : "program"
                    );

            audio.srcObject =
                new MediaStream(
                    [
                        event.track
                    ]
                );

            this
                .#syncViewerVolume();

            void audio.play()
                .catch(
                    () => {}
                );

            this.#emit(
                "audioChanged",
                {
                    kind:
                        microphone
                            ? "microphone"
                            : "program",
                    available:
                        true
                }
            );
        }

        #viewerAudioElement(
            kind
        ) {
            const field =
                kind ===
                    "microphone"
                    ? "#viewerMicAudio"
                    : "#viewerProgramAudio";

            if (field === "#viewerMicAudio") {
                if (!this.#viewerMicAudio) {
                    this.#viewerMicAudio =
                        this
                            .#createAudioElement(
                                "microphone"
                            );
                }

                return this.#viewerMicAudio;
            }

            if (!this.#viewerProgramAudio) {
                this.#viewerProgramAudio =
                    this
                        .#createAudioElement(
                            "program"
                        );
            }

            return this.#viewerProgramAudio;
        }

        #createAudioElement(
            kind
        ) {
            const audio =
                document.createElement(
                    "audio"
                );

            audio.autoplay =
                true;
            audio.playsInline =
                true;
            audio.hidden =
                true;
            audio.dataset
                .liveStreamAudio =
                kind;

            document.body.append(
                audio
            );

            return audio;
        }

        #syncViewerVolume() {
            if (this.#viewerMicAudio) {
                this.#viewerMicAudio
                    .muted =
                    this.#viewerMuted;

                this.#viewerMicAudio
                    .volume =
                    clamp01(
                        this
                            .#viewerMasterVolume *
                        this
                            .#viewerMicVolume
                    );
            }

            if (this.#viewerProgramAudio) {
                this
                    .#viewerProgramAudio
                    .muted =
                    this.#viewerMuted;

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

            this.#emit(
                "volumeChanged",
                {
                    muted:
                        this.#viewerMuted,
                    master:
                        this
                            .#viewerMasterVolume,
                    microphone:
                        this
                            .#viewerMicVolume,
                    program:
                        this
                            .#viewerProgramVolume
                }
            );
        }

        setViewerMuted(
            muted
        ) {
            this.#viewerMuted =
                Boolean(
                    muted
                );

            if (
                this.#viewerMuted &&
                this.#viewing
            ) {
                try {
                    globalThis
                        .speechSynthesis
                        ?.cancel?.();
                }
                catch {}
            }

            this
                .#syncViewerVolume();

            return this.#viewerMuted;
        }

        setViewerMasterVolume(
            value
        ) {
            this.#viewerMasterVolume =
                clamp01(
                    value
                );

            this
                .#syncViewerVolume();

            return this
                .#viewerMasterVolume;
        }

        setViewerMicrophoneVolume(
            value
        ) {
            this.#viewerMicVolume =
                clamp01(
                    value
                );

            this
                .#syncViewerVolume();

            return this
                .#viewerMicVolume;
        }

        setViewerProgramVolume(
            value
        ) {
            this.#viewerProgramVolume =
                clamp01(
                    value
                );

            this
                .#syncViewerVolume();

            return this
                .#viewerProgramVolume;
        }

        async stopViewing({
            notifyServer = true
        } = {}) {
            clearInterval(
                this.#viewerPollTimer
            );
            clearInterval(
                this.#viewerHeartbeatTimer
            );
            this.#viewerPollTimer =
                undefined;
            this.#viewerHeartbeatTimer =
                undefined;

            const wasViewing =
                this.#viewing;
            const peerId =
                this.#viewerPeerId;
            const targetUserId =
                this.#targetUserId;

            this.#viewing =
                false;

            try {
                this
                    .#viewerDataChannel
                    ?.close();
            }
            catch {}

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
            this.#viewerDataChannel =
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
            this.#viewerSignalId =
                0;
            this.#viewerMessageId =
                0;
            this.#viewerLastSequence =
                0;

            if (
                wasViewing &&
                notifyServer &&
                peerId &&
                targetUserId
            ) {
                try {
                    await this.#request(
                        "DELETE",
                        {
                            body: {
                                action:
                                    "leave",
                                targetUserId,
                                peerId
                            }
                        }
                    );
                }
                catch (error) {
                    console.warn(
                        "Unable to leave live stream cleanly:",
                        error
                    );
                }
            }

            if (wasViewing) {
                this.#emit(
                    "viewerChanged",
                    {
                        viewing:
                            false,
                        targetUserId,
                        peerId,
                        state:
                            "closed"
                    }
                );
            }
        }

        async close() {
            await Promise.all([
                this.stopViewing(),
                this.stopPublishing()
            ]);
        }
    }

    globalThis.WMOFLiveTripStream =
        WMOFLiveTripStream;
})();
