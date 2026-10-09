/* Initialize legacy persistence before app state reads local storage. */
(function (root) {
    "use strict";

    async function initialize({
        persistence = root.WMOFPersistence,
        documentRef = root.document,
        storageProvider = () => root.localStorage
    } = {}) {
        try {
            await persistence.ready;
            await persistence.initializeLegacy(storageProvider());
            return { ok: true };
        } catch (error) {
            if (documentRef?.documentElement?.dataset) {
                documentRef.documentElement.dataset.persistenceState = "reverted";
            }
            root.dispatchEvent(new CustomEvent("wmof:persistence-error", { detail: { error } }));
            return { ok: false, error };
        }
    }

    root.ClockTimerPersistenceStartup = Object.freeze({ initialize });
})(globalThis);
