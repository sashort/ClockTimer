import assert from "node:assert/strict";
import fs from "node:fs";
import {Window} from "happy-dom";

const window =
    new Window({
        url:
            "https://wmof.example/"
    });

Object.assign(
    globalThis,
    {
        window,
        document:
            window.document,
        HTMLElement:
            window.HTMLElement,
        Element:
            window.Element,
        Node:
            window.Node,
        CustomEvent:
            window.CustomEvent,
        EventTarget:
            window.EventTarget,
        MutationObserver:
            window.MutationObserver
    }
);

Object.defineProperty(
    globalThis,
    "navigator",
    {
        configurable: true,
        value:
            window.navigator
    }
);

window.SpeechRecognition =
    class {};

window.Commands = {
    wake() {},
    sleep() {},
    off() {},
    sync() {},
    dialog() {},
    cancel() {},
    details() {},
    page() {},
    priority() {}
};

window.document.body.innerHTML = [
    '<speech-menu id="system" speech-modal="system">',
    '<speech-command id="wakeCommand" speech-pattern="^wake$" speech-function="Commands.wake"></speech-command>',
    '<speech-command id="sleepCommand" speech-pattern="^sleep$" speech-function="Commands.sleep"></speech-command>',
    '<speech-command id="offCommand" speech-pattern="^off$" speech-function="Commands.off"></speech-command>',
    '</speech-menu>',
    '<speech-menu id="top" speech-modal="top-level">',
    '<speech-command speech-pattern="^sync(?: (?<syncAction>on|off))?$" speech-function="Commands.sync"></speech-command>',
    '<speech-command speech-index="10" speech-pattern="^priority$" speech-function="Commands.priority"></speech-command>',
    '</speech-menu>',
    '<button id="page" speech-index="999" speech-pattern="^log$" speech-function="Commands.page">Trip Log</button>',
    '<details id="more" open>',
    '<button id="detailsCommand" speech-pattern="^details$" speech-function="Commands.details">Details</button>',
    '</details>',
    '<dialog id="activeDialog" open>',
    '<speech-menu>',
    '<speech-command id="dialogCommand" speech-pattern="^ok(?:ay)?$" speech-function="Commands.dialog"></speech-command>',
    '</speech-menu>',
    '</dialog>',
    '<speech-menu id="default" speech-modal="default">',
    '<speech-command speech-pattern="^cancel$" speech-function="Commands.cancel"></speech-command>',
    '</speech-menu>'
].join("");

const SpeechMenu =
    Function(
        fs.readFileSync(
            new URL(
                "../SpeechMenu.js",
                import.meta.url
            ),
            "utf8"
        ) +
        "\nreturn SpeechMenu;"
    )();

window.SpeechMenu =
    SpeechMenu;

assert.deepEqual(
    [
        ...SpeechMenu
            .extrapolatePattern(
                window.document
                    .querySelector(
                        "#wakeCommand"
                    )
                    .getAttribute(
                        "speech-pattern"
                    )
            )
    ],
    [
        "wake"
    ],
    "system wake command should use normal phrase extrapolation"
);

assert.deepEqual(
    [
        ...SpeechMenu
            .extrapolatePattern(
                window.document
                    .querySelector(
                        "#sleepCommand"
                    )
                    .getAttribute(
                        "speech-pattern"
                    )
            )
    ],
    [
        "sleep"
    ],
    "system sleep command should use normal phrase extrapolation"
);

assert.deepEqual(
    [
        ...SpeechMenu
            .extrapolatePattern(
                window.document
                    .querySelector(
                        "#offCommand"
                    )
                    .getAttribute(
                        "speech-pattern"
                    )
            )
    ],
    [
        "off"
    ],
    "system off command should use normal phrase extrapolation"
);

assert.deepEqual(
    [
        ...SpeechMenu
            .extrapolatePattern(
                "^log$"
            )
    ],
    [
        "log"
    ]
);

assert.deepEqual(
    [
        ...SpeechMenu
            .extrapolatePattern(
                "^(?<goalScope>trip|total) goal (?<percent>.+)$"
            )
    ],
    [
        "trip goal <percent>",
        "total goal <percent>"
    ]
);


const reducedSyncPattern =
    SpeechMenu.withoutPhrase(
        "^sync(?: (?<syncAction>on|off))?$",
        "sync off"
    );

assert.deepEqual(
    [
        ...SpeechMenu
            .extrapolatePattern(
                reducedSyncPattern
            )
    ],
    [
        "sync",
        "sync on"
    ],
    "deleting one extrapolated phrase should preserve the remaining combinations"
);

const reducedRegex =
    new RegExp(
        reducedSyncPattern,
        "i"
    );

assert.equal(
    reducedRegex.exec(
        "sync on"
    )?.groups?.syncAction,
    "on",
    "phrase deletion should preserve named captures in the original regex"
);

assert.equal(
    reducedRegex.test(
        "sync off"
    ),
    false
);

SpeechMenu
    .extrapolatePhrases();

assert.deepEqual(
    [
        ...SpeechMenu.phrases
    ],
    [
        "wake",
        "sleep",
        "off",
        "priority",
        "sync",
        "sync on",
        "sync off",
        "ok",
        "okay",
        "cancel"
    ],
    "active dialog state should exclude non-modal page/details candidates"
);

window.document
    .querySelector(
        "#activeDialog"
    )
    .removeAttribute(
        "open"
    );

SpeechMenu
    .extrapolatePhrases();

assert.deepEqual(
    [
        ...SpeechMenu.phrases
    ],
    [
        "wake",
        "sleep",
        "off",
        "priority",
        "sync",
        "sync on",
        "sync off",
        "cancel",
        "details",
        "log"
    ],
    "without a modal, default then open context then page candidates should be available"
);

assert.equal(
    SpeechMenu
        .phraseGroups
        .find(
            group =>
                group.element.id ===
                "detailsCommand"
        )
        ?.modal,
    undefined
);

assert.equal(
    SpeechMenu
        .phraseGroups
        .find(
            group =>
                group.element
                    .closest(
                        "#top"
                    )
        )
        ?.modal,
    "top-level"
);


const repeatableSystemCommandSource =
    fs.readFileSync(
        new URL(
            "../SpeechMicBar.js",
            import.meta.url
        ),
        "utf8"
    );

for (
    const [
        phrase,
        action
    ] of [
        [
            "speech",
            "setSpeechMaster"
        ],
        [
            "faster",
            "changeAudioRateFaster"
        ],
        [
            "slower",
            "changeAudioRateSlower"
        ],
        [
            "louder",
            "changeAudioVolumeLouder"
        ],
        [
            "softer",
            "changeAudioVolumeSofter"
        ]
    ]
) {
    assert.match(
        repeatableSystemCommandSource,
        new RegExp(
            '"' +
            phrase +
            '"[\\s\\S]*?WMOFActions\\.' +
            action +
            '[\\s\\S]*?speech-repeatable'
        ),
        phrase +
            " should support rapid back-to-back execution"
    );
}

const speechMenuAsyncSource =
    fs.readFileSync(
        new URL(
            "../SpeechMenu.js",
            import.meta.url
        ),
        "utf8"
    );

assert.match(
    speechMenuAsyncSource,
    /#completeSpeechExecution[\s\S]*?await outcomeValue/
);
assert.match(
    speechMenuAsyncSource,
    /speechCommandDispatched[\s\S]*?void SpeechMenu[\s\S]*?#completeSpeechExecution/
);
assert.doesNotMatch(
    speechMenuAsyncSource,
    /static async #processElement[\s\S]*?const outcome\s*=\s*await outcomeValue[\s\S]*?static #list/
);

const speechMasterAppSource =
    fs.readFileSync(
        new URL(
            "../app.js",
            import.meta.url
        ),
        "utf8"
    );
const announcementCatalogSource =
    fs.readFileSync(
        new URL(
            "../AnnouncementCatalog.js",
            import.meta.url
        ),
        "utf8"
    );

assert.match(
    repeatableSystemCommandSource,
    /"speech"[\s\S]*?"\^speech \(\?:on\|off\)\$"[\s\S]*?WMOFActions\.setSpeechMaster[\s\S]*?speech-repeatable/
);
assert.match(
    repeatableSystemCommandSource,
    /"speech-rate-percent"[\s\S]*?\^speech \(\?!on\$\|off\$\)[\s\S]*?percent[\s\S]*?WMOFActions\.setAudioRatePercent[\s\S]*?speech-preproc-context[\s\S]*?percent[\s\S]*?speech-open-ended/
);
assert.match(
    repeatableSystemCommandSource,
    /"volume-percent"[\s\S]*?\^volume [\s\S]*?percent[\s\S]*?WMOFActions\.setAudioVolumePercent[\s\S]*?speech-preproc-context[\s\S]*?percent[\s\S]*?speech-open-ended/
);
assert.match(
    speechMasterAppSource,
    /setGlobalAudioRatePercent[\s\S]*?audioSettings\.speechVelocity[\s\S]*?audioSettings\.toneVelocity[\s\S]*?Speech Rate/
);
assert.match(
    speechMasterAppSource,
    /setGlobalAudioVolumePercent[\s\S]*?audioSettings\.speechVolume[\s\S]*?audioSettings\.toneVolume[\s\S]*?Speech Volume/
);
assert.match(
    speechMasterAppSource,
    /setMasterSpeech[\s\S]*?masters\.summary[\s\S]*?masters\.details[\s\S]*?Speech On[\s\S]*?Speech Off[\s\S]*?ignoreSummaryMaster/
);
assert.match(
    announcementCatalogSource,
    /trip-started"[\s\S]*?masterOverrides:[\s\S]*?"summary"[\s\S]*?"details"/
);
assert.match(
    announcementCatalogSource,
    /trip-ended"[\s\S]*?masterOverrides:[\s\S]*?"summary"[\s\S]*?"details"/
);
assert.match(
    speechMasterAppSource,
    /announcementOverridesMaster[\s\S]*?masterOverrides[\s\S]*?audioCellUserEnabled/
);

assert.match(
    speechMasterAppSource,
    /currentActionSignal[\s\S]*?invocationContext[\s\S]*?signal/
);
assert.match(
    speechMasterAppSource,
    /endCurrentIntervalOrTrip[\s\S]*?signal[\s\S]*?beginNewTripWorkflow\([\s\S]*?signal/
);
assert.match(
    speechMasterAppSource,
    /"openStartMenu"[\s\S]*?"endTrip"[\s\S]*?interruptGroup:[\s\S]*?"primary-surface"/
);
assert.match(
    speechMasterAppSource,
    /"handleVoiceEntrySpeech"[\s\S]*?"confirmNumberPad"[\s\S]*?"cancelNumberPadEdit"[\s\S]*?interruptGroup:[\s\S]*?"value-editor"/
);
assert.match(
    speechMasterAppSource,
    /confirmNumberPad[\s\S]*?currentActionSignal[\s\S]*?commitNumberPad\([\s\S]*?signal[\s\S]*?signal\?\.aborted/
);
assert.match(
    speechMasterAppSource,
    /parseVoiceEntryTranscript[\s\S]*?signal[\s\S]*?commitNumberPad\([\s\S]*?signal/
);

await SpeechMenu.sleep();
SpeechMenu.extrapolatePhrases();

assert.deepEqual(
    [
        ...SpeechMenu.phrases
    ],
    [
        "wake"
    ],
    "sleeping should expose only the wake phrase"
);
assert.equal(
    SpeechMenu.phraseGroups.length,
    1,
    "sleeping should expose exactly one command group"
);
assert.equal(
    SpeechMenu.phraseGroups[0]
        ?.element
        ?.dataset
        ?.speechSystemCommand,
    "wake",
    "the only sleeping command group should be wake"
);

await SpeechMenu.wake();
SpeechMenu.extrapolatePhrases();

assert.ok(
    SpeechMenu.phrases.includes(
        "priority"
    ),
    "waking should restore non-system phrases"
);
assert.ok(
    SpeechMenu.phraseGroups.some(
        group =>
            group.modal !==
                "system"
    ),
    "waking should restore non-system phrase groups"
);

assert.ok(
    SpeechMenu.phrases.indexOf(
        "wake"
    ) <
    SpeechMenu.phrases.indexOf(
        "priority"
    ),
    "system modal should outrank top-level regardless of speech-index"
);

assert.ok(
    SpeechMenu.phrases.indexOf(
        "priority"
    ) <
    SpeechMenu.phrases.indexOf(
        "sync"
    ),
    "higher speech-index should take precedence inside the same scope"
);

assert.ok(
    SpeechMenu.phrases.indexOf(
        "cancel"
    ) <
    SpeechMenu.phrases.indexOf(
        "log"
    ),
    "speech-index must not override effective scope precedence"
);

const compactCommand =
    window.document
        .createElement(
            "speech-command"
        );

compactCommand.setAttribute(
    "speech-pattern",
    "^break start$"
);

compactCommand.setAttribute(
    "speech-function",
    "Commands.sync"
);

window.document
    .querySelector(
        "#top"
    )
    .append(
        compactCommand
    );

SpeechMenu.refresh();

compactCommand
    .speechCompactPattern
    .lastIndex =
    0;

assert.equal(
    compactCommand
        .speechCompactPattern
        .test(
            "breakstart"
        ),
    true,
    "compact matching should tolerate omitted whitespace without rewriting the transcript"
);

console.log(
    "PASS SpeechMenu extrapolates available phrases using live precedence"
);

const speechMenuSource = fs.readFileSync(
    new URL(
        "../SpeechMenu.js",
        import.meta.url
    ),
    "utf8"
);

assert.match(
    speechMenuSource,
    /extrapolatePhrases\(\)[\s\S]*#availableCandidates\(\)/
);
assert.match(
    speechMenuSource,
    /const groupsChanged[\s\S]*group\.element !==[\s\S]*next\.element/
);
assert.match(
    speechMenuSource,
    /if \(\s*phrasesChanged\s*\|\|\s*groupsChanged\s*\)/
);
assert.match(
    speechMenuSource,
    /target\.closest\?\.\(\s*"details"\s*\)[\s\S]*!details\.open/
);
assert.match(
    speechMenuSource,
    /target\.closest\?\.\(\s*"\[popover\]"\s*\)[\s\S]*#openPopover/
);


{
    const appSource =
        fs.readFileSync(
            new URL(
                "../app.js",
                import.meta.url
            ),
            "utf8"
        );

    const micSource =
        fs.readFileSync(
            new URL(
                "../SpeechMicBar.js",
                import.meta.url
            ),
            "utf8"
        );

    assert.match(
        appSource,
        /openSpeechOptions\(\)[\s\S]*?optionsOpen[\s\S]*?return true;[\s\S]*?optionsCollapsed[\s\S]*?expandOptions/
    );

    assert.doesNotMatch(
        appSource,
        /toggleSpeechOptions\(\)/
    );

    assert.match(
        micSource,
        /"commands"[\s\S]*?"\^\(\?:\(\?:speech \)\?commands\|choices\|options\)\$"[\s\S]*?"WMOFActions\.openSpeechOptions"/
    );

    assert.doesNotMatch(
        micSource,
        /WMOFActions\.toggleSpeechOptions/
    );

    assert.match(
        micSource,
        /"chime"[\s\S]*?"\^chime \(\?:on\|off\)\$"[\s\S]*?"WMOFActions\.setChimeMaster"/
    );
    assert.match(
        appSource,
        /setMasterChime[\s\S]*?audioSettings\.masters\.chime[\s\S]*?renderAudioSettings\(\)[\s\S]*?saveAudioSettings\(\)[\s\S]*?confirmSettingChange\([\s\S]*?audioSettings\.masters\.chime[\s\S]*?Chime On[\s\S]*?Chime Off/
    );
    assert.match(
        micSource,
        /"faster"[\s\S]*?"\^faster\$"[\s\S]*?"WMOFActions\.changeAudioRateFaster"/
    );
    assert.match(
        micSource,
        /"slower"[\s\S]*?"\^slower\$"[\s\S]*?"WMOFActions\.changeAudioRateSlower"/
    );
    assert.match(
        micSource,
        /"louder"[\s\S]*?"\^louder\$"[\s\S]*?"WMOFActions\.changeAudioVolumeLouder"/
    );
    assert.match(
        micSource,
        /"softer"[\s\S]*?"\^softer\$"[\s\S]*?"WMOFActions\.changeAudioVolumeSofter"/
    );

    assert.match(
        appSource,
        /changeGlobalAudioRate[\s\S]*?speechVelocity[\s\S]*?toneVelocity[\s\S]*?Speech Rate/
    );
    assert.match(
        appSource,
        /changeGlobalAudioVolume[\s\S]*?speechVolume[\s\S]*?toneVolume[\s\S]*?Speech Volume/
    );
    assert.match(
        appSource,
        /AUDIO_SPEECH_VELOCITY_MAX\s*=\s*4[\s\S]*?AUDIO_TONE_VELOCITY_MAX\s*=\s*1\.5/
    );

    assert.match(
        appSource,
        /closeActiveSpeechSurface[\s\S]*?optionsOpen[\s\S]*?hideOptions[\s\S]*?getTripListState\(\) ===[\s\S]*?"open"[\s\S]*?closeTripList\([\s\S]*?"speech-close"/
    );

    assert.match(
        appSource,
        /canCloseSurface\(\)[\s\S]*?getTripListState\(\) ===[\s\S]*?"open"/
    );
}
