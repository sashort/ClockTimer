/* Orders application-level startup: announce readiness, then hydrate legacy persistence. */
(function (root) {
    "use strict";

    async function initialize({
        context = root.ClockTimerPageContext,
        settingsOnlyPage,
        audio = root.WMOFAudio,
        text,
        persistenceOptions = {}
    } = {}) {
        const settingsOnly = settingsOnlyPage ?? (
            context?.host === "settings-frame"
            || root.document?.body?.classList?.contains("settings-page") === true
        );
        const announcementFactory = root.ClockTimerStartupAnnouncement;
        const persistenceStartup = root.ClockTimerPersistenceStartup;
        if (!announcementFactory?.create) throw new Error("StartupAnnouncement.js did not register its factory.");
        if (!persistenceStartup?.initialize) throw new Error("PersistenceStartup.js did not register its initializer.");

        const announcement = announcementFactory.create({
            settingsOnlyPage: settingsOnly,
            audio,
            text
        });
        announcement.start();
        await persistenceStartup.initialize(persistenceOptions);
        return announcement;
    }

    root.ClockTimerApplicationStartup = Object.freeze({ initialize });
})(globalThis);
