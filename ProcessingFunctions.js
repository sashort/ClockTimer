(() => {
    "use strict";

    const processing =
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
                    "Invalid processing function: " +
                    normalized
                );
            }

            processing[
                normalized
            ] =
                implementation;

            globalThis
                .WMOFSpeechFunctionRegistry
                ?.ensureRole?.(
                    "WMOFProcessing." +
                    normalized,
                    "processing"
                );

            return implementation;
        };

    globalThis.WMOFProcessing =
        processing;

    globalThis.WMOFProcessingFunctions =
        Object.freeze({
            define
        });
})();
