/* Serializes automatic live-stream publisher transitions. */
(function (root) {
    "use strict";

    function create({
        getStream,
        getProfile,
        getNetworkStatus,
        isSpeechStarted = () => false,
        shouldPublish,
        logger = console
    } = {}) {
        if (typeof getStream !== "function"
            || typeof getProfile !== "function"
            || typeof getNetworkStatus !== "function"
            || typeof shouldPublish !== "function") {
            throw new TypeError("Live stream publisher requires state providers and a policy.");
        }

        let queue = Promise.resolve();
        function sync() {
            if (!getStream()) return Promise.resolve(false);
            queue = queue.catch(() => {}).then(async () => {
                const stream = getStream();
                if (!stream) return false;
                const desired = shouldPublish(getProfile(), getNetworkStatus());
                if (desired && !stream.publishing) {
                    await stream.startPublishing({requestMicrophone: false});
                    if (isSpeechStarted()) await stream.refreshPublisherMicrophone?.();
                } else if (!desired && stream.publishing) {
                    await stream.stopPublishing();
                }
                return stream.publishing;
            }).catch(error => {
                logger.warn("Automatic live stream presence failed:", error);
                return false;
            });
            return queue;
        }

        return Object.freeze({sync});
    }

    root.ClockTimerLiveStreamPublisher = Object.freeze({create});
})(globalThis);
