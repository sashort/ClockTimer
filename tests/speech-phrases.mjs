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
    page() {}
};

window.document.body.innerHTML = [
    '<speech-menu id="top" speech-modal="top-level">',
    '<speech-command speech-pattern="^sync(?: (?<syncAction>on|off))?$" speech-function="Commands.sync"></speech-command>',
    '</speech-menu>',
    '<button id="page" speech-pattern="^(?:show )?trip log$" speech-function="Commands.page">Trip Log</button>',
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

SpeechMenu
    .extrapolatePhrases();

assert.deepEqual(
    [
        ...SpeechMenu.phrases
    ],
    [
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

console.log(
    "PASS SpeechMenu extrapolates available phrases using live precedence"
);
