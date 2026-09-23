import assert from "node:assert/strict";
import fs from "node:fs";
import {Window} from "happy-dom";

const window = new Window({url:"https://wmof.example/"});

window.document.body.innerHTML = [
    '<button id="breakButton">Break</button>',
    '<speech-menu id="topMenu" speech-modal="top-level">',
    '<speech-command data-speech-editor-id="builtin:breakStart:page" data-speech-target="#breakButton" speech-pattern="^break start$" speech-function="WMOFActions.openBreakMenu"></speech-command>',
    '<speech-command data-speech-editor-id="builtin:breakStop:page" data-speech-target="#breakButton" speech-pattern="^break stop$" speech-function="WMOFActions.openBreakMenu"></speech-command>',
    '</speech-menu>'
].join("");

let refreshes = 0;

window.SpeechMenu = {
    refresh() {
        refreshes++;
    }
};

window.fetch =
    async () => ({
        ok:true,
        json:
            async () => ({
                entries:[]
            })
    });

for (
    const source of [
        "../SpeechFunctionRoles.js",
        "../SpeechFunctionRegistry.js",
        "../UtilityFunctions.js",
        "../SpeechProcessingFunctions.js",
        "../ActionFunctions.js",
        "../InteractionFunctions.js",
        "../PresentationSetters.js",
        "../SpeechEditorRuntime.js"
    ]
) {
    window.eval(
        fs.readFileSync(
            new URL(
                source,
                import.meta.url
            ),
            "utf8"
        )
    );
}

window.WMOFActionFunctions
    .define(
        "openBreakMenu",
        () => true
    );

window.WMOFSpeechProcessingFunctions
    .define(
        "normalizeSpeechValue",
        value => value
    );

window.WMOFInteractionFunctions
    .define(
        "openBreakMenuClick",
        () => true
    );

window.WMOFPresentationSetters
    .define(
        "setBreakPresentation",
        () => true
    );

window.WMOFUtilityFunctions
    .define(
        "formatBreakValue",
        value => String(value)
    );

await new Promise(
    resolve =>
        setTimeout(
            resolve,
            0
        )
);

const entries = [
    {
        id:"builtin:breakStart:page",
        kind:"existing",
        target:"#breakButton",
        order:1,
        attrs:{
            "speech-pattern":"^take a break$",
            "speech-function":"WMOFActions.openBreakMenu",
            "speech-index":"2"
        }
    },
    {
        id:"builtin:breakStop:page",
        kind:"existing",
        target:"#topMenu > speech-command:nth-of-type(2)",
        order:0,
        attrs:{
            "speech-pattern":"^stop break$",
            "speech-function":"WMOFActions.openBreakMenu",
            "speech-index":"5"
        }
    },
    {
        id:"edit:group:1",
        kind:"modal",
        target:"#breakButton",
        attrs:{
            "speech-modal":"top-level"
        }
    },
    {
        id:"edit:command:1",
        kind:"command",
        target:"#breakButton",
        parentId:"edit:group:1",
        attrs:{
            "speech-pattern":"^pause$",
            "speech-function":"WMOFActions.openBreakMenu"
        }
    },
    {
        id:"edit:attribute:1",
        kind:"attribute",
        target:"#breakButton",
        attrs:{
            "speech-pattern":"^break$",
            "speech-function":"WMOFActions.openBreakMenu",
            "speech-modal":""
        }
    }
];

window.WMOFSpeechEditorRuntime.apply(
    entries
);

assert.equal(
    window.document
        .querySelector(
            '[data-speech-editor-id="builtin:breakStart:page"]'
        )
        .getAttribute(
            "speech-pattern"
        ),
    "^take a break$"
);


assert.equal(
    window.document
        .querySelector(
            '[data-speech-editor-id="builtin:breakStart:page"]'
        )
        .getAttribute(
            "speech-index"
        ),
    "2"
);

assert.deepEqual(
    [
        ...window.document
            .querySelectorAll(
                "#topMenu > speech-command"
            )
    ]
        .map(
            element =>
                element.dataset
                    .speechEditorId
        )
        .slice(0, 2),
    [
        "builtin:breakStop:page",
        "builtin:breakStart:page"
    ],
    "persisted editor order should reorder speech-command siblings"
);

assert.equal(
    window.document
        .querySelector(
            "#breakButton"
        )
        .getAttribute(
            "speech-pattern"
        ),
    "^break$"
);

assert.equal(
    window.document
        .querySelector(
            "#breakButton"
        )
        .getAttribute(
            "speech-modal"
        ),
    "default"
);

const createdMenu =
    window.document
        .querySelector(
            'speech-menu[data-speech-editor-id="edit:group:1"]'
        );

assert.ok(
    createdMenu,
    "legacy modal config should materialize as speech-menu"
);

assert.equal(
    createdMenu
        .getAttribute(
            "speech-modal"
        ),
    "top-level"
);

assert.equal(
    createdMenu
        .querySelector(
            "speech-command"
        )
        .getAttribute(
            "speech-pattern"
        ),
    "^pause$"
);

assert.equal(
    createdMenu
        .previousElementSibling,
    window.document
        .querySelector(
            "#breakButton"
        ),
    "semantic menu should be associated next to its host element"
);

const functions =
    window.WMOFSpeechEditorRuntime
        .listFunctions();

assert.ok(
    functions.includes(
        "WMOFActions.openBreakMenu"
    )
);

assert.ok(
    functions.includes(
        "WMOFSpeechProcessing.normalizeSpeechValue"
    )
);


const roles =
    window.WMOFSpeechEditorRuntime
        .listFunctionRoles();

assert.ok(
    roles.speechProcessingFunctions.includes(
        "WMOFSpeechProcessing.normalizeSpeechValue"
    ),
    "speech-processing functions should populate speech-preproc choices"
);

assert.ok(
    !roles.actionFunctions.includes(
        "WMOFSpeechProcessing.normalizeSpeechValue"
    ),
    "speech-processing functions should be excluded from speech-function choices"
);

assert.ok(
    roles.actionFunctions.includes(
        "WMOFActions.openBreakMenu"
    ),
    "action functions should populate speech-function choices"
);

assert.ok(
    roles.interactionFunctions.includes(
        "WMOFInteractions.openBreakMenuClick"
    )
);

assert.ok(
    roles.presentationFunctions.includes(
        "WMOFPresentation.setBreakPresentation"
    )
);

assert.ok(
    roles.helperFunctions.includes(
        "WMOFUtilities.formatBreakValue"
    )
);

for (
    const hiddenName of [
        "WMOFInteractions.openBreakMenuClick",
        "WMOFPresentation.setBreakPresentation",
        "WMOFUtilities.formatBreakValue"
    ]
) {
    assert.ok(
        !roles.actionFunctions.includes(
            hiddenName
        ) &&
        !roles.speechProcessingFunctions.includes(
            hiddenName
        ),
        hiddenName +
            " should be excluded from both speech dropdown roles"
    );
}

assert.throws(
    () =>
        window.WMOFActionFunctions
            .define(
                "breakMenu",
                () => true
            ),
    /start with a verb/,
    "action function names should start with a verb"
);

assert.ok(
    !functions.some(
        name =>
            name.startsWith(
                "WMOFSpeechFunctionRegistry."
            )
    ),
    "registry helper methods should not appear as selectable speech functions"
);

assert.ok(
    refreshes >= 2
);

window.WMOFSpeechEditorRuntime.apply([
    entries[0]
]);

assert.equal(
    window.document
        .querySelectorAll(
            'speech-menu[data-speech-editor-id="edit:group:1"]'
        )
        .length,
    0
);

assert.equal(
    window.document
        .querySelectorAll(
            '[data-speech-editor-id="edit:command:1"]'
        )
        .length,
    0
);

console.log(
    "PASS speech editor runtime applies semantic speech menus and function discovery"
);
