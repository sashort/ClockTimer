(() => {
    "use strict";

    const language = Object.freeze({
        code: "en-US",
        name: "English (United States)",
        direction: "ltr",
        speechRecognitionLanguage: "en-US",
        speech: Object.freeze({
            wakePhrase: "^wake$",
            sleepPhrase: "^sleep$",
            offPhrase: "^off$",
            commands: Object.freeze({
                standardTime: "^standard time (?<timeValue>.+)$",
                readyAt: "^ready at (?<spokenTime>.+)$",
                readyAtContinuation: "^at (?<spokenTime>.+)$",
                ready: "^ready$",
                breakStart: "^break start$",
                breakChoice: "^(?<breakChoice>10|15|long|short|lunch)$",
                confirm: "^ok(?:ay)?$",
                yes: "^yes$",
                no: "^no$",
                cancel: "^(?:cancel|close)$",
                down: "^down(?: time)?$",
                breakEnd: "^break end$",
                resume: "^resume$",
                tripGoal: "^trip goal$",
                totalGoal: "^total goal$",
                setTripGoal: "^trip goal (?<percent>.+)$",
                setTotalGoal: "^total goal (?<percent>.+)$",
                readGoalMode: "^mode$",
                goalMode: "^(?<goalMode>auto|total|trip) mode$",
                sync: "^sync(?: (?<syncAction>on|off))?$",
                syncStatus: "^sync status$",
                howLong: "^(?:how long|time)$",
                when: "^when$",
                lockEndTime: "^lock end time(?: to)? (?<spokenTime>.+)$",
                showTripLog: "^(?:show )?trip log$",
                hideTripLog: "^(?:hide|close) trip log$",
                deferTrip: "^defer trip$",
                readRenderedTime: "^(?<timeMode>time remaining|time elapsed|end time)$",
                renderedTimeMode: "^show (?<timeMode>time remaining|time elapsed|end time)$",
                keypadValue: "^(?<spokenValue>.+)$"
            })
        }),
        ui: Object.freeze({})
    });

    const catalog = globalThis.WMOFLanguages || Object.create(null);
    catalog[language.code] = language;
    globalThis.WMOFLanguages = catalog;
})();
