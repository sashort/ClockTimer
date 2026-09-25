
(() => {
    "use strict";

    const STYLE_ID =
        "hamburger-menu-base-styles";

    const PROMOTION_DURATION =
        750;

    const PROMOTION_PAUSE =
        75;

    const ZOOM_DURATION =
        520;

    const wait =
        milliseconds =>
            new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        milliseconds
                    )
            );

    const px =
        value => {
            const number =
                Number.parseFloat(
                    String(value || "")
                );

            return Number.isFinite(
                number
            )
                ? number
                : 0;
        };

    const nextFrame =
        () =>
            new Promise(
                resolve =>
                    requestAnimationFrame(
                        () =>
                            resolve()
                    )
            );

    if (
        !document.getElementById(
            STYLE_ID
        )
    ) {
        const style =
            document
                .createElement(
                    "style"
                );

        style.id =
            STYLE_ID;

        style.textContent = [
            ":where(hamburger-menu) {",
            "  display: inline-block;",
            "  position: relative;",
            "  min-width: 0;",
            "  max-width: 100%;",
            "}",
            ":where(hamburger-menu) > [slot=\"trigger\"] {",
            "  translate: none;",
            "}",
            ":where(hamburger-menu) > .hamburger-menu-popover {",
            "  position: fixed;",
            "  opacity: 0;",
            "  visibility: hidden;",
            "  pointer-events: none;",
            "  translate: var(--hamburger-menu-popover-shift-x, 0px) var(--hamburger-menu-popover-shift-y, 0px);",
            "  position-try-order: most-height;",
            "  position-try-fallbacks: --hamburger-above-start, --hamburger-below-end, --hamburger-above-end, --hamburger-right-start, --hamburger-left-start;",
            "  inset: auto;",
            "  top: anchor(bottom);",
            "  left: anchor(left);",
            "  right: auto;",
            "  bottom: auto;",
            "  margin: 0;",
            "  max-width: calc(100vw - 16px);",
            "  height: fit-content;",
            "  min-height: 0;",
            "  max-height: var(--hamburger-menu-safe-height, calc(100dvh - 16px));",
            "  overflow: visible;",
            "  box-sizing: border-box;",
            "  z-index: 1000;",
            "}",
            ":where(hamburger-menu) > .hamburger-menu-popover[hidden] {",
            "  display: none;",
            "}",
            ":where(hamburger-menu) > .hamburger-menu-popover[data-ready=\"true\"] {",
            "  opacity: 1;",
            "  visibility: visible;",
            "  pointer-events: auto;",
            "}",
            ":where(hamburger-menu) > .hamburger-menu-popover[data-calculating=\"true\"] {",
            "  opacity: 0 !important;",
            "  visibility: hidden !important;",
            "  pointer-events: none !important;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-pane-frozen {",
            "  overflow: hidden !important;",
            "  flex: none !important;",
            "  min-width: 0 !important;",
            "  min-height: 0 !important;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-viewport {",
            "  position: relative;",
            "  width: 100%;",
            "  height: var(--hamburger-menu-panel-height, auto);",
            "  min-height: 0;",
            "  overflow-x: auto;",
            "  overflow-y: hidden;",
            "  scroll-snap-type: x mandatory;",
            "  scroll-behavior: smooth;",
            "  overscroll-behavior-x: contain;",
            "  scrollbar-width: none;",
            "  touch-action: pan-x pan-y;",
            "  box-sizing: border-box;",
            "  transition: height var(--hamburger-menu-layout-duration, 240ms) ease-in-out;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-viewport::-webkit-scrollbar {",
            "  display: none;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-source {",
            "  width: 100%;",
            "  min-height: 0;",
            "  display: flex;",
            "  align-items: stretch;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-panel {",
            "  width: 100%;",
            "  min-width: 100%;",
            "  height: var(--hamburger-menu-panel-height, auto);",
            "  flex: 0 0 100%;",
            "  overflow: hidden;",
            "  box-sizing: border-box;",
            "  scroll-snap-align: start;",
            "  scroll-snap-stop: always;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-indicator {",
            "  position: relative;",
            "  height: var(--hamburger-menu-indicator-height, 4px);",
            "  margin: var(--hamburger-menu-indicator-gap, 8px) 14px 3px;",
            "  overflow: hidden;",
            "  border-radius: 999px;",
            "  background: rgb(255 255 255 / 20%);",
            "  opacity: 1;",
            "  transition: opacity 180ms ease-in-out, height 180ms ease-in-out, margin 180ms ease-in-out;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-indicator[hidden] {",
            "  display: none;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-indicator-thumb {",
            "  position: absolute;",
            "  inset: 0 auto 0 0;",
            "  width: 100%;",
            "  height: 100%;",
            "  border-radius: inherit;",
            "  background: var(--hamburger-menu-indicator-color, currentColor);",
            "  transform: translateX(0);",
            "  will-change: transform, width;",
            "  transition: transform 220ms ease-in-out, width 220ms ease-in-out;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-focus-layer {",
            "  position: absolute;",
            "  inset: 0;",
            "  z-index: 8;",
            "  width: 100%;",
            "  min-height: 0;",
            "  overflow: hidden;",
            "  pointer-events: auto;",
            "  box-sizing: border-box;",
            "  display: flex;",
            "  flex-direction: column;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-focus-layer[hidden] {",
            "  display: none;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-focus-layer[data-flow=\"end\"] {",
            "  justify-content: flex-end;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-focus-layer[data-flow=\"start\"] {",
            "  justify-content: flex-start;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-focus-layer[data-scrollable=\"true\"] {",
            "  overflow-x: hidden;",
            "  overflow-y: auto;",
            "  overscroll-behavior-y: contain;",
            "  scrollbar-width: thin;",
            "  touch-action: pan-y;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-popover[data-focused=\"true\"] .hamburger-menu-indicator {",
            "  height: 0;",
            "  margin-top: 0;",
            "  margin-bottom: 0;",
            "  opacity: 0;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-popover[data-focused=\"true\"] .hamburger-menu-viewport {",
            "  overflow: hidden;",
            "  scroll-snap-type: none;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-focus-group {",
            "  position: relative;",
            "  z-index: 9;",
            "  width: 100%;",
            "  margin: 0;",
            "  background: var(--hamburger-menu-focus-background, transparent);",
            "  will-change: translate;",
            "  box-sizing: border-box;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-focus-group.hamburger-menu-focus-entering {",
            "  position: absolute;",
            "  inset-inline: 0;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-focus-layer[data-flow=\"start\"] .hamburger-menu-focus-group.hamburger-menu-focus-entering {",
            "  top: 0;",
            "  bottom: auto;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-focus-layer[data-flow=\"end\"] .hamburger-menu-focus-group.hamburger-menu-focus-entering {",
            "  top: auto;",
            "  bottom: 0;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-transition-clip {",
            "  min-height: 0 !important;",
            "  overflow: hidden !important;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-transition-hidden {",
            "  pointer-events: none !important;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-zooming {",
            "  will-change: translate;",
            "}",
            ":where(hamburger-menu) .hamburger-menu-promotion-mask {",
            "  position: absolute;",
            "  inset-inline: 0;",
            "  z-index: 7;",
            "  pointer-events: none;",
            "  background: var(--hamburger-menu-mask-background, var(--hamburger-menu-focus-background, Canvas));",
            "  will-change: clip-path;",
            "}",
            "@position-try --hamburger-above-start {",
            "  position-area: top span-right;",
            "  inset: auto;",
            "  align-self: end;",
            "  justify-self: start;",
            "}",
            "@position-try --hamburger-below-end {",
            "  position-area: bottom span-left;",
            "  inset: auto;",
            "  align-self: start;",
            "  justify-self: end;",
            "}",
            "@position-try --hamburger-above-end {",
            "  position-area: top span-left;",
            "  inset: auto;",
            "  align-self: end;",
            "  justify-self: end;",
            "}",
            "@position-try --hamburger-right-start {",
            "  position-area: right span-bottom;",
            "  inset: auto;",
            "  align-self: start;",
            "  justify-self: start;",
            "}",
            "@position-try --hamburger-left-start {",
            "  position-area: left span-bottom;",
            "  inset: auto;",
            "  align-self: start;",
            "  justify-self: end;",
            "}",
            "@media (prefers-reduced-motion: reduce) {",
            "  :where(hamburger-menu) .hamburger-menu-viewport,",
            "  :where(hamburger-menu) .hamburger-menu-indicator,",
            "  :where(hamburger-menu) .hamburger-menu-indicator-thumb {",
            "    transition: none !important;",
            "  }",
            "}"
        ].join(
            "\n"
        );

        document.head
            .append(
                style
            );
    }

    class HamburgerMenu extends HTMLElement {
        static #counter = 0;

        static get observedAttributes() {
            return [
                "safe-boundary",
                "item-rate"
            ];
        }

        #anchorName;
        #trigger;
        #popover;
        #viewport;
        #source;
        #indicator;
        #indicatorThumb;
        #focusLayer;
        #observer;
        #resizeObserver;
        #layoutFrame;
        #panelIndex = 0;
        #focusStack = [];
        #animations = new Set();
        #generation = 0;
        #transitionBusy = false;
        #boundaryOverride;
        #boundaryElement;
        #connected = false;
        #handlingMutations = false;
        #openState = false;
        #frozenPane;
        #frozenPaneRect;
        #frozenPaneBaseSize;
        #frozenPaneLocks = [];
        #openingMeasured = false;
        #openingMeasurementPromise;
        #layoutDirty = true;
        #sizeTargets = new Set();
        #boundaryTrackFrame;
        #boundarySnapshot;

        constructor() {
            super();

            HamburgerMenu
                .#counter += 1;

            this.#anchorName =
                "--hamburger-menu-anchor-" +
                HamburgerMenu
                    .#counter;
        }

        connectedCallback() {
            if (this.#connected) {
                return;
            }

            this.#connected =
                true;

            this.#build();
            this.#bind();
            this.refresh();
        }

        disconnectedCallback() {
            this.#connected =
                false;

            this.#observer
                ?.disconnect();

            this.#resizeObserver
                ?.disconnect();

            this.#sizeTargets
                .clear();

            this.#stopBoundaryTracking();

            if (
                this.#layoutFrame !==
                undefined
            ) {
                cancelAnimationFrame(
                    this.#layoutFrame
                );

                this.#layoutFrame =
                    undefined;
            }

            this.#cancelAnimations();
        }

        attributeChangedCallback(
            name,
            oldValue,
            newValue
        ) {
            if (
                oldValue ===
                newValue
            ) {
                return;
            }

            if (
                name ===
                    "safe-boundary"
            ) {
                this.#boundaryOverride =
                    undefined;
            }

            this.refresh();
        }

        get trigger() {
            return this.#trigger;
        }

        get popoverElement() {
            return this.#popover;
        }

        get isOpen() {
            if (this.#openState) {
                return true;
            }

            try {
                return Boolean(
                    this.#popover
                        ?.matches?.(
                            ":popover-open"
                        )
                );
            }
            catch {
                return Boolean(
                    this.#popover
                        ?.dataset
                        .open ===
                        "true"
                );
            }
        }

        get page() {
            return this.#panelIndex;
        }

        get pageCount() {
            return this
                .#panels()
                .length;
        }

        get promotionDepth() {
            return this
                .#focusStack
                .length;
        }

        get safeBoundary() {
            return this
                .#resolveBoundary();
        }

        set safeBoundary(
            value
        ) {
            if (
                value instanceof
                    Element
            ) {
                this.#boundaryOverride =
                    value;
            }
            else if (
                typeof value ===
                    "string"
            ) {
                this.#boundaryOverride =
                    undefined;

                this.setAttribute(
                    "safe-boundary",
                    value
                );

                return;
            }
            else {
                this.#boundaryOverride =
                    undefined;

                this.removeAttribute(
                    "safe-boundary"
                );
            }

            this.refresh();
        }

        showPopover() {
            if (!this.#popover) {
                return;
            }

            if (this.isOpen) {
                return;
            }

            if (
                typeof this
                    .#popover
                    .showPopover ===
                    "function"
            ) {
                this.#openingMeasured =
                    false;

                this.#beginOpeningMeasurement();

                this.#popover
                    .showPopover();

                this.#openState =
                    true;

                this.#startBoundaryTracking();

                this.#trigger
                    .setAttribute(
                        "aria-expanded",
                        "true"
                    );

                this.style
                    .setProperty(
                        "--hamburger-menu-panel-height",
                        "auto"
                    );

                this.#viewport
                    .style
                    .removeProperty(
                        "height"
                    );

                this.#indicator.hidden =
                    true;

                void this
                    .#finishOpeningMeasurement();

                return;
            }

            this.#openingMeasured =
                false;

            this.#beginOpeningMeasurement();

            this.#popover
                .dataset
                .open =
                "true";

            this.#popover.hidden =
                false;

            this.#handleToggle({
                oldState:
                    "closed",
                newState:
                    "open"
            });
        }

        hidePopover() {
            if (!this.#popover) {
                return;
            }

            if (!this.isOpen) {
                return;
            }

            if (
                typeof this
                    .#popover
                    .hidePopover ===
                    "function"
            ) {
                this.#popover
                    .hidePopover();

                this.#openState =
                    false;

                this.#stopBoundaryTracking();

                this.#openingMeasured =
                    false;

                this.#openingMeasurementPromise =
                    undefined;

                this.#trigger
                    .setAttribute(
                        "aria-expanded",
                        "false"
                    );

                delete this.#popover
                    .dataset
                    .calculating;

                delete this.#popover
                    .dataset
                    .ready;

                this.#unfreezePane();

                this.#reset();

                return;
            }

            delete this.#popover
                .dataset
                .open;

            this.#popover.hidden =
                true;

            this.#handleToggle({
                oldState:
                    "open",
                newState:
                    "closed"
            });
        }

        togglePopover() {
            if (this.isOpen) {
                this.hidePopover();
            }
            else {
                this.showPopover();
            }
        }

        back() {
            if (
                this.#focusStack
                    .length
            ) {
                return this
                    .#restoreFocusLevel();
            }

            this.hidePopover();

            return Promise.resolve(
                true
            );
        }

        refresh() {
            if (
                !this.#connected
            ) {
                return;
            }

            this.#adoptHostChildren();
            this.#syncResizeObservation();

            this.#layoutDirty =
                true;

            if (!this.isOpen) {
                return;
            }

            if (
                this.#layoutFrame !==
                undefined
            ) {
                return;
            }

            this.#layoutFrame =
                requestAnimationFrame(
                    () => {
                        this.#layoutFrame =
                            undefined;

                        if (
                            !this.isOpen ||
                            this.#transitionBusy
                        ) {
                            return;
                        }

                        this.#layoutDirty =
                            false;

                        if (
                            this.#focusStack
                                .length
                        ) {
                            const active =
                                this.#focusStack
                                    .at(-1);

                            if (
                                active
                                    ?.group
                                    ?.hidden
                            ) {
                                this.#reset();
                                this.#layoutPanels();
                                return;
                            }

                            this.#updateSafeGeometry();
                            this.#updateFocusBounds();
                            this.#reconcilePlacement();
                            return;
                        }

                        this.#updateSafeGeometry();
                        this.#layoutPanels();
                        this.#reconcilePlacement();
                    }
                );
        }

        #markLayoutDirty() {
            this.#layoutDirty =
                true;

            if (
                this.isOpen &&
                this.#frozenPaneLocks
                    .length
            ) {
                this.#refreshFrozenPaneGeometry();
            }

            if (
                this.isOpen &&
                !this.#transitionBusy
            ) {
                this.refresh();
            }
        }

        #flushLayoutIfDirty() {
            if (
                this.#layoutDirty &&
                this.isOpen &&
                !this.#transitionBusy
            ) {
                this.refresh();
            }
        }

        #adoptHostChildren() {
            const children =
                [
                    ...this.children
                ]
                    .filter(
                        child =>
                            child !==
                                this.#trigger &&
                            child !==
                                this.#popover
                    );

            if (!children.length) {
                return false;
            }

            this.#withObservationPaused(
                () => {
                    this.#source
                        .append(
                            ...children
                        );
                }
            );

            this.#syncResizeObservation();

            return true;
        }

        #syncResizeObservation() {
            if (
                !this.#resizeObserver
            ) {
                return;
            }

            const targets =
                new Set([
                    this,
                    this.#trigger
                ]);

            const boundary =
                this.#resolveBoundary();

            if (boundary) {
                targets.add(
                    boundary
                );
            }

            const collect =
                root => {
                    if (!root) {
                        return;
                    }

                    for (
                        const element of
                        root.querySelectorAll(
                            "*"
                        )
                    ) {
                        if (
                            element.classList
                                .contains(
                                    "hamburger-menu-panel"
                                ) ||
                            element.classList
                                .contains(
                                    "hamburger-menu-focus-placeholder"
                                ) ||
                            element.classList
                                .contains(
                                    "hamburger-menu-promotion-mask"
                                )
                        ) {
                            continue;
                        }

                        targets.add(
                            element
                        );
                    }
                };

            collect(
                this.#source
            );

            collect(
                this.#focusLayer
            );

            for (
                const target of
                this.#sizeTargets
            ) {
                if (
                    targets.has(
                        target
                    )
                ) {
                    continue;
                }

                try {
                    this.#resizeObserver
                        .unobserve(
                            target
                        );
                }
                catch {}
            }

            for (
                const target of
                targets
            ) {
                if (
                    this.#sizeTargets
                        .has(
                            target
                        )
                ) {
                    continue;
                }

                try {
                    this.#resizeObserver
                        .observe(
                            target
                        );
                }
                catch {}
            }

            this.#sizeTargets =
                targets;
        }

        getSafeRegion() {
            return {
                ...this
                    .#safeRegion()
            };
        }

        #build() {
            this.#trigger =
                this.querySelector(
                    ":scope > [slot=\"trigger\"]"
                ) ||
                this.querySelector(
                    ":scope > button"
                );

            if (!this.#trigger) {
                throw new Error(
                    "<hamburger-menu> requires a trigger element."
                );
            }

            this.#trigger
                .setAttribute(
                    "slot",
                    "trigger"
                );

            if (
                this.#trigger
                    .tagName ===
                    "BUTTON" &&
                !this.#trigger
                    .hasAttribute(
                        "type"
                    )
            ) {
                this.#trigger
                    .setAttribute(
                        "type",
                        "button"
                    );
            }

            this.#trigger
                .style
                .setProperty(
                    "anchor-name",
                    this.#anchorName
                );

            this.#popover =
                this.querySelector(
                    ":scope > .hamburger-menu-popover"
                );

            if (!this.#popover) {
                this.#popover =
                    document
                        .createElement(
                            "nav"
                        );

                this.#popover
                    .className =
                    "hamburger-menu-popover";

                this.#popover
                    .setAttribute(
                        "popover",
                        "auto"
                    );

                this.#popover
                    .setAttribute(
                        "role",
                        "menu"
                    );

                this.#popover
                    .setAttribute(
                        "aria-label",
                        this.getAttribute(
                            "aria-label"
                        ) ||
                        "Menu"
                    );

                this.#popover
                    .style
                    .setProperty(
                        "position-anchor",
                        this.#anchorName
                    );

                const content =
                    [
                        ...this.children
                    ]
                        .filter(
                            child =>
                                child !==
                                    this.#trigger &&
                                child !==
                                    this.#popover
                        );

                this.#viewport =
                    document
                        .createElement(
                            "div"
                        );

                this.#viewport
                    .className =
                    "hamburger-menu-viewport";

                this.#source =
                    document
                        .createElement(
                            "div"
                        );

                this.#source
                    .className =
                    "hamburger-menu-source";

                this.#source
                    .append(
                        ...content
                    );

                this.#focusLayer =
                    document
                        .createElement(
                            "div"
                        );

                this.#focusLayer
                    .className =
                    "hamburger-menu-focus-layer";

                this.#focusLayer.hidden =
                    true;

                this.#viewport
                    .append(
                        this.#source,
                        this.#focusLayer
                    );

                this.#indicator =
                    document
                        .createElement(
                            "div"
                        );

                this.#indicator
                    .className =
                    "hamburger-menu-indicator";

                this.#indicator
                    .setAttribute(
                        "aria-hidden",
                        "true"
                    );

                this.#indicatorThumb =
                    document
                        .createElement(
                            "span"
                        );

                this.#indicatorThumb
                    .className =
                    "hamburger-menu-indicator-thumb";

                this.#indicator
                    .append(
                        this.#indicatorThumb
                    );

                this.#popover
                    .append(
                        this.#viewport,
                        this.#indicator
                    );

                this.append(
                    this.#popover
                );
            }
            else {
                this.#viewport =
                    this.#popover
                        .querySelector(
                            ":scope > .hamburger-menu-viewport"
                        );

                this.#source =
                    this.#viewport
                        ?.querySelector(
                            ":scope > .hamburger-menu-source"
                        );

                this.#focusLayer =
                    this.#viewport
                        ?.querySelector(
                            ":scope > .hamburger-menu-focus-layer"
                        );

                this.#indicator =
                    this.#popover
                        .querySelector(
                            ":scope > .hamburger-menu-indicator"
                        );

                this.#indicatorThumb =
                    this.#indicator
                        ?.querySelector(
                            ":scope > .hamburger-menu-indicator-thumb"
                        );
            }

            this.#trigger
                .setAttribute(
                    "aria-haspopup",
                    "menu"
                );

            this.#trigger
                .setAttribute(
                    "aria-expanded",
                    "false"
                );
        }

        #bind() {
            this.#trigger
                .addEventListener(
                    "click",
                    event => {
                        event.preventDefault();
                        event.stopPropagation();

                        this.togglePopover();
                    }
                );

            this.#popover
                .addEventListener(
                    "toggle",
                    event =>
                        this.#handleToggle(
                            event
                        )
                );

            this.#viewport
                .addEventListener(
                    "scroll",
                    () =>
                        this.#updateIndicator(),
                    {
                        passive:
                            true
                    }
                );

            this.addEventListener(
                "click",
                event =>
                    this.#handleParentClick(
                        event
                    )
            );

            this.addEventListener(
                "keydown",
                event => {
                    if (
                        event.key ===
                            "Escape" &&
                        this.#focusStack
                            .length
                    ) {
                        event.preventDefault();
                        event.stopPropagation();

                        void this
                            .#restoreFocusLevel();
                    }
                }
            );

            globalThis
                .visualViewport
                ?.addEventListener(
                    "resize",
                    () =>
                        this.#markLayoutDirty()
                );

            globalThis
                .visualViewport
                ?.addEventListener(
                    "scroll",
                    () =>
                        this.refresh()
                );

            globalThis
                .addEventListener(
                    "resize",
                    () =>
                        this.#markLayoutDirty()
                );

            globalThis
                .addEventListener(
                    "scroll",
                    () =>
                        this.refresh(),
                    {
                        passive:
                            true
                    }
                );

            if (
                typeof ResizeObserver ===
                    "function"
            ) {
                this.#resizeObserver =
                    new ResizeObserver(
                        () =>
                            this.#markLayoutDirty()
                    );

                this.#syncResizeObservation();
            }

            if (
                typeof MutationObserver ===
                    "function"
            ) {
                this.#observer =
                    new MutationObserver(
                        mutations => {
                            if (
                                this
                                    .#handlingMutations
                            ) {
                                return;
                            }

                            const relevant =
                                mutations
                                    .some(
                                        mutation =>
                                            mutation
                                                .type ===
                                                "childList" ||
                                            mutation
                                                .type ===
                                                "characterData" ||
                                            mutation
                                                .attributeName ===
                                                "hidden"
                                    );

                            if (!relevant) {
                                return;
                            }

                            this.#adoptHostChildren();
                            this.#syncResizeObservation();
                            this.#markLayoutDirty();
                        }
                    );

                this.#observe();
            }
        }

        #observe() {
            if (
                !this.#observer
            ) {
                return;
            }

            this.#observer
                .observe(
                    this.#viewport,
                    {
                        subtree:
                            true,
                        childList:
                            true,
                        characterData:
                            true,
                        attributes:
                            true,
                        attributeFilter: [
                            "hidden"
                        ]
                    }
                );

            if (document.body) {
                this.#observer
                    .observe(
                        document.body,
                        {
                            subtree:
                                true,
                            childList:
                                true
                        }
                    );
            }
        }

        #withObservationPaused(
            callback
        ) {
            this.#observer
                ?.disconnect();

            this.#handlingMutations =
                true;

            try {
                return callback();
            }
            finally {
                this.#handlingMutations =
                    false;

                this.#observe();
            }
        }

        #activePane() {
            if (
                this.#focusStack
                    .length
            ) {
                return this.#viewport;
            }

            return (
                this.#currentPanel() ||
                this.#viewport
            );
        }

        #paneWidthFromPopover() {
            const rect =
                this.#popover
                    .getBoundingClientRect();

            const style =
                getComputedStyle(
                    this.#popover
                );

            const horizontalChrome =
                px(
                    style.paddingLeft
                ) +
                px(
                    style.paddingRight
                ) +
                px(
                    style.borderLeftWidth
                ) +
                px(
                    style.borderRightWidth
                );

            return Math.max(
                1,
                rect.width -
                    horizontalChrome
            );
        }

        #applyFrozenPaneGeometry(
            width,
            height
        ) {
            if (
                !this.#frozenPaneLocks
                    .length
            ) {
                return false;
            }

            const nextWidth =
                Math.max(
                    1,
                    width
                );

            const nextHeight =
                Math.max(
                    1,
                    height
                );

            if (
                this.#frozenPaneRect &&
                Math.abs(
                    this.#frozenPaneRect
                        .width -
                    nextWidth
                ) <=
                    0.5 &&
                Math.abs(
                    this.#frozenPaneRect
                        .height -
                    nextHeight
                ) <=
                    0.5
            ) {
                return false;
            }

            for (
                const lock of
                this.#frozenPaneLocks
            ) {
                const {
                    target
                } = lock;

                target.style.width =
                    nextWidth +
                    "px";

                target.style.height =
                    nextHeight +
                    "px";

                target.style.minWidth =
                    nextWidth +
                    "px";

                target.style.minHeight =
                    nextHeight +
                    "px";

                target.style.maxWidth =
                    nextWidth +
                    "px";

                target.style.maxHeight =
                    nextHeight +
                    "px";

                target.style.overflow =
                    "hidden";
            }

            this.style
                .setProperty(
                    "--hamburger-menu-panel-height",
                    nextHeight +
                        "px"
                );

            this.#frozenPaneRect = {
                width:
                    nextWidth,
                height:
                    nextHeight
            };

            return true;
        }

        #refreshFrozenPaneGeometry() {
            if (
                !this.#frozenPaneLocks
                    .length ||
                !this.#frozenPaneBaseSize
            ) {
                return false;
            }

            const region =
                this.#updateSafeGeometry();

            const safeHeight =
                Math.max(
                    1,
                    region.bottom -
                        region.top -
                        this.#menuChrome(
                            false
                        )
                );

            const currentPaneWidth =
                this
                    .#paneWidthFromPopover();

            const width =
                Math.min(
                    this.#frozenPaneBaseSize
                        .width,
                    currentPaneWidth
                );

            const height =
                Math.min(
                    this.#frozenPaneBaseSize
                        .height,
                    safeHeight
                );

            const changed =
                this
                    .#applyFrozenPaneGeometry(
                        width,
                        height
                    );

            if (changed) {
                this.#reconcilePlacement();
            }

            return changed;
        }

        #freezePane(
            pane =
                this.#activePane()
        ) {
            if (!pane) {
                return undefined;
            }

            this.#unfreezePane();

            const paneRect =
                pane
                    .getBoundingClientRect();

            const paneWidth =
                Math.max(
                    1,
                    paneRect.width
                );

            const paneHeight =
                Math.max(
                    1,
                    paneRect.height
                );

            const targets =
                new Set([
                    this.#viewport,
                    pane
                ]);

            this.#frozenPaneLocks =
                [];

            for (
                const target of
                targets
            ) {
                const lock = {
                    target,
                    classPresent:
                        target.classList
                            .contains(
                                "hamburger-menu-pane-frozen"
                            ),
                    width:
                        target.style.width,
                    height:
                        target.style.height,
                    maxWidth:
                        target.style.maxWidth,
                    maxHeight:
                        target.style.maxHeight,
                    minWidth:
                        target.style.minWidth,
                    minHeight:
                        target.style.minHeight,
                    overflow:
                        target.style.overflow
                };

                this.#frozenPaneLocks
                    .push(
                        lock
                    );

                target.classList
                    .add(
                        "hamburger-menu-pane-frozen"
                    );
            }

            this.#frozenPane =
                pane;

            this.#frozenPaneBaseSize = {
                width:
                    paneWidth,
                height:
                    paneHeight
            };

            this.#frozenPaneRect =
                undefined;

            this
                .#applyFrozenPaneGeometry(
                    paneWidth,
                    paneHeight
                );

            /*
             * Immediately clamp the lock against the current live safe
             * region. Later ResizeObserver / boundary-tracker changes call
             * the same method while the promotion remains frozen.
             */
            this.#refreshFrozenPaneGeometry();

            return {
                pane,
                width:
                    this.#frozenPaneRect
                        ?.width ||
                    paneWidth,
                height:
                    this.#frozenPaneRect
                        ?.height ||
                    paneHeight
            };
        }

        #unfreezePane() {
            if (
                !this.#frozenPaneLocks
                    .length
            ) {
                this.#frozenPane =
                    undefined;

                this.#frozenPaneRect =
                    undefined;

                this.#frozenPaneBaseSize =
                    undefined;

                return;
            }

            for (
                const lock of
                this.#frozenPaneLocks
            ) {
                const {
                    target
                } = lock;

                if (
                    !lock.classPresent
                ) {
                    target.classList
                        .remove(
                            "hamburger-menu-pane-frozen"
                        );
                }

                const styles = {
                    width:
                        lock.width,
                    height:
                        lock.height,
                    maxWidth:
                        lock.maxWidth,
                    maxHeight:
                        lock.maxHeight,
                    minWidth:
                        lock.minWidth,
                    minHeight:
                        lock.minHeight,
                    overflow:
                        lock.overflow
                };

                for (
                    const [
                        property,
                        value
                    ] of
                    Object.entries(
                        styles
                    )
                ) {
                    const cssProperty =
                        property
                            .replace(
                                /[A-Z]/g,
                                match =>
                                    "-" +
                                    match
                                        .toLowerCase()
                            );

                    if (value) {
                        target.style
                            .setProperty(
                                cssProperty,
                                value
                            );
                    }
                    else {
                        target.style
                            .removeProperty(
                                cssProperty
                            );
                    }
                }
            }

            this.#frozenPaneLocks =
                [];

            this.#frozenPane =
                undefined;

            this.#frozenPaneRect =
                undefined;

            this.#frozenPaneBaseSize =
                undefined;
        }

        #beginOpeningMeasurement() {
            if (
                this.#openingMeasured
            ) {
                return false;
            }

            this.#popover
                .dataset
                .calculating =
                "true";

            delete this.#popover
                .dataset
                .ready;

            return true;
        }

        #finishOpeningMeasurement() {
            if (
                this.#openingMeasured
            ) {
                return Promise.resolve();
            }

            if (
                this.#openingMeasurementPromise
            ) {
                return this
                    .#openingMeasurementPromise;
            }

            this.#openingMeasurementPromise =
                (async () => {
                    await nextFrame();

                    this.#updateSafeGeometry();
                    this.#layoutPanels();
                    this.#reconcilePlacement();

                    await nextFrame();

                    this.#reconcilePlacement();

                    this.#openingMeasured =
                        true;

                    delete this.#popover
                        .dataset
                        .calculating;

                    this.#popover
                        .dataset
                        .ready =
                        "true";
                })()
                    .finally(
                        () => {
                            this.#openingMeasurementPromise =
                                undefined;
                        }
                    );

            return this
                .#openingMeasurementPromise;
        }

        #dispatch(
            type,
            detail,
            cancelable = false
        ) {
            const event =
                new CustomEvent(
                    type,
                    {
                        bubbles:
                            true,
                        composed:
                            true,
                        cancelable,
                        detail
                    }
                );

            this.dispatchEvent(
                event
            );

            return event;
        }

        #handleToggle(
            event
        ) {
            const open =
                event.newState ===
                    "open";

            this.#openState =
                open;

            this.#trigger
                .setAttribute(
                    "aria-expanded",
                    String(open)
                );

            if (open) {
                this.#startBoundaryTracking();

                this.#popover.hidden =
                    false;

                if (
                    !this.#openingMeasured ||
                    this.#openingMeasurementPromise
                ) {
                    this.#beginOpeningMeasurement();

                    this.style
                        .setProperty(
                            "--hamburger-menu-panel-height",
                            "auto"
                        );

                    this.#viewport
                        .style
                        .removeProperty(
                            "height"
                        );

                    this.#indicator.hidden =
                        true;

                    void this
                        .#finishOpeningMeasurement();
                }
            }
            else {
                this.#stopBoundaryTracking();

                this.#openingMeasured =
                    false;

                this.#openingMeasurementPromise =
                    undefined;

                delete this.#popover
                    .dataset
                    .calculating;

                delete this.#popover
                    .dataset
                    .ready;

                this.#unfreezePane();
                this.#reset();
            }

            if (
                typeof ToggleEvent ===
                    "function" &&
                event.target ===
                    this.#popover
            ) {
                this.dispatchEvent(
                    new ToggleEvent(
                        "toggle",
                        {
                            oldState:
                                event.oldState,
                            newState:
                                event.newState
                        }
                    )
                );
            }

            this.#dispatch(
                open
                    ? "opened"
                    : "closed",
                {
                    menu:
                        this
                }
            );
        }

        #isUsableBoundaryElement(
            element,
            style =
                element
                    ? getComputedStyle(
                        element
                    )
                    : undefined
        ) {
            if (
                !element ||
                !element.isConnected ||
                !style
            ) {
                return false;
            }

            const display =
                String(
                    style.display ||
                    ""
                )
                    .trim()
                    .toLowerCase();

            if (
                !display ||
                display ===
                    "none" ||
                display ===
                    "contents" ||
                display.startsWith(
                    "inline"
                ) ||
                display.startsWith(
                    "table-"
                )
            ) {
                return false;
            }

            const blockDisplays =
                new Set([
                    "block",
                    "flow-root",
                    "flex",
                    "grid",
                    "table",
                    "list-item"
                ]);

            if (
                blockDisplays.has(
                    display
                )
            ) {
                return true;
            }

            const tokens =
                display
                    .split(
                        /\s+/
                    );

            return (
                tokens.includes(
                    "block"
                ) ||
                (
                    tokens.includes(
                        "list-item"
                    ) &&
                    !tokens.includes(
                        "inline"
                    )
                )
            );
        }

        #discoverBoundary() {
            const triggerRect =
                this.#trigger
                    ?.getBoundingClientRect();

            if (!triggerRect) {
                return undefined;
            }

            const viewport =
                this.#viewportBounds();

            const centerX =
                (
                    triggerRect.left +
                    triggerRect.right
                ) /
                2;

            const candidates = [];

            const consider =
                (
                    element,
                    priority
                ) => {
                    if (
                        !element ||
                        element ===
                            this ||
                        this.contains(
                            element
                        ) ||
                        element.contains(
                            this
                        )
                    ) {
                        return;
                    }

                    const style =
                        getComputedStyle(
                            element
                        );

                    if (
                        style.visibility ===
                            "hidden" ||
                        !this
                            .#isUsableBoundaryElement(
                                element,
                                style
                            )
                    ) {
                        return;
                    }

                    const rect =
                        element
                            .getBoundingClientRect();

                    if (
                        rect.width <=
                            0 ||
                        rect.height <=
                            0
                    ) {
                        return;
                    }

                    const above =
                        rect.bottom <=
                        triggerRect.top;

                    const below =
                        rect.top >=
                        triggerRect.bottom;

                    if (
                        !above &&
                        !below
                    ) {
                        return;
                    }

                    const viewportWidth =
                        globalThis
                            .visualViewport
                            ?.width ||
                        globalThis
                            .innerWidth ||
                        document
                            .documentElement
                            .clientWidth ||
                        0;

                    const broad =
                        rect.width >=
                        viewportWidth *
                        0.35;

                    const intersectsX =
                        centerX >=
                            rect.left &&
                        centerX <=
                            rect.right;

                    if (
                        priority >
                            0 &&
                        !intersectsX &&
                        !broad
                    ) {
                        return;
                    }

                    const distance =
                        above
                            ? triggerRect.top -
                                rect.bottom
                            : rect.top -
                                triggerRect.bottom;

                    candidates.push({
                        element,
                        priority,
                        distance
                    });
                };

            for (
                const element of
                document.querySelectorAll(
                    "[data-hamburger-safe-boundary]"
                )
            ) {
                consider(
                    element,
                    0
                );
            }

            for (
                const element of
                document.querySelectorAll(
                    "footer,[role=\"toolbar\"],[role=\"status\"]"
                )
            ) {
                consider(
                    element,
                    1
                );
            }

            for (
                const element of
                document.body
                    ?.querySelectorAll(
                        "*"
                    ) ||
                []
            ) {
                const style =
                    getComputedStyle(
                        element
                    );

                if (
                    style.position !==
                        "fixed" &&
                    style.position !==
                        "sticky"
                ) {
                    continue;
                }

                consider(
                    element,
                    2
                );
            }

            candidates.sort(
                (
                    left,
                    right
                ) =>
                    left.priority -
                        right.priority ||
                    left.distance -
                        right.distance
            );

            return candidates[
                0
            ]
                ?.element;
        }

        #resolveBoundary() {
            if (
                this.#boundaryOverride &&
                this
                    .#isUsableBoundaryElement(
                        this.#boundaryOverride
                    )
            ) {
                return this
                    .#boundaryOverride;
            }

            const selector =
                String(
                    this.getAttribute(
                        "safe-boundary"
                    ) ||
                    ""
                )
                    .trim();

            if (selector) {
                try {
                    const explicit =
                        document
                            .querySelector(
                                selector
                            );

                    if (
                        explicit &&
                        this
                            .#isUsableBoundaryElement(
                                explicit
                            )
                    ) {
                        return explicit;
                    }
                }
                catch {}
            }

            return this
                .#discoverBoundary();
        }

        #visibleBoundary() {
            const boundary =
                this.#resolveBoundary();

            if (!boundary) {
                return undefined;
            }

            const style =
                getComputedStyle(
                    boundary
                );

            if (
                style.visibility ===
                    "hidden" ||
                !this
                    .#isUsableBoundaryElement(
                        boundary,
                        style
                    )
            ) {
                return undefined;
            }

            const rect =
                boundary
                    .getBoundingClientRect();

            if (
                rect.width <= 0 ||
                rect.height <= 0
            ) {
                return undefined;
            }

            return {
                element:
                    boundary,
                rect,
                style
            };
        }

        #boundaryGeometrySnapshot() {
            const viewport =
                this.#viewportBounds();

            const boundary =
                this.#resolveBoundary();

            const rect =
                boundary
                    ?.getBoundingClientRect?.();

            return {
                boundary,
                top:
                    rect?.top,
                right:
                    rect?.right,
                bottom:
                    rect?.bottom,
                left:
                    rect?.left,
                documentBottom:
                    this
                        .#documentUsableBottom(
                            viewport.bottom
                        )
            };
        }

        #boundaryGeometryChanged(
            previous,
            next
        ) {
            if (!previous) {
                return false;
            }

            if (
                previous.boundary !==
                next.boundary
            ) {
                return true;
            }

            for (
                const key of [
                    "top",
                    "right",
                    "bottom",
                    "left",
                    "documentBottom"
                ]
            ) {
                const before =
                    previous[
                        key
                    ];

                const after =
                    next[
                        key
                    ];

                if (
                    before ===
                        undefined &&
                    after ===
                        undefined
                ) {
                    continue;
                }

                if (
                    !Number.isFinite(
                        before
                    ) ||
                    !Number.isFinite(
                        after
                    ) ||
                    Math.abs(
                        before -
                        after
                    ) >
                        0.5
                ) {
                    return true;
                }
            }

            return false;
        }

        #startBoundaryTracking() {
            if (
                this.#boundaryTrackFrame !==
                    undefined
            ) {
                return;
            }

            this.#boundarySnapshot =
                this
                    .#boundaryGeometrySnapshot();

            const track =
                () => {
                    this.#boundaryTrackFrame =
                        undefined;

                    if (
                        !this.#connected ||
                        !this.isOpen
                    ) {
                        return;
                    }

                    const next =
                        this
                            .#boundaryGeometrySnapshot();

                    if (
                        this
                            .#boundaryGeometryChanged(
                                this
                                    .#boundarySnapshot,
                                next
                            )
                    ) {
                        this.#boundarySnapshot =
                            next;

                        this
                            .#markLayoutDirty();
                    }
                    else {
                        this.#boundarySnapshot =
                            next;
                    }

                    this.#boundaryTrackFrame =
                        requestAnimationFrame(
                            track
                        );
                };

            this.#boundaryTrackFrame =
                requestAnimationFrame(
                    track
                );
        }

        #stopBoundaryTracking() {
            if (
                this.#boundaryTrackFrame !==
                    undefined
            ) {
                cancelAnimationFrame(
                    this.#boundaryTrackFrame
                );

                this.#boundaryTrackFrame =
                    undefined;
            }

            this.#boundarySnapshot =
                undefined;
        }

        #viewportBounds() {
            const viewport =
                globalThis
                    .visualViewport;

            const top =
                viewport
                    ?.offsetTop ||
                0;

            const bottom =
                top +
                (
                    viewport
                        ?.height ||
                    globalThis
                        .innerHeight ||
                    document
                        .documentElement
                        .clientHeight ||
                    0
                );

            return {
                top,
                bottom
            };
        }

        #documentUsableBottom(
            viewportBottom
        ) {
            const root =
                document
                    .documentElement;

            const body =
                document.body;

            const rootStyle =
                getComputedStyle(
                    root
                );

            const bodyStyle =
                body
                    ? getComputedStyle(
                        body
                    )
                    : undefined;

            const spacing =
                px(
                    rootStyle
                        .paddingBottom
                ) +
                px(
                    rootStyle
                        .marginBottom
                ) +
                px(
                    bodyStyle
                        ?.paddingBottom
                ) +
                px(
                    bodyStyle
                        ?.marginBottom
                );

            const documentBottom =
                root
                    .getBoundingClientRect()
                    .bottom -
                spacing;

            if (
                Number.isFinite(
                    documentBottom
                ) &&
                documentBottom > 0
            ) {
                return Math.min(
                    viewportBottom,
                    documentBottom
                );
            }

            return (
                viewportBottom -
                spacing
            );
        }

        #safeRegion() {
            const viewport =
                this.#viewportBounds();

            const documentBottom =
                this
                    .#documentUsableBottom(
                        viewport.bottom
                    );

            const triggerRect =
                this.#trigger
                    .getBoundingClientRect();

            const hostStyle =
                getComputedStyle(
                    this
                );

            const boundary =
                this.#visibleBoundary();

            if (!boundary) {
                return {
                    top:
                        viewport.top,
                    bottom:
                        documentBottom,
                    direction:
                        "document",
                    boundary:
                        undefined
                };
            }

            const boundaryCenter =
                (
                    boundary
                        .rect
                        .top +
                    boundary
                        .rect
                        .bottom
                ) /
                2;

            const triggerCenter =
                (
                    triggerRect.top +
                    triggerRect.bottom
                ) /
                2;

            if (
                boundaryCenter >=
                triggerCenter
            ) {
                return {
                    top:
                        viewport.top,
                    bottom:
                        Math.min(
                            documentBottom,
                            boundary
                                .rect
                                .top -
                                px(
                                    boundary
                                        .style
                                        .marginTop
                                ) -
                                px(
                                    hostStyle
                                        .marginBottom
                                )
                        ),
                    direction:
                        "below",
                    boundary:
                        boundary
                            .element
                };
            }

            return {
                top:
                    Math.max(
                        viewport.top,
                        boundary
                            .rect
                            .bottom +
                            px(
                                boundary
                                    .style
                                    .marginBottom
                            ) +
                            px(
                                hostStyle
                                    .marginTop
                            )
                    ),
                bottom:
                    documentBottom,
                direction:
                    "above",
                boundary:
                    boundary
                        .element
            };
        }

        #updateSafeGeometry() {
            const region =
                this.#safeRegion();

            const height =
                Math.max(
                    1,
                    region.bottom -
                    region.top
                );

            this.#popover
                .style
                .setProperty(
                    "--hamburger-menu-safe-height",
                    height +
                        "px"
                );

            this.#popover
                .dataset
                .boundary =
                region.direction;

            if (
                this.#boundaryElement !==
                region.boundary
            ) {
                if (
                    this.#resizeObserver &&
                    this.#boundaryElement
                ) {
                    try {
                        this.#resizeObserver
                            .unobserve(
                                this.#boundaryElement
                            );
                    }
                    catch {}
                }

                this.#boundaryElement =
                    region.boundary;

                this.#boundarySnapshot =
                    undefined;

                if (
                    this.#resizeObserver &&
                    this.#boundaryElement
                ) {
                    this.#resizeObserver
                        .observe(
                            this.#boundaryElement
                        );
                }
            }

            return region;
        }

        #menuChrome(
            reserveIndicator = false
        ) {
            const style =
                getComputedStyle(
                    this.#popover
                );

            return (
                px(
                    style.paddingTop
                ) +
                px(
                    style.paddingBottom
                ) +
                px(
                    style.borderTopWidth
                ) +
                px(
                    style.borderBottomWidth
                ) +
                (
                    reserveIndicator
                        ? (
                            px(
                                getComputedStyle(
                                    this.#indicator
                                )
                                    .height
                            ) +
                            px(
                                getComputedStyle(
                                    this.#indicator
                                )
                                    .marginTop
                            ) +
                            px(
                                getComputedStyle(
                                    this.#indicator
                                )
                                    .marginBottom
                            )
                        )
                        : 0
                )
            );
        }

        #safePanelHeight(
            reserveIndicator = false
        ) {
            const region =
                this.#safeRegion();

            return Math.max(
                1,
                region.bottom -
                    region.top -
                    this.#menuChrome(
                        reserveIndicator
                    )
            );
        }

        #measure(
            element
        ) {
            if (
                !element ||
                element.hidden ||
                getComputedStyle(
                    element
                ).display ===
                    "none"
            ) {
                return {
                    height:
                        0,
                    marginTop:
                        0,
                    marginBottom:
                        0,
                    outerHeight:
                        0
                };
            }

            const style =
                getComputedStyle(
                    element
                );

            const height =
                element
                    .getBoundingClientRect()
                    .height;

            const marginTop =
                px(
                    style.marginTop
                );

            const marginBottom =
                px(
                    style.marginBottom
                );

            return {
                height,
                marginTop,
                marginBottom,
                outerHeight:
                    height +
                    marginTop +
                    marginBottom
            };
        }

        #normalItems() {
            const items = [];

            for (
                const child of
                this.#source
                    .children
            ) {
                if (
                    child.classList
                        .contains(
                            "hamburger-menu-panel"
                        )
                ) {
                    items.push(
                        ...child.children
                    );

                    continue;
                }

                items.push(
                    child
                );
            }

            return items;
        }

        #panels() {
            return [
                ...this
                    .#source
                    .querySelectorAll(
                        ":scope > .hamburger-menu-panel"
                    )
            ];
        }

        #currentPanel() {
            const panels =
                this.#panels();

            if (!panels.length) {
                return undefined;
            }

            const width =
                this.#viewport
                    .clientWidth ||
                1;

            this.#panelIndex =
                Math.max(
                    0,
                    Math.min(
                        panels.length -
                            1,
                        Math.round(
                            this.#viewport
                                .scrollLeft /
                            width
                        )
                    )
                );

            return panels[
                this.#panelIndex
            ];
        }

        #pack(
            items,
            maximumHeight
        ) {
            const pages = [];
            let page = {
                items: [],
                height:
                    0
            };

            const push =
                () => {
                    if (
                        page.items
                            .length
                    ) {
                        pages.push(
                            page
                        );
                    }

                    page = {
                        items: [],
                        height:
                            0
                    };
                };

            for (
                let index = 0;
                index <
                    items.length;
                index += 1
            ) {
                const first =
                    items[
                        index
                    ];

                const chunk = [
                    first
                ];

                if (
                    first.tagName ===
                        "HR" &&
                    items[
                        index +
                            1
                    ]
                ) {
                    chunk.push(
                        items[
                            index +
                                1
                        ]
                    );

                    index += 1;
                }

                const height =
                    chunk.reduce(
                        (
                            total,
                            element
                        ) =>
                            total +
                            this
                                .#measure(
                                    element
                                )
                                .outerHeight,
                        0
                    );

                if (
                    page.height > 0 &&
                    height > 0 &&
                    page.height +
                        height >
                        maximumHeight
                ) {
                    push();
                }

                page.items.push(
                    ...chunk
                );

                page.height +=
                    height;
            }

            push();

            if (!pages.length) {
                pages.push({
                    items: [],
                    height:
                        1
                });
            }

            return pages;
        }

        #layoutPanels() {
            if (
                !this.isOpen ||
                this.#transitionBusy ||
                this.#focusStack
                    .length
            ) {
                return false;
            }

            const items =
                this.#normalItems();

            if (!items.length) {
                return false;
            }

            this.style
                .setProperty(
                    "--hamburger-menu-panel-height",
                    "auto"
                );

            let pages =
                this.#pack(
                    items,
                    this
                        .#safePanelHeight(
                            false
                        )
                );

            if (
                pages.length >
                1
            ) {
                pages =
                    this.#pack(
                        items,
                        this
                            .#safePanelHeight(
                                true
                            )
                    );
            }

            const panelLimit =
                this.#safePanelHeight(
                    pages.length >
                        1
                );

            this.#withObservationPaused(
                () => {
                    const panels =
                        pages.map(
                            (
                                page,
                                index
                            ) => {
                                const panel =
                                    document
                                        .createElement(
                                            "section"
                                        );

                                panel.className =
                                    "hamburger-menu-panel";

                                panel.dataset
                                    .menuPanel =
                                    String(
                                        index
                                    );

                                panel.append(
                                    ...page.items
                                );

                                return panel;
                            }
                        );

                    this.#source
                        .replaceChildren(
                            ...panels
                        );
                }
            );

            const tallest =
                Math.max(
                    1,
                    ...pages.map(
                        page =>
                            Math.min(
                                page.height,
                                panelLimit
                            )
                    )
                );

            this.style
                .setProperty(
                    "--hamburger-menu-panel-height",
                    tallest +
                        "px"
                );

            this.#viewport
                .style
                .height =
                tallest +
                    "px";

            this.#updateIndicator();

            this.goToPage(
                Math.max(
                    0,
                    Math.min(
                        pages.length -
                            1,
                        this.#panelIndex
                    )
                ),
                {
                    smooth:
                        false
                }
            );

            this.#dispatch(
                "layoutchanged",
                {
                    pageCount:
                        pages.length,
                    panelHeight:
                        tallest
                }
            );

            return true;
        }

        goToPage(
            index,
            {
                smooth = true
            } = {}
        ) {
            const panels =
                this.#panels();

            if (!panels.length) {
                return false;
            }

            const next =
                Math.max(
                    0,
                    Math.min(
                        panels.length -
                            1,
                        Number(index) ||
                            0
                    )
                );

            this.#panelIndex =
                next;

            const left =
                next *
                (
                    this.#viewport
                        .clientWidth ||
                    1
                );

            if (
                typeof this
                    .#viewport
                    .scrollTo ===
                    "function"
            ) {
                this.#viewport
                    .scrollTo({
                        left,
                        behavior:
                            smooth
                                ? "smooth"
                                : "auto"
                    });
            }
            else {
                this.#viewport
                    .scrollLeft =
                    left;
            }

            requestAnimationFrame(
                () =>
                    this.#updateIndicator()
            );

            return true;
        }

        #updateIndicator() {
            const panels =
                this.#panels();

            const count =
                panels.length;

            this.#indicator.hidden =
                count <= 1;

            if (count <= 1) {
                this.#panelIndex =
                    0;

                this.#indicatorThumb
                    .style
                    .removeProperty(
                        "width"
                    );

                this.#indicatorThumb
                    .style
                    .removeProperty(
                        "transform"
                    );

                return;
            }

            this.#indicatorThumb
                .style.width =
                (
                    100 /
                    count
                ) +
                "%";

            const width =
                this.#viewport
                    .clientWidth ||
                1;

            const progress =
                Math.max(
                    0,
                    Math.min(
                        count -
                            1,
                        this.#viewport
                            .scrollLeft /
                        width
                    )
                );

            this.#indicatorThumb
                .style
                .transform =
                "translateX(" +
                (
                    progress *
                    100
                ) +
                "%)";

            const next =
                Math.round(
                    progress
                );

            if (
                next !==
                this.#panelIndex
            ) {
                this.#panelIndex =
                    next;

                this.#dispatch(
                    "pagechanged",
                    {
                        page:
                            next,
                        pageCount:
                            count
                    }
                );
            }
        }

        #placement() {
            const menu =
                this.#popover
                    .getBoundingClientRect();

            const trigger =
                this.#trigger
                    .getBoundingClientRect();

            if (
                menu.bottom <=
                trigger.top +
                    1
            ) {
                return "above";
            }

            if (
                menu.top >=
                trigger.bottom -
                    1
            ) {
                return "below";
            }

            if (
                menu.right <=
                trigger.left +
                    1
            ) {
                return "left";
            }

            if (
                menu.left >=
                trigger.right -
                    1
            ) {
                return "right";
            }

            return (
                (
                    trigger.top +
                    trigger.bottom
                ) /
                    2 >=
                (
                    menu.top +
                    menu.bottom
                ) /
                    2
                    ? "above"
                    : "below"
            );
        }

        #flowDirection() {
            const menu =
                this.#popover
                    .getBoundingClientRect();

            const trigger =
                this.#trigger
                    .getBoundingClientRect();

            return (
                (
                    trigger.top +
                    trigger.bottom
                ) /
                    2 >=
                (
                    menu.top +
                    menu.bottom
                ) /
                    2
                    ? "end"
                    : "start"
            );
        }

        #reconcilePlacement(
            pass = 0
        ) {
            if (!this.isOpen) {
                return;
            }

            const region =
                this.#updateSafeGeometry();

            const menu =
                this.#popover
                    .getBoundingClientRect();

            const currentShiftY =
                px(
                    getComputedStyle(
                        this.#popover
                    )
                        .getPropertyValue(
                            "--hamburger-menu-popover-shift-y"
                        )
                );

            let deltaY =
                0;

            if (
                menu.bottom >
                region.bottom
            ) {
                deltaY -=
                    menu.bottom -
                    region.bottom;
            }

            if (
                menu.top +
                    deltaY <
                region.top
            ) {
                deltaY +=
                    region.top -
                    (
                        menu.top +
                        deltaY
                    );
            }

            const nextShiftY =
                currentShiftY +
                deltaY;

            this.#popover
                .style
                .setProperty(
                    "--hamburger-menu-popover-shift-y",
                    nextShiftY +
                        "px"
                );

            if (
                Math.abs(
                    deltaY
                ) >
                    0.5 &&
                pass <
                    2
            ) {
                requestAnimationFrame(
                    () =>
                        this
                            .#reconcilePlacement(
                                pass +
                                    1
                            )
                );

                return;
            }

            const placement =
                this.#placement();

            const flow =
                this.#flowDirection();

            this.#popover
                .dataset
                .placement =
                placement;

            this.#popover
                .dataset
                .flow =
                flow;

            this.#focusLayer
                .dataset
                .flow =
                flow;

            if (
                this.#focusStack
                    .length
            ) {
                this.#updateFocusBounds();
            }
        }

        #animationRate() {
            const value =
                Number(
                    this.getAttribute(
                        "item-rate"
                    )
                );

            return (
                Number.isFinite(
                    value
                ) &&
                value >
                    0
                    ? value
                    : 0.5
            );
        }

        #duration(
            distance
        ) {
            return Math.max(
                1,
                Math.round(
                    Math.max(
                        0,
                        Number(
                            distance
                        ) ||
                        0
                    ) /
                    this
                        .#animationRate()
                )
            );
        }

        #trackAnimation(
            animation
        ) {
            if (!animation) {
                return animation;
            }

            this.#animations
                .add(
                    animation
                );

            animation.finished
                .catch(
                    () => {}
                )
                .finally(
                    () =>
                        this.#animations
                            .delete(
                                animation
                            )
                );

            return animation;
        }

        #cancelAnimations() {
            for (
                const animation of
                this.#animations
            ) {
                try {
                    animation.cancel();
                }
                catch {}
            }

            this.#animations
                .clear();
        }

        #clearClip(
            element
        ) {
            if (!element) {
                return;
            }

            for (
                const property of [
                    "height",
                    "margin-top",
                    "margin-bottom",
                    "overflow"
                ]
            ) {
                element.style
                    .removeProperty(
                        property
                    );
            }

            element.classList
                .remove(
                    "hamburger-menu-transition-clip",
                    "hamburger-menu-transition-hidden"
                );
        }

        #setClip(
            element,
            metrics,
            fraction
        ) {
            if (
                !element ||
                !metrics
            ) {
                return;
            }

            element.classList
                .add(
                    "hamburger-menu-transition-clip"
                );

            element.style
                .height =
                (
                    metrics.height *
                    fraction
                ) +
                "px";

            element.style
                .marginTop =
                (
                    metrics.marginTop *
                    fraction
                ) +
                "px";

            element.style
                .marginBottom =
                (
                    metrics.marginBottom *
                    fraction
                ) +
                "px";

            element.style
                .overflow =
                "hidden";
        }

        #animateHeight(
            element,
            metrics,
            opening,
            generation =
                this.#generation
        ) {
            if (
                !element ||
                !metrics ||
                metrics.outerHeight <=
                    0
            ) {
                return Promise.resolve();
            }

            element.classList
                .remove(
                    "hamburger-menu-transition-hidden"
                );

            this.#setClip(
                element,
                metrics,
                opening
                    ? 0
                    : 1
            );

            if (
                typeof element
                    .animate !==
                    "function"
            ) {
                if (opening) {
                    this.#clearClip(
                        element
                    );
                }
                else {
                    this.#setClip(
                        element,
                        metrics,
                        0
                    );

                    element.classList
                        .add(
                            "hamburger-menu-transition-hidden"
                        );
                }

                return Promise.resolve();
            }

            const full = {
                height:
                    metrics.height +
                    "px",
                marginTop:
                    metrics.marginTop +
                    "px",
                marginBottom:
                    metrics.marginBottom +
                    "px"
            };

            const zero = {
                height:
                    "0px",
                marginTop:
                    "0px",
                marginBottom:
                    "0px"
            };

            const animation =
                this.#trackAnimation(
                    element.animate(
                        opening
                            ? [
                                zero,
                                full
                            ]
                            : [
                                full,
                                zero
                            ],
                        {
                            duration:
                                this.#duration(
                                    metrics
                                        .outerHeight
                                ),
                            easing:
                                "linear",
                            fill:
                                "both"
                        }
                    )
                );

            return animation
                .finished
                .catch(
                    () => {}
                )
                .finally(
                    () => {
                        try {
                            animation
                                .cancel();
                        }
                        catch {}

                        if (
                            generation !==
                            this.#generation
                        ) {
                            return;
                        }

                        if (opening) {
                            this.#clearClip(
                                element
                            );
                        }
                        else {
                            this.#setClip(
                                element,
                                metrics,
                                0
                            );

                            element.classList
                                .add(
                                    "hamburger-menu-transition-hidden"
                                );
                        }
                    }
                );
        }

        #visibleRows(
            root,
            excluding
        ) {
            const rows = [];

            if (
                root
                    ?.matches?.(
                        ".hamburger-menu-panel"
                    )
            ) {
                rows.push(
                    ...root.children
                );
            }
            else if (root) {
                const owner =
                    root.querySelector(
                        ":scope > button[aria-controls]"
                    );

                if (owner) {
                    rows.push(
                        owner
                    );
                }

                const submenu =
                    owner
                        ? document
                            .getElementById(
                                owner
                                    .getAttribute(
                                        "aria-controls"
                                    )
                            )
                        : undefined;

                if (submenu) {
                    rows.push(
                        ...submenu.children
                    );
                }
            }

            return rows.filter(
                row =>
                    row !==
                        excluding &&
                    !row.hidden &&
                    getComputedStyle(
                        row
                    ).display !==
                        "none"
            );
        }

        #prepareGrowth(
            submenu
        ) {
            submenu.hidden =
                false;

            const records =
                [
                    ...submenu
                        .children
                ]
                    .filter(
                        child =>
                            !child.hidden &&
                            getComputedStyle(
                                child
                            ).display !==
                                "none"
                    )
                    .map(
                        element => ({
                            element,
                            metrics:
                                this
                                    .#measure(
                                        element
                                    )
                        })
                    );

            for (
                const record of
                records
            ) {
                this.#setClip(
                    record.element,
                    record.metrics,
                    0
                );
            }

            return records;
        }

        #createPromotionMask(
            originalRect,
            promotedRect,
            flow,
            reverse = false
        ) {
            const viewportRect =
                this.#viewport
                    .getBoundingClientRect();

            const top =
                Math.min(
                    originalRect.top,
                    promotedRect.top
                );

            const bottom =
                Math.max(
                    originalRect.bottom,
                    promotedRect.bottom
                );

            const height =
                Math.max(
                    1,
                    bottom -
                    top
                );

            const mask =
                document
                    .createElement(
                        "div"
                    );

            mask.className =
                "hamburger-menu-promotion-mask";

            mask.style.top =
                (
                    top -
                    viewportRect.top
                ) +
                "px";

            mask.style.height =
                height +
                "px";

            const startClip =
                flow ===
                    "start"
                    ? "inset(" +
                        Math.max(
                            0,
                            originalRect.top -
                                top
                        ) +
                        "px 0 0 0)"
                    : "inset(0 0 " +
                        Math.max(
                            0,
                            bottom -
                                originalRect.bottom
                        ) +
                        "px 0)";

            const fullClip =
                "inset(0 0 0 0)";

            mask.style.clipPath =
                reverse
                    ? fullClip
                    : startClip;

            this.#viewport
                .append(
                    mask
                );

            return {
                element:
                    mask,
                from:
                    reverse
                        ? fullClip
                        : startClip,
                to:
                    reverse
                        ? startClip
                        : fullClip
            };
        }

        #animatePromotionMask(
            mask,
            duration
        ) {
            if (!mask?.element) {
                return Promise.resolve();
            }

            if (
                !duration ||
                typeof mask
                    .element
                    .animate !==
                    "function"
            ) {
                mask.element
                    .style
                    .clipPath =
                    mask.to;

                return Promise.resolve();
            }

            const animation =
                this
                    .#trackAnimation(
                        mask.element
                            .animate(
                                [
                                    {
                                        clipPath:
                                            mask.from
                                    },
                                    {
                                        clipPath:
                                            mask.to
                                    }
                                ],
                                {
                                    duration,
                                    easing:
                                        "ease-in-out",
                                    fill:
                                        "both"
                                }
                            )
                    );

            return animation
                .finished
                .catch(
                    () => {}
                )
                .finally(
                    () => {
                        try {
                            animation
                                .cancel();
                        }
                        catch {}

                        mask.element
                            .style
                            .clipPath =
                            mask.to;
                    }
                );
        }

        #fixedMotionDuration(
            milliseconds
        ) {
            try {
                if (
                    globalThis
                        .matchMedia?.(
                            "(prefers-reduced-motion: reduce)"
                        )
                        .matches
                ) {
                    return 0;
                }
            }
            catch {}

            return milliseconds;
        }

        #promotionPause() {
            return this
                .#fixedMotionDuration(
                    PROMOTION_PAUSE
                );
        }

        #restoreRecordStyle(
            record
        ) {
            if (!record?.element) {
                return;
            }

            const {
                element
            } = record;

            if (
                record.inlineDisplay
            ) {
                element.style.display =
                    record.inlineDisplay;
            }
            else {
                element.style
                    .removeProperty(
                        "display"
                    );
            }

            if (
                record.inlineVisibility
            ) {
                element.style.visibility =
                    record.inlineVisibility;
            }
            else {
                element.style
                    .removeProperty(
                        "visibility"
                    );
            }

            if (
                record.inlineTranslate
            ) {
                element.style.translate =
                    record.inlineTranslate;
            }
            else {
                element.style
                    .removeProperty(
                        "translate"
                    );
            }

            element.classList
                .remove(
                    "hamburger-menu-zooming"
                );

            record.hiddenByPromotion =
                false;
        }

        #hidePromotionRecord(
            record
        ) {
            if (
                !record?.element ||
                record
                    .hiddenByPromotion
            ) {
                return;
            }

            record.element
                .style.display =
                "none";

            record.hiddenByPromotion =
                true;
        }

        #promotionRows(
            sourceRoot,
            group,
            groupRect,
            flow
        ) {
            const all =
                this
                    .#visibleRows(
                        sourceRoot,
                        group
                    )
                    .map(
                        element => ({
                            element,
                            metrics:
                                this
                                    .#measure(
                                        element
                                    ),
                            rect:
                                element
                                    .getBoundingClientRect(),
                            inlineDisplay:
                                element
                                    .style
                                    .display,
                            inlineVisibility:
                                element
                                    .style
                                    .visibility,
                            inlineTranslate:
                                element
                                    .style
                                    .translate,
                            hiddenByPromotion:
                                false,
                            zoomDistance:
                                0
                        })
                    )
                    .filter(
                        record =>
                            record
                                .metrics
                                .outerHeight >
                            0
                    );

            const toward = [];
            const away = [];

            for (
                const record of
                all
            ) {
                if (
                    flow ===
                    "start"
                ) {
                    if (
                        record
                            .rect
                            .bottom <=
                        groupRect
                            .top +
                            0.5
                    ) {
                        toward.push(
                            record
                        );
                    }
                    else if (
                        record
                            .rect
                            .top >=
                        groupRect
                            .bottom -
                            0.5
                    ) {
                        away.push(
                            record
                        );
                    }
                }
                else {
                    if (
                        record
                            .rect
                            .top >=
                        groupRect
                            .bottom -
                            0.5
                    ) {
                        toward.push(
                            record
                        );
                    }
                    else if (
                        record
                            .rect
                            .bottom <=
                        groupRect
                            .top +
                            0.5
                    ) {
                        away.push(
                            record
                        );
                    }
                }
            }

            return {
                all,
                toward,
                away
            };
        }

        #fullyCovers(
            movingRect,
            stationaryRect
        ) {
            return (
                movingRect.top <=
                    stationaryRect.top +
                        0.5 &&
                movingRect.bottom >=
                    stationaryRect.bottom -
                        0.5 &&
                movingRect.left <=
                    stationaryRect.left +
                        0.5 &&
                movingRect.right >=
                    stationaryRect.right -
                        0.5
            );
        }

        #watchCoveredRows(
            group,
            records,
            completion,
            generation
        ) {
            let finished =
                false;

            Promise.resolve(
                completion
            )
                .catch(
                    () => {}
                )
                .finally(
                    () => {
                        finished =
                            true;
                    }
                );

            return new Promise(
                resolve => {
                    const check =
                        () => {
                            if (
                                generation !==
                                this
                                    .#generation
                            ) {
                                resolve();
                                return;
                            }

                            const movingRect =
                                group
                                    .getBoundingClientRect();

                            for (
                                const record of
                                records
                            ) {
                                if (
                                    record
                                        .hiddenByPromotion
                                ) {
                                    continue;
                                }

                                const rect =
                                    record
                                        .element
                                        .getBoundingClientRect();

                                if (
                                    this
                                        .#fullyCovers(
                                            movingRect,
                                            rect
                                        )
                                ) {
                                    this
                                        .#hidePromotionRecord(
                                            record
                                        );
                                }
                            }

                            if (finished) {
                                resolve();
                                return;
                            }

                            setTimeout(
                                check,
                                16
                            );
                        };

                    check();
                }
            );
        }

        #watchUncoveredRows(
            group,
            records,
            completion,
            generation
        ) {
            let finished =
                false;

            Promise.resolve(
                completion
            )
                .catch(
                    () => {}
                )
                .finally(
                    () => {
                        finished =
                            true;
                    }
                );

            return new Promise(
                resolve => {
                    const check =
                        () => {
                            if (
                                generation !==
                                this
                                    .#generation
                            ) {
                                resolve();
                                return;
                            }

                            const movingRect =
                                group
                                    .getBoundingClientRect();

                            for (
                                const record of
                                records
                            ) {
                                if (
                                    record
                                        .element
                                        .style
                                        .visibility !==
                                    "hidden"
                                ) {
                                    continue;
                                }

                                const rect =
                                    record
                                        .element
                                        .getBoundingClientRect();

                                if (
                                    !this
                                        .#fullyCovers(
                                            movingRect,
                                            rect
                                        )
                                ) {
                                    if (
                                        record
                                            .inlineVisibility
                                    ) {
                                        record
                                            .element
                                            .style
                                            .visibility =
                                            record
                                                .inlineVisibility;
                                    }
                                    else {
                                        record
                                            .element
                                            .style
                                            .removeProperty(
                                                "visibility"
                                            );
                                    }
                                }
                            }

                            if (finished) {
                                resolve();
                                return;
                            }

                            setTimeout(
                                check,
                                16
                            );
                        };

                    check();
                }
            );
        }

        #animateZoomAway(
            records,
            flow,
            generation
        ) {
            const viewportRect =
                this
                    .#viewport
                    .getBoundingClientRect();

            const distance =
                Math.max(
                    80,
                    viewportRect
                        .height +
                        64
                );

            const direction =
                flow ===
                    "start"
                    ? 1
                    : -1;

            const duration =
                this
                    .#fixedMotionDuration(
                        ZOOM_DURATION
                    );

            return records.map(
                record => {
                    record.zoomDistance =
                        direction *
                        distance;

                    record.element
                        .classList
                        .add(
                            "hamburger-menu-zooming"
                        );

                    if (
                        !duration ||
                        typeof record
                            .element
                            .animate !==
                            "function"
                    ) {
                        this
                            .#hidePromotionRecord(
                                record
                            );

                        return Promise.resolve();
                    }

                    const animation =
                        this
                            .#trackAnimation(
                                record
                                    .element
                                    .animate(
                                        [
                                            {
                                                translate:
                                                    "0 0"
                                            },
                                            {
                                                translate:
                                                    "0 " +
                                                    record
                                                        .zoomDistance +
                                                    "px"
                                            }
                                        ],
                                        {
                                            duration,
                                            easing:
                                                "cubic-bezier(.55,0,1,.45)",
                                            fill:
                                                "both"
                                        }
                                    )
                            );

                    return animation
                        .finished
                        .catch(
                            () => {}
                        )
                        .finally(
                            () => {
                                if (
                                    generation ===
                                    this
                                        .#generation
                                ) {
                                    this
                                        .#hidePromotionRecord(
                                            record
                                        );
                                }

                                try {
                                    animation
                                        .cancel();
                                }
                                catch {}

                                record.element
                                    .classList
                                    .remove(
                                        "hamburger-menu-zooming"
                                    );
                            }
                        );
                }
            );
        }

        #animateZoomBack(
            records,
            generation
        ) {
            const duration =
                this
                    .#fixedMotionDuration(
                        ZOOM_DURATION
                    );

            return records.map(
                record => {
                    if (
                        record
                            .inlineDisplay
                    ) {
                        record.element
                            .style
                            .display =
                            record
                                .inlineDisplay;
                    }
                    else {
                        record.element
                            .style
                            .removeProperty(
                                "display"
                            );
                    }

                    record.hiddenByPromotion =
                        false;

                    record.element
                        .style
                        .visibility =
                        record.inlineVisibility ||
                        "";

                    record.element
                        .classList
                        .add(
                            "hamburger-menu-zooming"
                        );

                    if (
                        !duration ||
                        typeof record
                            .element
                            .animate !==
                            "function"
                    ) {
                        this
                            .#restoreRecordStyle(
                                record
                            );

                        return Promise.resolve();
                    }

                    const animation =
                        this
                            .#trackAnimation(
                                record
                                    .element
                                    .animate(
                                        [
                                            {
                                                translate:
                                                    "0 " +
                                                    record
                                                        .zoomDistance +
                                                    "px"
                                            },
                                            {
                                                translate:
                                                    "0 0"
                                            }
                                        ],
                                        {
                                            duration,
                                            easing:
                                                "cubic-bezier(0,.55,.45,1)",
                                            fill:
                                                "both"
                                        }
                                    )
                            );

                    return animation
                        .finished
                        .catch(
                            () => {}
                        )
                        .finally(
                            () => {
                                try {
                                    animation
                                        .cancel();
                                }
                                catch {}

                                if (
                                    generation ===
                                    this
                                        .#generation
                                ) {
                                    this
                                        .#restoreRecordStyle(
                                            record
                                        );
                                }
                            }
                        );
                }
            );
        }

        async #openPromotedSubmenu(
            entry,
            generation
        ) {
            const collapsedHeight =
                entry.group
                    .getBoundingClientRect()
                    .height;

            const growing =
                this
                    .#prepareGrowth(
                        entry
                            .submenu
                    );

            entry.button
                .setAttribute(
                    "aria-expanded",
                    "true"
                );

            this.#popover
                .dataset
                .focused =
                "true";

            const safeHeight =
                this.#safePanelHeight(
                    false
                );

            const intendedHeight =
                Math.max(
                    1,
                    Math.min(
                        safeHeight,
                        collapsedHeight +
                            growing.reduce(
                                (
                                    total,
                                    record
                                ) =>
                                    total +
                                    record
                                        .metrics
                                        .outerHeight,
                                0
                            )
                    )
                );

            /*
             * Commit the promoted pane's destination height while the
             * old pane geometry is still locked. Releasing the lock only
             * after this prevents a one-frame collapse to the closed
             * parent height between the slide and child expansion.
             */
            this.style
                .setProperty(
                    "--hamburger-menu-panel-height",
                    intendedHeight +
                        "px"
                );

            this.#unfreezePane();

            this.#viewport
                .style.height =
                intendedHeight +
                    "px";

            this
                .#updateFocusBounds(
                    intendedHeight
                );

            await Promise.all(
                growing.map(
                    record =>
                        this
                            .#animateHeight(
                                record.element,
                                record.metrics,
                                true,
                                generation
                            )
                )
            );
        }

        async #closePromotedSubmenu(
            entry,
            generation
        ) {
            const shrinking =
                [
                    ...entry
                        .submenu
                        .children
                ]
                    .filter(
                        child =>
                            !child.hidden &&
                            getComputedStyle(
                                child
                            ).display !==
                                "none"
                    )
                    .map(
                        element => ({
                            element,
                            metrics:
                                this
                                    .#measure(
                                        element
                                    )
                        })
                    )
                    .filter(
                        record =>
                            record
                                .metrics
                                .outerHeight >
                            0
                    );

            await Promise.all(
                shrinking.map(
                    record =>
                        this
                            .#animateHeight(
                                record.element,
                                record.metrics,
                                false,
                                generation
                            )
                )
            );

            if (
                generation !==
                this.#generation
            ) {
                return;
            }

            entry.submenu.hidden =
                true;

            entry.button
                .setAttribute(
                    "aria-expanded",
                    "false"
                );

            for (
                const record of
                shrinking
            ) {
                this
                    .#clearClip(
                        record.element
                    );
            }
        }

        #handleParentClick(
            event
        ) {
            if (
                event.target ===
                    this.#trigger ||
                this.#transitionBusy
            ) {
                return;
            }

            const button =
                event.target
                    ?.closest?.(
                        "button[aria-controls]"
                    );

            if (
                !button ||
                !this.contains(
                    button
                ) ||
                button ===
                    this.#trigger
            ) {
                return;
            }

            const submenuId =
                button
                    .getAttribute(
                        "aria-controls"
                    );

            const submenu =
                submenuId
                    ? document
                        .getElementById(
                            submenuId
                        )
                    : undefined;

            const group =
                button
                    .parentElement;

            if (
                !submenu ||
                !group ||
                !group.contains(
                    submenu
                )
            ) {
                return;
            }

            event.preventDefault();

            const active =
                this.#focusStack
                    .at(-1);

            if (
                active
                    ?.group ===
                    group &&
                !submenu.hidden
            ) {
                void this
                    .#restoreFocusLevel();

                return;
            }

            if (!submenu.hidden) {
                return;
            }

            void this
                .#promote(
                    group,
                    button,
                    submenu
                );
        }

        async #promote(
            group,
            button,
            submenu
        ) {
            if (
                !group ||
                !button ||
                !submenu ||
                this.#transitionBusy
            ) {
                return false;
            }

            const flow =
                this
                    .#flowDirection();

            const opening =
                this.#dispatch(
                    "parentopening",
                    {
                        group,
                        button,
                        submenu,
                        depth:
                            this
                                .#focusStack
                                .length +
                            1,
                        flow
                    },
                    true
                );

            if (
                opening
                    .defaultPrevented
            ) {
                return false;
            }

            const current =
                this.#focusStack
                    .at(-1);

            const sourceRoot =
                current
                    ?.group ||
                this.#currentPanel();

            if (!sourceRoot) {
                return false;
            }

            this.#transitionBusy =
                true;

            this.#freezePane(
                this.#activePane()
            );

            const generation =
                ++this.#generation;

            this.#cancelAnimations();

            const originalPanelIndex =
                this.#panelIndex;

            const originalRect =
                group
                    .getBoundingClientRect();

            const rows =
                this
                    .#promotionRows(
                        sourceRoot,
                        group,
                        originalRect,
                        flow
                    );

            const sourceParent =
                group.parentNode;

            const anchor =
                document
                    .createComment(
                        "hamburger-menu-focus-anchor"
                    );

            sourceParent
                .insertBefore(
                    anchor,
                    group
                );

            const placeholder =
                document
                    .createElement(
                        "div"
                    );

            placeholder
                .className =
                "hamburger-menu-focus-placeholder";

            const groupMetrics =
                this.#measure(
                    group
                );

            placeholder.style.height =
                groupMetrics.height +
                "px";

            placeholder.style.marginTop =
                groupMetrics.marginTop +
                "px";

            placeholder.style.marginBottom =
                groupMetrics.marginBottom +
                "px";

            sourceParent
                .insertBefore(
                    placeholder,
                    anchor
                );

            this.#focusLayer.hidden =
                false;

            this.#focusLayer
                .dataset
                .flow =
                flow;

            group.classList
                .add(
                    "hamburger-menu-focus-group",
                    "hamburger-menu-focus-entering"
                );

            group.style
                .zIndex =
                String(
                    20 +
                    this.#focusStack
                        .length
                );

            this.#focusLayer
                .append(
                    group
                );

            const targetRect =
                group
                    .getBoundingClientRect();

            const translateX =
                originalRect.left -
                targetRect.left;

            const translateY =
                originalRect.top -
                targetRect.top;

            group.style.translate =
                translateX +
                "px " +
                translateY +
                "px";

            const entry = {
                group,
                button,
                submenu,
                sourceRoot,
                sourceParent,
                anchor,
                placeholder,
                rows:
                    rows.all,
                toward:
                    rows.toward,
                away:
                    rows.away,
                originalPanelIndex,
                flow
            };

            this.#focusStack
                .push(
                    entry
                );

            const duration =
                this
                    .#fixedMotionDuration(
                        PROMOTION_DURATION
                    );

            let movement;

            if (
                duration &&
                typeof group
                    .animate ===
                    "function"
            ) {
                movement =
                    this
                        .#trackAnimation(
                            group.animate(
                                [
                                    {
                                        translate:
                                            translateX +
                                            "px " +
                                            translateY +
                                            "px"
                                    },
                                    {
                                        translate:
                                            "0 0"
                                    }
                                ],
                                {
                                    duration,
                                    easing:
                                        "ease-in-out",
                                    fill:
                                        "both"
                                }
                            )
                        );
            }

            const movementDone =
                movement
                    ? movement
                        .finished
                        .catch(
                            () => {}
                        )
                    : Promise.resolve();

            const promotionMask =
                this
                    .#createPromotionMask(
                        originalRect,
                        targetRect,
                        flow,
                        false
                    );

            const maskDone =
                this
                    .#animatePromotionMask(
                        promotionMask,
                        duration
                    );

            const zoomDone =
                Promise.all(
                    this
                        .#animateZoomAway(
                            entry.away,
                            flow,
                            generation
                        )
                );

            await Promise.all([
                movementDone,
                maskDone,
                zoomDone
            ]);

            if (
                generation !==
                this.#generation
            ) {
                return false;
            }

            try {
                movement
                    ?.cancel();
            }
            catch {}

            group.style
                .removeProperty(
                    "translate"
                );

            group.classList
                .remove(
                    "hamburger-menu-focus-entering"
                );

            for (
                const record of
                entry.rows
            ) {
                this
                    .#hidePromotionRecord(
                        record
                    );
            }

            promotionMask
                .element
                ?.remove();

            if (current) {
                current.group.hidden =
                    true;
            }
            else {
                this.#source
                    .style
                    .visibility =
                    "hidden";
            }

            const pause =
                this
                    .#promotionPause();

            if (pause) {
                await wait(
                    pause
                );
            }

            if (
                generation !==
                this.#generation
            ) {
                return false;
            }

            await this
                .#openPromotedSubmenu(
                    entry,
                    generation
                );

            if (
                generation !==
                this.#generation
            ) {
                return false;
            }

            this
                .#updateFocusBounds();

            this.#transitionBusy =
                false;

            this.#flushLayoutIfDirty();

            this.#dispatch(
                "parentopened",
                {
                    group,
                    button,
                    submenu,
                    depth:
                        this
                            .#focusStack
                            .length,
                    flow
                }
            );

            return true;
        }

        async #restoreFocusLevel() {
            const entry =
                this.#focusStack
                    .at(-1);

            if (
                !entry ||
                this.#transitionBusy
            ) {
                return false;
            }

            const closing =
                this.#dispatch(
                    "parentclosing",
                    {
                        group:
                            entry.group,
                        button:
                            entry.button,
                        submenu:
                            entry.submenu,
                        depth:
                            this
                                .#focusStack
                                .length,
                        flow:
                            entry.flow
                    },
                    true
                );

            if (
                closing
                    .defaultPrevented
            ) {
                return false;
            }

            this.#transitionBusy =
                true;

            this.#freezePane(
                this.#viewport
            );

            const generation =
                ++this.#generation;

            this.#cancelAnimations();

            await this
                .#closePromotedSubmenu(
                    entry,
                    generation
                );

            if (
                generation !==
                this.#generation
            ) {
                return false;
            }

            const promotedRect =
                entry.group
                    .getBoundingClientRect();

            const parent =
                this.#focusStack
                    .length >
                    1
                    ? this
                        .#focusStack[
                            this
                                .#focusStack
                                .length -
                            2
                        ]
                    : undefined;

            if (parent) {
                parent.group.hidden =
                    false;
            }
            else {
                this.#source
                    .style
                    .visibility =
                    "visible";
            }

            for (
                const record of
                entry.rows
            ) {
                if (
                    record.inlineDisplay
                ) {
                    record.element
                        .style
                        .display =
                        record
                            .inlineDisplay;
                }
                else {
                    record.element
                        .style
                        .removeProperty(
                            "display"
                        );
                }

                record.hiddenByPromotion =
                    false;

                if (
                    record.inlineVisibility
                ) {
                    record.element
                        .style
                        .visibility =
                        record
                            .inlineVisibility;
                }
                else {
                    record.element
                        .style
                        .removeProperty(
                            "visibility"
                        );
                }
            }

            const destinationRect =
                entry.placeholder
                    ?.getBoundingClientRect();

            if (!destinationRect) {
                this.#transitionBusy =
                    false;

                this.#unfreezePane();

                return false;
            }

            const reverseMask =
                this
                    .#createPromotionMask(
                        destinationRect,
                        promotedRect,
                        entry.flow,
                        true
                    );

            const translateX =
                destinationRect.left -
                promotedRect.left;

            const translateY =
                destinationRect.top -
                promotedRect.top;

            entry.group
                .classList
                .add(
                    "hamburger-menu-focus-leaving"
                );

            const duration =
                this
                    .#fixedMotionDuration(
                        PROMOTION_DURATION
                    );

            let movement;

            if (
                duration &&
                typeof entry
                    .group
                    .animate ===
                    "function"
            ) {
                movement =
                    this
                        .#trackAnimation(
                            entry.group
                                .animate(
                                    [
                                        {
                                            translate:
                                                "0 0"
                                        },
                                        {
                                            translate:
                                                translateX +
                                                "px " +
                                                translateY +
                                                "px"
                                        }
                                    ],
                                    {
                                        duration,
                                        easing:
                                            "ease-in-out",
                                        fill:
                                            "both"
                                    }
                                )
                        );
            }

            const movementDone =
                movement
                    ? movement
                        .finished
                        .catch(
                            () => {}
                        )
                    : Promise.resolve();

            const maskDone =
                this
                    .#animatePromotionMask(
                        reverseMask,
                        duration
                    );

            const zoomBackDone =
                Promise.all(
                    this
                        .#animateZoomBack(
                            entry.away,
                            generation
                        )
                );

            await Promise.all([
                movementDone,
                maskDone,
                zoomBackDone
            ]);

            if (
                generation !==
                this.#generation
            ) {
                return false;
            }

            entry.group
                .style
                .translate =
                translateX +
                "px " +
                translateY +
                "px";

            try {
                movement
                    ?.cancel();
            }
            catch {}

            if (
                entry.anchor
                    ?.parentNode
            ) {
                entry.anchor
                    .parentNode
                    .insertBefore(
                        entry.group,
                        entry.anchor
                    );
            }

            entry.group
                .style
                .removeProperty(
                    "translate"
                );

            reverseMask
                .element
                ?.remove();

            entry.group
                .style
                .removeProperty(
                    "z-index"
                );

            entry.group
                .classList
                .remove(
                    "hamburger-menu-focus-group",
                    "hamburger-menu-focus-leaving"
                );

            for (
                const record of
                entry.rows
            ) {
                this
                    .#restoreRecordStyle(
                        record
                    );
            }

            entry.placeholder
                ?.remove();

            entry.anchor
                ?.remove();

            this.#focusStack
                .pop();

            if (parent) {
                parent.group.hidden =
                    false;
            }
            else {
                this.#focusLayer.hidden =
                    true;

                delete this.#popover
                    .dataset
                    .focused;

                this.#focusLayer
                    .removeAttribute(
                        "data-scrollable"
                    );

                this.#focusLayer
                    .scrollTop =
                    0;
            }

            this.#unfreezePane();

            this.#transitionBusy =
                false;

            if (
                this.#focusStack
                    .length
            ) {
                this.#updateFocusBounds();
            }
            else {
                this.#markLayoutDirty();

                this.goToPage(
                    entry
                        .originalPanelIndex,
                    {
                        smooth:
                            false
                    }
                );
            }

            this.#flushLayoutIfDirty();

            this.#dispatch(
                "parentclosed",
                {
                    group:
                        entry.group,
                    button:
                        entry.button,
                    submenu:
                        entry.submenu,
                    depth:
                        this
                            .#focusStack
                            .length,
                    flow:
                        entry.flow
                }
            );

            return true;
        }

        #updateFocusBounds(
            knownFullHeight
        ) {
            const current =
                this.#focusStack
                    .at(-1);

            if (!current) {
                return false;
            }

            const safeHeight =
                this.#safePanelHeight(
                    false
                );

            const group =
                current.group;

            const fullHeight =
                Number.isFinite(
                    knownFullHeight
                )
                    ? knownFullHeight
                    : Math.max(
                        group.scrollHeight,
                        group
                            .getBoundingClientRect()
                            .height
                    );

            const paneHeight =
                Math.max(
                    1,
                    Math.min(
                        safeHeight,
                        fullHeight
                    )
                );

            this.style
                .setProperty(
                    "--hamburger-menu-panel-height",
                    paneHeight +
                        "px"
                );

            this.#viewport
                .style
                .height =
                paneHeight +
                    "px";

            if (
                fullHeight >
                safeHeight +
                    0.5
            ) {
                this.#focusLayer
                    .dataset
                    .scrollable =
                    "true";

                if (
                    current.flow ===
                        "end"
                ) {
                    requestAnimationFrame(
                        () => {
                            this.#focusLayer
                                .scrollTop =
                                this.#focusLayer
                                    .scrollHeight;
                        }
                    );
                }
            }
            else {
                this.#focusLayer
                    .removeAttribute(
                        "data-scrollable"
                    );

                this.#focusLayer
                    .scrollTop =
                    0;
            }

            return true;
        }

        #reset() {
            this.#unfreezePane();

            this.#generation +=
                1;

            this.#cancelAnimations();

            this.#transitionBusy =
                false;

            while (
                this.#focusStack
                    .length
            ) {
                const entry =
                    this.#focusStack
                        .pop();

                if (
                    entry.anchor
                        ?.parentNode
                ) {
                    entry.anchor
                        .parentNode
                        .insertBefore(
                            entry.group,
                            entry.anchor
                        );
                }

                entry.group.hidden =
                    false;

                entry.group
                    .classList
                    .remove(
                        "hamburger-menu-focus-group",
                        "hamburger-menu-focus-entering",
                        "hamburger-menu-focus-leaving"
                    );

                entry.group
                    .style
                    .removeProperty(
                        "translate"
                    );

                entry.group
                    .style
                    .removeProperty(
                        "z-index"
                    );

                entry.submenu.hidden =
                    true;

                entry.button
                    .setAttribute(
                        "aria-expanded",
                        "false"
                    );

                for (
                    const record of
                    entry.rows ||
                    []
                ) {
                    this
                        .#restoreRecordStyle(
                            record
                        );
                }

                for (
                    const child of
                    entry.submenu
                        .children
                ) {
                    this.#clearClip(
                        child
                    );
                }

                entry.placeholder
                    ?.remove();

                entry.anchor
                    ?.remove();
            }

            this.#focusLayer
                .replaceChildren();

            this.#focusLayer.hidden =
                true;

            this.#focusLayer
                .removeAttribute(
                    "data-scrollable"
                );

            this.#focusLayer
                .scrollTop =
                0;

            delete this.#popover
                .dataset
                .focused;

            this.#source
                .style
                .visibility =
                "visible";

            const items =
                this.#normalItems();

            const allButtons =
                [
                    ...this
                        .#source
                        .querySelectorAll(
                            "button[aria-controls]"
                        )
                ];

            for (
                const button of
                allButtons
            ) {
                const submenu =
                    document
                        .getElementById(
                            button
                                .getAttribute(
                                    "aria-controls"
                                )
                        );

                if (
                    submenu &&
                    this.contains(
                        submenu
                    )
                ) {
                    submenu.hidden =
                        true;

                    button
                        .setAttribute(
                            "aria-expanded",
                            "false"
                        );
                }
            }

            this.#withObservationPaused(
                () => {
                    this.#source
                        .replaceChildren(
                            ...items
                        );
                }
            );

            this.#panelIndex =
                0;

            this.#viewport
                .scrollLeft =
                0;

            this.#viewport
                .style
                .removeProperty(
                    "height"
                );

            this.style
                .removeProperty(
                    "--hamburger-menu-panel-height"
                );

            this.#indicator.hidden =
                true;

            this.#indicatorThumb
                .style
                .removeProperty(
                    "width"
                );

            this.#indicatorThumb
                .style
                .removeProperty(
                    "transform"
                );
        }
    }

    customElements.define(
        "hamburger-menu",
        HamburgerMenu
    );

    globalThis.HamburgerMenu =
        HamburgerMenu;
})();
