/* Trip-log pin state and its accessible button presentation. */
(function (root) {
    "use strict";

    function setPinned(value, {
        appElement,
        pinButton,
        tripLogButton,
        isTripListActive = () => false,
        persist = true,
        storageKey,
        writeStorage
    } = {}) {
        const pinned = Boolean(value);
        if (!appElement) throw new TypeError("Trip-log app element is required.");
        appElement.dataset.tripLogPinned = String(pinned);
        pinButton?.setAttribute("aria-pressed", String(pinned));
        if (pinButton) {
            const label = pinned ? "Unpin Trip Log" : "Pin Trip Log";
            pinButton.setAttribute("aria-label", label);
            pinButton.title = label;
        }
        if (tripLogButton) {
            const hidden = !pinned && !isTripListActive();
            tripLogButton.inert = hidden;
            if (hidden) tripLogButton.setAttribute("aria-hidden", "true");
            else tripLogButton.removeAttribute("aria-hidden");
        }
        if (persist && typeof writeStorage === "function") {
            writeStorage(storageKey, String(pinned));
        }
        return pinned;
    }

    root.ClockTimerTripLogPinController = Object.freeze({ setPinned });
})(globalThis);
