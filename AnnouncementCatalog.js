(() => {
    "use strict";

    const entries =
        new Map();

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

            return Object.freeze({
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
        ["trip-started", "Trip Started"],
        ["trip-started-early", "Trip Started Early"],
        ["trip-started-late", "Trip Started Late"],
        ["break-started", "Break Started"],
        ["short-break-started", "Short Break Started"],
        ["lunch-started", "Lunch Started"],
        ["trip-resumed-early", "Trip Resumed Early"],
        ["trip-resumed-automatically", "Trip Resumed Automatically"],
        ["trip-resumed-after-break", "Trip Resumed After Break"],
        ["down-time-started", "Down Time Started"],
        ["trip-resumed-from-down", "Trip Resumed From Down"],
        ["trip-ended", "Trip Ended"],
        ["goal-failed", "Goal Failed"],
        ["lunch-clock-out", "Lunch Clock Out"],
        ["lunch-clock-in", "Lunch Clock In"]
    ];

    for (
        const [
            key,
            label
        ] of definitions
    ) {
        register(
            key,
            {
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

    const api = {
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
