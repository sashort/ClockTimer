/* Instrument-select option population for audio settings. */
(function (root) {
    "use strict";

    async function populate({
        select, selectedInstrument = "", documentRef = root.document,
        catalogLoader = () => root.WMOFAudio?.load?.(),
        text = key => root.WMOFLanguagePack.text(key),
        warn = (...args) => root.console?.warn?.(...args)
    } = {}) {
        if (!select) return;
        try {
            const catalog = await catalogLoader();
            const fragment = documentRef.createDocumentFragment();
            const defaultOption = documentRef.createElement("option");
            defaultOption.value = "";
            defaultOption.textContent = text("b5b19daf-1b1a-595e-ae3d-ec088d1b1978");
            fragment.append(defaultOption);
            for (const [id, instrument] of Object.entries(catalog?.instruments || {})) {
                if (instrument?.selectable === false) continue;
                const option = documentRef.createElement("option");
                option.value = id;
                option.textContent = String(instrument?.displayName || id);
                fragment.append(option);
            }
            select.replaceChildren(fragment);
            select.value = selectedInstrument;
            if (select.value !== selectedInstrument) select.value = "";
        } catch (error) {
            warn("Unable to load audio instruments:", error);
        }
    }

    root.WMOFAudioInstrumentOptions = Object.freeze({ populate });
})(globalThis);
