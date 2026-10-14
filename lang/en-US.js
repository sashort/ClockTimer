(() => {
    "use strict";
    // Compatibility entry point. English vocabulary now comes from the language pack.
    const language = globalThis.WMOFLanguagePack?.language;
    if (!language) throw new Error("Load the language pack before the speech language adapter.");
    globalThis.WMOFLanguages ||= Object.create(null);
    globalThis.WMOFLanguages[language.code] = language;
})();
