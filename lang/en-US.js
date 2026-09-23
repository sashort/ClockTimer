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
            commands: Object.freeze({
                standardTime: "^standard time (?<timeValue>.+)$",
                readyAt: "^ready at (?<spokenTime>.+)$",
                readyAtContinuation: "^at (?<spokenTime>.+)$",
                ready: "^ready$",
                breakStart: "^break start$",
                breakChoice: "^(?<breakChoice>10|15|long|short|lunch)$",
                confirm: "^ok(?:ay)?$",
                cancel: "^cancel$",
                down: "^down(?: time)?$",
                breakEnd: "^break end$",
                resume: "^resume$",
                goal: "^(?<goalScope>trip|total) goal (?<percent>.+)$",
                goalMode: "^(?<goalMode>auto|total|trip) mode$",
                sync: "^sync(?: (?<syncAction>on|off))?$",
                lockEndTime: "^lock end time(?: to)? (?<spokenTime>.+)$",
                showTripLog: "^(?:show )?trip log$",
                hideTripLog: "^(?:hide|close) trip log$",
                deferTrip: "^defer trip$",
                renderedTimeMode: "^(?:time )?(?<timeMode>elapsed|remaining|end(?: time)?)$",
                keypadValue: "^(?<spokenValue>.+)$"
            }),
            recognition: Object.freeze({
                phrases: Object.freeze([
                    "listen",
                    "mute",
                    "standard time <duration>",
                    "ready at <clock>",
                    "at <clock>",
                    "ready",
                    "break start",
                    "<breakChoice>",
                    "<confirmation>",
                    "cancel",
                    "down",
                    "down time",
                    "break end",
                    "resume",
                    "<goalScope> goal <percent>",
                    "<goalMode> mode",
                    "sync",
                    "sync <syncAction>",
                    "lock end time <clock>",
                    "lock end time to <clock>",
                    "trip log",
                    "show trip log",
                    "hide trip log",
                    "close trip log",
                    "defer trip",
                    "<timeMode>",
                    "time <timeMode>",
                    "<clock>",
                    "<duration>",
                    "<percent>",
                    "<number>"
                ]),
                options: Object.freeze({
                    breakChoice: Object.freeze([
                        "10",
                        "15",
                        "long",
                        "short",
                        "lunch"
                    ]),
                    confirmation: Object.freeze([
                        "ok",
                        "okay"
                    ]),
                    goalScope: Object.freeze([
                        "trip",
                        "total"
                    ]),
                    goalMode: Object.freeze([
                        "auto",
                        "total",
                        "trip"
                    ]),
                    syncAction: Object.freeze([
                        "on",
                        "off"
                    ]),
                    timeMode: Object.freeze([
                        "elapsed",
                        "remaining",
                        "end",
                        "end time"
                    ])
                }),
                numbers: Object.freeze({
                    output: "digits"
                })
            })
        }),
        ui: Object.freeze({})
    });

    const catalog = globalThis.WMOFLanguages || Object.create(null);
    catalog[language.code] = language;
    globalThis.WMOFLanguages = catalog;
})();
