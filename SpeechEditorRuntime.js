(() => {
    "use strict";

    const names = [
        "speech-pattern",
        "speech-function",
        "speech-preproc",
        "speech-preproc-context",
        "speech-preproc-field",
        "speech-modal"
    ];
    const created = new Map();

    const normalizeKind =
        kind =>
            kind === "modal"
                ? "menu"
                : kind;

    const find = entry => {
        if (entry.kind === "existing") {
            const byId =
                [...document.querySelectorAll("[data-speech-editor-id]")]
                    .find(
                        element =>
                            element.dataset.speechEditorId ===
                            entry.id
                    );

            if (byId) return byId;
        }

        try {
            return document.querySelector(
                entry.target
            );
        }
        catch {
            return null;
        }
    };

    const insertionHost =
        host =>
            host.matches(
                "dialog,[popover],details,body"
            )
                ? host
                : host.parentElement ||
                    document.body;

    const applyAttributes =
        (element, attrs) => {
            for (const name of names) {
                let value =
                    attrs?.[name];

                if (
                    name === "speech-modal" &&
                    value === ""
                ) {
                    value = "default";
                }

                if (
                    name === "speech-modal" &&
                    value !== undefined &&
                    !["top-level", "default"]
                        .includes(value)
                ) {
                    value = undefined;
                }

                if (
                    typeof value === "string" &&
                    value !== ""
                ) {
                    element.setAttribute(
                        name,
                        value
                    );
                }
                else {
                    element.removeAttribute(
                        name
                    );
                }
            }
        };

    const placeMenu =
        (menu, host) => {
            if (
                host.matches(
                    "dialog,[popover],details,body"
                )
            ) {
                host.append(menu);
                return;
            }

            host.insertAdjacentElement(
                "afterend",
                menu
            );
        };

    const listFunctions = () => {
        const result = new Set();
        const visited = new Set();

        const add =
            (
                value,
                path,
                depth = 0
            ) => {
                if (
                    value == null ||
                    depth > 4 ||
                    visited.has(value)
                ) {
                    return;
                }

                if (
                    typeof value ===
                    "function"
                ) {
                    let source = "";

                    try {
                        source =
                            Function.prototype
                                .toString
                                .call(value);
                    }
                    catch {}

                    if (
                        path &&
                        !/\[native code\]/
                            .test(source)
                    ) {
                        result.add(path);
                    }
                }

                if (
                    (
                        typeof value !==
                            "object" &&
                        typeof value !==
                            "function"
                    ) ||
                    value === globalThis
                ) {
                    return;
                }

                visited.add(value);

                let keys = [];

                try {
                    keys =
                        Object.getOwnPropertyNames(
                            value
                        );
                }
                catch {
                    return;
                }

                for (const key of keys) {
                    if (
                        [
                            "prototype",
                            "caller",
                            "callee",
                            "arguments"
                        ].includes(key)
                    ) {
                        continue;
                    }

                    let child;

                    try {
                        child = value[key];
                    }
                    catch {
                        continue;
                    }

                    if (
                        typeof child !==
                            "function" &&
                        (
                            typeof child !==
                                "object" ||
                            child === null
                        )
                    ) {
                        continue;
                    }

                    add(
                        child,
                        path
                            ? path + "." + key
                            : key,
                        depth + 1
                    );
                }
            };

        for (
            const element of
            document.querySelectorAll(
                "[speech-function], [speech-preproc]"
            )
        ) {
            for (
                const name of
                [
                    "speech-function",
                    "speech-preproc"
                ]
            ) {
                const path =
                    element.getAttribute(
                        name
                    );

                if (path) result.add(path);
            }
        }

        for (
            const key of
            Object.getOwnPropertyNames(
                globalThis
            )
        ) {
            let value;

            try {
                value = globalThis[key];
            }
            catch {
                continue;
            }

            if (
                typeof value ===
                    "function"
            ) {
                let source = "";

                try {
                    source =
                        Function.prototype
                            .toString
                            .call(value);
                }
                catch {}

                if (
                    !/\[native code\]/
                        .test(source)
                ) {
                    result.add(key);
                }

                continue;
            }

            if (
                value &&
                typeof value ===
                    "object" &&
                (
                    Object.getPrototypeOf(
                        value
                    ) === Object.prototype ||
                    Object.getPrototypeOf(
                        value
                    ) === null
                )
            ) {
                add(
                    value,
                    key,
                    0
                );
            }
        }

        return [...result]
            .filter(Boolean)
            .sort(
                (a, b) =>
                    a.localeCompare(b)
            );
    };

    const apply = entries => {
        for (const element of created.values()) {
            element.remove();
        }

        created.clear();

        for (const rawEntry of entries) {
            const entry = {
                ...rawEntry,
                kind:
                    normalizeKind(
                        rawEntry.kind
                    )
            };

            if (entry.kind === "existing") {
                const element =
                    find(entry);

                if (element) {
                    applyAttributes(
                        element,
                        entry.attrs
                    );
                }
            }
            else if (
                entry.kind === "attribute"
            ) {
                const element =
                    find(entry);

                if (element) {
                    applyAttributes(
                        element,
                        entry.attrs
                    );
                }
            }
            else if (
                entry.kind === "menu"
            ) {
                const host =
                    find(entry);

                if (!host) continue;

                const element =
                    document.createElement(
                        "speech-menu"
                    );

                element.dataset.speechEditorId =
                    entry.id;
                element.dataset.speechTarget =
                    entry.target;

                applyAttributes(
                    element,
                    entry.attrs
                );

                placeMenu(
                    element,
                    host
                );

                created.set(
                    entry.id,
                    element
                );
            }
        }

        for (const rawEntry of entries) {
            const entry = {
                ...rawEntry,
                kind:
                    normalizeKind(
                        rawEntry.kind
                    )
            };

            if (entry.kind !== "command") {
                continue;
            }

            const host =
                (
                    entry.parentId &&
                    created.get(
                        entry.parentId
                    )
                ) ||
                find(entry);

            if (!host) continue;

            const element =
                document.createElement(
                    "speech-command"
                );

            element.dataset.speechEditorId =
                entry.id;
            element.dataset.speechTarget =
                entry.target;

            applyAttributes(
                element,
                entry.attrs
            );

            if (
                host.matches(
                    "speech-menu"
                )
            ) {
                host.append(element);
            }
            else {
                insertionHost(
                    host
                ).append(element);
            }

            created.set(
                entry.id,
                element
            );
        }

        globalThis.SpeechMenu
            ?.refresh?.();
    };

    globalThis.WMOFSpeechEditorRuntime = {
        apply,
        listFunctions
    };

    fetch(
        "api/speech-editor-config/",
        {
            credentials:
                "same-origin",
            cache:
                "no-store"
        }
    )
        .then(
            response =>
                response.ok
                    ? response.json()
                    : Promise.reject(
                        new Error(
                            "Speech configuration unavailable"
                        )
                    )
        )
        .then(
            config =>
                apply(
                    config.entries ||
                    []
                )
        )
        .catch(
            error =>
                console.warn(error)
        );
})();
