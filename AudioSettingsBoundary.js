/* Keeps audio settings dialogs inside the visual viewport and observes layout changes. */
(function (root) {
    "use strict";

    function refresh({ settingsDialog, announcementsDialog, viewport = root.visualViewport, safeBottom = 0 } = {}) {
        if (!settingsDialog) return false;
        const viewportTop = viewport?.offsetTop ?? 0;
        const safeHeight = Math.max(0, safeBottom - viewportTop);
        for (const dialog of [settingsDialog, announcementsDialog]) {
            if (!dialog) continue;
            dialog.style.setProperty("--audio-settings-safe-top", viewportTop + "px");
            dialog.style.setProperty("--audio-settings-safe-height", safeHeight + "px");
        }
        return true;
    }

    function bind({ speechMicBar, refreshCallback, windowRef = root, ResizeObserverCtor = root.ResizeObserver } = {}) {
        speechMicBar?.addEventListener("speech-surface-boundary-change", refreshCallback);
        windowRef.visualViewport?.addEventListener("resize", refreshCallback);
        windowRef.visualViewport?.addEventListener("scroll", refreshCallback);
        windowRef.addEventListener("resize", refreshCallback);
        if (typeof ResizeObserverCtor === "function" && speechMicBar) {
            const observer = new ResizeObserverCtor(refreshCallback);
            observer.observe(speechMicBar);
            return observer;
        }
        return null;
    }

    root.WMOFAudioSettingsBoundary = Object.freeze({ refresh, bind });
})(globalThis);
