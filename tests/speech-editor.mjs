import assert from "node:assert/strict";
import fs from "node:fs";
import {Window} from "happy-dom";

const window = new Window({url:"https://wmof.example/"});

window.document.body.innerHTML = [
    '<button id="breakButton">Break</button>',
    '<speech-menu id="topMenu" speech-modal="top-level">',
    '<speech-command data-speech-editor-id="builtin:breakStart:page" data-speech-target="#breakButton" speech-pattern="^break start$" speech-function="WMOFSpeechCommands.breakStart"></speech-command>',
    '</speech-menu>'
].join("");

window.WMOFSpeechCommands = {
    breakStart() {}
};

window.WMOFSpeechPreprocess = {
    normalize(value) {
        return value;
    }
};

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

window.eval(
    fs.readFileSync(
        new URL(
            "../SpeechEditorRuntime.js",
            import.meta.url
        ),
        "utf8"
    )
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
        attrs:{
            "speech-pattern":"^take a break$",
            "speech-function":"WMOFSpeechCommands.breakStart"
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
            "speech-function":"WMOFSpeechCommands.breakStart"
        }
    },
    {
        id:"edit:attribute:1",
        kind:"attribute",
        target:"#breakButton",
        attrs:{
            "speech-pattern":"^break$",
            "speech-function":"WMOFSpeechCommands.breakStart",
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
        "WMOFSpeechCommands.breakStart"
    )
);

assert.ok(
    functions.includes(
        "WMOFSpeechPreprocess.normalize"
    )
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
