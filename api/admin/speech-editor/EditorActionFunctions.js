(() => {
    "use strict";

    const implementations =
        new Map();

    const metadata =
        new Map();

    const actions =
        Object.create(null);

    const events =
        new EventTarget();

    const verbPrefix =
        /^(?:add|apply|begin|cancel|change|choose|clear|close|confirm|connect|create|delete|defer|disable|discard|disconnect|edit|enable|end|enter|get|hide|load|lock|move|open|prepare|release|reload|remove|reorder|request|reset|resume|run|save|schedule|select|set|show|stage|start|stop|submit|switch|test|toggle|unlock|update|validate)/;

    let stateProvider =
        () => ({});

    let mutationAllowedProvider =
        () => true;

    let transactionProvider;

    const normalizeName =
        value =>
            String(value || "")
                .trim();

    const clone =
        value =>
            value === undefined
                ? undefined
                : structuredClone(
                    value
                );

    const validateName =
        name => {
            const normalized =
                normalizeName(
                    name
                );

            if (
                !/^[A-Za-z_$][\w$]*$/
                    .test(
                        normalized
                    )
            ) {
                return {
                    valid:
                        false,
                    name:
                        normalized,
                    reason:
                        "Editor action names must be valid JavaScript identifiers."
                };
            }

            if (
                !verbPrefix.test(
                    normalized
                )
            ) {
                return {
                    valid:
                        false,
                    name:
                        normalized,
                    reason:
                        "Editor action names must start with a verb."
                };
            }

            return {
                valid:
                    true,
                name:
                    normalized,
                reason:
                    ""
            };
        };

    const emit =
        (
            type,
            detail
        ) => {
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

    const define =
        (
            name,
            implementation,
            definition = {}
        ) => {
            const validation =
                validateName(
                    name
                );

            if (
                !validation.valid
            ) {
                throw new TypeError(
                    validation.reason +
                    (
                        validation.name
                            ? " " +
                                validation.name
                            : ""
                    )
                );
            }

            if (
                typeof implementation !==
                    "function"
            ) {
                throw new TypeError(
                    validation.name +
                    " editor action requires a function implementation."
                );
            }

            implementations.set(
                validation.name,
                implementation
            );

            metadata.set(
                validation.name,
                {
                    description:
                        String(
                            definition
                                ?.description ||
                            ""
                        ),
                    input:
                        clone(
                            definition
                                ?.input ||
                            {
                                type:
                                    "object"
                            }
                        ),
                    output:
                        clone(
                            definition
                                ?.output
                        ),
                    mutates:
                        definition
                            ?.mutates !==
                        false,
                    transactional:
                        definition
                            ?.transactional !==
                        false,
                    examples:
                        clone(
                            Array.isArray(
                                definition?.examples
                            )
                                ? definition.examples
                                : []
                        )
                }
            );

            if (
                !actions[
                    validation.name
                ]
            ) {
                Object.defineProperty(
                    actions,
                    validation.name,
                    {
                        enumerable:
                            true,
                        configurable:
                            false,
                        writable:
                            false,
                        value(
                            input = {}
                        ) {
                            return implementations
                                .get(
                                    validation.name
                                )
                                (
                                    input ??
                                    {}
                                );
                        }
                    }
                );
            }

            return actions[
                validation.name
            ];
        };

    const normalizeCommand =
        value => {
            if (
                typeof value ===
                    "string"
            ) {
                return normalizeCommand(
                    JSON.parse(
                        value
                    )
                );
            }

            if (
                !value ||
                typeof value !==
                    "object" ||
                Array.isArray(
                    value
                )
            ) {
                throw new TypeError(
                    "Editor commands must be JSON objects."
                );
            }

            const action =
                normalizeName(
                    value.action
                );

            if (!action) {
                throw new TypeError(
                    "Editor command is missing action."
                );
            }

            return {
                action,
                input:
                    value.input ??
                    value.params ??
                    {}
            };
        };

    const execute =
        async command => {
            const normalized =
                normalizeCommand(
                    command
                );

            const action =
                actions[
                    normalized.action
                ];

            if (
                typeof action !==
                    "function"
            ) {
                throw new Error(
                    "Unknown Speech Editor action: " +
                    normalized.action
                );
            }

            const definition =
                metadata.get(
                    normalized.action
                );

            if (
                definition
                    ?.mutates !==
                    false &&
                !mutationAllowedProvider()
            ) {
                throw new Error(
                    "Developer permission is required for Speech Editor changes."
                );
            }

            emit(
                "beforeaction",
                clone(
                    normalized
                )
            );

            try {
                const result =
                    await action(
                        normalized.input
                    );

                const detail = {
                    ...clone(
                        normalized
                    ),
                    result:
                        clone(
                            result
                        )
                };

                emit(
                    "actioncompleted",
                    detail
                );

                return result;
            }
            catch (
                error
            ) {
                emit(
                    "actionfailed",
                    {
                        ...clone(
                            normalized
                        ),
                        message:
                            error
                                ?.message ||
                            String(
                                error
                            )
                    }
                );

                throw error;
            }
        };

    const executeBatch =
        async (
            commands,
            {
                atomic = false,
                continueOnError = false
            } = {}
        ) => {
            if (
                !Array.isArray(
                    commands
                )
            ) {
                throw new TypeError(
                    "Editor action batches require an actions array."
                );
            }

            if (atomic) {
                for (
                    const command of
                    commands
                ) {
                    const normalized =
                        normalizeCommand(
                            command
                        );

                    const definition =
                        metadata.get(
                            normalized.action
                        );

                    if (
                        definition &&
                        definition.transactional ===
                            false
                    ) {
                        throw new Error(
                            "Action cannot run inside an atomic batch: " +
                            normalized.action
                        );
                    }
                }
            }

            let snapshot;

            if (
                atomic &&
                transactionProvider
                    ?.snapshot
            ) {
                snapshot =
                    await transactionProvider
                        .snapshot();
            }

            const results = [];

            try {
                for (
                    const command of
                    commands
                ) {
                    try {
                        results.push({
                            ok:
                                true,
                            result:
                                await execute(
                                    command
                                )
                        });
                    }
                    catch (
                        error
                    ) {
                        results.push({
                            ok:
                                false,
                            error:
                                error
                                    ?.message ||
                                String(
                                    error
                                )
                        });

                        if (
                            !continueOnError
                        ) {
                            throw error;
                        }
                    }
                }
            }
            catch (
                error
            ) {
                if (
                    atomic &&
                    snapshot !==
                        undefined &&
                    transactionProvider
                        ?.restore
                ) {
                    await transactionProvider
                        .restore(
                            snapshot
                        );
                }

                throw error;
            }

            return results;
        };

    const executeJSON =
        async value => {
            const parsed =
                typeof value ===
                    "string"
                    ? JSON.parse(
                        value
                    )
                    : value;

            if (
                Array.isArray(
                    parsed
                )
            ) {
                return executeBatch(
                    parsed
                );
            }

            if (
                parsed &&
                typeof parsed ===
                    "object" &&
                Array.isArray(
                    parsed.actions
                )
            ) {
                return executeBatch(
                    parsed.actions,
                    {
                        atomic:
                            Boolean(
                                parsed.atomic
                            ),
                        continueOnError:
                            Boolean(
                                parsed
                                    .continueOnError
                            )
                    }
                );
            }

            return execute(
                parsed
            );
        };

    const getManifest =
        () => ({
            version:
                1,
            capabilities: {
                atomicBatches:
                    true,
                rollbackOnError:
                    true,
                nonTransactionalActionsRejectedFromAtomicBatches:
                    true,
                stateSnapshots:
                    true
            },
            commandShape: {
                action:
                    "actionName",
                input: {}
            },
            batchShape: {
                atomic:
                    true,
                continueOnError:
                    false,
                actions: [
                    {
                        action:
                            "actionName",
                        input: {}
                    }
                ]
            },
            actions:
                [
                    ...implementations
                        .keys()
                ]
                    .sort(
                        (
                            left,
                            right
                        ) =>
                            left.localeCompare(
                                right
                            )
                    )
                    .map(
                        name => ({
                            name,
                            ...clone(
                                metadata.get(
                                    name
                                )
                            )
                        })
                    )
        });

    globalThis
        .WMOFSpeechEditorActions =
        actions;

    globalThis
        .WMOFSpeechEditorActionFunctions =
        Object.freeze({
            define,
            execute,
            executeBatch,
            executeJSON,
            events,
            validateName,

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
                ]
                    .sort(
                        (
                            left,
                            right
                        ) =>
                            left.localeCompare(
                                right
                            )
                    );
            },

            describe(name) {
                const normalized =
                    normalizeName(
                        name
                    );

                if (
                    !metadata.has(
                        normalized
                    )
                ) {
                    return undefined;
                }

                return {
                    name:
                        normalized,
                    ...clone(
                        metadata.get(
                            normalized
                        )
                    )
                };
            },

            setMetadata(
                name,
                value
            ) {
                const normalized =
                    normalizeName(
                        name
                    );

                if (
                    !metadata.has(
                        normalized
                    )
                ) {
                    throw new Error(
                        "Speech Editor action was not found: " +
                        normalized
                    );
                }

                metadata.set(
                    normalized,
                    {
                        ...metadata.get(
                            normalized
                        ),
                        ...clone(
                            value ||
                            {}
                        )
                    }
                );

                return this.describe(
                    normalized
                );
            },

            getManifest,

            getState() {
                return clone(
                    stateProvider?.() ||
                    {}
                );
            },

            setStateProvider(
                provider
            ) {
                if (
                    typeof provider !==
                        "function"
                ) {
                    throw new TypeError(
                        "Speech Editor state provider must be a function."
                    );
                }

                stateProvider =
                    provider;

                return this;
            },

            setMutationAllowedProvider(
                provider
            ) {
                if (
                    typeof provider !==
                        "function"
                ) {
                    throw new TypeError(
                        "Speech Editor mutation permission provider must be a function."
                    );
                }

                mutationAllowedProvider =
                    provider;

                return this;
            },

            setTransactionProvider(
                provider
            ) {
                if (
                    !provider ||
                    typeof provider
                        .snapshot !==
                        "function" ||
                    typeof provider
                        .restore !==
                        "function"
                ) {
                    throw new TypeError(
                        "Speech Editor transaction provider requires snapshot() and restore()."
                    );
                }

                transactionProvider =
                    provider;

                return this;
            }
        });
})();
