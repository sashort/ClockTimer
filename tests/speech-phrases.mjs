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
    sync() {},
    dialog() {},
    cancel() {},
    details() {},
    page() {},
    priority() {}
};

window.document.body.innerHTML = [
    '<speech-menu id="top" speech-modal="top-level">',
    '<speech-command speech-pattern="^sync(?: (?<syncAction>on|off))?$" speech-function="Commands.sync"></speech-command>',
    '<speech-command speech-index="10" speech-pattern="^priority$" speech-function="Commands.priority"></speech-command>',
    '</speech-menu>',
    '<button id="page" speech-index="999" speech-pattern="^(?:show )?trip log$" speech-function="Commands.page">Trip Log</button>',
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
                "^(?:show )?trip log$"
            )
    ],
    [
        "trip log",
        "show trip log"
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
        "priority",
        "sync",
        "sync on",
        "sync off",
        "cancel",
        "details",
        "trip log",
        "show trip log"
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
        "trip log"
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
