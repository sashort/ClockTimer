(() => {
    "use strict";

    const $ = id =>
        document.getElementById(id);

    const frame =
        $("appFrame");

    const form =
        $("attributeForm");

    const endpoint =
        "../../speech-editor-config/";

    const attributeNames = [
        "speech-pattern",
        "speech-function",
        "speech-preproc",
        "speech-preproc-context",
        "speech-preproc-field",
        "speech-modal",
        "speech-index"
    ];

    const ignoredNavigatorTags =
        new Set([
            "SCRIPT",
            "STYLE",
            "LINK",
            "META",
            "TEMPLATE",
            "SPEECH-MENU",
            "SPEECH-COMMAND"
        ]);

    let saved = [];
    let draft = [];
    let revision = "empty";
    let overlay = true;
    let frameDocument;
    let selectedElement;
    let selectedLocator;
    let highlighted;
    let functionNames = [];
    let applyTimer;
    let refreshTimer;
    let frameObserver;
    const tierOpenState = new Map();
    const menuOpenState = new Map();
    let draggedPhraseItem;
    let viewportResizeObserver;

    const status =
        (message, error = false) => {
            $("status").textContent =
                message || "";

            $("status")
                .classList
                .toggle(
                    "error",
                    error
                );
        };

    const dirty =
        () =>
            JSON.stringify(draft) !==
            JSON.stringify(saved);

    const updateButtons = () => {
        const clean =
            !dirty();

        $("saveButton").disabled =
            clean;

        $("discardButton").disabled =
            clean;
    };

    const normalizeKind =
        kind =>
            kind === "modal"
                ? "menu"
                : kind;

    const normalizeEntry =
        entry => {
            const clone =
                structuredClone(entry);

            clone.kind =
                normalizeKind(
                    clone.kind
                );

            if (
                clone.attrs?.[
                    "speech-modal"
                ] === ""
            ) {
                clone.attrs[
                    "speech-modal"
                ] =
                    "default";
            }

            return clone;
        };

    const normalizeEntries =
        entries =>
            entries.map(
                normalizeEntry
            );

    const selectorFor = element => {
        if (
            !element ||
            element === frameDocument
        ) {
            return "";
        }

        if (element.id) {
            return (
                "#" +
                CSS.escape(
                    element.id
                )
            );
        }

        const parts = [];

        for (
            let node = element;
            node &&
            node !== frameDocument.body;
            node = node.parentElement
        ) {
            if (node.id) {
                parts.unshift(
                    "#" +
                    CSS.escape(
                        node.id
                    )
                );
                break;
            }

            if (!node.parentElement) {
                break;
            }

            const tag =
                node.tagName
                    .toLowerCase();

            const siblings =
                [
                    ...node
                        .parentElement
                        .children
                ]
                    .filter(
                        sibling =>
                            sibling.tagName ===
                            node.tagName
                    );

            parts.unshift(
                tag +
                ":nth-of-type(" +
                (
                    siblings
                        .indexOf(
                            node
                        ) +
                    1
                ) +
                ")"
            );
        }

        return parts.join(
            " > "
        );
    };

    const compactLabel =
        element => {
            if (!element) return "";

            const tag =
                element
                    .tagName
                    .toLowerCase();

            const id =
                element.id
                    ? "#" +
                        element.id
                    : "";

            const classes =
                !id &&
                element.classList
                    ?.length
                    ? "." +
                        [
                            ...element
                                .classList
                        ]
                            .slice(0, 2)
                            .join(".")
                    : "";

            return (
                "<" +
                tag +
                id +
                classes +
                ">"
            );
        };

    const displayName =
        element => {
            if (!element) {
                return "Select an element";
            }

            if (
                element.matches(
                    "speech-menu"
                )
            ) {
                const target =
                    element.dataset
                        .speechTarget;

                return target
                    ? "Speech Menu — " +
                        target
                    : "Speech Menu";
            }

            if (
                element.matches(
                    "speech-command"
                )
            ) {
                return (
                    "Speech Command — " +
                    (
                        element.getAttribute(
                            "speech-pattern"
                        ) ||
                        "new command"
                    )
                );
            }

            return (
                element.getAttribute(
                    "aria-label"
                ) ||
                element.textContent
                    ?.trim()
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .slice(0, 44) ||
                compactLabel(element)
            );
        };

    const snapshot =
        element => {
            const result = {};

            for (
                const name of
                attributeNames
            ) {
                if (
                    !element
                        .hasAttribute(
                            name
                        )
                ) {
                    continue;
                }

                let value =
                    element
                        .getAttribute(
                            name
                        );

                if (
                    name ===
                        "speech-modal" &&
                    value === ""
                ) {
                    value =
                        "default";
                }

                result[name] =
                    value;
            }

            return result;
        };

    const sanitizeId =
        value =>
            String(value)
                .replace(
                    /[^A-Za-z0-9_-]+/g,
                    "_"
                )
                .slice(0, 72);

    const entryForElement =
        element => {
            if (!element) return null;

            let id =
                element.dataset
                    ?.speechEditorId;

            if (
                !id &&
                element.matches(
                    "speech-menu, speech-command"
                )
            ) {
                id =
                    "existing:" +
                    element.tagName
                        .toLowerCase()
                        .replace(
                            "speech-",
                            ""
                        ) +
                    ":" +
                    sanitizeId(
                        selectorFor(
                            element
                        ) ||
                        element.dataset
                            ?.speechTarget ||
                        "body"
                    );

                element.dataset
                    .speechEditorId =
                    id;
            }

            if (id) {
                const savedEntry =
                    draft.find(
                        entry =>
                            entry.id === id
                    );

                if (savedEntry) {
                    return savedEntry;
                }

                return {
                    id,
                    kind: "existing",
                    target:
                        selectorFor(
                            element
                        ) ||
                        element.dataset
                            .speechTarget ||
                        "body",
                    attrs:
                        snapshot(
                            element
                        )
                };
            }

            const target =
                selectorFor(
                    element
                );

            const configured =
                draft.find(
                    entry =>
                        entry.kind ===
                            "attribute" &&
                        entry.target ===
                            target
                );

            if (configured) {
                return configured;
            }

            if (
                element.hasAttribute(
                    "speech-pattern"
                )
            ) {
                return {
                    id:
                        "attribute:" +
                        sanitizeId(
                            target
                        ),
                    kind:
                        "attribute",
                    target,
                    attrs:
                        snapshot(
                            element
                        )
                };
            }

            return null;
        };

    const writableEntry =
        element => {
            const baseline =
                entryForElement(
                    element
                );

            if (!baseline) {
                return null;
            }

            let entry =
                draft.find(
                    item =>
                        item.id ===
                        baseline.id
                );

            if (!entry) {
                entry =
                    normalizeEntry(
                        baseline
                    );

                draft.push(
                    entry
                );
            }

            return entry;
        };

    const resolveByLocator =
        locator => {
            if (
                !frameDocument ||
                !locator
            ) {
                return null;
            }

            if (
                locator.type ===
                    "editor-id"
            ) {
                return (
                    [
                        ...frameDocument
                            .querySelectorAll(
                                "[data-speech-editor-id]"
                            )
                    ].find(
                        element =>
                            element.dataset
                                .speechEditorId ===
                            locator.value
                    ) ||
                    null
                );
            }

            try {
                return (
                    frameDocument
                        .querySelector(
                            locator.value
                        ) ||
                    null
                );
            }
            catch {
                return null;
            }
        };

    const locatorFor =
        element => {
            const id =
                element?.dataset
                    ?.speechEditorId;

            if (id) {
                return {
                    type:
                        "editor-id",
                    value:
                        id
                };
            }

            return {
                type:
                    "selector",
                value:
                    selectorFor(
                        element
                    )
            };
        };

    const associatedMenuFor =
        element => {
            if (
                !element ||
                !frameDocument
            ) {
                return null;
            }

            if (
                element.matches(
                    "speech-menu"
                )
            ) {
                return element;
            }

            const enclosing =
                element.closest(
                    "speech-menu"
                );

            if (enclosing) {
                return enclosing;
            }

            const target =
                selectorFor(
                    element
                );

            return (
                [
                    ...frameDocument
                        .querySelectorAll(
                            "speech-menu[data-speech-target]"
                        )
                ].find(
                    menu =>
                        menu.dataset
                            .speechTarget ===
                        target
                ) ||
                null
            );
        };

    const hostElementForMenu =
        menu => {
            const target =
                menu?.dataset
                    ?.speechTarget;

            if (!target) {
                return null;
            }

            try {
                return frameDocument
                    .querySelector(
                        target
                    );
            }
            catch {
                return null;
            }
        };

    const highlight =
        element => {
            if (
                highlighted
                    ?.isConnected
            ) {
                highlighted.style
                    .removeProperty(
                        "outline"
                    );

                highlighted.style
                    .removeProperty(
                        "outline-offset"
                    );
            }

            let target =
                element;

            if (
                target?.matches(
                    "speech-menu, speech-command"
                )
            ) {
                target =
                    hostElementForMenu(
                        target.closest(
                            "speech-menu"
                        ) ||
                        target
                    ) ||
                    target.dataset
                        ?.speechTarget &&
                        (() => {
                            try {
                                return frameDocument
                                    .querySelector(
                                        target.dataset
                                            .speechTarget
                                    );
                            }
                            catch {
                                return null;
                            }
                        })();
            }

            if (
                !target ||
                target.matches(
                    "speech-menu, speech-command"
                )
            ) {
                highlighted =
                    undefined;
                return;
            }

            highlighted =
                target;

            highlighted.style
                .setProperty(
                    "outline",
                    "4px dashed #a9ddf7",
                    "important"
                );

            highlighted.style
                .setProperty(
                    "outline-offset",
                    "2px",
                    "important"
                );
        };

    const selectElement =
        (
            element,
            options = {}
        ) => {
            if (!element) return;

            selectedElement =
                element;

            selectedLocator =
                locatorFor(
                    element
                );

            highlight(
                element
            );

            renderSelection();
            renderDomTree();
            renderPhraseList();

            if (
                options.scrollPhrase !==
                    false
            ) {
                requestAnimationFrame(
                    () => {
                        document
                            .querySelector(
                                ".phrase-group.selected, .speech-menu-group.selected"
                            )
                            ?.scrollIntoView(
                                {
                                    block:
                                        "nearest"
                                }
                            );
                    }
                );
            }
        };

    const restoreSelection =
        () => {
            const resolved =
                resolveByLocator(
                    selectedLocator
                );

            if (resolved) {
                selectedElement =
                    resolved;
                highlight(
                    resolved
                );
            }
            else if (
                selectedLocator
                    ?.type ===
                    "editor-id"
            ) {
                selectedElement =
                    undefined;
            }
        };

    const candidateEditElement =
        () => {
            if (!selectedElement) {
                return null;
            }

            if (
                selectedElement.matches(
                    "speech-menu, speech-command"
                )
            ) {
                return selectedElement;
            }

            if (
                selectedElement.hasAttribute(
                    "speech-pattern"
                )
            ) {
                return selectedElement;
            }

            return associatedMenuFor(
                selectedElement
            );
        };

    const currentMenu =
        () => {
            const edit =
                candidateEditElement();

            if (
                edit?.matches(
                    "speech-menu"
                )
            ) {
                return edit;
            }

            return edit?.closest(
                "speech-menu"
            ) ||
                null;
        };

    const scheduleApply =
        () => {
            clearTimeout(
                applyTimer
            );

            applyTimer =
                setTimeout(
                    () => {
                        const runtime =
                            frame.contentWindow
                                ?.WMOFSpeechEditorRuntime;

                        runtime?.apply?.(
                            draft
                        );

                        setTimeout(
                            () => {
                                restoreSelection();
                                functionNames =
                                    runtime
                                        ?.listFunctions
                                        ?.() ||
                                    functionNames;
                                renderAll();
                            },
                            0
                        );
                    },
                    70
                );

            updateButtons();
        };

    const scheduleLiveRefresh =
        () => {
            clearTimeout(
                refreshTimer
            );

            refreshTimer =
                setTimeout(
                    () => {
                        renderPhraseList();
                        renderDomTree();
                        renderSelection();
                    },
                    30
                );
        };

    const classifyGroup =
        group => {
            const element =
                group.element;

            if (
                group.modal ===
                "top-level"
            ) {
                return {
                    band:
                        "modal",
                    tier:
                        "top-level",
                    label:
                        "Top level"
                };
            }

            const dialog =
                [
                    ...frameDocument
                        .querySelectorAll(
                            "dialog[open]"
                        )
                ].at(-1);

            if (
                dialog &&
                dialog.contains(
                    element
                )
            ) {
                return {
                    band:
                        "modal",
                    tier:
                        "active-modal",
                    label:
                        "Active dialog / modal"
                };
            }

            if (
                group.modal ===
                "default"
            ) {
                return {
                    band:
                        "modal",
                    tier:
                        "default",
                    label:
                        "Default"
                };
            }

            const details =
                element.closest(
                    "details[open]"
                );

            let popover =
                element.closest(
                    "[popover]"
                );

            if (popover) {
                try {
                    if (
                        !popover.matches(
                            ":popover-open"
                        )
                    ) {
                        popover = null;
                    }
                }
                catch {
                    popover =
                        null;
                }
            }

            if (
                details ||
                popover
            ) {
                return {
                    band:
                        "non-modal",
                    tier:
                        "open-context",
                    label:
                        "Open details / popover"
                };
            }

            return {
                band:
                    "non-modal",
                tier:
                    "page",
                label:
                    "Page"
            };
        };

    const phraseSource =
        group => {
            const element =
                group.element;

            if (
                element.matches(
                    "speech-command"
                )
            ) {
                const target =
                    element.dataset
                        .speechTarget;

                return target
                    ? "<speech-command> → " +
                        target
                    : "<speech-command>";
            }

            return selectorFor(
                element
            );
        };

    const scrubSpeechElement =
        element => {
            const entry =
                entryForElement(
                    element
                );

            if (!entry) return;

            if (
                element.matches(
                    "speech-command"
                ) &&
                entry.id.startsWith(
                    "edit:"
                )
            ) {
                const menu =
                    element.closest(
                        "speech-menu"
                    );

                draft =
                    draft.filter(
                        item =>
                            item.id !==
                            entry.id
                    );

                selectedLocator =
                    menu
                        ? locatorFor(
                            menu
                        )
                        : undefined;
            }
            else {
                const writable =
                    writableEntry(
                        element
                    );

                if (!writable) return;

                writable.attrs = {};
            }

            scheduleApply();
        };

    const deletePhrase =
        (
            group,
            phrase
        ) => {
            const element =
                group.element;

            if (
                group.phrases.length <=
                    1
            ) {
                scrubSpeechElement(
                    element
                );
                status(
                    "Last phrase removed; speech attributes were cleared."
                );
                return;
            }

            const speechMenu =
                frame.contentWindow
                    ?.SpeechMenu;

            const nextPattern =
                speechMenu
                    ?.withoutPhrase?.(
                        group.pattern,
                        phrase
                    );

            if (
                !nextPattern ||
                nextPattern ===
                    group.pattern
            ) {
                status(
                    "That phrase could not be removed from the pattern.",
                    true
                );
                return;
            }

            updateEntryField(
                element,
                "speech-pattern",
                nextPattern
            );

            status(
                "Phrase removed and speech-pattern updated."
            );
        };

    const renderPhraseChips =
        (
            container,
            group
        ) => {
            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "phrases";

            for (
                const phrase of
                group.phrases
            ) {
                const chip =
                    document.createElement(
                        "span"
                    );

                chip.className =
                    "phrase-chip";

                if (
                    /<[^>]+>/
                        .test(
                            phrase
                        )
                ) {
                    chip.classList
                        .add(
                            "slot"
                        );
                }

                const text =
                    document.createElement(
                        "span"
                    );

                text.textContent =
                    phrase;

                const remove =
                    document.createElement(
                        "button"
                    );

                remove.type =
                    "button";
                remove.className =
                    "phrase-delete";
                remove.title =
                    "Delete phrase";
                remove.setAttribute(
                    "aria-label",
                    "Delete phrase " +
                        phrase
                );
                remove.textContent =
                    "×";

                remove.addEventListener(
                    "pointerdown",
                    event =>
                        event.stopPropagation()
                );

                remove.addEventListener(
                    "click",
                    event => {
                        event.preventDefault();
                        event.stopPropagation();

                        deletePhrase(
                            group,
                            phrase
                        );
                    }
                );

                chip.append(
                    text,
                    remove
                );

                row.append(
                    chip
                );
            }

            container.append(
                row
            );
        };

    const directSpeechChildren =
        (
            parent,
            selector
        ) =>
            [
                ...parent.children
            ].filter(
                element =>
                    element.matches(
                        selector
                    )
            );

    const persistSiblingOrder =
        elements => {
            elements.forEach(
                (
                    element,
                    order
                ) => {
                    const entry =
                        writableEntry(
                            element
                        );

                    if (entry) {
                        entry.order =
                            order;
                    }
                }
            );

            scheduleApply();
        };

    const reorderDraggedElement =
        (
            dragged,
            target,
            after
        ) => {
            if (
                !dragged ||
                !target ||
                dragged === target
            ) {
                return false;
            }

            const isCommand =
                dragged.matches(
                    "speech-command"
                ) &&
                target.matches(
                    "speech-command"
                );

            const isMenu =
                dragged.matches(
                    "speech-menu"
                ) &&
                target.matches(
                    "speech-menu"
                );

            if (
                !isCommand &&
                !isMenu
            ) {
                return false;
            }

            if (
                dragged.parentElement !==
                    target.parentElement
            ) {
                return false;
            }

            const parent =
                dragged.parentElement;

            if (
                isCommand &&
                !parent?.matches(
                    "speech-menu"
                )
            ) {
                return false;
            }

            const selector =
                isCommand
                    ? "speech-command"
                    : "speech-menu";

            const siblings =
                directSpeechChildren(
                    parent,
                    selector
                );

            const sourceIndex =
                siblings.indexOf(
                    dragged
                );

            let targetIndex =
                siblings.indexOf(
                    target
                );

            if (
                sourceIndex < 0 ||
                targetIndex < 0
            ) {
                return false;
            }

            siblings.splice(
                sourceIndex,
                1
            );

            targetIndex =
                siblings.indexOf(
                    target
                );

            siblings.splice(
                targetIndex +
                    (after ? 1 : 0),
                0,
                dragged
            );

            persistSiblingOrder(
                siblings
            );

            status(
                isCommand
                    ? "Speech Command order changed."
                    : "Speech Menu order changed."
            );

            return true;
        };

    const attachDragBehavior =
        (
            wrapper,
            element,
            kind
        ) => {
            wrapper.draggable =
                true;

            wrapper.dataset
                .dragKind =
                kind;

            wrapper.addEventListener(
                "dragstart",
                event => {
                    draggedPhraseItem = {
                        element,
                        kind
                    };

                    wrapper.classList
                        .add(
                            "dragging"
                        );

                    event.dataTransfer
                        ?.setData(
                            "text/plain",
                            element.dataset
                                .speechEditorId ||
                            kind
                        );

                    if (
                        event.dataTransfer
                    ) {
                        event.dataTransfer
                            .effectAllowed =
                            "move";
                    }
                }
            );

            wrapper.addEventListener(
                "dragend",
                () => {
                    draggedPhraseItem =
                        undefined;

                    for (
                        const node of
                        document
                            .querySelectorAll(
                                ".dragging, .drop-before, .drop-after"
                            )
                    ) {
                        node.classList
                            .remove(
                                "dragging",
                                "drop-before",
                                "drop-after"
                            );
                    }
                }
            );

            wrapper.addEventListener(
                "dragover",
                event => {
                    const dragged =
                        draggedPhraseItem;

                    if (
                        !dragged ||
                        dragged.kind !==
                            kind ||
                        dragged.element
                            .parentElement !==
                            element
                                .parentElement
                    ) {
                        return;
                    }

                    if (
                        kind ===
                            "command" &&
                        !element.parentElement
                            ?.matches(
                                "speech-menu"
                            )
                    ) {
                        return;
                    }

                    event.preventDefault();

                    const rect =
                        wrapper
                            .getBoundingClientRect();

                    const after =
                        event.clientY >
                        rect.top +
                            rect.height / 2;

                    wrapper.classList
                        .toggle(
                            "drop-before",
                            !after
                        );

                    wrapper.classList
                        .toggle(
                            "drop-after",
                            after
                        );
                }
            );

            wrapper.addEventListener(
                "dragleave",
                () =>
                    wrapper.classList
                        .remove(
                            "drop-before",
                            "drop-after"
                        )
            );

            wrapper.addEventListener(
                "drop",
                event => {
                    const dragged =
                        draggedPhraseItem;

                    if (
                        !dragged ||
                        dragged.kind !==
                            kind
                    ) {
                        return;
                    }

                    event.preventDefault();

                    const rect =
                        wrapper
                            .getBoundingClientRect();

                    reorderDraggedElement(
                        dragged.element,
                        element,
                        event.clientY >
                            rect.top +
                                rect.height / 2
                    );
                }
            );
        };

    const renderCandidateGroup =
        group => {
            const wrapper =
                document.createElement(
                    "div"
                );

            wrapper.className =
                "phrase-group";

            wrapper.classList
                .toggle(
                    "selected",
                    group.element ===
                        selectedElement
                );

            const button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";
            button.className =
                "phrase-group-button";

            const source =
                document.createElement(
                    "span"
                );

            source.className =
                "phrase-source";

            const index =
                group.element
                    .getAttribute(
                        "speech-index"
                    );

            source.textContent =
                phraseSource(
                    group
                ) +
                (
                    index
                        ? " — index " +
                            index
                        : ""
                );

            if (
                group.element.matches(
                    "speech-command"
                ) &&
                group.element.parentElement
                    ?.matches(
                        "speech-menu"
                    )
            ) {
                const handle =
                    document.createElement(
                        "span"
                    );

                handle.className =
                    "drag-handle";
                handle.textContent =
                    "⋮⋮";
                handle.title =
                    "Drag to reorder Speech Command";

                source.prepend(
                    handle,
                    " "
                );

                attachDragBehavior(
                    wrapper,
                    group.element,
                    "command"
                );
            }

            button.append(
                source
            );

            renderPhraseChips(
                button,
                group
            );

            button.addEventListener(
                "click",
                () =>
                    selectElement(
                        group.element,
                        {
                            scrollPhrase:
                                false
                        }
                    )
            );

            wrapper.append(
                button
            );

            return wrapper;
        };

    const menuStateKey =
        menu =>
            menu.dataset
                .speechEditorId ||
            selectorFor(
                menu
            );

    const renderTier =
        (
            tierInfo,
            groups
        ) => {
            const section =
                document.createElement(
                    "details"
                );

            section.className =
                "tier";
            section.dataset.tier =
                tierInfo.tier;

            section.open =
                tierOpenState.has(
                    tierInfo.tier
                )
                    ? tierOpenState.get(
                        tierInfo.tier
                    )
                    : true;

            section.addEventListener(
                "toggle",
                () =>
                    tierOpenState.set(
                        tierInfo.tier,
                        section.open
                    )
            );

            const bar =
                document.createElement(
                    "summary"
                );

            bar.className =
                "tier-bar";
            bar.textContent =
                tierInfo.label;

            section.append(
                bar
            );

            const menuMap =
                new Map();

            for (const group of groups) {
                const menu =
                    group.menu;

                if (!menu) {
                    section.append(
                        renderCandidateGroup(
                            group
                        )
                    );
                    continue;
                }

                if (
                    !menuMap.has(
                        menu
                    )
                ) {
                    menuMap.set(
                        menu,
                        []
                    );
                }

                menuMap
                    .get(menu)
                    .push(group);
            }

            for (
                const [
                    menu,
                    menuGroups
                ] of
                menuMap
            ) {
                const details =
                    document.createElement(
                        "details"
                    );

                details.className =
                    "speech-menu-group";

                details.classList
                    .toggle(
                        "selected",
                        menu ===
                            selectedElement
                    );

                const key =
                    menuStateKey(
                        menu
                    );

                details.open =
                    menuOpenState.has(
                        key
                    )
                        ? menuOpenState.get(
                            key
                        )
                        : (
                            menu ===
                                selectedElement ||
                            menuGroups.some(
                                group =>
                                    group.element ===
                                    selectedElement
                            )
                        );

                details.addEventListener(
                    "toggle",
                    () =>
                        menuOpenState.set(
                            key,
                            details.open
                        )
                );

                const summary =
                    document.createElement(
                        "summary"
                    );

                const mode =
                    menu.getAttribute(
                        "speech-modal"
                    );

                const target =
                    menu.dataset
                        .speechTarget;

                const index =
                    menu.getAttribute(
                        "speech-index"
                    );

                const handle =
                    document.createElement(
                        "span"
                    );

                handle.className =
                    "drag-handle";
                handle.textContent =
                    "⋮⋮";
                handle.title =
                    "Drag to reorder Speech Menu";

                summary.append(
                    handle,
                    document.createTextNode(
                        " Speech Menu" +
                        (
                            mode
                                ? " — " +
                                    mode
                                : ""
                        ) +
                        (
                            index
                                ? " — index " +
                                    index
                                : ""
                        ) +
                        (
                            target
                                ? " — " +
                                    target
                                : ""
                        )
                    )
                );

                summary.addEventListener(
                    "click",
                    () => {
                        setTimeout(
                            () =>
                                selectElement(
                                    menu,
                                    {
                                        scrollPhrase:
                                            false
                                    }
                                ),
                            0
                        );
                    }
                );

                const children =
                    document.createElement(
                        "div"
                    );

                children.className =
                    "speech-menu-children";

                for (
                    const group of
                    menuGroups
                ) {
                    children.append(
                        renderCandidateGroup(
                            group
                        )
                    );
                }

                details.append(
                    summary,
                    children
                );

                attachDragBehavior(
                    details,
                    menu,
                    "menu"
                );

                section.append(
                    details
                );
            }

            return section;
        };

    const renderPhraseList =
        () => {
            const list =
                $("phraseList");

            list.replaceChildren();

            const speechMenu =
                frame.contentWindow
                    ?.SpeechMenu;

            speechMenu
                ?.extrapolatePhrases
                ?.();

            const groups =
                [
                    ...(
                        speechMenu
                            ?.phraseGroups ||
                        []
                    )
                ];

            if (!groups.length) {
                const empty =
                    document.createElement(
                        "div"
                    );

                empty.className =
                    "empty-list";
                empty.textContent =
                    "No speech phrases are available in the current UI state.";

                list.append(
                    empty
                );
                return;
            }

            const tierOrder = [
                "top-level",
                "active-modal",
                "default",
                "open-context",
                "page"
            ];

            const labels =
                new Map();

            const grouped =
                new Map();

            for (const group of groups) {
                const info =
                    classifyGroup(
                        group
                    );

                labels.set(
                    info.tier,
                    info
                );

                if (
                    !grouped.has(
                        info.tier
                    )
                ) {
                    grouped.set(
                        info.tier,
                        []
                    );
                }

                grouped
                    .get(info.tier)
                    .push(group);
            }

            for (
                const bandName of
                [
                    "modal",
                    "non-modal"
                ]
            ) {
                const availableTiers =
                    tierOrder.filter(
                        tier =>
                            labels.get(
                                tier
                            )?.band ===
                                bandName &&
                            grouped.get(
                                tier
                            )?.length
                    );

                if (
                    !availableTiers
                        .length
                ) {
                    continue;
                }

                const band =
                    document.createElement(
                        "section"
                    );

                band.className =
                    "precedence-band " +
                    bandName;

                const bandLabel =
                    document.createElement(
                        "div"
                    );

                bandLabel.className =
                    "band-label";
                bandLabel.textContent =
                    bandName ===
                        "modal"
                        ? "Modal precedence"
                        : "Non-modal precedence";

                band.append(
                    bandLabel
                );

                for (
                    const tier of
                    availableTiers
                ) {
                    band.append(
                        renderTier(
                            labels.get(
                                tier
                            ),
                            grouped.get(
                                tier
                            )
                        )
                    );
                }

                list.append(
                    band
                );
            }
        };

    const nodeSearchText =
        element =>
            (
                element.tagName +
                " " +
                element.id +
                " " +
                element.className +
                " " +
                (
                    element.getAttribute(
                        "aria-label"
                    ) ||
                    ""
                ) +
                " " +
                (
                    element.textContent ||
                    ""
                )
                    .trim()
                    .slice(0, 80)
            )
                .toLowerCase();

    const navigatorChildren =
        element =>
            [
                ...element.children
            ]
                .filter(
                    child =>
                        !ignoredNavigatorTags
                            .has(
                                child.tagName
                            ) &&
                        !(
                            child.closest(
                                "svg"
                            ) &&
                            child.tagName !==
                                "SVG"
                        )
                );

    const renderDomTree =
        () => {
            const tree =
                $("domTree");

            tree.replaceChildren();

            if (!frameDocument) {
                return;
            }

            const filter =
                $("domSearch")
                    .value
                    .trim()
                    .toLowerCase();

            const matchesTree =
                element => {
                    const children =
                        navigatorChildren(
                            element
                        );

                    return (
                        !filter ||
                        nodeSearchText(
                            element
                        ).includes(
                            filter
                        ) ||
                        children.some(
                            matchesTree
                        )
                    );
                };

            let count = 0;

            const appendNode =
                (
                    element,
                    parent,
                    depth
                ) => {
                    if (
                        count >= 1800 ||
                        !matchesTree(
                            element
                        )
                    ) {
                        return;
                    }

                    count++;

                    const row =
                        document.createElement(
                            "button"
                        );

                    row.type =
                        "button";
                    row.className =
                        "dom-row";
                    row.style
                        .paddingLeft =
                        (
                            7 +
                            depth * 13
                        ) +
                        "px";

                    row.classList
                        .toggle(
                            "selected",
                            element ===
                                selectedElement ||
                            (
                                selectedElement
                                    ?.matches?.(
                                        "speech-menu, speech-command"
                                    ) &&
                                hostElementForMenu(
                                    selectedElement
                                        .closest?.(
                                            "speech-menu"
                                        ) ||
                                    selectedElement
                                ) ===
                                    element
                            )
                        );

                    row.classList
                        .toggle(
                            "has-speech",
                            element
                                .hasAttribute(
                                    "speech-pattern"
                                )
                        );

                    row.classList
                        .toggle(
                            "has-menu",
                            Boolean(
                                associatedMenuFor(
                                    element
                                )
                            )
                        );

                    const label =
                        document.createElement(
                            "span"
                        );

                    label.className =
                        "dom-label";
                    label.textContent =
                        compactLabel(
                            element
                        );

                    row.append(
                        label
                    );

                    row.addEventListener(
                        "click",
                        () =>
                            selectElement(
                                element
                            )
                    );

                    parent.append(
                        row
                    );

                    for (
                        const child of
                        navigatorChildren(
                            element
                        )
                    ) {
                        appendNode(
                            child,
                            parent,
                            depth + 1
                        );
                    }
                };

            appendNode(
                frameDocument.body,
                tree,
                0
            );
        };

    const namedFields =
        pattern => {
            const fields = [];
            const regex =
                /\(\?<([A-Za-z_$][\w$]*)>/g;

            let match;

            while (
                (
                    match =
                        regex.exec(
                            pattern ||
                            ""
                        )
                )
            ) {
                if (
                    !fields.includes(
                        match[1]
                    )
                ) {
                    fields.push(
                        match[1]
                    );
                }
            }

            return fields;
        };

    const contextOptions =
        preproc => {
            if (
                !frameDocument ||
                !preproc
            ) {
                return [];
            }

            return [
                ...new Set(
                    [
                        ...frameDocument
                            .querySelectorAll(
                                "[speech-preproc][speech-preproc-context]"
                            )
                    ]
                        .filter(
                            element =>
                                element.getAttribute(
                                    "speech-preproc"
                                ) ===
                                preproc
                        )
                        .map(
                            element =>
                                element.getAttribute(
                                    "speech-preproc-context"
                                )
                        )
                        .filter(
                            Boolean
                        )
                )
            ].sort();
        };

    const fillDatalist =
        (
            datalist,
            values
        ) => {
            datalist.replaceChildren(
                ...values.map(
                    value =>
                        new Option(
                            value,
                            value
                        )
                )
            );
        };

    const modalHintFor =
        element => {
            if (!element) return "";

            if (
                element.matches(
                    "speech-menu"
                )
            ) {
                return element.hasAttribute(
                    "speech-modal"
                )
                    ? "This menu sets the default precedence for its child speech commands."
                    : "Blank lets child commands inherit structural precedence.";
            }

            const own =
                element.getAttribute(
                    "speech-modal"
                );

            if (own) {
                return "This candidate overrides any parent speech-menu precedence.";
            }

            const menu =
                element.closest(
                    "speech-menu"
                );

            const inherited =
                menu?.getAttribute(
                    "speech-modal"
                );

            return inherited
                ? "Inherits " +
                    inherited +
                    " from its parent speech-menu."
                : "Blank uses structural precedence.";
        };

    const renderSelection =
        () => {
            const selected =
                selectedElement;

            $("selectedTitle").textContent =
                displayName(
                    selected
                );

            $("selectedPath").textContent =
                selected
                    ? (
                        selected.matches(
                            "speech-menu, speech-command"
                        )
                            ? (
                                selected.dataset
                                    .speechTarget ||
                                selected.dataset
                                    .speechEditorId ||
                                compactLabel(
                                    selected
                                )
                            )
                            : selectorFor(
                                selected
                            )
                    )
                    : "Choose an item in the DOM navigator, phrase list, or preview.";

            const ordinary =
                selected &&
                !selected.matches(
                    "speech-menu, speech-command"
                );

            const associatedMenu =
                ordinary
                    ? associatedMenuFor(
                        selected
                    )
                    : null;

            const canToggleMenu =
                Boolean(
                    ordinary &&
                    !selected
                        .hasAttribute(
                            "speech-pattern"
                        ) &&
                    !selected.closest(
                        "speech-menu"
                    )
                );

            $("speechMenuToggleField")
                .hidden =
                !canToggleMenu;

            $("speechMenuToggle")
                .checked =
                Boolean(
                    associatedMenu
                );

            const edit =
                candidateEditElement();

            form.hidden =
                !edit;

            $("menuActions").hidden =
                !(
                    edit?.matches(
                        "speech-menu"
                    )
                );

            if (!edit) {
                return;
            }

            const isMenu =
                edit.matches(
                    "speech-menu"
                );

            for (
                const label of
                form.querySelectorAll(
                    "[data-candidate-field]"
                )
            ) {
                label.hidden =
                    isMenu;
            }

            $("preprocSettings").hidden =
                isMenu ||
                !edit.getAttribute(
                    "speech-preproc"
                );

            const attrs =
                snapshot(
                    edit
                );

            for (
                const name of
                [
                    "speech-pattern",
                    "speech-function",
                    "speech-preproc",
                    "speech-preproc-context",
                    "speech-preproc-field"
                ]
            ) {
                const input =
                    form.elements
                        .namedItem(
                            name
                        );

                if (input) {
                    input.value =
                        attrs[name] ||
                        "";
                }
            }

            $("modalValue").value =
                attrs[
                    "speech-modal"
                ] ||
                "";

            $("modalHint").textContent =
                modalHintFor(
                    edit
                );

            const preproc =
                attrs[
                    "speech-preproc"
                ] ||
                "";

            fillDatalist(
                $("preprocContextOptions"),
                contextOptions(
                    preproc
                )
            );

            fillDatalist(
                $("preprocFieldOptions"),
                namedFields(
                    attrs[
                        "speech-pattern"
                    ]
                )
            );

            if (isMenu) {
                $("removeButton")
                    .textContent =
                    edit.dataset
                        .speechEditorId
                        ?.startsWith(
                            "edit:"
                        )
                        ? "Remove Speech Menu"
                        : "Reset menu override";
            }
            else if (
                edit.dataset
                    .speechEditorId
                    ?.startsWith(
                        "edit:"
                    )
            ) {
                $("removeButton")
                    .textContent =
                    "Remove Speech Command";
            }
            else if (
                edit.matches(
                    "speech-command"
                )
            ) {
                $("removeButton")
                    .textContent =
                    "Disable Speech Command";
            }
            else {
                $("removeButton")
                    .textContent =
                    "Remove speech attributes";
            }
        };

    const updateEntryField =
        (
            element,
            name,
            value
        ) => {
            const entry =
                writableEntry(
                    element
                );

            if (!entry) {
                return;
            }

            if (
                name ===
                    "speech-modal" &&
                value === ""
            ) {
                delete entry.attrs[
                    name
                ];
            }
            else if (value) {
                entry.attrs[name] =
                    value;
            }
            else {
                delete entry.attrs[
                    name
                ];
            }

            scheduleApply();
        };

    const attachCombobox =
        (
            input,
            optionsNode
        ) => {
            let active = -1;

            const optionButtons =
                () =>
                    [
                        ...optionsNode
                            .querySelectorAll(
                                ".combo-option"
                            )
                    ];

            const renderOptions =
                () => {
                    optionsNode
                        .replaceChildren();

                    for (
                        const name of
                        functionNames
                    ) {
                        const button =
                            document.createElement(
                                "button"
                            );

                        button.type =
                            "button";
                        button.className =
                            "combo-option";
                        button.setAttribute(
                            "role",
                            "option"
                        );
                        button.textContent =
                            name;

                        button.addEventListener(
                            "pointerdown",
                            event =>
                                event
                                    .preventDefault()
                        );

                        button.addEventListener(
                            "click",
                            () => {
                                input.value =
                                    name;
                                input.dispatchEvent(
                                    new Event(
                                        "input",
                                        {
                                            bubbles:
                                                true
                                        }
                                    )
                                );
                                hide();
                                input.focus();
                            }
                        );

                        optionsNode.append(
                            button
                        );
                    }

                    active = -1;
                    moveToPrefix();
                };

            const show = () => {
                if (
                    !optionsNode
                        .childElementCount
                ) {
                    renderOptions();
                }

                optionsNode.hidden =
                    false;

                input.setAttribute(
                    "aria-expanded",
                    "true"
                );

                moveToPrefix();
            };

            const hide = () => {
                optionsNode.hidden =
                    true;

                input.setAttribute(
                    "aria-expanded",
                    "false"
                );

                active = -1;
            };

            const setActive =
                index => {
                    const buttons =
                        optionButtons();

                    for (
                        const button of
                        buttons
                    ) {
                        button.classList
                            .remove(
                                "active"
                            );
                    }

                    if (!buttons.length) {
                        active = -1;
                        return;
                    }

                    active =
                        (
                            index %
                                buttons.length +
                            buttons.length
                        ) %
                        buttons.length;

                    const button =
                        buttons[
                            active
                        ];

                    button.classList
                        .add(
                            "active"
                        );

                    button.scrollIntoView(
                        {
                            block:
                                "nearest"
                        }
                    );
                };

            const moveToPrefix =
                () => {
                    const value =
                        input.value
                            .trim()
                            .toLowerCase();

                    const buttons =
                        optionButtons();

                    if (!buttons.length) {
                        return;
                    }

                    const match =
                        buttons.findIndex(
                            button =>
                                button.textContent
                                    .toLowerCase()
                                    .startsWith(
                                        value
                                    )
                        );

                    setActive(
                        match >= 0
                            ? match
                            : 0
                    );
                };

            input.addEventListener(
                "focus",
                show
            );

            input.addEventListener(
                "input",
                () => {
                    show();
                    moveToPrefix();
                }
            );

            input.addEventListener(
                "keydown",
                event => {
                    if (
                        event.key ===
                        "ArrowDown"
                    ) {
                        event.preventDefault();
                        show();
                        setActive(
                            active + 1
                        );
                    }
                    else if (
                        event.key ===
                        "ArrowUp"
                    ) {
                        event.preventDefault();
                        show();
                        setActive(
                            active - 1
                        );
                    }
                    else if (
                        event.key ===
                            "Enter" &&
                        active >= 0
                    ) {
                        const button =
                            optionButtons()[
                                active
                            ];

                        if (button) {
                            event.preventDefault();
                            input.value =
                                button.textContent;
                            input.dispatchEvent(
                                new Event(
                                    "input",
                                    {
                                        bubbles:
                                            true
                                    }
                                )
                            );
                            hide();
                        }
                    }
                    else if (
                        event.key ===
                        "Escape"
                    ) {
                        hide();
                    }
                }
            );

            input.addEventListener(
                "blur",
                () =>
                    setTimeout(
                        hide,
                        120
                    )
            );

            return {
                refresh:
                    renderOptions
            };
        };

    const functionCombo =
        attachCombobox(
            $("functionInput"),
            $("functionOptions")
        );

    const preprocCombo =
        attachCombobox(
            $("preprocInput"),
            $("preprocOptions")
        );

    const renderAll = () => {
        renderPhraseList();
        renderDomTree();
        renderSelection();
        updateButtons();
    };

    const selectFromPreview =
        element => {
            if (
                !element ||
                element ===
                    frameDocument
            ) {
                return;
            }

            selectElement(
                element
            );
        };

    const intercept =
        event => {
            if (!overlay) return;

            event.preventDefault();
            event.stopImmediatePropagation();

            if (
                event.type ===
                    "pointerdown" ||
                event.type ===
                    "click"
            ) {
                selectFromPreview(
                    event.target
                );
            }
        };

    const attachFrame =
        () => {
            frameDocument =
                frame.contentDocument;

            if (!frameDocument) {
                return;
            }

            for (
                const type of
                [
                    "pointerdown",
                    "pointerup",
                    "click",
                    "dblclick"
                ]
            ) {
                frameDocument
                    .addEventListener(
                        type,
                        intercept,
                        true
                    );
            }

            frameDocument
                .addEventListener(
                    "toggle",
                    scheduleLiveRefresh,
                    true
                );

            frameDocument
                .addEventListener(
                    "close",
                    scheduleLiveRefresh,
                    true
                );

            frameDocument
                .addEventListener(
                    "cancel",
                    scheduleLiveRefresh,
                    true
                );

            const speechMenu =
                frame.contentWindow
                    ?.SpeechMenu;

            speechMenu
                ?.events
                ?.addEventListener(
                    "phrasesChanged",
                    scheduleLiveRefresh
                );

            frameObserver
                ?.disconnect();

            frameObserver =
                new MutationObserver(
                    scheduleLiveRefresh
                );

            frameObserver.observe(
                frameDocument.body,
                {
                    subtree: true,
                    childList: true,
                    attributes: true,
                    attributeFilter: [
                        "speech-pattern",
                        "speech-modal",
                        "open",
                        "hidden",
                        "disabled"
                    ]
                }
            );

            functionNames =
                frame.contentWindow
                    ?.WMOFSpeechEditorRuntime
                    ?.listFunctions
                    ?.() ||
                [];

            functionCombo.refresh();
            preprocCombo.refresh();

            selectedElement =
                undefined;
            selectedLocator =
                undefined;

            $("selectedTitle")
                .textContent =
                "Select an element";

            $("selectedPath")
                .textContent =
                "Choose an item in the DOM navigator, phrase list, or preview.";

            frame.classList
                .toggle(
                    "editor-overlay-on",
                    overlay
                );

            frame.classList
                .toggle(
                    "editor-overlay-off",
                    !overlay
                );

            renderAll();
        };

    if (
        frame.contentDocument
            ?.readyState ===
        "complete"
    ) {
        attachFrame();
    }

    frame.addEventListener(
        "load",
        attachFrame
    );

    $("overlayToggle")
        .addEventListener(
            "click",
            () => {
                overlay =
                    !overlay;

                $("overlayToggle")
                    .textContent =
                    "Overlay: " +
                    (
                        overlay
                            ? "On"
                            : "Off"
                    );

                $("overlayToggle")
                    .setAttribute(
                        "aria-pressed",
                        String(
                            overlay
                        )
                    );

                frame.classList
                    .toggle(
                        "editor-overlay-on",
                        overlay
                    );

                frame.classList
                    .toggle(
                        "editor-overlay-off",
                        !overlay
                    );
            }
        );

    $("domSearch")
        .addEventListener(
            "input",
            renderDomTree
        );

    form.addEventListener(
        "input",
        event => {
            const target =
                event.target;

            if (
                !target.name ||
                target.name ===
                    "speech-modal"
            ) {
                return;
            }

            const edit =
                candidateEditElement();

            if (!edit) return;

            updateEntryField(
                edit,
                target.name,
                target.value
            );

            if (
                target.name ===
                "speech-preproc"
            ) {
                $("preprocSettings")
                    .hidden =
                    !target.value;
            }

            if (
                target.name ===
                "speech-pattern"
            ) {
                fillDatalist(
                    $("preprocFieldOptions"),
                    namedFields(
                        target.value
                    )
                );
            }
        }
    );

    $("modalValue")
        .addEventListener(
            "change",
            event => {
                const edit =
                    candidateEditElement();

                if (!edit) return;

                updateEntryField(
                    edit,
                    "speech-modal",
                    event.target.value
                );
            }
        );

    $("speechMenuToggle")
        .addEventListener(
            "change",
            event => {
                const host =
                    selectedElement;

                if (
                    !host ||
                    host.matches(
                        "speech-menu, speech-command"
                    )
                ) {
                    return;
                }

                const existing =
                    associatedMenuFor(
                        host
                    );

                if (
                    event.target.checked
                ) {
                    if (existing) {
                        return;
                    }

                    const target =
                        selectorFor(
                            host
                        );

                    const id =
                        "edit:menu:" +
                        Date.now()
                            .toString(36);

                    draft.push({
                        id,
                        kind:
                            "menu",
                        target,
                        attrs: {}
                    });

                    selectedLocator = {
                        type:
                            "editor-id",
                        value:
                            id
                    };

                    scheduleApply();
                    status(
                        "Speech Menu added."
                    );
                    return;
                }

                if (!existing) {
                    return;
                }

                const menuEntry =
                    entryForElement(
                        existing
                    );

                if (!menuEntry) {
                    event.target.checked =
                        true;
                    return;
                }

                const children =
                    [
                        ...existing
                            .querySelectorAll(
                                ":scope > speech-command"
                            )
                    ];

                if (
                    children.length &&
                    !confirm(
                        "This Speech Menu contains " +
                        children.length +
                        " speech command" +
                        (
                            children.length ===
                                1
                                ? ""
                                : "s"
                        ) +
                        ". Unchecking Speech Menu will permanently remove those speech commands. Continue?"
                    )
                ) {
                    event.target.checked =
                        true;
                    return;
                }

                const id =
                    menuEntry.id;

                draft =
                    draft.filter(
                        entry =>
                            entry.id !== id &&
                            entry.parentId !== id
                    );

                selectedLocator = {
                    type:
                        "selector",
                    value:
                        menuEntry.target
                };

                scheduleApply();
                status(
                    "Speech Menu removed."
                );
            }
        );

    $("addCommandButton")
        .addEventListener(
            "click",
            () => {
                const menu =
                    currentMenu();

                if (!menu) return;

                const menuEntry =
                    writableEntry(
                        menu
                    );

                if (!menuEntry) {
                    return;
                }

                const id =
                    "edit:command:" +
                    Date.now()
                        .toString(36) +
                    Math.random()
                        .toString(36)
                        .slice(2, 6);

                draft.push({
                    id,
                    kind:
                        "command",
                    target:
                        menuEntry.target ||
                        "body",
                    parentId:
                        menuEntry.id,
                    attrs: {}
                });

                selectedLocator = {
                    type:
                        "editor-id",
                    value:
                        id
                };

                scheduleApply();
                status(
                    "Speech Command added."
                );
            }
        );

    $("removeButton")
        .addEventListener(
            "click",
            () => {
                const edit =
                    candidateEditElement();

                if (!edit) return;

                const entry =
                    entryForElement(
                        edit
                    );

                if (!entry) {
                    return;
                }

                if (
                    edit.matches(
                        "speech-menu"
                    )
                ) {
                    const children =
                        [
                            ...edit
                                .querySelectorAll(
                                    ":scope > speech-command"
                                )
                        ];

                    if (
                        children.length &&
                        !confirm(
                            "Removing this Speech Menu will also remove " +
                            children.length +
                            " child speech command" +
                            (
                                children.length ===
                                    1
                                    ? ""
                                    : "s"
                            ) +
                            ". Continue?"
                        )
                    ) {
                        return;
                    }

                    if (
                        entry.id
                            .startsWith(
                                "edit:"
                            )
                    ) {
                        draft =
                            draft.filter(
                                item =>
                                    item.id !==
                                        entry.id &&
                                    item.parentId !==
                                        entry.id
                            );

                        const host =
                            hostElementForMenu(
                                edit
                            );

                        selectedLocator =
                            host
                                ? locatorFor(
                                    host
                                )
                                : undefined;
                    }
                    else {
                        const writable =
                            writableEntry(
                                edit
                            );

                        writable.attrs =
                            {};
                    }

                    scheduleApply();
                    return;
                }

                if (
                    entry.id
                        .startsWith(
                            "edit:"
                        )
                ) {
                    draft =
                        draft.filter(
                            item =>
                                item.id !==
                                entry.id
                        );

                    const menu =
                        edit.closest(
                            "speech-menu"
                        );

                    selectedLocator =
                        menu
                            ? locatorFor(
                                menu
                            )
                            : undefined;
                }
                else {
                    const writable =
                        writableEntry(
                            edit
                        );

                    writable.attrs =
                        {};
                }

                scheduleApply();
            }
        );

    const splitter =
        $("inspectorSplitter");

    let splitStartY;
    let splitStartHeight;

    splitter.addEventListener(
        "pointerdown",
        event => {
            splitStartY =
                event.clientY;

            splitStartHeight =
                document
                    .querySelector(
                        ".phrase-pane"
                    )
                    .getBoundingClientRect()
                    .height;

            splitter
                .setPointerCapture?.(
                    event.pointerId
                );

            event.preventDefault();
        }
    );

    splitter.addEventListener(
        "pointermove",
        event => {
            if (
                splitStartY ===
                undefined
            ) {
                return;
            }

            const inspector =
                document
                    .querySelector(
                        ".inspector"
                    );

            const total =
                inspector
                    .getBoundingClientRect()
                    .height;

            const next =
                Math.max(
                    150,
                    Math.min(
                        total - 210,
                        splitStartHeight +
                        event.clientY -
                        splitStartY
                    )
                );

            document
                .documentElement
                .style
                .setProperty(
                    "--phrase-pane-height",
                    next + "px"
                );
        }
    );

    const endSplit = () => {
        splitStartY =
            undefined;
        splitStartHeight =
            undefined;
    };

    splitter.addEventListener(
        "pointerup",
        endSplit
    );

    splitter.addEventListener(
        "pointercancel",
        endSplit
    );

    splitter.addEventListener(
        "keydown",
        event => {
            if (
                ![
                    "ArrowUp",
                    "ArrowDown"
                ].includes(
                    event.key
                )
            ) {
                return;
            }

            event.preventDefault();

            const current =
                document
                    .querySelector(
                        ".phrase-pane"
                    )
                    .getBoundingClientRect()
                    .height;

            const inspectorHeight =
                document
                    .querySelector(
                        ".inspector"
                    )
                    .getBoundingClientRect()
                    .height;

            const next =
                Math.max(
                    150,
                    Math.min(
                        inspectorHeight -
                            210,
                        current +
                        (
                            event.key ===
                                "ArrowDown"
                                ? 20
                                : -20
                        )
                    )
                );

            document
                .documentElement
                .style
                .setProperty(
                    "--phrase-pane-height",
                    next + "px"
                );
        }
    );

    const resolvesFunction =
        path => {
            let value =
                frame.contentWindow;

            for (
                const part of
                String(path)
                    .split(".")
            ) {
                value =
                    value?.[part];
            }

            return typeof value ===
                "function";
        };

    const validate = () => {
        for (const entry of draft) {
            const kind =
                normalizeKind(
                    entry.kind
                );

            const attrs =
                entry.attrs ||
                {};

            const modal =
                attrs[
                    "speech-modal"
                ];

            if (
                modal &&
                ![
                    "top-level",
                    "default"
                ].includes(
                    modal
                )
            ) {
                return (
                    "Invalid speech-modal value: " +
                    modal
                );
            }

            if (
                kind === "menu"
            ) {
                continue;
            }

            if (
                kind === "command" &&
                Object.keys(attrs)
                    .length &&
                !attrs[
                    "speech-pattern"
                ]
            ) {
                return "New speech commands need speech-pattern.";
            }

            if (
                attrs[
                    "speech-pattern"
                ] &&
                !attrs[
                    "speech-function"
                ]
            ) {
                return "Commands with a pattern need speech-function.";
            }

            if (
                attrs[
                    "speech-pattern"
                ]
            ) {
                try {
                    new RegExp(
                        attrs[
                            "speech-pattern"
                        ],
                        "i"
                    );
                }
                catch {
                    return (
                        "Invalid pattern: " +
                        attrs[
                            "speech-pattern"
                        ]
                    );
                }
            }

            for (
                const name of
                [
                    "speech-function",
                    "speech-preproc"
                ]
            ) {
                if (
                    attrs[name] &&
                    !resolvesFunction(
                        attrs[name]
                    )
                ) {
                    return (
                        name +
                        " was not found: " +
                        attrs[name]
                    );
                }
            }
        }

        return "";
    };

    $("saveButton")
        .addEventListener(
            "click",
            async () => {
                const error =
                    validate();

                if (error) {
                    status(
                        error,
                        true
                    );
                    return;
                }

                $("saveButton").disabled =
                    true;

                try {
                    const response =
                        await fetch(
                            endpoint,
                            {
                                method:
                                    "PUT",
                                credentials:
                                    "same-origin",
                                headers: {
                                    "Content-Type":
                                        "application/json",
                                    "X-CSRF-Token":
                                        document
                                            .body
                                            .dataset
                                            .csrf
                                },
                                body:
                                    JSON.stringify({
                                        entries:
                                            draft,
                                        revision
                                    })
                            }
                        );

                    const data =
                        await response.json();

                    if (!response.ok) {
                        throw new Error(
                            data.message ||
                            "Save failed."
                        );
                    }

                    saved =
                        normalizeEntries(
                            data.entries
                        );

                    draft =
                        structuredClone(
                            saved
                        );

                    revision =
                        data.revision;

                    frame.contentWindow
                        .location
                        .reload();

                    status(
                        "Speech commands saved."
                    );
                }
                catch (error) {
                    status(
                        error.message,
                        true
                    );
                }

                updateButtons();
            }
        );

    $("discardButton")
        .addEventListener(
            "click",
            () => {
                draft =
                    structuredClone(
                        saved
                    );

                frame.contentWindow
                    .location
                    .reload();

                status(
                    "Unsaved speech changes discarded."
                );
            }
        );

    addEventListener(
        "beforeunload",
        event => {
            if (!dirty()) return;

            event.preventDefault();
            event.returnValue =
                "";
        }
    );

    fetch(
        endpoint,
        {
            credentials:
                "same-origin",
            cache:
                "no-store"
        }
    )
        .then(
            response =>
                response.json()
        )
        .then(
            data => {
                if (
                    !Array.isArray(
                        data.entries
                    )
                ) {
                    throw new Error(
                        data.message ||
                        "Configuration unavailable."
                    );
                }

                saved =
                    normalizeEntries(
                        data.entries
                    );

                draft =
                    structuredClone(
                        saved
                    );

                revision =
                    data.revision;

                renderAll();
            }
        )
        .catch(
            error =>
                status(
                    error.message,
                    true
                )
        );
})();
