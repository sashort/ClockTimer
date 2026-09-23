(() => {
    "use strict";

    const taggedPreprocFunctions = [
        "WMOFSpeechPreprocess.normalize"
    ];

    const preproc =
        new Set();

    const normalize =
        value => {
            const name =
                String(value || "")
                    .trim();

            return /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/
                .test(name)
                    ? name
                    : "";
        };

    const tagPreproc =
        (...names) => {
            for (const value of names.flat()) {
                const name =
                    normalize(value);

                if (name) {
                    preproc.add(name);
                }
            }

            return api;
        };

    const untagPreproc =
        (...names) => {
            for (const value of names.flat()) {
                const name =
                    normalize(value);

                if (name) {
                    preproc.delete(name);
                }
            }

            return api;
        };

    const api = {
        tagPreproc,
        untagPreproc,

        isPreproc(name) {
            return preproc.has(
                normalize(name)
            );
        },

        listPreproc() {
            return [
                ...preproc
            ].sort(
                (a, b) =>
                    a.localeCompare(b)
            );
        }
    };

    tagPreproc(
        taggedPreprocFunctions
    );

    globalThis.WMOFSpeechFunctionRegistry =
        Object.freeze(api);
})();
