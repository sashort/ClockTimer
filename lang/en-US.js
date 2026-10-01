(() => {
    "use strict";

    // Value vocabulary shared by percent, duration, and clock-time entry.
    // Do not use .+ here: it would also claim OK, cancel, and named commands.
    // The context-specific preprocessor/action still validates the value.
    const keypadToken =
        "(?:\\d+(?::\\d{1,2}){0,2}(?:\\.\\d+)?%?|%|" +
        "zero|oh|o|naught|nought|double|triple|one|two|to|too|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|and|a|an|hours?|hrs?|minutes?|mins?|seconds?|secs?|percent|per|cent|am|pm|today|tomorrow|noon|midnight|quarter|half|past|after|to|till|until|at|o'?clock|a\\.?\\s*m\\.?|p\\.?\\s*m\\.?)";
    const keypadValuePattern =
        "^(?<spokenValue>" + keypadToken +
        "(?:[\\s\\-\\u2013\\u2014]+" + keypadToken + ")*)$";

    const smallNumberHotwords =
        [
            "zero",
            "one",
            "two",
            "three",
            "four",
            "five",
            "six",
            "seven",
            "eight",
            "nine",
            "ten",
            "eleven",
            "twelve",
            "thirteen",
            "fourteen",
            "fifteen",
            "sixteen",
            "seventeen",
            "eighteen",
            "nineteen"
        ];
    const tensHotwords =
        [
            "twenty",
            "thirty",
            "forty",
            "fifty",
            "sixty",
            "seventy",
            "eighty",
            "ninety"
        ];
    const numberValueHotwords =
        [
            ...smallNumberHotwords,
            "oh",
            "o",
            "naught",
            "nought",
            "double",
            "triple"
        ];

    for (
        const tens of tensHotwords
    ) {
        numberValueHotwords.push(
            tens
        );

        for (
            let digit = 1;
            digit <= 9;
            digit++
        ) {
            numberValueHotwords.push(
                tens +
                " " +
                smallNumberHotwords[
                    digit
                ]
            );
        }
    }

    const language = Object.freeze({
        code: "en-US",
        name: "English (United States)",
        direction: "ltr",
        speechRecognitionLanguage: "en-US",
        speech: Object.freeze({
            recognitionHotwords:
                Object.freeze(
                    numberValueHotwords
                        .slice()
                ),
            wakePhrase: "^wake$",
            sleepPhrase: "^sleep$",
            offPhrase: "^off$",
            nouns: Object.freeze({showTripLog: "log|trip log"}),
            commands: Object.freeze({
                standardTime: "^standard(?: time)? (?<timeValue>.+)$",
                standardTimeEditor: "^standard(?: time)?$",
                scheduledStartEditor: "^(?:scheduled start|scheduled time)$",
                scheduledStart: "^(?:scheduled start|scheduled time) (?<spokenTime>.+)$",
                scheduledStartNow: "^start$",
                actualStartEditor: "^(?:actual start|start time)$",
                actualStart: "^(?:actual start|start time) (?<spokenTime>.+)$",
                creationTimeEditor: "^(?:creation time|created(?: at)?)$",
                creationTime: "^(?:creation time|created(?: at)?) (?<spokenTime>.+)$",
                readyAt: "^ready at (?<spokenTime>.+)$",
                readyAtContinuation: "^at (?<spokenTime>.+)$",
                ready: "^ready$",
                breakStart: "^break start$",
                breakChoice: "^(?<breakChoice>10|15|break|long|short|lunch)$",
                confirm: "^ok(?:ay)?$",
                yes: "^yes$",
                no: "^no$",
                cancel: "^cancel$",
                close: "^close$",
                voice: "^voice$",
                voiceEntryConfirm: "^ok(?:ay)?$",
                voiceEntryCancel: "^(?:cancel|close)$",
                voiceEntryTouch: "^(?:touch|keypad|number pad)$",
                voiceEntryDefer: "^defer trip$",
                down: "^down(?: time)?$",
                breakEnd: "^break end$",
                resume: "^resume$",
                tripGoal: "^trip goal$",
                totalGoal: "^total goal$",
                changeGoal: "^(?<percent>.+?)(?: percent)? (?<goalScope>day|trip|total|week|check|month|year)$",
                readGoalMode: "^mode$",
                goalMode: "^(?<goalMode>auto|total|trip|day|week|check|month|year)(?: mode)?$",
                sync: "^(?:sync|sink|sin)(?: (?<syncAction>on|off))?$",
                syncStatus: "^(?:sync|sink|sin) status$",
                howLong: "^(?:how long|time)$",
                when: "^when$",
                lockEndTime: "^lock end time(?: to)? (?<spokenTime>.+)$",
                showTripLog: "^(?:trip )?log$",
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
