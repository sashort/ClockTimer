import assert from "node:assert/strict";
import fs from "node:fs";
import {Window} from "happy-dom";

const window = new Window({
    url:
        "https://wmof.example/api/admin/speech-editor/"
});

window.structuredClone ??=
    globalThis.structuredClone;

window.eval(
    fs.readFileSync(
        new URL(
            "../api/admin/speech-editor/EditorActionFunctions.js",
            import.meta.url
        ),
        "utf8"
    )
);

const api =
    window.WMOFSpeechEditorActionFunctions;

const actions =
    window.WMOFSpeechEditorActions;

let state = {
    value:
        0
};

api.setStateProvider(
    () => state
);

api.setTransactionProvider({
    snapshot() {
        return structuredClone(
            state
        );
    },

    restore(
        snapshot
    ) {
        state =
            structuredClone(
                snapshot
            );
    }
});

api.define(
    "setValue",
    input => {
        state.value =
            Number(
                input.value
            );

        return state.value;
    },
    {
        description:
            "Set the test value.",
        input: {
            type:
                "object",
            required: [
                "value"
            ]
        }
    }
);

api.define(
    "changeValue",
    input => {
        state.value +=
            Number(
                input.delta
            );

        return state.value;
    }
);

api.define(
    "saveProbe",
    () =>
        true,
    {
        transactional:
            false
    }
);

api.define(
    "validateProbe",
    input => {
        if (
            input.fail
        ) {
            throw new Error(
                "probe failure"
            );
        }

        return true;
    },
    {
        mutates:
            false
    }
);

assert.equal(
    typeof actions.setValue,
    "function",
    "defined editor actions should be exposed"
);

assert.equal(
    (
        await api.execute({
            action:
                "setValue",
            input: {
                value:
                    4
            }
        })
    ),
    4
);

assert.equal(
    api.getState().value,
    4,
    "state provider should expose the current semantic editor state"
);

const manifest =
    api.getManifest();

assert.ok(
    manifest.actions.some(
        action =>
            action.name ===
                "setValue" &&
            action.description ===
                "Set the test value."
    ),
    "manifest should describe available editor actions"
);

await api.executeJSON(
    JSON.stringify({
        atomic:
            true,
        actions: [
            {
                action:
                    "setValue",
                input: {
                    value:
                        10
                }
            },
            {
                action:
                    "changeValue",
                input: {
                    delta:
                        5
                }
            }
        ]
    })
);

assert.equal(
    state.value,
    15,
    "atomic JSON batches should execute semantic actions in order"
);

await assert.rejects(
    () =>
        api.executeJSON({
            atomic:
                true,
            actions: [
                {
                    action:
                        "setValue",
                    input: {
                        value:
                            99
                    }
                },
                {
                    action:
                        "validateProbe",
                    input: {
                        fail:
                            true
                    }
                }
            ]
        }),
    /probe failure/
);

assert.equal(
    state.value,
    15,
    "failed atomic batches should restore the editor snapshot"
);

await assert.rejects(
    () =>
        api.executeJSON({
            atomic:
                true,
            actions: [
                {
                    action:
                        "saveProbe",
                    input: {}
                }
            ]
        }),
    /cannot run inside an atomic batch/
);

assert.equal(
    api.validateName(
        "speechThing"
    ).valid,
    false,
    "editor action names should start with a verb"
);

assert.equal(
    api.validateName(
        "setSpeechThing"
    ).valid,
    true
);

console.log(
    "PASS Speech Editor JSON action registry, manifest and atomic rollback"
);
