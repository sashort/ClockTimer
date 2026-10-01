(() => {
    "use strict";
    const resources = new Map();
    let current;
    let generation = 0;
    const fetchLanguage = locale => {
        if (!resources.has(locale)) {
            const request = fetch(`lang/${encodeURIComponent(locale)}/announcements.json`, { cache: "no-cache" })
                .then(response => {
                    if (!response.ok) throw new Error(`Announcement language could not be loaded: ${locale}`);
                    return response.json();
                }).then(data => {
                    if (data.version !== 1 || data.locale !== locale || !data.announcements || !data.messages)
                        throw new Error(`Invalid announcement language: ${locale}`);
                    return data;
                }).catch(error => { resources.delete(locale); throw error; });
            resources.set(locale, request);
        }
        return resources.get(locale);
    };
    const lookup = (data, path) => path.split('.').reduce((value, key) => value?.[key], data);
    const api = {
        get locale() { return current?.selected.locale || "en-US"; },
        async load(locale = "en-US") {
            if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(locale)) throw new TypeError("Invalid announcement locale");
            locale = locale.toLowerCase() === "en" ? "en-US" : locale;
            const requestGeneration = ++generation;
            const english = await fetchLanguage("en-US");
            const selected = locale === "en-US" ? english : await fetchLanguage(locale).catch(() => english);
            if (requestGeneration === generation) current = { selected, english };
            return selected.locale;
        },
        text(path, values = {}) {
            if (!current) throw new Error("Announcement language is not loaded");
            const template = lookup(current.selected, path) ?? lookup(current.english, path);
            if (typeof template !== "string") throw new Error(`Unknown announcement template: ${path}`);
            return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (_, key) => {
                if (!Object.prototype.hasOwnProperty.call(values, key)) throw new Error(`Missing announcement value: ${key}`);
                return String(values[key] ?? "");
            });
        },
        summary(type) {
            const definition = current?.selected.announcements[type] ?? current?.english.announcements[type];
            return definition?.summary ? { text: api.text(`announcements.${type}.summary`), options: definition.speechOptions || {} } : null;
        }
    };
    globalThis.WMOFAnnouncementLanguage = Object.freeze(api);
})();
