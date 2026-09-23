(() => {
    "use strict";

    const interactions =
        Object.create(null);

    const registry =
        globalThis
            .WMOFSpeechFunctionRegistry;

    const define =
        (
            name,
            implementation
        ) => {
            const normalized =
                String(name || "")
                    .trim();

            if (
                !/^[A-Za-z_$][\w$]*$/
                    .test(normalized) ||
                typeof implementation !==
                    "function"
            ) {
                throw new TypeError(
                    "Invalid interaction function: " +
                    normalized
                );
            }

            interactions[
                normalized
            ] =
                implementation;

            registry
                ?.ensureRole?.(
                    "WMOFInteractions." +
                    normalized,
                    "interaction"
                );

            return implementation;
        };

    const bindAction =
        ({
            element,
            event,
            name,
            action,
            args,
            preventDefault = false,
            stopPropagation = false,
            options
        }) => {
            if (
                !element ||
                !event ||
                !name ||
                !action
            ) {
                return undefined;
            }

            const handler =
                define(
                    name,
                    interactionEvent => {
                        if (
                            preventDefault
                        ) {
                            interactionEvent
                                .preventDefault();
                        }

                        if (
                            stopPropagation
                        ) {
                            interactionEvent
                                .stopPropagation();
                        }

                        const values =
                            typeof args ===
                                "function"
                                ? args(
                                    interactionEvent
                                )
                                : [];

                        return globalThis
                            .WMOFActions
                            ?.[action]
                            ?.(
                                ...(
                                    Array.isArray(
                                        values
                                    )
                                        ? values
                                        : [values]
                                )
                            );
                    }
                );

            element.addEventListener(
                event,
                handler,
                options
            );

            return handler;
        };

    globalThis.WMOFInteractions =
        interactions;

    globalThis.WMOFInteractionFunctions =
        Object.freeze({
            define,
            bindAction
        });
})();
