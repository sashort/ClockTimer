/* Storage boundary for persisted audio settings. */
(function (root) {
    "use strict";

    function load({ readStorage, storageKey, settingsModel } = {}) {
        if (typeof readStorage !== "function" || !settingsModel?.read) {
            throw new TypeError("Audio settings storage reader and model are required.");
        }
        return settingsModel.read(readStorage(storageKey));
    }

    function save({ writeStorage, storageKey, settingsModel, settings } = {}) {
        if (typeof writeStorage !== "function" || !settingsModel?.serialize) {
            throw new TypeError("Audio settings storage writer and model are required.");
        }
        writeStorage(storageKey, settingsModel.serialize(settings));
    }

    root.WMOFAudioSettingsPersistence = Object.freeze({ load, save });
})(globalThis);
