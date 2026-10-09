/* Standalone settings-page bootstrap. Runs only after the legacy app has installed its handlers. */
(function (root) {
    "use strict";

    function start() {
        const pageHeader = document.getElementById("settingsPageHeader");
        const embedded = root.self !== root.top;
        if (embedded) {
            document.body.classList.add("settings-embedded");
            document.documentElement.classList.add("settings-embedded-document");
            if (pageHeader) pageHeader.hidden = true;
        }

        const requestedSurface = new URLSearchParams(root.location.search).get("surface");
        const surfaceId = root.ClockTimerSettingsSurfaces
            ? root.ClockTimerSettingsSurfaces.normalize(requestedSurface)
            : (["graphicalSettingsDialog", "audioSettingsDialog", "audioAnnouncementsDialog", "stateSettingsDialog", "tripSettingsDialog"].includes(requestedSurface)
                ? requestedSurface
                : "graphicalSettingsDialog");
        const surface = document.getElementById(surfaceId);
        if (!surface) return false;

        surface.setAttribute("data-primary-settings-surface", "");
        if (embedded) {
            surface.addEventListener("close", () => {
                try {
                    root.parent.postMessage({ type: "clocktimer-settings-closed" }, root.location.origin);
                } catch {}
            });
        }

        // Preserve the original app's population, validation, focus, and event handlers.
        const originalTrigger = document.querySelector('[data-dialog="' + surfaceId + '"]');
        if (originalTrigger) {
            originalTrigger.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));
            return true;
        }

        const opening = new CustomEvent("opening", {
            bubbles: true,
            cancelable: true,
            detail: { reason: "user", duration: 0 }
        });
        if (surface.dispatchEvent(opening)) {
            try { surface.showModal(); } catch { surface.setAttribute("open", ""); }
        }
        return true;
    }

    function initialize() {
        if (document.documentElement.dataset.clocktimerAppReady === "true") {
            return start();
        }
        if (document.documentElement.dataset.clocktimerSettingsBootstrapPending === "true") return false;
        document.documentElement.dataset.clocktimerSettingsBootstrapPending = "true";
        document.addEventListener("clocktimer-app-ready", () => {
            delete document.documentElement.dataset.clocktimerSettingsBootstrapPending;
            start();
        }, { once: true });
        return false;
    }

    root.ClockTimerSettingsPageBootstrap = Object.freeze({ initialize, start });
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
})(globalThis);
