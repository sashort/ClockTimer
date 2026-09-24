import assert from "node:assert/strict";
import fs from "node:fs";
import {Window} from "happy-dom";

const window = new Window({
    url:
        "https://wmof.example/"
});

window.structuredClone ??=
    globalThis.structuredClone;

for (
    const source of [
        "../SpeechFunctionRoles.js",
        "../SpeechFunctionRegistry.js",
        "../ActionFunctions.js"
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

let probe;
let contextProbe;

window.WMOFActionFunctions
    .define(
        "setMacroProbe",
        value => {
            probe =
                value;

            return value;
        },
        {
            parameters: [
                {
                    name:
                        "value",
                    type:
                        "number"
                }
            ]
        }
    );

window.WMOFActionFunctions
    .define(
        "setContextProbe",
        value => {
            contextProbe =
                value;

            return value;
        }
    );

assert.equal(
    window.WMOFActionFunctions
        .validateName(
            "macroProbe"
        )
        .valid,
    false,
    "macro names without a verb should be rejected"
);

assert.equal(
    window.WMOFActionFunctions
        .validateName(
            "startMacroProbe"
        )
        .valid,
    true,
    "macro names that start with an action verb should be accepted"
);

for (
    const name of [
        "continueMacroProbe",
        "cycleMacroProbe",
        "readMacroProbe",
        "runMacroProbe",
        "connectMacroProbe"
    ]
) {
    assert.equal(
        window.WMOFActionFunctions
            .validateName(
                name
            )
            .valid,
        true,
        name +
            " should be accepted by the action verb registry"
    );
}

window.WMOFActionFunctions
    .defineAll({
        continueRegistrationProbe() {
            return true;
        },

        cycleRegistrationProbe() {
            return true;
        },

        readRegistrationProbe() {
            return true;
        },

        runRegistrationProbe() {
            return true;
        },

        connectRegistrationProbe() {
            return true;
        }
    });

assert.equal(
    typeof window.WMOFActions
        .readRegistrationProbe,
    "function",
    "read actions should satisfy the action verb contract"
);

assert.equal(
    typeof window.WMOFActions
        .connectRegistrationProbe,
    "function",
    "defineAll should continue registering actions after continue/cycle/read/run verbs"
);

let interruptedSignal;
let interruptedAction;

window.WMOFActionFunctions
    .define(
        "openInterruptProbe",
        () => {
            const context =
                window
                    .WMOFActionFunctions
                    .invocationContext;

            interruptedSignal =
                context.signal;

            return new Promise(
                resolve =>
                    interruptedSignal
                        .addEventListener(
                            "abort",
                            () =>
                                resolve(
                                    true
                                ),
                            {
                                once:
                                    true
                            }
                        )
            );
        },
        {
            interruptGroup:
                "probe-surface"
        }
    );

window.WMOFActionFunctions
    .define(
        "closeInterruptProbe",
        () => {
            interruptedAction =
                window
                    .WMOFActionFunctions
                    .invocationContext
                    ?.interruptedAction;

            return true;
        },
        {
            interruptGroup:
                "probe-surface"
        }
    );

const pendingInterrupt =
    window.WMOFActions
        .openInterruptProbe();

assert.equal(
    window.WMOFActionFunctions
        .isInterruptGroupActive(
            "probe-surface"
        ),
    true,
    "an async action should keep its interrupt group active"
);

assert.equal(
    window.WMOFActions
        .closeInterruptProbe(),
    true,
    "a complementary action should execute without waiting for the first action"
);

assert.equal(
    interruptedSignal.aborted,
    true,
    "the newer action should abort the older action in the same interrupt group"
);

assert.equal(
    interruptedAction,
    "openInterruptProbe",
    "the newer action should know which complementary action it interrupted"
);

await pendingInterrupt;

assert.equal(
    window.WMOFActionFunctions
        .isInterruptGroupActive(
            "probe-surface"
        ),
    false,
    "the interrupt group should settle after the replacement action completes"
);

window.WMOFActionFunctions
    .startRecording();

window.WMOFActions
    .setMacroProbe(
        105
    );

const recording =
    window.WMOFActionFunctions
        .stopRecording();

assert.deepEqual(
    recording.steps,
    [
        {
            action:
                "setMacroProbe",
            args: [
                {
                    source:
                        "literal",
                    value:
                        105
                }
            ]
        }
    ],
    "recording should preserve action arguments"
);

window.WMOFActionFunctions
    .setContextProvider(
        () => ({
            currentTrip: {
                id:
                    "trip-123"
            }
        })
    );

window.WMOFActionFunctions
    .registerMacro({
        name:
            "startMacroProbe",
        parameters: [
            {
                name:
                    "goal",
                type:
                    "percent",
                default:
                    100
            }
        ],
        steps: [
            {
                action:
                    "setMacroProbe",
                args: [
                    {
                        source:
                            "parameter",
                        name:
                            "goal"
                    }
                ]
            },
            {
                action:
                    "setContextProbe",
                args: [
                    {
                        source:
                            "context",
                        path:
                            "currentTrip.id"
                    }
                ]
            }
        ]
    });

assert.equal(
    typeof window.WMOFActions
        .startMacroProbe,
    "function",
    "saved macros should register as WMOFActions functions"
);

await window.WMOFActions
    .startMacroProbe(
        110
    );

assert.equal(
    probe,
    110,
    "positional macro arguments should bind by parameter order"
);

assert.equal(
    contextProbe,
    "trip-123",
    "context arguments should resolve from the semantic macro context"
);

await window.WMOFActionFunctions
    .runMacro(
        "startMacroProbe",
        {
            goal:
                95
        }
    );

assert.equal(
    probe,
    95,
    "named macro bindings should override defaults"
);

assert.throws(
    () =>
        window.WMOFActionFunctions
            .registerMacro({
                name:
                    "setMacroProbe",
                parameters:
                    [],
                steps: [
                    {
                        action:
                            "setContextProbe",
                        args:
                            []
                    }
                ]
            }),
    /already exists/,
    "macros should not replace native action functions"
);

console.log(
    "PASS action macro recording, parameters, context, validation and registration"
);
