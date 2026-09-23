(() => {
    "use strict";

    const taggedFunctionRoles = {
        "speech-processing": [
            "WMOFSpeechProcessing.normalizeSpeechValue"
        ],
        action: [],
        interaction: [],
        presentation: [],
        helper: []
    };

    const validRoles =
        new Set([
            "speech-processing",
            "action",
            "interaction",
            "presentation",
            "helper"
        ]);

    const roles =
        new Map();

    const normalizeName =
        value => {
            const name =
                String(value || "")
                    .trim();

            return /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/
                .test(name)
                    ? name
                    : "";
        };

    const normalizeRole =
        value => {
            const role =
                String(value || "")
                    .trim()
                    .toLowerCase();

            return validRoles.has(role)
                ? role
                : "";
        };

    const setRole =
        (
            name,
            role
        ) => {
            const normalizedName =
                normalizeName(name);

            const normalizedRole =
                normalizeRole(role);

            if (!normalizedName) {
                return api;
            }

            if (!normalizedRole) {
                roles.delete(
                    normalizedName
                );

                return api;
            }

            roles.set(
                normalizedName,
                normalizedRole
            );

            return api;
        };

    const setMany =
        (
            role,
            names
        ) => {
            for (
                const name of
                names.flat()
            ) {
                setRole(
                    name,
                    role
                );
            }

            return api;
        };

    const api = {
        roles:
            Object.freeze(
                [
                    ...validRoles
                ]
            ),

        setRole,

        ensureRole(
            name,
            role
        ) {
            const normalizedName =
                normalizeName(name);

            if (
                normalizedName &&
                !roles.has(
                    normalizedName
                )
            ) {
                setRole(
                    normalizedName,
                    role
                );
            }

            return api;
        },

        clearRole(name) {
            return setRole(
                name,
                ""
            );
        },

        tagSpeechProcessing(...names) {
            return setMany(
                "speech-processing",
                names
            );
        },

        tagAction(...names) {
            return setMany(
                "action",
                names
            );
        },

        tagInteraction(...names) {
            return setMany(
                "interaction",
                names
            );
        },

        tagPresentation(...names) {
            return setMany(
                "presentation",
                names
            );
        },

        tagHelper(...names) {
            return setMany(
                "helper",
                names
            );
        },

        roleOf(name) {
            return (
                roles.get(
                    normalizeName(name)
                ) ||
                ""
            );
        },

        isSpeechProcessing(name) {
            return (
                api.roleOf(name) ===
                "speech-processing"
            );
        },

        isProcessing(name) {
            return api
                .isSpeechProcessing(
                    name
                );
        },

        isAction(name) {
            return (
                api.roleOf(name) ===
                "action"
            );
        },

        list(role) {
            const normalizedRole =
                normalizeRole(role);

            if (!normalizedRole) {
                return [];
            }

            return [
                ...roles
            ]
                .filter(
                    ([, value]) =>
                        value ===
                        normalizedRole
                )
                .map(
                    ([name]) =>
                        name
                )
                .sort(
                    (a, b) =>
                        a.localeCompare(b)
                );
        },

        snapshot() {
            const result = {
                "speech-processing": [],
                action: [],
                interaction: [],
                presentation: [],
                helper: []
            };

            for (
                const [
                    name,
                    role
                ] of roles
            ) {
                result[role].push(
                    name
                );
            }

            for (
                const names of
                Object.values(
                    result
                )
            ) {
                names.sort(
                    (a, b) =>
                        a.localeCompare(b)
                );
            }

            return result;
        }
    };

    for (
        const [
            role,
            names
        ] of Object.entries(
            taggedFunctionRoles
        )
    ) {
        setMany(
            role,
            names
        );
    }

    globalThis.WMOFSpeechFunctionRegistry =
        Object.freeze(api);
})();
