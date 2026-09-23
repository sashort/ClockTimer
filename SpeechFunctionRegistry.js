(() => {
    "use strict";

    const taggedFunctionRoles = {
        processing: [
            "WMOFSpeechPreprocess.normalize"
        ],
        action: [],
        interaction: [],
        presentation: []
    };

    const validRoles =
        new Set([
            "processing",
            "action",
            "interaction",
            "presentation"
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

        tagProcessing(...names) {
            return setMany(
                "processing",
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

        roleOf(name) {
            return (
                roles.get(
                    normalizeName(name)
                ) ||
                ""
            );
        },

        isProcessing(name) {
            return (
                api.roleOf(name) ===
                "processing"
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
                processing: [],
                action: [],
                interaction: [],
                presentation: []
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
