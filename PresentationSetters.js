(() => {
    "use strict";

    const presentation =
        Object.create(null);

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
                    "Invalid presentation setter: " +
                    normalized
                );
            }

            presentation[
                normalized
            ] =
                implementation;

            globalThis
                .WMOFSpeechFunctionRegistry
                ?.ensureRole?.(
                    "WMOFPresentation." +
                    normalized,
                    "presentation"
                );

            return implementation;
        };

    globalThis.WMOFPresentation =
        presentation;

    globalThis.WMOFPresentationSetters =
        Object.freeze({
            define
        });
})();
