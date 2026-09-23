(() => {
    "use strict";

    const registry =
        globalThis
            .WMOFSpeechFunctionRegistry;

    const utilities =
        Object.create(null);

    const define =
        (
            name,
            implementation
        ) => {
            if (
                !/^[A-Za-z_$][\w$]*$/
                    .test(name) ||
                typeof implementation !==
                    "function"
            ) {
                throw new TypeError(
                    "Invalid helper/utility function: " +
                    name
                );
            }

            utilities[name] =
                implementation;

            registry
                ?.ensureRole?.(
                    "WMOFUtilities." +
                    name,
                    "helper"
                );

            return implementation;
        };

    define(
        "wait",
        milliseconds =>
            new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        Math.max(
                            0,
                            Number(
                                milliseconds
                            ) ||
                            0
                        )
                    )
            )
    );

    define(
        "safeStorageGet",
        key => {
            try {
                return localStorage
                    .getItem(key);
            }
            catch {
                return null;
            }
        }
    );

    define(
        "safeStorageSet",
        (
            key,
            value
        ) => {
            try {
                localStorage
                    .setItem(
                        key,
                        value
                    );

                return true;
            }
            catch {
                return false;
            }
        }
    );

    define(
        "formatDuration",
        milliseconds => {
            const totalSeconds =
                Math.max(
                    0,
                    Math.floor(
                        (
                            Number(
                                milliseconds
                            ) ||
                            0
                        ) /
                        1000
                    )
                );

            const hours =
                Math.floor(
                    totalSeconds /
                    3600
                );

            const minutes =
                Math.floor(
                    (
                        totalSeconds %
                        3600
                    ) /
                    60
                );

            const seconds =
                totalSeconds %
                60;

            return [
                hours,
                minutes,
                seconds
            ]
                .map(
                    value =>
                        String(value)
                            .padStart(
                                2,
                                "0"
                            )
                )
                .join(":");
        }
    );

    define(
        "formatDateInput",
        date => {
            if (
                !(date instanceof Date) ||
                Number.isNaN(
                    date.getTime()
                )
            ) {
                return "";
            }

            const pad =
                value =>
                    String(value)
                        .padStart(
                            2,
                            "0"
                        );

            return (
                String(
                    date.getFullYear()
                )
                    .padStart(
                        4,
                        "0"
                    ) +
                "-" +
                pad(
                    date.getMonth() +
                    1
                ) +
                "-" +
                pad(
                    date.getDate()
                )
            );
        }
    );

    define(
        "parseDateInput",
        value => {
            const match =
                String(
                    value ||
                    ""
                )
                    .match(
                        /^(\d{4})-(\d{2})-(\d{2})$/
                    );

            if (!match) {
                return undefined;
            }

            const date =
                new Date(
                    Number(
                        match[1]
                    ),
                    Number(
                        match[2]
                    ) -
                        1,
                    Number(
                        match[3]
                    )
                );

            if (
                date.getFullYear() !==
                    Number(
                        match[1]
                    ) ||
                date.getMonth() !==
                    Number(
                        match[2]
                    ) -
                        1 ||
                date.getDate() !==
                    Number(
                        match[3]
                    )
            ) {
                return undefined;
            }

            return date;
        }
    );

    globalThis.WMOFUtilities =
        Object.freeze(
            utilities
        );

    globalThis.WMOFUtilityFunctions =
        Object.freeze({
            define
        });
})();
