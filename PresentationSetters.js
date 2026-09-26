(() => {
    "use strict";

    const presentation =
        Object.create(null);

    let responseTimer;

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
                    "Invalid presentation setter: " +
                    normalized
                );
            }

            presentation[
                normalized
            ] =
                implementation;

            globalThis
                .WMOFSpeechFunctionRegistry
                ?.ensureRole?.(
                    "WMOFPresentation." +
                    normalized,
                    "presentation"
                );

            return implementation;
        };

    const responseBar =
        () =>
            document.querySelector(
                "speech-mic-bar"
            );

    const isVisible =
        element => {
            if (
                !(element instanceof Element) ||
                !element.isConnected ||
                element.hidden
            ) {
                return false;
            }

            try {
                const style =
                    getComputedStyle(
                        element
                    );

                if (
                    style.display === "none" ||
                    style.visibility === "hidden"
                ) {
                    return false;
                }

                const rect =
                    element
                        .getBoundingClientRect();

                return (
                    rect.width > 0 &&
                    rect.height > 0
                );
            }
            catch {
                return false;
            }
        };

    const resolveTargets =
        (
            selector,
            elements
        ) => {
            const result = [];
            const seen = new Set();

            const append =
                element => {
                    if (
                        !(element instanceof Element) ||
                        seen.has(element)
                    ) {
                        return;
                    }

                    seen.add(element);
                    result.push(element);
                };

            for (
                const element of
                Array.isArray(elements)
                    ? elements
                    : []
            ) {
                append(element);
            }

            if (
                !result.length &&
                selector
            ) {
                try {
                    for (
                        const element of
                        document.querySelectorAll(
                            selector
                        )
                    ) {
                        append(element);
                    }
                }
                catch {}
            }

            return result;
        };

    const chooseRepresentative =
        elements => {
            const visible =
                elements.filter(
                    isVisible
                );

            const candidates =
                visible.length
                    ? visible
                    : elements;

            if (!candidates.length) {
                return undefined;
            }

            if (
                candidates.includes(
                    document.activeElement
                )
            ) {
                return document.activeElement;
            }

            return candidates
                .map(
                    (
                        element,
                        index
                    ) => {
                        let area =
                            Number
                                .POSITIVE_INFINITY;

                        try {
                            const rect =
                                element
                                    .getBoundingClientRect();

                            if (
                                rect.width > 0 &&
                                rect.height > 0
                            ) {
                                area =
                                    rect.width *
                                    rect.height;
                            }
                        }
                        catch {}

                        return {
                            element,
                            area,
                            index
                        };
                    }
                )
                .sort(
                    (a, b) =>
                        a.area -
                            b.area ||
                        a.index -
                            b.index
                )[0]
                ?.element;
        };

    const copyComputedStyle =
        (
            source,
            target,
            pseudo
        ) => {
            let style;

            try {
                style =
                    getComputedStyle(
                        source,
                        pseudo
                    );
            }
            catch {
                return;
            }

            if (!style) return;

            for (
                let index = 0;
                index < style.length;
                index++
            ) {
                const property =
                    style[index];

                try {
                    target.style.setProperty(
                        property,
                        style.getPropertyValue(
                            property
                        ),
                        style.getPropertyPriority(
                            property
                        )
                    );
                }
                catch {}
            }
        };

    const clonePseudo =
        (
            source,
            pseudo
        ) => {
            let style;

            try {
                style =
                    getComputedStyle(
                        source,
                        pseudo
                    );
            }
            catch {
                return undefined;
            }

            if (!style) {
                return undefined;
            }

            const content =
                style.content;

            const hasContent =
                content &&
                content !== "none" &&
                content !== "normal" &&
                content !== '""';

            const hasVisual =
                style.backgroundImage !==
                    "none" ||
                style.maskImage !==
                    "none" ||
                style.webkitMaskImage !==
                    "none";

            if (
                !hasContent &&
                !hasVisual
            ) {
                return undefined;
            }

            const node =
                document.createElement(
                    "span"
                );

            node.dataset
                .speechResponsePseudo =
                pseudo === "::before"
                    ? "before"
                    : "after";

            copyComputedStyle(
                source,
                node,
                pseudo
            );

            if (hasContent) {
                node.textContent =
                    content.replace(
                        /^["']|["']$/g,
                        ""
                    );
            }

            node.setAttribute(
                "aria-hidden",
                "true"
            );

            return node;
        };

    const sanitize =
        node => {
            if (
                !(node instanceof Element)
            ) {
                return;
            }

            node.removeAttribute("id");
            node.removeAttribute("for");
            node.removeAttribute(
                "popovertarget"
            );
            node.setAttribute(
                "aria-hidden",
                "true"
            );

            if ("disabled" in node) {
                try {
                    node.disabled = true;
                }
                catch {}
            }

            for (
                const child of
                node.querySelectorAll(
                    "[id], [for], [popovertarget]"
                )
            ) {
                child.removeAttribute("id");
                child.removeAttribute("for");
                child.removeAttribute(
                    "popovertarget"
                );
                child.setAttribute(
                    "aria-hidden",
                    "true"
                );

                if ("disabled" in child) {
                    try {
                        child.disabled =
                            true;
                    }
                    catch {}
                }
            }
        };

    const shouldCompactButton =
        source => {
            if (
                !source.matches?.(
                    "button, [role='button'], input[type='button'], input[type='submit'], input[type='reset']"
                )
            ) {
                return false;
            }

            let width = 0;
            let height = 0;

            try {
                const rect =
                    source
                        .getBoundingClientRect();

                width =
                    Number(
                        rect.width
                    ) ||
                    0;
                height =
                    Number(
                        rect.height
                    ) ||
                    0;
            }
            catch {}

            try {
                const style =
                    getComputedStyle(
                        source
                    );

                width =
                    Math.max(
                        width,
                        parseFloat(
                            style.width
                        ) ||
                        0
                    );
                height =
                    Math.max(
                        height,
                        parseFloat(
                            style.height
                        ) ||
                        0
                    );
            }
            catch {}

            width =
                Math.max(
                    width,
                    Number(
                        source.scrollWidth
                    ) ||
                    0
                );
            height =
                Math.max(
                    height,
                    Number(
                        source.scrollHeight
                    ) ||
                    0
                );

            return (
                width > 280 ||
                height > 48
            );
        };

    const compactButton =
        source => {
            const visual =
                document.createElement(
                    "div"
                );

            visual.className =
                "speech-response-button-facsimile";

            let style;

            try {
                style =
                    getComputedStyle(
                        source
                    );
            }
            catch {}

            for (
                const property of
                [
                    "background",
                    "background-color",
                    "color",
                    "border",
                    "border-color",
                    "border-style",
                    "border-width",
                    "border-radius",
                    "box-shadow",
                    "font-family",
                    "font-weight",
                    "text-transform",
                    "letter-spacing"
                ]
            ) {
                const value =
                    style
                        ?.getPropertyValue(
                            property
                        );

                if (value) {
                    visual.style
                        .setProperty(
                            property,
                            value
                        );
                }
            }

            visual.style
                .setProperty(
                    "box-sizing",
                    "border-box"
                );
            visual.style
                .setProperty(
                    "max-width",
                    "240px"
                );
            visual.style
                .setProperty(
                    "max-height",
                    "46px"
                );
            visual.style
                .setProperty(
                    "min-height",
                    "24px"
                );
            visual.style
                .setProperty(
                    "padding",
                    "4px 10px"
                );
            visual.style
                .setProperty(
                    "display",
                    "flex"
                );
            visual.style
                .setProperty(
                    "align-items",
                    "center"
                );
            visual.style
                .setProperty(
                    "justify-content",
                    "center"
                );
            visual.style
                .setProperty(
                    "overflow",
                    "hidden"
                );
            visual.style
                .setProperty(
                    "white-space",
                    "nowrap"
                );
            visual.style
                .setProperty(
                    "text-overflow",
                    "ellipsis"
                );
            visual.style
                .setProperty(
                    "font-size",
                    "12px"
                );
            visual.style
                .setProperty(
                    "line-height",
                    "1.15"
                );

            visual.textContent =
                (
                    source.getAttribute(
                        "aria-label"
                    ) ||
                    (
                        "value" in source
                            ? source.value
                            : ""
                    ) ||
                    source.textContent ||
                    ""
                )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();

            visual.setAttribute(
                "aria-hidden",
                "true"
            );
            visual.setAttribute(
                "data-speech-response-snapshot",
                ""
            );

            return visual;
        };

    const cloneVisual =
        source => {
            if (
                !(source instanceof Element)
            ) {
                return undefined;
            }

            if (
                shouldCompactButton(
                    source
                )
            ) {
                return compactButton(
                    source
                );
            }

            const clone =
                source.cloneNode(false);

            copyComputedStyle(
                source,
                clone
            );
            sanitize(clone);

            const before =
                clonePseudo(
                    source,
                    "::before"
                );

            if (before) {
                clone.append(before);
            }

            for (
                const child of
                source.childNodes
            ) {
                if (
                    child instanceof Element
                ) {
                    const childClone =
                        cloneVisual(
                            child
                        );

                    if (childClone) {
                        clone.append(
                            childClone
                        );
                    }
                }
                else {
                    clone.append(
                        child.cloneNode(
                            true
                        )
                    );
                }
            }

            const after =
                clonePseudo(
                    source,
                    "::after"
                );

            if (after) {
                clone.append(after);
            }

            clone.style
                .setProperty(
                    "pointer-events",
                    "none",
                    "important"
                );
            clone.setAttribute(
                "data-speech-response-snapshot",
                ""
            );

            return clone;
        };

    const responseTimeout =
        commandElement => {
            const raw =
                commandElement
                    ?.getAttribute?.(
                        "speech-response-timeout"
                    );

            if (
                raw === null ||
                raw === undefined ||
                String(raw).trim() === ""
            ) {
                return 2000;
            }

            const value =
                String(raw)
                    .trim()
                    .toLowerCase();

            if (
                [
                    "persistent",
                    "none",
                    "manual"
                ].includes(value)
            ) {
                return null;
            }

            let milliseconds;

            if (
                value.endsWith("ms")
            ) {
                milliseconds =
                    Number(
                        value.slice(
                            0,
                            -2
                        )
                    );
            }
            else if (
                value.endsWith("s")
            ) {
                milliseconds =
                    Number(
                        value.slice(
                            0,
                            -1
                        )
                    ) *
                    1000;
            }
            else {
                milliseconds =
                    Number(value);
            }

            return (
                Number.isFinite(
                    milliseconds
                ) &&
                milliseconds >= 0
            )
                ? milliseconds
                : 2000;
        };

    const dismissSpeechResponse =
        (
            {
                fast = false
            } = {}
        ) => {
            clearTimeout(
                responseTimer
            );
            responseTimer =
                undefined;

            return responseBar()
                ?.clearResponse?.({
                    duration:
                        fast
                            ? 90
                            : 190
                });
        };

    const scheduleDismissal =
        (
            commandElement,
            utteranceId
        ) => {
            clearTimeout(
                responseTimer
            );
            responseTimer =
                undefined;

            const delay =
                responseTimeout(
                    commandElement
                );

            if (delay === null) {
                return;
            }

            responseTimer =
                setTimeout(
                    () => {
                        responseTimer =
                            undefined;
                        void responseBar()
                            ?.clearResponse?.({
                                duration:
                                    190,
                                utteranceId
                            });
                    },
                    delay
                );
        };

    const beginSpeechResponse =
        (
            {
                commandElement,
                targetSelector,
                targetElements
            } = {}
        ) => {
            const targets =
                resolveTargets(
                    targetSelector,
                    targetElements
                );

            const representative =
                chooseRepresentative(
                    targets
                );

            return {
                commandElement,
                targetSelector,
                targets,
                representative,
                before:
                    cloneVisual(
                        representative
                    )
            };
        };

    const finishSpeechResponse =
        (
            session,
            {
                commandElement =
                    session?.commandElement,
                targetSelector =
                    session?.targetSelector,
                targetElements =
                    session?.targets,
                utteranceId
            } = {}
        ) => {
            if (!session) {
                return false;
            }

            const targets =
                resolveTargets(
                    targetSelector,
                    targetElements
                );

            const representative =
                session
                    .representative
                    ?.isConnected
                    ? session
                        .representative
                    : chooseRepresentative(
                        targets
                    );

            const after =
                cloneVisual(
                    representative
                );

            if (
                !session.before &&
                !after
            ) {
                return false;
            }

            clearTimeout(
                responseTimer
            );
            responseTimer =
                undefined;

            const bar =
                responseBar();

            if (!bar) {
                return false;
            }

            bar.presentResponseTransition?.(
                session.before ||
                    after,
                after ||
                    session.before,
                {
                    duration: 320
                }
            );

            scheduleDismissal(
                commandElement,
                utteranceId
            );

            return true;
        };

    const presentSpeechDictation =
        (
            value,
            {
                commandElement,
                utteranceId
            } = {}
        ) => {
            const text =
                String(
                    value ??
                    ""
                ).trim();

            if (!text) {
                return false;
            }

            clearTimeout(
                responseTimer
            );

            responseTimer =
                undefined;

            const bar =
                responseBar();

            if (!bar) {
                return false;
            }

            bar.setResponse?.(
                text
            );

            scheduleDismissal(
                commandElement,
                utteranceId
            );

            return true;
        };

    const cancelSpeechResponse =
        () =>
            false;

    globalThis.WMOFPresentation =
        presentation;

    globalThis.WMOFPresentationSetters =
        Object.freeze({
            define,
            beginSpeechResponse,
            finishSpeechResponse,
            presentSpeechDictation,
            cancelSpeechResponse,
            dismissSpeechResponse
        });
})();
