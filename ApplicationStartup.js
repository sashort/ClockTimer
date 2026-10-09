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
            context,
            settingsOnlyPage: settingsOnly,
            audio,
            text
        });
        announcement.start();
        await persistenceStartup.initialize(persistenceOptions);
        return announcement;
    }

    async function initializePage({
        context = root.ClockTimerPageContext,
        settingsOnlyPage,
        audio = root.WMOFAudio,
        documentRef = root.document
    } = {}) {
        const audioSettingsStartup = root.ClockTimerAudioSettingsStartup;
        if (!audioSettingsStartup?.ensureModel) {
            throw new Error("AudioSettingsStartup.js did not register its initializer.");
        }
        await audioSettingsStartup.ensureModel({ context });

        const audioUnlock = root.ClockTimerAudioUnlock;
        if (!audioUnlock?.install) {
            throw new Error("AudioUnlock.js did not register its installer.");
        }
        audioUnlock.install(documentRef, audio);

        const announcementLanguage = root.WMOFAnnouncementLanguage;
        if (!announcementLanguage?.load || !announcementLanguage?.text) {
            throw new Error("Announcement language did not register its loader.");
        }
        await announcementLanguage.load(documentRef?.documentElement?.lang || "en-US");
        const text = (key, values) => announcementLanguage.text(key, values);
        const startupAnnouncement = await initialize({
            context,
            settingsOnlyPage,
            audio,
            text
        });
        return { announcementLanguage, text, startupAnnouncement };
    }

    root.ClockTimerApplicationStartup = Object.freeze({ initialize, initializePage });
})(globalThis);
