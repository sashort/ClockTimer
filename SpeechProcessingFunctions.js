(() => {
    "use strict";

    const speechProcessing =
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
                    "Invalid speech processing function: " +
                    normalized
                );
            }

            speechProcessing[
                normalized
            ] =
                implementation;

            globalThis
                .WMOFSpeechFunctionRegistry
                ?.ensureRole?.(
                    "WMOFSpeechProcessing." +
                    normalized,
                    "speech-processing"
                );

            return implementation;
        };

    globalThis.WMOFSpeechProcessing =
        speechProcessing;

    globalThis.WMOFSpeechProcessingFunctions =
        Object.freeze({
            define
        });
})();
