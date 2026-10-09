/* Voice-select option population for audio settings. */
(function (root) {
    "use strict";

    async function populate({
        select, documentRef = root.document, language,
        selected = { provider: "system", voice: "" },
        encode = (provider, voice) => String(provider || "system") + "|" + encodeURIComponent(String(voice || "")),
        catalogLoader = () => root.WMOFVoiceCatalog?.load?.(language),
        text = key => root.WMOFLanguagePack.text(key),
        warn = (...args) => root.console?.warn?.(...args)
    } = {}) {
        if (!select) return;
        const selectedValue = encode(selected.provider, selected.voice);
        const fragment = documentRef.createDocumentFragment();
        const defaultOption = documentRef.createElement("option");
        defaultOption.value = encode("system", "");
        defaultOption.textContent = text("3adfd015-0028-5e88-b395-baa087eecef5");
        fragment.append(defaultOption);
        try {
            const catalog = await catalogLoader();
            for (const provider of catalog?.providers || []) {
                if (!provider?.voices?.length) continue;
                const group = documentRef.createElement("optgroup");
                group.label = String(provider.label || provider.id || "Voices");
                for (const voice of provider.voices) {
                    const option = documentRef.createElement("option");
                    option.value = encode(voice.provider || provider.id, voice.id);
                    option.textContent = String(voice.name || voice.id);
                    if (voice.language && String(voice.language).toLowerCase() !== String(language).toLowerCase()) {
                        option.textContent += " (" + voice.language + ")";
                    }
                    group.append(option);
                }
                fragment.append(group);
            }
        } catch (error) {
            warn("Unable to load speech voices:", error);
        }
        select.replaceChildren(fragment);
        const available = [...select.options].some(option => option.value === selectedValue);
        if (!available && selected.voice) {
            const unavailable = documentRef.createElement("option");
            unavailable.value = selectedValue;
            unavailable.textContent = text("d7f13047-b878-5e40-ab98-9a269f68dcf7");
            unavailable.disabled = true;
            select.append(unavailable);
        }
        select.value = available || selected.voice ? selectedValue : defaultOption.value;
    }

    root.WMOFAudioVoiceOptions = Object.freeze({ populate });
})(globalThis);
