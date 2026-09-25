(() => {
    "use strict";

    // Value vocabulary shared by percent, duration, and clock-time entry.
    // Do not use .+ here: it would also claim OK, cancel, and named commands.
    // The context-specific preprocessor/action still validates the value.
    const keypadToken =
        "(?:\\d+(?::\\d{1,2}){0,2}(?:\\.\\d+)?%?|%|" +
        "zero|oh|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|and|a|an|hours?|hrs?|minutes?|mins?|seconds?|secs?|percent|per|cent|am|pm|today|tomorrow|noon|midnight|quarter|half|past|after|to|till|until|at|o'?clock|a\\.?\\s*m\\.?|p\\.?\\s*m\\.?)";
    const keypadValuePattern =
        "^(?<spokenValue>" + keypadToken +
        "(?:[\\s\\-\\u2013\\u2014]+" + keypadToken + ")*)$";

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
                breakChoice: "^(?<breakChoice>10|15|break|long|short|lunch)$",
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
                goalMode: "^(?<goalMode>auto|total|trip)(?: mode)?$",
                sync: "^(?:sync|sink|sin)(?: (?<syncAction>on|off))?$",
                syncStatus: "^(?:sync|sink|sin) status$",
                howLong: "^(?:how long|time)$",
                when: "^when$",
                lockEndTime: "^lock end time(?: to)? (?<spokenTime>.+)$",
                showTripLog: "^(?:show )?trip log$",
                hideTripLog: "^(?:hide|close) trip log$",
                deferTrip: "^defer trip$",
                readRenderedTime: "^(?<timeMode>time remaining|time elapsed|end time)$",
                renderedTimeMode: "^show (?<timeMode>time remaining|time elapsed|end time)$",
                keypadValue: keypadValuePattern
            })
        }),
        ui: Object.freeze({})
    });

    const catalog = globalThis.WMOFLanguages || Object.create(null);
    catalog[language.code] = language;
    globalThis.WMOFLanguages = catalog;
})();
