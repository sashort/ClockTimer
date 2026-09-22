(() => {
    "use strict";
    const names = ["speech-pattern", "speech-function", "speech-preproc", "speech-preproc-context", "speech-preproc-field", "speech-modal"];
    const created = new Map();
    const find = entry => {
        if (entry.kind === "existing") return [...document.querySelectorAll("[data-speech-editor-id]")].find(element => element.dataset.speechEditorId === entry.id);
        try { return document.querySelector(entry.target); }
        catch { return null; }
    };
    const insertionHost = host => host.matches("speech-modal,dialog,[popover],body") ? host : host.parentElement || document.body;
    const applyAttributes = (element, attrs) => {
        for (const name of names) {
            const value = attrs?.[name];
            if (typeof value === "string" && (value !== "" || name === "speech-modal")) element.setAttribute(name, value);
            else element.removeAttribute(name);
        }
    };
    const apply = entries => {
        for (const element of created.values()) element.remove();
        created.clear();
        for (const entry of entries) {
            if (entry.kind === "existing") {
                const element = find(entry);
                if (element) applyAttributes(element, entry.attrs);
            } else if (entry.kind === "attribute") {
                const element = find(entry);
                if (element) applyAttributes(element, entry.attrs);
            } else if (entry.kind === "modal") {
                const host = find(entry);
                if (!host) continue;
                const element = document.createElement("speech-modal");
                element.hidden = true;
                element.dataset.speechEditorId = entry.id;
                applyAttributes(element, entry.attrs);
                insertionHost(host).append(element);
                created.set(entry.id, element);
            }
        }
        for (const entry of entries) {
            if (entry.kind !== "command") continue;
            const host = (entry.parentId && created.get(entry.parentId)) || find(entry);
            if (!host) continue;
            const element = document.createElement("speech-command");
            element.hidden = true;
            element.dataset.speechEditorId = entry.id;
            element.dataset.speechTarget = entry.target;
            applyAttributes(element, entry.attrs);
            insertionHost(host).append(element);
            created.set(entry.id, element);
        }
        if (typeof SpeechMenu !== "undefined") SpeechMenu.refresh();
    };
    globalThis.WMOFSpeechEditorRuntime = {apply};
    fetch("api/speech-editor-config/", {credentials:"same-origin", cache:"no-store"})
        .then(response => response.ok ? response.json() : Promise.reject(new Error("Speech configuration unavailable")))
        .then(config => apply(config.entries || []))
        .catch(error => console.warn(error));
})();
