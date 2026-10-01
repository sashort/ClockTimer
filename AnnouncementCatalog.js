(() => {
    "use strict";

    const entries =
        new Map();

    // Stable type IDs: append new IDs; do not renumber existing types.
    const typeIds = Object.freeze({
        "trip-started": 1, "trip-started-early": 2, "trip-started-late": 3,
        "break-started": 4, "short-break-started": 5, "lunch-started": 6,
        "trip-resumed-early": 7, "trip-resumed-automatically": 8,
        "trip-resumed-after-break": 9, "down-time-started": 10,
        "trip-resumed-from-down": 11, "trip-ended": 12, "goal-failed": 13,
        "lunch-clock-out": 14, "lunch-clock-in": 15, "setting-change": 16,
        "goal-change": 17, "range-change": 18, "sync-state": 19, "sync-goal": 20,
        "syncTry": 21
    });

    const titleFromKey =
        key =>
            String(key || "")
                .trim()
                .replace(
                    /[-_]+/g,
                    " "
                )
                .replace(
                    /\b\w/g,
                    value =>
                        value.toUpperCase()
                );

    const normalize =
        (
            key,
            definition = {}
        ) => {
            const normalizedKey =
                String(key || "")
                    .trim();

            if (!normalizedKey) {
                throw new TypeError(
                    "Announcement key is required."
                );
            }

            const layers =
                Array.from(
                    new Set(
                        (
                            Array.isArray(
                                definition.layers
                            )
                                ? definition.layers
                                : [
                                    "chime",
                                    "summary",
                                    "details"
                                ]
                        )
                            .filter(
                                layer =>
                                    [
                                        "chime",
                                        "summary",
                                        "details"
                                    ].includes(
                                        layer
                                    )
                            )
                    )
                );

            const masterOverrides =
                Array.from(
                    new Set(
                        (
                            Array.isArray(
                                definition.masterOverrides
                            )
                                ? definition.masterOverrides
                                : []
                        )
                            .filter(
                                layer =>
                                    [
                                        "chime",
                                        "summary",
                                        "details"
                                    ].includes(
                                        layer
                                    )
                            )
                    )
                );

            return Object.freeze({
                id: typeIds[normalizedKey],
                key:
                    normalizedKey,
                label:
                    String(
                        definition.label ||
                        titleFromKey(
                            normalizedKey
                        )
                    ).trim(),
                group:
                    String(
                        definition.group ||
                        "Events"
                    ).trim(),
                song:
                    String(
                        definition.song ||
                        normalizedKey
                    ).trim(),
                layers:
                    Object.freeze(
                        layers
                    ),
                masterOverrides:
                    Object.freeze(
                        masterOverrides
                    )
            });
        };

    const register =
        (
            key,
            definition
        ) => {
            const entry =
                normalize(
                    key,
                    definition
                );

            entries.set(
                entry.key,
                entry
            );

            return entry;
        };

    const ensure =
        (
            key,
            definition
        ) =>
            entries.get(
                String(key || "")
                    .trim()
            ) ||
            register(
                key,
                definition
            );

    const definitions = [
        ["trip-started", "Trip Started", {masterOverrides: ["summary", "details"]}],
        ["trip-started-early", "Trip Started Early", {masterOverrides: ["summary", "details"]}],
        ["trip-started-late", "Trip Started Late", {masterOverrides: ["summary", "details"]}],
        ["break-started", "Break Started"],
        ["short-break-started", "Short Break Started"],
        ["lunch-started", "Lunch Started"],
        ["trip-resumed-early", "Trip Resumed Early"],
        ["trip-resumed-automatically", "Trip Resumed Automatically"],
        ["trip-resumed-after-break", "Trip Resumed After Break"],
        ["down-time-started", "Down Time Started"],
        ["trip-resumed-from-down", "Trip Resumed From Down"],
        ["trip-ended", "Trip Ended", {masterOverrides: ["summary", "details"]}],
        ["goal-failed", "Goal Failed"],
        ["lunch-clock-out", "Lunch Clock Out"],
        ["lunch-clock-in", "Lunch Clock In"]
    ];

    for (
        const [
            key,
            label,
            options = {}
        ] of definitions
    ) {
        register(
            key,
            {
                ...options,
                label,
                group:
                    "Trip Events"
            }
        );
    }

    register(
        "setting-change",
        {
            label:
                "Setting Changed",
            group:
                "Settings",
            song:
                "info-tone",
            layers: [
                "chime",
                "summary"
            ]
        }
    );

    register(
        "goal-change",
        {
            label:
                "Goal Changed",
            group:
                "Settings",
            song:
                "info-tone",
            layers: [
                "chime",
                "summary"
            ]
        }
    );

    register(
        "range-change",
        {
            label:
                "Range Changed",
            group:
                "Settings",
            song:
                "info-tone",
            layers: [
                "chime",
                "summary"
            ]
        }
    );

    register(
        "sync-state",
        {
            label:
                "Sync State",
            group:
                "Settings",
            layers: [
                "summary"
            ]
        }
    );

    register(
        "sync-goal",
        {
            label:
                "Sync Goal",
            group:
                "Settings",
            layers: [
                "summary"
            ]
        }
    );

    const api = {
        id(key) { return typeIds[String(key || "").trim()]; },
        register,
        ensure,

        get(key) {
            return entries.get(
                String(key || "")
                    .trim()
            );
        },

        has(key) {
            return entries.has(
                String(key || "")
                    .trim()
            );
        },

        list() {
            return [
                ...entries.values()
            ];
        },

        remove(key) {
            return entries.delete(
                String(key || "")
                    .trim()
            );
        }
    };

    globalThis.WMOFAnnouncementCatalog =
        Object.freeze(
            api
        );
})();
