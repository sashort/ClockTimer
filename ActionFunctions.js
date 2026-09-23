(() => {
    "use strict";

    const implementations = new Map();
    const sources = new Map();
    const metadata = new Map();
    const macros = new Map();
    const actions = Object.create(null);
    const events = new EventTarget();

    const actionVerbs = Object.freeze([
        "add","apply","begin","cancel","change","choose","clear","close",
        "confirm","connect","create","delete","defer","disable","disconnect",
        "edit","enable","end","enter","hide","load","lock","move","open",
        "prepare","release","remove","reorder","request","reset","resume",
        "save","schedule","select","set","show","start","stop","submit",
        "switch","toggle","unlock","update"
    ]);

    const verbPrefix = new RegExp(
        "^(?:" + actionVerbs.join("|") + ")"
    );

    let recording;
    let playbackDepth = 0;
    let contextProvider = () => ({});
    const macroStack = [];

    const normalizeName =
        value =>
            String(value || "")
                .trim();

    const plainObject =
        value =>
            Boolean(
                value &&
                typeof value === "object" &&
                !Array.isArray(
                    value
                ) &&
                Object.prototype
                    .toString
                    .call(
                        value
                    ) ===
                    "[object Object]"
            );

    const cloneLiteral =
        value => {
            if (value === undefined) {
                return {
                    __wmofMacroType:
                        "undefined"
                };
            }

            if (
                value === null ||
                typeof value === "string" ||
                typeof value === "number" ||
                typeof value === "boolean"
            ) {
                return value;
            }

            if (value instanceof Date) {
                return {
                    __wmofMacroType:
                        "date",
                    value:
                        value.toISOString()
                };
            }

            if (Array.isArray(value)) {
                return value.map(
                    cloneLiteral
                );
            }

            if (plainObject(value)) {
                return Object.fromEntries(
                    Object.entries(value)
                        .map(
                            ([key, child]) => [
                                key,
                                cloneLiteral(child)
                            ]
                        )
                );
            }

            return {
                __wmofMacroUnsupported:
                    value?.constructor?.name ||
                    typeof value,
                value:
                    String(value)
            };
        };

    const restoreLiteral =
        value => {
            if (Array.isArray(value)) {
                return value.map(
                    restoreLiteral
                );
            }

            if (plainObject(value)) {
                if (
                    value.__wmofMacroType ===
                    "undefined"
                ) {
                    return undefined;
                }

                if (
                    value.__wmofMacroType ===
                    "date"
                ) {
                    return new Date(
                        value.value
                    );
                }

                return Object.fromEntries(
                    Object.entries(value)
                        .map(
                            ([key, child]) => [
                                key,
                                restoreLiteral(child)
                            ]
                        )
                );
            }

            return value;
        };

    const containsUnsupported =
        value => {
            if (Array.isArray(value)) {
                return value.some(
                    containsUnsupported
                );
            }

            if (!plainObject(value)) {
                return false;
            }

            if (
                value.__wmofMacroUnsupported
            ) {
                return true;
            }

            return Object.values(value)
                .some(
                    containsUnsupported
                );
        };

    const emit =
        (type, detail) => {
            try {
                events.dispatchEvent(
                    new CustomEvent(
                        type,
                        {
                            detail
                        }
                    )
                );
            }
            catch {}
        };

    const validateName =
        (
            name,
            {
                allowExistingMacro = false
            } = {}
        ) => {
            const normalized =
                normalizeName(name);

            if (
                !/^[A-Za-z_$][\w$]*$/
                    .test(normalized)
            ) {
                return {
                    valid: false,
                    name:
                        normalized,
                    reason:
                        "Action function names must be valid JavaScript identifiers."
                };
            }

            if (
                !verbPrefix.test(
                    normalized
                )
            ) {
                return {
                    valid: false,
                    name:
                        normalized,
                    reason:
                        "Action function names must start with a verb."
                };
            }

            if (
                implementations.has(
                    normalized
                ) &&
                !(
                    allowExistingMacro &&
                    sources.get(
                        normalized
                    ) ===
                        "macro"
                )
            ) {
                return {
                    valid: false,
                    name:
                        normalized,
                    reason:
                        "An action function with this name already exists."
                };
            }

            return {
                valid: true,
                name:
                    normalized,
                reason:
                    ""
            };
        };

    const defineInternal =
        (
            name,
            implementation,
            definitionMetadata = {},
            source = "native"
        ) => {
            const normalized =
                normalizeName(name);

            const validation =
                validateName(
                    normalized,
                    {
                        allowExistingMacro:
                            source ===
                                "macro"
                    }
                );

            if (
                !validation.valid &&
                !(
                    implementations.has(
                        normalized
                    ) &&
                    sources.get(
                        normalized
                    ) === source
                )
            ) {
                throw new TypeError(
                    validation.reason +
                    (
                        normalized
                            ? " " + normalized
                            : ""
                    )
                );
            }

            if (
                typeof implementation !==
                    "function"
            ) {
                throw new TypeError(
                    normalized +
                    " action requires a function implementation."
                );
            }

            implementations.set(
                normalized,
                implementation
            );

            sources.set(
                normalized,
                source
            );

            metadata.set(
                normalized,
                {
                    ...(
                        metadata.get(
                            normalized
                        ) ||
                        {}
                    ),
                    ...(
                        definitionMetadata ||
                        {}
                    ),
                    source
                }
            );

            if (!actions[normalized]) {
                Object.defineProperty(
                    actions,
                    normalized,
                    {
                        configurable:
                            source ===
                                "macro",
                        enumerable: true,
                        writable: false,
                        value(
                            ...args
                        ) {
                            if (
                                recording &&
                                playbackDepth ===
                                    0
                            ) {
                                const step = {
                                    action:
                                        normalized,
                                    args:
                                        args.map(
                                            value => ({
                                                source:
                                                    "literal",
                                                value:
                                                    cloneLiteral(
                                                        value
                                                    )
                                            })
                                        )
                                };

                                recording.steps
                                    .push(
                                        step
                                    );

                                emit(
                                    "recorded",
                                    {
                                        step:
                                            structuredClone(
                                                step
                                            ),
                                        recording:
                                            structuredClone(
                                                recording
                                            )
                                    }
                                );
                            }

                            return implementations
                                .get(
                                    normalized
                                )
                                (...args);
                        }
                    }
                );
            }

            globalThis
                .WMOFSpeechFunctionRegistry
                ?.ensureRole?.(
                    "WMOFActions." +
                    normalized,
                    "action"
                );

            return actions[
                normalized
            ];
        };

    const define =
        (
            name,
            implementation,
            definitionMetadata
        ) =>
            defineInternal(
                name,
                implementation,
                definitionMetadata,
                "native"
            );

    const defineAll =
        values => {
            for (
                const [
                    name,
                    value
                ] of Object.entries(
                    values || {}
                )
            ) {
                if (
                    typeof value ===
                        "function"
                ) {
                    define(
                        name,
                        value
                    );
                    continue;
                }

                define(
                    name,
                    value?.implementation,
                    value?.metadata
                );
            }

            return actions;
        };

    const normalizeBinding =
        value => {
            const source =
                String(
                    value?.source ||
                    "literal"
                )
                    .toLowerCase();

            if (source === "parameter") {
                return {
                    source:
                        "parameter",
                    name:
                        normalizeName(
                            value?.name
                        )
                };
            }

            if (source === "context") {
                return {
                    source:
                        "context",
                    path:
                        String(
                            value?.path ||
                            ""
                        )
                            .trim()
                };
            }

            return {
                source:
                    "literal",
                value:
                    cloneLiteral(
                        value?.value
                    )
            };
        };

    const normalizeMacro =
        value => ({
            name:
                normalizeName(
                    value?.name
                ),
            parameters:
                Array.isArray(
                    value?.parameters
                )
                    ? value.parameters
                        .map(
                            parameter => ({
                                name:
                                    normalizeName(
                                        parameter?.name
                                    ),
                                type:
                                    String(
                                        parameter?.type ||
                                        "value"
                                    )
                                        .trim() ||
                                    "value",
                                ...(
                                    Object.prototype
                                        .hasOwnProperty
                                        .call(
                                            parameter ||
                                                {},
                                            "default"
                                        )
                                        ? {
                                            default:
                                                cloneLiteral(
                                                    parameter
                                                        .default
                                                )
                                        }
                                        : {}
                                )
                            })
                        )
                    : [],
            steps:
                Array.isArray(
                    value?.steps
                )
                    ? value.steps
                        .map(
                            step => ({
                                action:
                                    normalizeName(
                                        step?.action
                                    ),
                                args:
                                    Array.isArray(
                                        step?.args
                                    )
                                        ? step.args
                                            .map(
                                                normalizeBinding
                                            )
                                        : []
                            })
                        )
                    : []
        });

    const validateMacro =
        (
            value,
            {
                allowExistingMacro = true,
                requireActions = true
            } = {}
        ) => {
            const macro =
                normalizeMacro(
                    value
                );

            const nameValidation =
                validateName(
                    macro.name,
                    {
                        allowExistingMacro
                    }
                );

            if (!nameValidation.valid) {
                return {
                    valid: false,
                    macro,
                    reason:
                        nameValidation.reason
                };
            }

            if (!macro.steps.length) {
                return {
                    valid: false,
                    macro,
                    reason:
                        "A macro needs at least one action."
                };
            }

            const parameterNames =
                new Set();

            for (
                const parameter of
                macro.parameters
            ) {
                if (
                    !/^[A-Za-z_$][\w$]*$/
                        .test(
                            parameter.name
                        )
                ) {
                    return {
                        valid: false,
                        macro,
                        reason:
                            "Macro parameter names must be valid identifiers."
                    };
                }

                if (
                    parameterNames.has(
                        parameter.name
                    )
                ) {
                    return {
                        valid: false,
                        macro,
                        reason:
                            "Macro parameter names must be unique."
                    };
                }

                if (
                    Object.prototype
                        .hasOwnProperty
                        .call(
                            parameter,
                            "default"
                        ) &&
                    containsUnsupported(
                        parameter.default
                    )
                ) {
                    return {
                        valid: false,
                        macro,
                        reason:
                            "Macro parameter defaults must be serializable."
                    };
                }

                parameterNames.add(
                    parameter.name
                );
            }

            for (
                const step of
                macro.steps
            ) {
                if (
                    !/^[A-Za-z_$][\w$]*$/
                        .test(
                            step.action
                        )
                ) {
                    return {
                        valid: false,
                        macro,
                        reason:
                            "Macro steps must reference action function names."
                    };
                }

                if (
                    step.action ===
                    macro.name
                ) {
                    return {
                        valid: false,
                        macro,
                        reason:
                            "A macro cannot call itself."
                    };
                }

                if (
                    requireActions &&
                    !implementations.has(
                        step.action
                    ) &&
                    !macros.has(
                        step.action
                    )
                ) {
                    return {
                        valid: false,
                        macro,
                        reason:
                            "Macro action was not found: " +
                            step.action
                    };
                }

                for (
                    const argument of
                    step.args
                ) {
                    if (
                        argument.source ===
                            "parameter" &&
                        !parameterNames.has(
                            argument.name
                        )
                    ) {
                        return {
                            valid: false,
                            macro,
                            reason:
                                "Macro parameter was not found: " +
                                argument.name
                        };
                    }

                    if (
                        argument.source ===
                            "literal" &&
                        containsUnsupported(
                            argument.value
                        )
                    ) {
                        return {
                            valid: false,
                            macro,
                            reason:
                                "Recorded argument must be changed to a parameter or context value before saving."
                        };
                    }
                }
            }

            return {
                valid: true,
                macro,
                reason:
                    ""
            };
        };

    const contextValue =
        (
            context,
            path
        ) => {
            if (!path) {
                return context;
            }

            let value =
                context;

            for (
                const part of
                String(path)
                    .split(".")
                    .filter(Boolean)
            ) {
                if (
                    [
                        "__proto__",
                        "prototype",
                        "constructor"
                    ].includes(part)
                ) {
                    return undefined;
                }

                value =
                    value?.[part];
            }

            return value;
        };

    const resolveBinding =
        (
            binding,
            parameters,
            context
        ) => {
            if (
                binding.source ===
                "parameter"
            ) {
                return parameters[
                    binding.name
                ];
            }

            if (
                binding.source ===
                "context"
            ) {
                return contextValue(
                    context,
                    binding.path
                );
            }

            return restoreLiteral(
                binding.value
            );
        };

    const getContext =
        explicit => {
            if (
                explicit !==
                    undefined
            ) {
                return explicit;
            }

            try {
                return (
                    contextProvider?.() ||
                    {}
                );
            }
            catch {
                return {};
            }
        };

    const runMacro =
        async (
            name,
            supplied = {},
            explicitContext
        ) => {
            const normalized =
                normalizeName(name);

            const macro =
                macros.get(
                    normalized
                );

            if (!macro) {
                throw new Error(
                    "Macro not found: " +
                    normalized
                );
            }

            if (
                macroStack.includes(
                    normalized
                )
            ) {
                throw new Error(
                    "Recursive macro invocation: " +
                    [
                        ...macroStack,
                        normalized
                    ].join(
                        " -> "
                    )
                );
            }

            const suppliedValues =
                Array.isArray(
                    supplied
                )
                    ? Object.fromEntries(
                        macro.parameters
                            .map(
                                (
                                    parameter,
                                    index
                                ) => [
                                    parameter.name,
                                    supplied[
                                        index
                                    ]
                                ]
                            )
                    )
                    : (
                        plainObject(
                            supplied
                        )
                            ? supplied
                            : {}
                    );

            const parameters = {};

            for (
                const parameter of
                macro.parameters
            ) {
                if (
                    Object.prototype
                        .hasOwnProperty
                        .call(
                            suppliedValues,
                            parameter.name
                        )
                ) {
                    parameters[
                        parameter.name
                    ] =
                        suppliedValues[
                            parameter.name
                        ];
                }
                else if (
                    Object.prototype
                        .hasOwnProperty
                        .call(
                            parameter,
                            "default"
                        )
                ) {
                    parameters[
                        parameter.name
                    ] =
                        restoreLiteral(
                            parameter
                                .default
                        );
                }
                else {
                    parameters[
                        parameter.name
                    ] =
                        undefined;
                }
            }

            const context =
                getContext(
                    explicitContext
                );

            macroStack.push(
                normalized
            );
            playbackDepth += 1;

            try {
                let result = true;

                for (
                    const step of
                    macro.steps
                ) {
                    const action =
                        actions[
                            step.action
                        ];

                    if (
                        typeof action !==
                            "function"
                    ) {
                        throw new Error(
                            "Macro action was not found: " +
                            step.action
                        );
                    }

                    const args =
                        step.args
                            .map(
                                binding =>
                                    resolveBinding(
                                        binding,
                                        parameters,
                                        context
                                    )
                            );

                    result =
                        await action(
                            ...args
                        );

                    if (
                        result ===
                            false
                    ) {
                        return false;
                    }
                }

                return result;
            }
            finally {
                playbackDepth -= 1;
                macroStack.pop();
            }
        };

    const invokeMacro =
        (
            name,
            args
        ) => {
            const macro =
                macros.get(
                    name
                );

            let supplied;

            if (
                args.length === 1 &&
                plainObject(
                    args[0]
                )
            ) {
                supplied =
                    args[0];
            }
            else {
                supplied =
                    Object.fromEntries(
                        macro.parameters
                            .map(
                                (
                                    parameter,
                                    index
                                ) => [
                                    parameter.name,
                                    args[index]
                                ]
                            )
                    );
            }

            return runMacro(
                name,
                supplied
            );
        };

    const registerMacro =
        value => {
            const firstPass =
                validateMacro(
                    value,
                    {
                        allowExistingMacro:
                            true,
                        requireActions:
                            false
                    }
                );

            if (!firstPass.valid) {
                throw new TypeError(
                    firstPass.reason
                );
            }

            const macro =
                firstPass.macro;

            macros.set(
                macro.name,
                macro
            );

            defineInternal(
                macro.name,
                (
                    ...args
                ) =>
                    invokeMacro(
                        macro.name,
                        args
                    ),
                {
                    macro: true,
                    parameters:
                        macro.parameters
                },
                "macro"
            );

            const validation =
                validateMacro(
                    macro,
                    {
                        allowExistingMacro:
                            true,
                        requireActions:
                            true
                    }
                );

            if (!validation.valid) {
                macros.delete(
                    macro.name
                );
                implementations.delete(
                    macro.name
                );
                sources.delete(
                    macro.name
                );
                metadata.delete(
                    macro.name
                );

                try {
                    delete actions[
                        macro.name
                    ];
                }
                catch {}

                throw new TypeError(
                    validation.reason
                );
            }

            emit(
                "macroschanged",
                {
                    macros:
                        [...macros.values()]
                }
            );

            return actions[
                macro.name
            ];
        };

    const removeMacro =
        name => {
            const normalized =
                normalizeName(name);

            if (
                sources.get(
                    normalized
                ) !==
                    "macro"
            ) {
                return false;
            }

            macros.delete(
                normalized
            );
            implementations.delete(
                normalized
            );
            sources.delete(
                normalized
            );
            metadata.delete(
                normalized
            );

            try {
                delete actions[
                    normalized
                ];
            }
            catch {}

            emit(
                "macroschanged",
                {
                    macros:
                        [...macros.values()]
                }
            );

            return true;
        };

    const registerMacros =
        values => {
            const incoming =
                Array.isArray(
                    values
                )
                    ? values
                    : [];

            const normalized = [];
            const names =
                new Set();

            for (
                const value of
                incoming
            ) {
                const validation =
                    validateMacro(
                        value,
                        {
                            allowExistingMacro:
                                true,
                            requireActions:
                                false
                        }
                    );

                if (!validation.valid) {
                    throw new TypeError(
                        validation.reason
                    );
                }

                if (
                    names.has(
                        validation
                            .macro
                            .name
                    )
                ) {
                    throw new TypeError(
                        "Macro names must be unique."
                    );
                }

                names.add(
                    validation
                        .macro
                        .name
                );

                normalized.push(
                    validation
                        .macro
                );
            }

            const availableActions =
                new Set(
                    [
                        ...implementations
                            .keys()
                    ]
                        .filter(
                            name =>
                                sources.get(
                                    name
                                ) !==
                                    "macro"
                        )
                );

            for (
                const name of
                names
            ) {
                availableActions.add(
                    name
                );
            }

            for (
                const macro of
                normalized
            ) {
                for (
                    const step of
                    macro.steps
                ) {
                    if (
                        !availableActions
                            .has(
                                step.action
                            )
                    ) {
                        throw new TypeError(
                            "Macro action was not found: " +
                            step.action
                        );
                    }
                }
            }

            for (
                const name of
                [...macros.keys()]
            ) {
                if (
                    !names.has(
                        name
                    )
                ) {
                    removeMacro(
                        name
                    );
                }
            }

            for (
                const macro of
                normalized
            ) {
                macros.set(
                    macro.name,
                    macro
                );

                defineInternal(
                    macro.name,
                    (
                        ...args
                    ) =>
                        invokeMacro(
                            macro.name,
                            args
                        ),
                    {
                        macro: true,
                        parameters:
                            macro.parameters
                    },
                    "macro"
                );
            }

            emit(
                "macroschanged",
                {
                    macros:
                        [...macros.values()]
                }
            );

            return [
                ...macros.values()
            ];
        };

    globalThis.WMOFActions =
        actions;

    globalThis.WMOFActionFunctions =
        Object.freeze({
            define,
            defineAll,
            events,
            actionVerbs,

            validateName,

            validateMacro,

            registerMacro,

            registerMacros,

            removeMacro,

            runMacro,

            getMacros() {
                return structuredClone(
                    [
                        ...macros.values()
                    ]
                );
            },

            setContextProvider(
                provider
            ) {
                if (
                    typeof provider !==
                        "function"
                ) {
                    throw new TypeError(
                        "Macro context provider must be a function."
                    );
                }

                contextProvider =
                    provider;

                return this;
            },

            startRecording(
                {
                    name = ""
                } = {}
            ) {
                recording = {
                    name:
                        normalizeName(
                            name
                        ),
                    steps: []
                };

                emit(
                    "recordingchanged",
                    {
                        recording:
                            structuredClone(
                                recording
                            )
                    }
                );

                return structuredClone(
                    recording
                );
            },

            stopRecording() {
                const result =
                    recording
                        ? structuredClone(
                            recording
                        )
                        : {
                            name: "",
                            steps: []
                        };

                recording =
                    undefined;

                emit(
                    "recordingchanged",
                    {
                        recording:
                            undefined
                    }
                );

                return result;
            },

            clearRecording() {
                if (recording) {
                    recording.steps =
                        [];
                }

                emit(
                    "recordingchanged",
                    {
                        recording:
                            recording
                                ? structuredClone(
                                    recording
                                )
                                : undefined
                    }
                );

                return this.getRecording();
            },

            getRecording() {
                return recording
                    ? structuredClone(
                        recording
                    )
                    : undefined;
            },

            isRecording() {
                return Boolean(
                    recording
                );
            },

            describe(name) {
                const normalized =
                    normalizeName(name);

                return {
                    name:
                        normalized,
                    ...(
                        metadata.get(
                            normalized
                        ) ||
                        {}
                    )
                };
            },

            setMetadata(
                name,
                value
            ) {
                const normalized =
                    normalizeName(name);

                if (
                    !implementations.has(
                        normalized
                    )
                ) {
                    throw new Error(
                        "Action function was not found: " +
                        normalized
                    );
                }

                metadata.set(
                    normalized,
                    {
                        ...(
                            metadata.get(
                                normalized
                            ) ||
                            {}
                        ),
                        ...(
                            value ||
                            {}
                        )
                    }
                );

                return this.describe(
                    normalized
                );
            },

            has(name) {
                return implementations
                    .has(
                        normalizeName(
                            name
                        )
                    );
            },

            list() {
                return [
                    ...implementations
                        .keys()
                ].sort(
                    (a, b) =>
                        a.localeCompare(b)
                );
            }
        });
})();
