(() => {
    "use strict";

    const language = Object.freeze({
        code: "en-US",
        name: "English (United States)",
        direction: "ltr",
        speechRecognitionLanguage: "en-US",
        speech: Object.freeze({
            wakePhrase: "^listen$",
            sleepPhrase: "^mute$",
            commands: Object.freeze({})
        }),
        ui: Object.freeze({})
    });

    const catalog = globalThis.WMOFLanguages || Object.create(null);
    catalog[language.code] = language;
    globalThis.WMOFLanguages = catalog;
})();
