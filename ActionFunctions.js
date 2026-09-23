(() => {
    "use strict";

    const implementations =
        new Map();

    const actions =
        Object.create(null);

    const verbPrefix =
        /^(?:add|apply|begin|cancel|change|choose|clear|close|confirm|connect|create|delete|defer|disable|disconnect|edit|enable|end|enter|hide|load|lock|move|open|prepare|release|remove|reorder|request|reset|resume|save|schedule|select|set|show|start|stop|submit|switch|toggle|unlock|update)/;

    const normalizeName =
        value =>
            String(value || "")
                .trim();

    const define =
        (
            name,
            implementation
        ) => {
            const normalized =
                normalizeName(name);

            if (
                !/^[A-Za-z_$][\w$]*$/
                    .test(normalized) ||
                !verbPrefix.test(
                    normalized
                )
            ) {
                throw new TypeError(
                    "Action function names must start with a verb: " +
                    normalized
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

            if (!actions[normalized]) {
                Object.defineProperty(
                    actions,
                    normalized,
                    {
                        configurable: false,
                        enumerable: true,
                        writable: false,
                        value(
                            ...args
                        ) {
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

    const defineAll =
        values => {
            for (
                const [
                    name,
                    implementation
                ] of Object.entries(
                    values || {}
                )
            ) {
                define(
                    name,
                    implementation
                );
            }

            return actions;
        };

    globalThis.WMOFActions =
        actions;

    globalThis.WMOFActionFunctions =
        Object.freeze({
            define,
            defineAll,

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
