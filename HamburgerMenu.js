
(() => {
    "use strict";

    const STYLE_ID =
        "hamburger-menu-base-styles";

    const DEFAULT_PROMOTION_DURATION =
        450;

    const PROMOTION_PAUSE =
        75;

    let coverageAnimationId = 0;

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
            "@property --hamburger-menu-target-x {",
            "  syntax: '<length>';",
            "  inherits: true;",
            "  initial-value: 0px;",
            "}",
            "@property --hamburger-menu-target-y {",
            "  syntax: '<length>';",
            "  inherits: true;",
            "  initial-value: 0px;",
            "}",
            ":where(hamburger-menu) {",
            "  --hamburger-menu-promotion-duration: 450ms;",
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
            "  height: auto;",
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
            "  max-height: none !important;",
            "  height: var(--hamburger-menu-frozen-pane-height) !important;",
            "  transition: height var(--hamburger-menu-frozen-height-duration, var(--hamburger-menu-layout-duration, 240ms)) ease-in-out !important;",
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
            "  touch-action: pan-y;",
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
            "  visibility: visible;",
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
            ":where(hamburger-menu) .hamburger-menu-focus-group.hamburger-menu-panel-driven {",
            "  translate: var(--hamburger-menu-target-x) var(--hamburger-menu-target-y);",
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
            "  :where(hamburger-menu) .hamburger-menu-pane-frozen,",
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
        #normalPaneHeight;
        #openingMeasured = false;
        #openingMeasurementPromise;
        #layoutDirty = true;
        #sizeTargets = new Set();
        #boundaryTrackFrame;
        #boundarySnapshot;
        #swipePointerId;
        #swipeStartX = 0;
        #swipeStartY = 0;
        #swipeStartScrollLeft = 0;
        #swipeActive = false;
        #suppressSwipeClick = false;
        #suppressSwipeClickTimer;

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

            clearTimeout(
                this.#suppressSwipeClickTimer
            );
            this.#swipePointerId =
                undefined;
            this.#swipeActive =
                false;
            this.#suppressSwipeClick =
                false;
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

                const prepared = this.#prepareOpeningLayout();

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

                if (!prepared) {
                    this.style.setProperty(
                        "--hamburger-menu-panel-height", "auto"
                    );
                    this.#viewport.style.removeProperty("height");
                    this.#indicator.hidden = true;
                }

                void this
                    .#finishOpeningMeasurement(prepared);

                return;
            }

            this.#openingMeasured =
                false;

            this.#beginOpeningMeasurement();

            this.#prepareOpeningLayout();

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

        #beginPaneSwipe(
            event
        ) {
            if (
                this.#transitionBusy ||
                this.#focusStack.length ||
                this.pageCount <=
                    1 ||
                (
                    event.pointerType &&
                    event.pointerType !==
                        "touch" &&
                    event.pointerType !==
                        "pen"
                ) ||
                event.target
                    ?.closest?.(
                        "select, input, textarea"
                    )
            ) {
                return;
            }

            this.#swipePointerId =
                event.pointerId;
            this.#swipeStartX =
                event.clientX;
            this.#swipeStartY =
                event.clientY;
            this.#swipeStartScrollLeft =
                this.#viewport.scrollLeft;
            this.#swipeActive =
                false;
        }

        #movePaneSwipe(
            event
        ) {
            if (
                event.pointerId !==
                    this.#swipePointerId
            ) {
                return;
            }

            const deltaX =
                event.clientX -
                this.#swipeStartX;
            const deltaY =
                event.clientY -
                this.#swipeStartY;

            if (!this.#swipeActive) {
                if (
                    Math.abs(
                        deltaX
                    ) <
                        8
                ) {
                    return;
                }

                if (
                    Math.abs(
                        deltaY
                    ) >=
                    Math.abs(
                        deltaX
                    )
                ) {
                    this.#swipePointerId =
                        undefined;

                    return;
                }

                this.#swipeActive =
                    true;

                try {
                    this.#viewport
                        .setPointerCapture(
                            event.pointerId
                        );
                }
                catch {}
            }

            event.preventDefault();

            this.#viewport
                .scrollLeft =
                this.#swipeStartScrollLeft -
                deltaX;

            this.#updateIndicator();
        }

        #endPaneSwipe(
            event
        ) {
            if (
                event.pointerId !==
                    this.#swipePointerId
            ) {
                return;
            }

            const wasActive =
                this.#swipeActive;

            this.#swipePointerId =
                undefined;
            this.#swipeActive =
                false;

            try {
                this.#viewport
                    .releasePointerCapture(
                        event.pointerId
                    );
            }
            catch {}

            if (!wasActive) {
                return;
            }

            event.preventDefault();

            const width =
                this.#viewport
                    .clientWidth ||
                1;
            const page =
                Math.round(
                    this.#viewport
                        .scrollLeft /
                    width
                );

            this.goToPage(
                page
            );

            this.#suppressSwipeClick =
                true;

            clearTimeout(
                this.#suppressSwipeClickTimer
            );

            this.#suppressSwipeClickTimer =
                setTimeout(
                    () => {
                        this.#suppressSwipeClick =
                            false;
                    },
                    350
                );
        }

        #cancelPaneSwipe(
            event
        ) {
            if (
                event.pointerId !==
                    this.#swipePointerId
            ) {
                return;
            }

            this.#swipePointerId =
                undefined;
            this.#swipeActive =
                false;

            this.goToPage(
                this.#panelIndex
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

            this.#viewport
                .addEventListener(
                    "pointerdown",
                    event =>
                        this.#beginPaneSwipe(
                            event
                        )
                );

            this.#viewport
                .addEventListener(
                    "pointermove",
                    event =>
                        this.#movePaneSwipe(
                            event
                        ),
                    {
                        passive:
                            false
                    }
                );

            this.#viewport
                .addEventListener(
                    "pointerup",
                    event =>
                        this.#endPaneSwipe(
                            event
                        )
                );

            this.#viewport
                .addEventListener(
                    "pointercancel",
                    event =>
                        this.#cancelPaneSwipe(
                            event
                        )
                );

            this.#viewport
                .addEventListener(
                    "click",
                    event => {
                        if (
                            !this.#suppressSwipeClick
                        ) {
                            return;
                        }

                        this.#suppressSwipeClick =
                            false;
                        clearTimeout(
                            this.#suppressSwipeClickTimer
                        );

                        event.preventDefault();
                        event.stopPropagation();
                    },
                    {
                        capture:
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

            // New direct host children need adopting. Changes elsewhere in
            // the document (including the clock's one-second render) do not.
            this.#observer.observe(this, { childList: true });
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

                target.style
                    .setProperty(
                        "--hamburger-menu-frozen-pane-height",
                        nextHeight +
                            "px"
                    );

                target.style.minWidth =
                    nextWidth +
                    "px";

                target.style.maxWidth =
                    nextWidth +
                    "px";

                target.style.overflow =
                    "hidden";
            }

            this.style
                .setProperty(
                    "--hamburger-menu-panel-height",
                    "var(--hamburger-menu-frozen-pane-height, " +
                        nextHeight +
                        "px)"
                );

            this.style
                .setProperty(
                    "--hamburger-menu-frozen-pane-height",
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
                this.#activePane(),
            measuredHeight
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
                    Number.isFinite(measuredHeight)
                        ? measuredHeight
                        : paneRect.height
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
                    frozenHeight:
                        target.style
                            .getPropertyValue(
                                "--hamburger-menu-frozen-pane-height"
                            ),
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

                if (
                    lock.frozenHeight
                ) {
                    target.style
                        .setProperty(
                            "--hamburger-menu-frozen-pane-height",
                            lock.frozenHeight
                        );
                }
                else {
                    target.style
                        .removeProperty(
                            "--hamburger-menu-frozen-pane-height"
                        );
                }

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

            this.style
                .removeProperty(
                    "--hamburger-menu-frozen-pane-height"
                );
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

        #prepareOpeningLayout() {
            this.#normalPaneHeight = undefined;

            // A closed popover has no layout box. Show it invisibly in its
            // normal location, measure the current rows, then restore its
            // display before entering the top layer.
            const inlineDisplay = this.#popover.style.display;
            this.#popover.style.display = "block";

            try {
                if (!this.#popover.getBoundingClientRect().width) {
                    return false;
                }

                this.#updateSafeGeometry();
                return this.#layoutPanels(true);
            }
            finally {
                this.#popover.style.display = inlineDisplay;
            }
        }

        #finishOpeningMeasurement(prepared = false) {
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
                    if (!prepared) {
                        this.#layoutPanels();
                    }
                    this.#reconcilePlacement();

                    await nextFrame();

                    this.#reconcilePlacement();

                    if (
                        !this.#frozenPaneLocks
                            .length
                    ) {
                        this.#freezePane(
                            this.#viewport,
                            this.#normalPaneHeight
                        );
                    }

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
                    !this.#openingMeasured &&
                    !this.#openingMeasurementPromise
                ) {
                    this.#beginOpeningMeasurement();

                    const prepared =
                        Number.isFinite(this.#normalPaneHeight);

                    if (!prepared) {
                        this.style.setProperty(
                            "--hamburger-menu-panel-height", "auto"
                        );
                        this.#viewport.style.removeProperty("height");
                        this.#indicator.hidden = true;
                    }

                    void this
                        .#finishOpeningMeasurement(prepared);
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

        #layoutPanels(beforeOpen = false) {
            if (
                (!this.isOpen && !beforeOpen) ||
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

            const wasFrozen =
                this.#frozenPaneLocks.length > 0;

            if (wasFrozen) {
                this.#unfreezePane();
            }

            this.style
                .setProperty(
                    "--hamburger-menu-panel-height",
                    "auto"
                );

            this.#viewport.style.removeProperty("height");
            this.#indicator.hidden = true;

            // Measure the current UI state in one unconstrained column.
            // Existing panes can clip or stretch their children, so their
            // row rectangles cannot be used for the partition pass.
            this.#withObservationPaused(() => {
                const measurementPane = document.createElement("section");
                measurementPane.className = "hamburger-menu-panel";
                measurementPane.append(...items);
                this.#source.replaceChildren(measurementPane);
            });

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
                this.#indicator.hidden = false;
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

            // Re-measure after partitioning: the final pane DOM, margins,
            // and current styles determine the height to freeze.
            const tallest =
                Math.max(
                    1,
                    ...this.#panels().map(
                        panel =>
                            Math.min(
                                Math.max(
                                    panel.scrollHeight,
                                    panel.getBoundingClientRect().height
                                ),
                                panelLimit
                            )
                    )
                );

            this.#normalPaneHeight = tallest;

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

            if (wasFrozen) {
                this.#freezePane(this.#viewport, tallest);
            }

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
                    .length &&
                !this.#frozenPaneLocks
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

            const duration =
                this
                    .#fixedMotionDuration(
                        this
                            .#duration(
                                metrics
                                    .outerHeight
                            )
                    );

            if (!duration) {
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
                            duration,
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

        #rememberLeftBorders(entry) {
            entry.leftBorderRecords = [
                entry.submenu,
                ...entry.submenu.querySelectorAll("*")
            ]
                .filter(element => element.getClientRects().length)
                .map(element => ({
                    element,
                    style: getComputedStyle(element)
                }))
                .filter(record =>
                    px(record.style.borderLeftWidth) > 0 &&
                    record.style.borderLeftStyle !== "none"
                )
                .map(({ element, style }) => ({
                    element,
                    border: style.borderLeft,
                    inline: element.style.getPropertyValue("border-left"),
                    priority: element.style.getPropertyPriority("border-left")
                }));
        }

        #restoreLeftBorders(entry) {
            for (const record of entry.leftBorderRecords || []) {
                if (record.inline) {
                    record.element.style.setProperty(
                        "border-left", record.inline, record.priority
                    );
                }
                else {
                    record.element.style.removeProperty("border-left");
                }
            }
        }

        #cssTimeMilliseconds(
            value,
            fallback
        ) {
            const text =
                String(
                    value ||
                    ""
                )
                    .trim()
                    .toLowerCase();

            const match =
                text.match(
                    /^(-?(?:\d+\.?\d*|\.\d+))(ms|s)$/
                );

            if (!match) {
                return fallback;
            }

            const number =
                Number(
                    match[
                        1
                    ]
                );

            if (
                !Number.isFinite(
                    number
                ) ||
                number <
                    0
            ) {
                return fallback;
            }

            return (
                match[
                    2
                ] ===
                    "s"
                    ? number *
                        1000
                    : number
            );
        }

        #promotionDuration() {
            const value =
                getComputedStyle(
                    this
                )
                    .getPropertyValue(
                        "--hamburger-menu-promotion-duration"
                    );

            return this
                .#fixedMotionDuration(
                    this
                        .#cssTimeMilliseconds(
                            value,
                            DEFAULT_PROMOTION_DURATION
                        )
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

            element.style.animation = record.inlineAnimation || "";
            element.style.pointerEvents = record.inlinePointerEvents || "";

            element.classList
                .remove(
                    "hamburger-menu-zooming"
                );

            element.style.removeProperty("--hamburger-menu-row-switch-time");
            element.style.removeProperty("--hamburger-menu-row-motion-duration");
            element.style.removeProperty("--hamburger-menu-disappear-threshold-1");
            element.style.removeProperty("--hamburger-menu-disappear-threshold-2");
            element.style.removeProperty("--hamburger-menu-row-switch-percentage");
            record.slot?.remove();
            record.slot = undefined;

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

        #visiblePaintBounds(element) {
            const base = element.getBoundingClientRect();
            let top = base.top;
            let right = base.right;
            let bottom = base.bottom;
            let left = base.left;

            const include = node => {
                if (!node || node.hidden) return false;
                const style = getComputedStyle(node);
                if (style.display === "none" ||
                    style.visibility === "hidden" ||
                    Number(style.opacity) === 0) return false;
                const rect = node.getBoundingClientRect();
                if (!rect.width || !rect.height) return false;
                top = Math.min(top, rect.top);
                right = Math.max(right, rect.right);
                bottom = Math.max(bottom, rect.bottom);
                left = Math.min(left, rect.left);
                return true;
            };

            const visit = group => {
                const button = group.querySelector(
                    ":scope > button[aria-controls]"
                );
                const submenu = button && document.getElementById(
                    button.getAttribute("aria-controls")
                );
                if (!submenu || !group.contains(submenu) ||
                    !include(submenu)) return;
                for (const child of submenu.children) {
                    if (include(child)) visit(child);
                }
            };
            visit(element);
            return {
                top, right, bottom, left,
                width: right - left,
                height: bottom - top
            };
        }

        #panelItemBounds(panel) {
            const items = [];
            const visible = element => {
                if (element.hidden) return false;
                const style = getComputedStyle(element);
                return style.display !== "none" &&
                    style.visibility !== "hidden" &&
                    Number(style.opacity) !== 0;
            };
            const collect = (element, parent) => {
                if (!visible(element)) return;
                const owner = element.querySelector(
                    ":scope > button[aria-controls]"
                );
                const submenu = owner && document.getElementById(
                    owner.getAttribute("aria-controls")
                );
                const children = submenu && element.contains(submenu) &&
                    visible(submenu)
                    ? [...submenu.children].filter(visible) : [];
                items.push({
                    element,
                    parent,
                    nested: !!parent,
                    hasMenu: !!owner,
                    rect: this.#visiblePaintBounds(element)
                });
                for (const child of children) collect(child, element);
            };
            for (const element of panel.children) collect(element, null);
            return items;
        }

        #hasVisibleChild(element, target, panelItems) {
            const item =
                panelItems.find(
                    candidate =>
                        candidate.element ===
                        element
                );

            const targetItem =
                panelItems.find(
                    candidate =>
                        candidate.element ===
                        target
                );

            if (
                !item ||
                !targetItem
            ) {
                return false;
            }

            if (
                panelItems.some(
                    child =>
                        child.parent ===
                        element
                )
            ) {
                return true;
            }

            if (
                item.parent ===
                targetItem.parent
            ) {
                return undefined;
            }

            if (targetItem.parent) {
                return this
                    .#hasVisibleChild(
                        element,
                        targetItem.parent,
                        panelItems
                    );
            }

            return false;
        }

        #promotionRows(
            sourceRoot,
            group,
            groupRect,
            flow,
            panelItems
        ) {
            const candidates = panelItems
                ? panelItems
                    .filter(
                        item =>
                            item.element !== group &&
                            !group.contains(
                                item.element
                            )
                    )
                    .map(
                        item => ({
                            ...item,
                            coverageState:
                                this
                                    .#hasVisibleChild(
                                        item.element,
                                        group,
                                        panelItems
                                    )
                        })
                    )
                    .filter(
                        item =>
                            item.coverageState !== true &&
                            (
                                item.nested ||
                                !item.hasMenu
                            )
                    )
                : this.#visibleRows(sourceRoot, group).map(element => ({
                    element,
                    nested: false,
                    coverageState: undefined,
                    rect: this.#visiblePaintBounds(element)
                }));
            const all = candidates
                    .map(
                        ({ element, nested, coverageState, rect }) => ({
                            element,
                            nested,
                            coverageState,
                            metrics:
                                this
                                    .#measure(
                                        element
                                    ),
                            rect,
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
                            inlineAnimation:
                                element.style.animation,
                            paintedOpacity:
                                getComputedStyle(element).opacity,
                            paintedDisplay:
                                getComputedStyle(element).display,
                            inlinePointerEvents:
                                element.style.pointerEvents,
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

        #rowVisibilitySwitchTime(progress, duration) {
            // Invert the parent's ease-in-out timing curve so the CSS
            // opacity keyframe fires at the matching travel position.
            let low = 0;
            let high = 1;
            const target = Math.max(0, Math.min(1, progress));

            for (let step = 0; step < 28; step += 1) {
                const t = (low + high) / 2;
                const eased = 3 * (1 - t) * t * t + t * t * t;
                if (eased < target) low = t;
                else high = t;
            }

            const t = (low + high) / 2;
            const time = 3 * (1 - t) * (1 - t) * t * .42 +
                3 * (1 - t) * t * t * .58 + t * t * t;
            return Math.max(0, Math.min(duration, time * duration));
        }

        #animateRowVisibility(records, from, to, duration, flow) {
            if (!duration || !records.length) return undefined;

            const rules = [];
            const animations = [];
            for (const record of records) {
                const rect = record.rect;
                const prefix = "--hamburger-menu-disappear-threshold-";
                // Record when the target's leading and trailing edges each
                // reach this item's hamburger-side edge. Every visible leaf
                // uses its own measured bound, at any menu nesting depth.
                const itemBound = flow === "start" ? rect.top : rect.bottom;
                const leadingFrom = flow === "start" ? from.top : from.bottom;
                const leadingTo = flow === "start" ? to.top : to.bottom;
                const trailingFrom = flow === "start"
                    ? from.bottom : from.top;
                const trailingTo = flow === "start"
                    ? to.bottom : to.top;
                const leadingTravel = leadingTo - leadingFrom;
                const trailingTravel = trailingTo - trailingFrom;
                const firstProgress = Math.abs(leadingTravel) > .5
                    ? (itemBound - leadingFrom) / leadingTravel : 1;
                const secondProgress = Math.abs(trailingTravel) > .5
                    ? (itemBound - trailingFrom) / trailingTravel : 1;
                const first = this.#rowVisibilitySwitchTime(
                    firstProgress, duration
                );
                const second = this.#rowVisibilitySwitchTime(
                    secondProgress, duration
                );
                record.element.style.setProperty(prefix + "1", first + "ms");
                record.element.style.setProperty(prefix + "2", second + "ms");
                const switchTime = second;

                record.element.style.setProperty(
                    "--hamburger-menu-row-switch-time",
                    switchTime + "ms"
                );
                record.element.style.setProperty(
                    "--hamburger-menu-row-motion-duration",
                    duration + "ms"
                );
                const percentage = Math.max(0, Math.min(100,
                    switchTime / duration * 100
                ));
                record.element.style.setProperty(
                    "--hamburger-menu-row-switch-percentage",
                    percentage + "%"
                );
                const name = "hamburger-menu-coverage-" +
                    ++coverageAnimationId;
                const before = Math.max(0, percentage - .001);
                const initial = record.paintedOpacity;
                const final = "0";
                if (record.coverageState === false) {
                    const slot = document.createElement("div");
                    slot.setAttribute("aria-hidden", "true");
                    Object.assign(slot.style, {
                        display: "none",
                        visibility: "hidden",
                        pointerEvents: "none",
                        boxSizing: "border-box",
                        width: record.rect.width + "px",
                        height: record.metrics.height + "px",
                        marginTop: record.metrics.marginTop + "px",
                        marginBottom: record.metrics.marginBottom + "px"
                    });
                    record.element.before(slot);
                    record.slot = slot;
                    const slotName = name + "-slot";
                    rules.push(`@keyframes ${name} { ` +
                        `0%, ${before}% { opacity: ${initial}; display: ${record.paintedDisplay}; } ` +
                        `${percentage}%, 100% { opacity: 0; display: none; } }`);
                    rules.push(`@keyframes ${slotName} { ` +
                        `0%, ${before}% { display: none; } ` +
                        `${percentage}%, 100% { display: block; } }`);
                    animations.push([record, name, slotName]);
                }
                else {
                    rules.push(`@keyframes ${name} { ` +
                        `0%, ${before}% { opacity: ${initial}; } ` +
                        `${percentage}%, 100% { opacity: ${final}; } }`);
                    animations.push([record, name]);
                }
            }

            const style = document.createElement("style");
            style.textContent = rules.join("\n");
            document.head.append(style);
            for (const [record, name, slotName] of animations) {
                record.element.style.animation =
                    `${name} var(--hamburger-menu-row-motion-duration) linear both`;
                record.element.style.pointerEvents = "none";
                if (slotName) {
                    record.slot.style.animation =
                        `${slotName} ${duration}ms linear both`;
                }
            }
            return { style, animations };
        }

        #reverseRowVisibility(entry, duration) {
            if (!entry.rowKeyframes || !duration) return;
            // Changing direction on a finished CSS animation does not
            // restart it. Clear all rows, flush once, then play in reverse.
            for (const [record, , slotName] of entry.rowKeyframes.animations) {
                record.element.style.animation = "none";
                if (slotName) record.slot.style.animation = "none";
            }
            void entry.sourceRoot.offsetWidth;
            for (const [record, name, slotName] of entry.rowKeyframes.animations) {
                record.element.style.setProperty(
                    "--hamburger-menu-row-motion-duration", duration + "ms"
                );
                record.element.style.animation =
                    `${name} var(--hamburger-menu-row-motion-duration) ` +
                    "linear reverse both";
                if (slotName) {
                    record.slot.style.animation =
                        `${slotName} ${duration}ms linear reverse both`;
                }
            }
        }

        #animateZoomAway(
            records,
            flow,
            generation,
            duration
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
            generation,
            duration
        ) {
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

            entry.submenu.hidden = false;
            this.#rememberLeftBorders(entry);

            const growing =
                this
                    .#prepareGrowth(
                        entry
                            .submenu
                    );

            entry.submenuAnimationRecords =
                growing.map(
                    record => ({
                        element:
                            record.element,
                        metrics: {
                            ...record.metrics
                        }
                    })
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

            const fullHeight =
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
                );

            /*
             * Promotion owns the pane geometry. Keep the pane frozen for
             * the entire promoted state; submenu growth happens inside the
             * frozen viewport and may make the focus layer scrollable, but
             * it never changes the pane height.
             */
            this
                .#updateFocusBounds(
                    fullHeight
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

            if (
                generation ===
                this.#generation
            ) {
                this
                    .#updateFocusBounds(
                        fullHeight
                    );
            }
        }

        async #closePromotedSubmenu(
            entry,
            generation
        ) {
            // Restore the original line before the first collapse frame.
            for (const record of entry.leftBorderRecords || []) {
                record.element.style.setProperty(
                    "border-left", record.border, "important"
                );
            }

            const openingMetrics =
                new Map(
                    (
                        entry
                            .submenuAnimationRecords ||
                        []
                    )
                        .map(
                            record => [
                                record.element,
                                record.metrics
                            ]
                        )
                );

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
                                openingMetrics
                                    .get(
                                        element
                                    ) ||
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

            this.#restoreLeftBorders(entry);

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
            event.stopPropagation();

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

        #translationAnimation(
            element,
            from,
            to,
            duration
        ) {
            const frame = rect => ({
                translate:
                    rect.x + "px " + rect.y + "px",
                width:
                    rect.width + "px",
                height:
                    rect.height + "px"
            });

            if (
                !duration ||
                typeof element
                    .animate !==
                    "function"
            ) {
                Object.assign(
                    element.style,
                    frame(to)
                );

                return {
                    animation:
                        undefined,
                    finished:
                        Promise.resolve()
                };
            }

            const animation =
                this
                    .#trackAnimation(
                        element.animate(
                            [frame(from), frame(to)],
                            {
                                duration,
                                easing:
                                    "ease-in-out",
                                fill:
                                    "both"
                            }
                        )
                    );

            return {
                animation,
                finished:
                    animation
                        .finished
                        .catch(
                            () => {}
                        )
            };
        }

        async #promoteNested(
            current,
            group,
            button,
            submenu,
            flow,
            generation,
            originalPanelIndex
        ) {
            const sourceParent =
                group.parentNode;

            if (!sourceParent) {
                this.#transitionBusy =
                    false;

                return false;
            }

            const childStart =
                group
                    .getBoundingClientRect();
            const parent =
                current.group;
            const parentStart =
                parent.getBoundingClientRect();

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

            placeholder.className =
                "hamburger-menu-focus-placeholder";

            const groupMetrics =
                this.#measure(
                    group
                );

            placeholder.style.height =
                groupMetrics.height + "px";
            placeholder.style.marginTop =
                groupMetrics.marginTop + "px";
            placeholder.style.marginBottom =
                groupMetrics.marginBottom + "px";

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

            const entry = {
                group,
                button,
                submenu,
                sourceRoot:
                    parent,
                sourceParent,
                anchor,
                placeholder,
                rows: [],
                toward: [],
                away: [],
                originalPanelIndex,
                flow,
                nestedMotion: {
                    parentHeight: parentStart.height,
                    parentTranslate: parent.style.translate,
                    childTranslate: group.style.translate,
                    childWidth: group.style.width,
                    childHeight: group.style.height
                }
            };

            this.#focusStack
                .push(
                    entry
                );

            group.classList
                .add(
                    "hamburger-menu-focus-group",
                    "hamburger-menu-focus-entering"
                );

            group.style.zIndex =
                String(
                    20 +
                    this.#focusStack
                        .length
                );

            this.#focusLayer
                .append(
                    group
                );

            const childTarget =
                group.getBoundingClientRect();

            const parentOffsetY =
                childTarget.top - childStart.top;

            const from = {
                x: childStart.left - childTarget.left,
                y: childStart.top - childTarget.top,
                width: childStart.width,
                height: childStart.height
            };
            const to = {
                x: 0,
                y: 0,
                width: childTarget.width,
                height: childTarget.height
            };

            Object.assign(group.style, {
                translate: from.x + "px " + from.y + "px",
                width: from.width + "px",
                height: from.height + "px"
            });

            const duration = this.#promotionDuration();
            const motion = this.#translationAnimation(
                group, from, to, duration
            );
            const parentMotion = duration &&
                typeof parent.animate === "function"
                ? this.#trackAnimation(parent.animate(
                    [
                        { translate: "0 0" },
                        { translate: "0 " + parentOffsetY + "px" }
                    ],
                    { duration, easing: "ease-in-out", fill: "both" }
                ))
                : undefined;

            await Promise.all([
                motion.finished,
                parentMotion?.finished.catch(() => {})
            ]);

            if (generation !== this.#generation) {
                return false;
            }

            try {
                motion.animation?.cancel();
                parentMotion?.cancel();
            }
            catch {}

            group.style.translate = entry.nestedMotion.childTranslate;
            group.style.width = entry.nestedMotion.childWidth;
            group.style.height = entry.nestedMotion.childHeight;

            parent.hidden = true;
            parent.style.translate =
                entry.nestedMotion.parentTranslate;

            group.classList
                .remove(
                    "hamburger-menu-focus-entering"
                );

            group.style.zIndex =
                String(
                    20 +
                    this.#focusStack
                        .length -
                    1
                );

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

        async #restoreNestedFocusLevel(
            entry,
            parent,
            generation
        ) {
            const parentGroup =
                parent.group;
            const child =
                entry.group;
            const childStart =
                child
                    .getBoundingClientRect();

            // Keep the returning parent out of flex layout so showing it
            // cannot move the child before either animation starts.
            const parentStyle = {
                position: parentGroup.style.position,
                left: parentGroup.style.left,
                top: parentGroup.style.top,
                width: parentGroup.style.width,
                height: parentGroup.style.height
            };
            entry.nestedMotion.restoreParentStyle = parentStyle;
            const layerRect =
                this.#focusLayer.getBoundingClientRect();
            const parentTop = entry.flow === "start"
                ? layerRect.top
                : layerRect.bottom - entry.nestedMotion.parentHeight;
            Object.assign(parentGroup.style, {
                position: "absolute",
                left: "0px",
                top: parentTop - layerRect.top + "px",
                width: layerRect.width + "px",
                height: entry.nestedMotion.parentHeight + "px"
            });

            parentGroup.hidden =
                false;

            const destination =
                entry.placeholder
                    ?.getBoundingClientRect();

            if (!destination) {
                parentGroup.hidden =
                    true;
                Object.assign(parentGroup.style, parentStyle);
                this.#transitionBusy =
                    false;
                return false;
            }

            const from = {
                x: 0,
                y: 0,
                width: childStart.width,
                height: childStart.height
            };
            const to = {
                x: destination.left - childStart.left,
                y: destination.top - childStart.top,
                width: destination.width,
                height: destination.height
            };

            const parentOffsetY =
                childStart.top - destination.top;
            parentGroup.style.translate =
                "0 " + parentOffsetY + "px";

            const duration = this.#promotionDuration();
            const motion = this.#translationAnimation(
                child, from, to, duration
            );
            const parentMotion = duration &&
                typeof parentGroup.animate === "function"
                ? this.#trackAnimation(parentGroup.animate(
                    [
                        { translate: "0 " + parentOffsetY + "px" },
                        { translate: "0 0" }
                    ],
                    { duration, easing: "ease-in-out", fill: "both" }
                ))
                : undefined;

            await Promise.all([
                motion.finished,
                parentMotion?.finished.catch(() => {})
            ]);

            if (
                generation !==
                this.#generation
            ) {
                return false;
            }

            Object.assign(child.style, {
                translate: to.x + "px " + to.y + "px",
                width: to.width + "px",
                height: to.height + "px"
            });

            try {
                motion.animation
                    ?.cancel();
                parentMotion?.cancel();
            }
            catch {}

            parentGroup.style.translate =
                entry.nestedMotion.parentTranslate;

            if (entry.anchor?.parentNode) {
                entry.anchor.parentNode.insertBefore(
                    child, entry.anchor
                );
            }

            child.classList.remove(
                "hamburger-menu-focus-group",
                "hamburger-menu-focus-leaving"
            );
            child.style.translate =
                entry.nestedMotion.childTranslate;
            child.style.width =
                entry.nestedMotion.childWidth;
            child.style.height =
                entry.nestedMotion.childHeight;
            child.style.removeProperty("z-index");

            entry.placeholder
                ?.remove();

            entry.anchor
                ?.remove();

            Object.assign(parentGroup.style, parentStyle);
            delete entry.nestedMotion.restoreParentStyle;

            this.#focusStack
                .pop();

            parentGroup.hidden =
                false;

            this.#transitionBusy =
                false;

            this
                .#updateFocusBounds();

            this.#flushLayoutIfDirty();

            this.#dispatch(
                "parentclosed",
                {
                    group:
                        child,
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

            /*
             * One frozen pane spans the entire promoted stack. Nested
             * parents reuse the existing lock so opening or closing a
             * nested level cannot change the pane geometry.
             */
            if (
                !this.#frozenPaneLocks
                    .length
            ) {
                this.#freezePane(
                    this.#activePane()
                );
            }

            const generation =
                ++this.#generation;

            this.#cancelAnimations();

            const originalPanelIndex =
                this.#panelIndex;

            if (current) {
                return this
                    .#promoteNested(
                        current,
                        group,
                        button,
                        submenu,
                        flow,
                        generation,
                        originalPanelIndex
                    );
            }

            // Measure every rendered item before moving the target or
            // inserting placeholders. Coverage uses this one panel snapshot.
            const panelItems = sourceRoot.matches(".hamburger-menu-panel")
                ? this.#panelItemBounds(sourceRoot) : undefined;
            const originalRect = panelItems
                ?.find(item => item.element === group)?.rect ??
                this.#visiblePaintBounds(group);

            const rows =
                this
                    .#promotionRows(
                        sourceRoot,
                        group,
                        originalRect,
                        flow,
                        panelItems
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

            // Keep the promoted target and sibling rows beneath the panel
            // that owns their shared position property.
            sourceRoot.append(this.#focusLayer);
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
                this.#visiblePaintBounds(group);

            const translateX =
                originalRect.left -
                targetRect.left;

            const translateY =
                originalRect.top -
                targetRect.top;

            const panelMotion = typeof globalThis.CSS?.registerProperty ===
                "function";
            if (panelMotion) {
                sourceRoot.style.setProperty(
                    "--hamburger-menu-target-x", translateX + "px"
                );
                sourceRoot.style.setProperty(
                    "--hamburger-menu-target-y", translateY + "px"
                );
                group.classList.add("hamburger-menu-panel-driven");
            }
            else {
                group.style.translate = translateX + "px " + translateY + "px";
            }

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
                motionPanel: sourceRoot,
                panelMotion,
                originalPanelIndex,
                flow
            };

            this.#focusStack
                .push(
                    entry
                );

            const duration =
                this
                    .#promotionDuration();

            let movement;

            if (duration && typeof group.animate === "function") {
                movement =
                    this
                        .#trackAnimation(
                            (panelMotion ? sourceRoot : group).animate(
                                panelMotion ? [
                                    {
                                        "--hamburger-menu-target-x": translateX + "px",
                                        "--hamburger-menu-target-y": translateY + "px"
                                    },
                                    {
                                        "--hamburger-menu-target-x": "0px",
                                        "--hamburger-menu-target-y": "0px"
                                    }
                                ] : [
                                    { translate: translateX + "px " + translateY + "px" },
                                    { translate: "0 0" }
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

            entry.rowKeyframes = this.#animateRowVisibility(
                entry.toward, originalRect, targetRect,
                duration, flow
            );

            const zoomDone =
                Promise.all(
                    this
                        .#animateZoomAway(
                            entry.away,
                            flow,
                            generation,
                            duration
                        )
                );

            await Promise.all([
                movementDone,
                zoomDone
            ]);

            if (
                generation !==
                this.#generation
            ) {
                return false;
            }

            if (panelMotion) {
                sourceRoot.style.setProperty("--hamburger-menu-target-x", "0px");
                sourceRoot.style.setProperty("--hamburger-menu-target-y", "0px");
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

            if (
                !this.#frozenPaneLocks
                    .length
            ) {
                this.#freezePane(
                    this.#viewport
                );
            }

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

            if (
                parent &&
                entry.nestedMotion
            ) {
                return this
                    .#restoreNestedFocusLevel(
                        entry,
                        parent,
                        generation
                    );
            }

            let parentZIndex;

            if (parent) {
                parentZIndex =
                    parent.group
                        .style
                        .zIndex;

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

                /*
                 * Preserve the current promotion lock on a failed nested
                 * restore. A later reset/close can unwind it safely.
                 */
                return false;
            }

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
                    .#promotionDuration();

            let movement;

            if (duration && typeof entry.group.animate === "function") {
                movement =
                    this
                        .#trackAnimation(
                            (entry.panelMotion
                                ? entry.motionPanel
                                : entry.group).animate(
                                    entry.panelMotion ? [
                                        {
                                            "--hamburger-menu-target-x": "0px",
                                            "--hamburger-menu-target-y": "0px"
                                        },
                                        {
                                            "--hamburger-menu-target-x": translateX + "px",
                                            "--hamburger-menu-target-y": translateY + "px"
                                        }
                                    ] : [
                                        { translate: "0 0" },
                                        { translate: translateX + "px " + translateY + "px" }
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

            this.#reverseRowVisibility(entry, duration);

            const zoomBackDone =
                Promise.all(
                    this
                        .#animateZoomBack(
                            entry.away,
                            generation,
                            duration
                        )
                );

            await Promise.all([
                movementDone,
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

            if (parent) {
                if (parentZIndex) {
                    parent.group
                        .style
                        .zIndex =
                        parentZIndex;
                }
                else {
                    parent.group
                        .style
                        .removeProperty(
                            "z-index"
                        );
                }
            }

            entry.group
                .style
                .removeProperty(
                    "z-index"
                );

            entry.group
                .classList
                .remove(
                    "hamburger-menu-focus-group",
                    "hamburger-menu-focus-leaving",
                    "hamburger-menu-panel-driven"
                );

            entry.rowKeyframes?.style.remove();
            entry.rowKeyframes = undefined;
            if (entry.panelMotion) {
                entry.motionPanel.style.removeProperty("--hamburger-menu-target-x");
                entry.motionPanel.style.removeProperty("--hamburger-menu-target-y");
            }
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
                this.#viewport.append(this.#focusLayer);
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

            if (
                this.#frozenPaneLocks
                    .length
            ) {
                const paneHeight =
                    Math.max(
                        1,
                        Math.min(
                            safeHeight,
                            this.#frozenPaneRect
                                ?.height ||
                            this.#frozenPaneBaseSize
                                ?.height ||
                            safeHeight
                        )
                    );

                if (
                    fullHeight >
                    paneHeight +
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
            this.#generation +=
                1;

            this.#normalPaneHeight = undefined;

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
                        "hamburger-menu-focus-leaving",
                        "hamburger-menu-panel-driven"
                    );

                entry.rowKeyframes?.style.remove();
                if (entry.panelMotion) {
                    entry.motionPanel.style.removeProperty("--hamburger-menu-target-x");
                    entry.motionPanel.style.removeProperty("--hamburger-menu-target-y");
                }

                if (entry.nestedMotion) {
                    entry.group.style.translate =
                        entry.nestedMotion.childTranslate;
                    entry.group.style.width =
                        entry.nestedMotion.childWidth;
                    entry.group.style.height =
                        entry.nestedMotion.childHeight;
                    entry.sourceRoot.style.translate =
                        entry.nestedMotion.parentTranslate;
                    if (entry.nestedMotion.restoreParentStyle) {
                        Object.assign(
                            entry.sourceRoot.style,
                            entry.nestedMotion.restoreParentStyle
                        );
                    }
                }
                else {
                    entry.group
                        .style
                        .removeProperty(
                            "translate"
                        );
                }

                entry.group
                    .style
                    .removeProperty(
                        "z-index"
                    );

                entry.submenu.hidden =
                    true;

                this.#restoreLeftBorders(entry);

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

            this.#viewport.append(this.#focusLayer);
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
