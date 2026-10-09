/* Shared settings iframe controller for order-filler and drop-in hosts. */
(function (root) {
    "use strict";
    const FALLBACK_SURFACES = [
        "graphicalSettingsDialog",
        "audioSettingsDialog",
        "audioAnnouncementsDialog",
        "stateSettingsDialog",
        "tripSettingsDialog"
    ];

    function install(documentRef = document, windowRef = root) {
        const dialog = documentRef.getElementById("clockTimerSettingsFrameDialog");
        const frame = documentRef.getElementById("clockTimerSettingsFrame");
        if (!dialog || !frame || dialog.dataset.controllerReady) return false;
        dialog.dataset.controllerReady = "true";

        const surfaces = root.ClockTimerSettingsSurfaces
            ? { has: value => root.ClockTimerSettingsSurfaces.isValid(value) }
            : new Set(FALLBACK_SURFACES);

        documentRef.querySelectorAll("[data-open-clock-timer-settings]").forEach(button => {
            button.addEventListener("click", () => {
                const requested = button.dataset.settingsSurface;
                const surface = surfaces.has(requested) ? requested : "graphicalSettingsDialog";
                frame.dataset.settingsSurface = surface;
                const parentHost = documentRef.body?.classList?.contains("drop-in-page")
                    || documentRef.body?.querySelector?.("#liveStreamDialog")
                    ? "drop-in"
                    : "order-filler";
                const query = new URLSearchParams({ surface, parentHost });
                frame.src = "settings.html?" + query.toString();
                const menu = button.closest("hamburger-menu");
                if (menu && typeof menu.hidePopover === "function") {
                    try { menu.hidePopover(); } catch {}
                }
                if (!dialog.open) dialog.showModal();
            });
        });

        windowRef.addEventListener("message", event => {
            if (event.source !== frame.contentWindow || event.origin !== windowRef.location.origin) return;
            if (event.data?.type === "clocktimer-settings-closed" && dialog.open) dialog.close();
        });
        dialog.addEventListener("click", event => {
            if (event.target === dialog) dialog.close();
        });
        return true;
    }

    root.ClockTimerSettingsFrameController = Object.freeze({ install });
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => install(), { once: true });
    } else {
        install();
    }
})(globalThis);
