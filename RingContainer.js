class RingContainer extends HTMLElement {
    #shadowRoot;

    #parent;

    #inset;
    #width;
    #margin;
    #innerMargin;
    #outerMargin;

    #sizeObserver;

    #resizeDuration;

    #reorderFilter;
    #resizeFilter;

    #connectFilter;
    #disconnectFilter;

    #filterRamp;
    #filterRampFront;
    #filterRampEnd;

    #filterRampConnect;
    #filterRampDisconnect;

    #style;
    #container;

    #resizePending = false;
    #reorderPending = false;

    #pendingLifecycleAction;

    #resizeActive = false;
    #reorderActive = false;

    #syncingAttribute = false;

    #animationPhase = "idle";
    #animationToken = 0;
    #phaseTimer;

    #animationResize = false;
    #animationReorder = false;

    #animationTargetInset;
    #animationTargetWidth;

    #animationGeometryChanged = false;

    #animationFilter = "none";
    #animationFrontRamp = "0ms";
    #animationEndRamp = "0ms";

    #geometryRefreshFrame;

    static #batchResizing = false;
    static #propertiesRegistered = false;
    static #instances = new Set();
    static #reordering = false;

    static #globalResizeDuration;

    static #globalReorderFilter;
    static #globalResizeFilter;

    static #globalConnectFilter;
    static #globalDisconnectFilter;

    static #globalFilterRamp;
    static #globalFilterRampFront;
    static #globalFilterRampEnd;

    static #globalFilterRampConnect;
    static #globalFilterRampDisconnect;

    static observedAttributes = [
        "inset",
        "width",
        "margin",
        "inner-margin",
        "outer-margin"
    ];

    constructor() {
        super();

        RingContainer.#registerProperties();

        this.#inset =
            this.getAttribute(
                "inset"
            );

        this.#width =
            this.getAttribute(
                "width"
            );

        this.#margin =
            this.getAttribute(
                "margin"
            );

        this.#innerMargin =
            this.getAttribute(
                "inner-margin"
            );

        this.#outerMargin =
            this.getAttribute(
                "outer-margin"
            );

        this.#shadowRoot =
            this.attachShadow({
                mode: "closed"
            });

        this.#style =
            document.createElement(
                "style"
            );

        this.#container =
            document.createElement(
                "div"
            );

        this.#container.id =
            "container";

        const slot =
            document.createElement(
                "slot"
            );

        this.#container.appendChild(
            slot
        );

        this.#shadowRoot.appendChild(
            this.#style
        );

        this.#shadowRoot.appendChild(
            this.#container
        );

        this.#refreshNormalizedLengthAttributes();

        this.#updateStyle();

        this.#updateDuration();

        this.#updateProperties(
            false
        );

        this.#container.style.filter =
            "none";
    }

    connectedCallback() {
        this.#parent =
            this.parentElement;

        RingContainer.#instances.add(
            this
        );

        if (
            RingContainer.#reordering
        ) {
            return;
        }

        this.#refreshNormalizedLengthAttributes();

        this.#cancelAnimation();

        this.#resizePending =
            false;

        this.#reorderPending =
            false;

        this.#pendingLifecycleAction =
            undefined;

        this.#resizeActive =
            false;

        this.#reorderActive =
            false;

        this.#updateDuration();

        this.#startSizeObserver();

        RingContainer.#recalculateParent(
            this.#parent,
            "connect",
            this
        );
    }

    disconnectedCallback() {
        if (
            RingContainer.#reordering
        ) {
            return;
        }

        const parent =
            this.#parent;

        this.#stopSizeObserver();

        this.#cancelAnimation();

        RingContainer.#instances.delete(
            this
        );

        this.#parent =
            null;

        RingContainer.#recalculateParent(
            parent,
            "disconnect"
        );
    }

    get inset() {
        return this.#inset;
    }

    set inset(value) {
        this.#setLengthValue(
            "inset",
            value
        );
    }

    get width() {
        return this.#width;
    }

    set width(value) {
        this.#setLengthValue(
            "width",
            value
        );
    }

    get margin() {
        return this.#margin;
    }

    set margin(value) {
        this.#setLengthValue(
            "margin",
            value
        );
    }

    get innerMargin() {
        return this.#innerMargin;
    }

    set innerMargin(value) {
        this.#setLengthValue(
            "inner-margin",
            value
        );
    }

    get outerMargin() {
        return this.#outerMargin;
    }

    set outerMargin(value) {
        this.#setLengthValue(
            "outer-margin",
            value
        );
    }

    get renderedInset() {
        return this.#getRenderedGeometry().inset;
    }

    get renderedWidth() {
        return this.#getRenderedGeometry().width;
    }

    static get batchResizing() {
        return RingContainer.#batchResizing;
    }

    static set batchResizing(
        value
    ) {
        const batchResizing =
            Boolean(value);

        if (
            batchResizing ===
            RingContainer.#batchResizing
        ) {
            return;
        }

        RingContainer.#batchResizing =
            batchResizing;

        if (!batchResizing) {
            RingContainer.#flushResizeBatch();
        }
    }

    static get resizeDuration() {
        return (
            RingContainer
                .#globalResizeDuration ??
            "333ms"
        );
    }

    static set resizeDuration(
        value
    ) {
        RingContainer.#globalResizeDuration =
            RingContainer.#normalizeOptionalTime(
                value
            );

        RingContainer.#updateInstanceDurations();
    }

    static get reorderFilter() {
        return (
            RingContainer
                .#globalReorderFilter ??
            "opacity(75%)"
        );
    }

    static set reorderFilter(
        value
    ) {
        RingContainer.#globalReorderFilter =
            RingContainer.#normalizeOptionalFilter(
                value
            );
    }

    static get resizeFilter() {
        return (
            RingContainer
                .#globalResizeFilter ??
            "none"
        );
    }

    static set resizeFilter(
        value
    ) {
        RingContainer.#globalResizeFilter =
            RingContainer.#normalizeOptionalFilter(
                value
            );
    }

    static get connectFilter() {
        return (
            RingContainer
                .#globalConnectFilter ??
            "opacity(75%)"
        );
    }

    static set connectFilter(
        value
    ) {
        RingContainer.#globalConnectFilter =
            RingContainer.#normalizeOptionalFilter(
                value
            );
    }

    static get disconnectFilter() {
        return (
            RingContainer
                .#globalDisconnectFilter ??
            "opacity(75%)"
        );
    }

    static set disconnectFilter(
        value
    ) {
        RingContainer.#globalDisconnectFilter =
            RingContainer.#normalizeOptionalFilter(
                value
            );
    }

    static get filterRamp() {
        return (
            RingContainer
                .#globalFilterRamp ??
            true
        );
    }

    static set filterRamp(
        value
    ) {
        RingContainer.#globalFilterRamp =
            RingContainer.#normalizeOptionalBoolean(
                value
            );
    }

    static get filterRampFront() {
        return (
            RingContainer
                .#globalFilterRampFront ??
            "125ms"
        );
    }

    static set filterRampFront(
        value
    ) {
        RingContainer.#globalFilterRampFront =
            RingContainer.#normalizeOptionalTime(
                value
            );
    }

    static get filterRampEnd() {
        return (
            RingContainer
                .#globalFilterRampEnd ??
            "125ms"
        );
    }

    static set filterRampEnd(
        value
    ) {
        RingContainer.#globalFilterRampEnd =
            RingContainer.#normalizeOptionalTime(
                value
            );
    }

    static get filterRampConnect() {
        return (
            RingContainer
                .#globalFilterRampConnect ??
            "125ms"
        );
    }

    static set filterRampConnect(
        value
    ) {
        RingContainer.#globalFilterRampConnect =
            RingContainer.#normalizeOptionalTime(
                value
            );
    }

    static get filterRampDisconnect() {
        return (
            RingContainer
                .#globalFilterRampDisconnect ??
            "125ms"
        );
    }

    static set filterRampDisconnect(
        value
    ) {
        RingContainer.#globalFilterRampDisconnect =
            RingContainer.#normalizeOptionalTime(
                value
            );
    }

    get resizeDuration() {
        if (
            RingContainer
                .#globalResizeDuration !==
            undefined
        ) {
            return RingContainer
                .#globalResizeDuration;
        }

        return (
            this.#resizeDuration ??
            "333ms"
        );
    }

    set resizeDuration(
        value
    ) {
        this.#resizeDuration =
            RingContainer.#normalizeOptionalTime(
                value
            );

        this.#updateDuration();
    }

    get reorderFilter() {
        if (
            RingContainer
                .#globalReorderFilter !==
            undefined
        ) {
            return RingContainer
                .#globalReorderFilter;
        }

        return (
            this.#reorderFilter ??
            "opacity(75%)"
        );
    }

    set reorderFilter(
        value
    ) {
        this.#reorderFilter =
            RingContainer.#normalizeOptionalFilter(
                value
            );
    }

    get resizeFilter() {
        if (
            RingContainer
                .#globalResizeFilter !==
            undefined
        ) {
            return RingContainer
                .#globalResizeFilter;
        }

        return (
            this.#resizeFilter ??
            "none"
        );
    }

    set resizeFilter(
        value
    ) {
        this.#resizeFilter =
            RingContainer.#normalizeOptionalFilter(
                value
            );
    }

    get connectFilter() {
        if (
            RingContainer
                .#globalConnectFilter !==
            undefined
        ) {
            return RingContainer
                .#globalConnectFilter;
        }

        return (
            this.#connectFilter ??
            "opacity(75%)"
        );
    }

    set connectFilter(
        value
    ) {
        this.#connectFilter =
            RingContainer.#normalizeOptionalFilter(
                value
            );
    }

    get disconnectFilter() {
        if (
            RingContainer
                .#globalDisconnectFilter !==
            undefined
        ) {
            return RingContainer
                .#globalDisconnectFilter;
        }

        return (
            this.#disconnectFilter ??
            "opacity(75%)"
        );
    }

    set disconnectFilter(
        value
    ) {
        this.#disconnectFilter =
            RingContainer.#normalizeOptionalFilter(
                value
            );
    }

    get filterRamp() {
        if (
            RingContainer
                .#globalFilterRamp !==
            undefined
        ) {
            return RingContainer
                .#globalFilterRamp;
        }

        return (
            this.#filterRamp ??
            true
        );
    }

    set filterRamp(
        value
    ) {
        this.#filterRamp =
            RingContainer.#normalizeOptionalBoolean(
                value
            );
    }

    get filterRampFront() {
        if (
            RingContainer
                .#globalFilterRampFront !==
            undefined
        ) {
            return RingContainer
                .#globalFilterRampFront;
        }

        return (
            this.#filterRampFront ??
            "125ms"
        );
    }

    set filterRampFront(
        value
    ) {
        this.#filterRampFront =
            RingContainer.#normalizeOptionalTime(
                value
            );
    }

    get filterRampEnd() {
        if (
            RingContainer
                .#globalFilterRampEnd !==
            undefined
        ) {
            return RingContainer
                .#globalFilterRampEnd;
        }

        return (
            this.#filterRampEnd ??
            "125ms"
        );
    }

    set filterRampEnd(
        value
    ) {
        this.#filterRampEnd =
            RingContainer.#normalizeOptionalTime(
                value
            );
    }

    get filterRampConnect() {
        if (
            RingContainer
                .#globalFilterRampConnect !==
            undefined
        ) {
            return RingContainer
                .#globalFilterRampConnect;
        }

        return (
            this.#filterRampConnect ??
            "125ms"
        );
    }

    set filterRampConnect(
        value
    ) {
        this.#filterRampConnect =
            RingContainer.#normalizeOptionalTime(
                value
            );
    }

    get filterRampDisconnect() {
        if (
            RingContainer
                .#globalFilterRampDisconnect !==
            undefined
        ) {
            return RingContainer
                .#globalFilterRampDisconnect;
        }

        return (
            this.#filterRampDisconnect ??
            "125ms"
        );
    }

    set filterRampDisconnect(
        value
    ) {
        this.#filterRampDisconnect =
            RingContainer.#normalizeOptionalTime(
                value
            );
    }

    static reorder(
        ...ringContainers
    ) {
        if (
            ringContainers.length < 2
        ) {
            return;
        }

        const unique =
            new Set(
                ringContainers
            );

        if (
            unique.size !==
            ringContainers.length
        ) {
            throw new TypeError(
                "RingContainer.reorder() cannot contain duplicate RingContainers."
            );
        }

        for (
            const ring of
            ringContainers
        ) {
            if (
                !(ring instanceof
                    RingContainer)
            ) {
                throw new TypeError(
                    "RingContainer.reorder() arguments must be RingContainer instances."
                );
            }

            if (
                !ring.parentElement
            ) {
                throw new Error(
                    "Every RingContainer passed to reorder() must have a parent."
                );
            }
        }

        const parent =
            ringContainers[0]
                .parentElement;

        for (
            const ring of
            ringContainers
        ) {
            if (
                ring.parentElement !==
                parent
            ) {
                throw new Error(
                    "Every RingContainer passed to reorder() must have the same parent."
                );
            }
        }

        const parentRings =
            RingContainer.#getParentRings(
                parent
            );

        const startingGeometry =
            new Map();

        for (
            const ring of
            parentRings
        ) {
            ring.#freezeCurrentGeometry();

            startingGeometry.set(
                ring,
                ring.#getRenderedGeometry()
            );
        }

        const ringSet =
            new Set(
                ringContainers
            );

        const ringsInDomOrder =
            Array.from(
                parent.children
            ).filter(
                element =>
                    ringSet.has(
                        element
                    )
            );

        RingContainer.#reordering =
            true;

        try {
            const placeholders =
                ringsInDomOrder.map(
                    ring => {
                        const placeholder =
                            document.createComment(
                                "ring-container-reorder"
                            );

                        ring.replaceWith(
                            placeholder
                        );

                        return placeholder;
                    }
                );

            for (
                let index = 0;
                index <
                ringContainers.length;
                index++
            ) {
                placeholders[
                    index
                ].replaceWith(
                    ringContainers[
                        index
                    ]
                );
            }
        }
        finally {
            RingContainer.#reordering =
                false;
        }

        const reorderedRings =
            RingContainer.#getParentRings(
                parent
            );

        for (
            const ring of
            reorderedRings
        ) {
            ring.#parent =
                parent;
        }

        for (
            const ring of
            reorderedRings
        ) {
            const geometry =
                startingGeometry.get(
                    ring
                );

            if (geometry) {
                ring.#applyGeometryInstant(
                    geometry.inset,
                    geometry.width
                );
            }
        }

        if (
            RingContainer.#batchResizing
        ) {
            for (
                const ring of
                reorderedRings
            ) {
                ring.#resizePending =
                    true;

                ring.#reorderPending =
                    true;

                ring.#pendingLifecycleAction =
                    undefined;
            }

            return;
        }

        for (
            const ring of
            reorderedRings
        ) {
            ring.#startConfiguredAnimation(
                ring.#calculateEffectiveInset(),
                ring.#width ?? "0px",
                "reorder"
            );
        }
    }

    attributeChangedCallback(
        name,
        oldValue,
        newValue
    ) {
        if (
            oldValue === newValue ||
            this.#syncingAttribute
        ) {
            return;
        }

        if (
            newValue?.trim().toLowerCase() ===
                "calculated"
        ) {
            this.#syncingAttribute =
                true;

            try {
                if (oldValue === null) {
                    this.removeAttribute(name);
                }
                else {
                    this.setAttribute(
                        name,
                        oldValue
                    );
                }
            }
            finally {
                this.#syncingAttribute =
                    false;
            }

            return;
        }

        switch (name) {
            case "inset":
                this.inset = newValue;
                break;

            case "width":
                this.width = newValue;
                break;

            case "margin":
                this.margin = newValue;
                break;

            case "inner-margin":
                this.innerMargin = newValue;
                break;

            case "outer-margin":
                this.outerMargin = newValue;
                break;
        }
    }

    static #recalculateParent(
        parent,
        action,
        changedRing
    ) {
        if (!parent) {
            return;
        }

        const rings =
            RingContainer.#getParentRings(
                parent
            );

        for (
            const ring of rings
        ) {
            ring.#parent =
                parent;

            if (
                RingContainer.#batchResizing
            ) {
                ring.#resizePending =
                    true;

                ring.#reorderPending =
                    false;

                ring.#pendingLifecycleAction =
                    action;

                continue;
            }

            const force =
                action === "connect" &&
                ring === changedRing;

            ring.#startConfiguredAnimation(
                ring.#calculateEffectiveInset(),
                ring.#width ?? "0px",
                action,
                force
            );
        }
    }

    static #getParentRings(
        parent
    ) {
        if (!parent) {
            return [];
        }

        return Array.from(
            parent.children
        ).filter(
            element =>
                element instanceof
                RingContainer
        );
    }

    #scheduleResize() {
        if (
            RingContainer.#batchResizing
        ) {
            this.#resizePending =
                true;

            this.#pendingLifecycleAction =
                undefined;

            return;
        }

        this.#resizePending =
            false;

        this.#pendingLifecycleAction =
            undefined;

        this.#startConfiguredAnimation(
            this.#calculateEffectiveInset(),
            this.#width ?? "0px",
            "resize"
        );
    }

    #startConfiguredAnimation(
        targetInset,
        targetWidth,
        type,
        force = false
    ) {
        if (
            type === "resize" &&
            this.#animationPhase !==
                "idle" &&
            this.#animationResize &&
            this.#animationTargetInset ===
                targetInset &&
            this.#animationTargetWidth ===
                targetWidth
        ) {
            return;
        }

        let filter =
            "none";

        let frontRamp =
            "0ms";

        let endRamp =
            "0ms";

        let resize =
            false;

        let reorder =
            false;

        switch (type) {
            case "resize":
                resize = true;

                filter =
                    this.resizeFilter;

                if (
                    this.filterRamp
                ) {
                    frontRamp =
                        this.filterRampFront;

                    endRamp =
                        this.filterRampEnd;
                }

                break;

            case "reorder":
                resize = true;
                reorder = true;

                filter =
                    RingContainer.#combineFilters(
                        this.resizeFilter,
                        this.reorderFilter
                    );

                if (
                    this.filterRamp
                ) {
                    frontRamp =
                        this.filterRampFront;

                    endRamp =
                        this.filterRampEnd;
                }

                break;

            case "connect":
                resize = true;

                filter =
                    this.connectFilter;

                frontRamp =
                    this.filterRampConnect;

                endRamp =
                    this.filterRampConnect;

                break;

            case "disconnect":
                resize = true;

                filter =
                    this.disconnectFilter;

                frontRamp =
                    this.filterRampDisconnect;

                endRamp =
                    this.filterRampDisconnect;

                break;

            default:
                return;
        }

        this.#startAnimation(
            targetInset,
            targetWidth,
            {
                filter,
                frontRamp,
                endRamp,
                resize,
                reorder,
                force
            }
        );
    }

    #startAnimation(
        targetInset,
        targetWidth,
        options
    ) {
        const current =
            this.#getRenderedGeometry();

        const geometryChanged =
            current.inset !==
                targetInset ||
            current.width !==
                targetWidth;

        this.#cancelAnimation(
            false
        );

        this.#animationTargetInset =
            targetInset;

        this.#animationTargetWidth =
            targetWidth;

        this.#animationGeometryChanged =
            geometryChanged;

        this.#animationResize =
            options.resize;

        this.#animationReorder =
            options.reorder;

        this.#animationFilter =
            options.filter ??
            "none";

        this.#animationFrontRamp =
            options.frontRamp ??
            "0ms";

        this.#animationEndRamp =
            options.endRamp ??
            "0ms";

        this.#resizePending =
            false;

        this.#reorderPending =
            false;

        this.#pendingLifecycleAction =
            undefined;

        if (
            !geometryChanged &&
            !options.force
        ) {
            this.#finishAnimation();

            return;
        }

        if (
            this.#animationFilter !==
            "none" &&
            RingContainer.#timeToMilliseconds(
                this.#animationFrontRamp
            ) > 0
        ) {
            this.#startFrontRamp();

            return;
        }

        this.#container.style.filter =
            this.#animationFilter;

        this.#startGeometryAnimation();
    }

    #startFrontRamp() {
        clearTimeout(
            this.#phaseTimer
        );

        const token =
            ++this.#animationToken;

        this.#animationPhase =
            "front-ramp";

        this.#resizeActive =
            false;

        this.#reorderActive =
            false;

        const duration =
            this.#animationFrontRamp;

        const milliseconds =
            RingContainer.#timeToMilliseconds(
                duration
            );

        this.#setTransition(
            "none",
            "0ms"
        );

        this.#container.style.filter =
            "none";

        this.#container
            .getBoundingClientRect();

        this.#setTransition(
            "filter",
            duration
        );

        this.#container.style.filter =
            this.#animationFilter;

        if (
            milliseconds <= 0
        ) {
            this.#startGeometryAnimation();

            return;
        }

        this.#phaseTimer =
            setTimeout(
                () => {
                    if (
                        token !==
                        this.#animationToken
                    ) {
                        return;
                    }

                    this.#startGeometryAnimation();
                },
                milliseconds
            );
    }

    #startGeometryAnimation() {
        clearTimeout(
            this.#phaseTimer
        );

        const token =
            ++this.#animationToken;

        this.#animationPhase =
            "geometry";

        this.#resizeActive =
            this.#animationResize;

        this.#reorderActive =
            this.#animationReorder;

        if (
            !this.#animationGeometryChanged
        ) {
            this.#startEndRamp();

            return;
        }

        const duration =
            this.resizeDuration;

        const milliseconds =
            RingContainer.#timeToMilliseconds(
                duration
            );

        this.#setTransition(
            "--ring-container-inset, --ring-container-width",
            duration
        );

        this.#container.style.setProperty(
            "--ring-container-inset",
            this.#animationTargetInset
        );

        this.#container.style.setProperty(
            "--ring-container-width",
            this.#animationTargetWidth
        );

        this.#startChildGeometryRefresh();

        if (
            milliseconds <= 0
        ) {
            this.#startEndRamp();

            return;
        }

        this.#phaseTimer =
            setTimeout(
                () => {
                    if (
                        token !==
                        this.#animationToken
                    ) {
                        return;
                    }

                    this.#startEndRamp();
                },
                milliseconds
            );
    }

    #startEndRamp() {
        clearTimeout(
            this.#phaseTimer
        );

        this.#resizeActive =
            false;

        this.#reorderActive =
            false;

        if (
            this.#animationFilter ===
            "none"
        ) {
            this.#finishAnimation();

            return;
        }

        const milliseconds =
            RingContainer.#timeToMilliseconds(
                this.#animationEndRamp
            );

        if (
            milliseconds <= 0
        ) {
            this.#finishAnimation();

            return;
        }

        const token =
            ++this.#animationToken;

        this.#animationPhase =
            "end-ramp";

        this.#setTransition(
            "filter",
            this.#animationEndRamp
        );

        this.#container.style.filter =
            this.#animationFilter;

        this.#container
            .getBoundingClientRect();

        this.#container.style.filter =
            "none";

        this.#phaseTimer =
            setTimeout(
                () => {
                    if (
                        token !==
                        this.#animationToken
                    ) {
                        return;
                    }

                    this.#finishAnimation(
                        token
                    );
                },
                milliseconds
            );
    }

    #refreshChildVisualGeometry() {
        for (const child of this.children) {
            if (
                typeof child.refreshVisualGeometry ===
                    "function"
            ) {
                child.refreshVisualGeometry();
            }
        }
    }

    #startChildGeometryRefresh() {
        if (
            this.#geometryRefreshFrame !==
                undefined
        ) {
            cancelAnimationFrame(
                this.#geometryRefreshFrame
            );
        }

        const refresh = () => {
            if (
                this.#animationPhase !==
                    "geometry"
            ) {
                this.#geometryRefreshFrame =
                    undefined;

                return;
            }

            this.#refreshChildVisualGeometry();

            this.#geometryRefreshFrame =
                requestAnimationFrame(
                    refresh
                );
        };

        this.#refreshChildVisualGeometry();

        this.#geometryRefreshFrame =
            requestAnimationFrame(
                refresh
            );
    }

    #stopChildGeometryRefresh() {
        if (
            this.#geometryRefreshFrame ===
                undefined
        ) {
            return;
        }

        cancelAnimationFrame(
            this.#geometryRefreshFrame
        );

        this.#geometryRefreshFrame =
            undefined;
    }

    #finishAnimation(
        expectedToken
    ) {
        if (
            expectedToken !==
                undefined &&
            expectedToken !==
                this.#animationToken
        ) {
            return;
        }

        clearTimeout(
            this.#phaseTimer
        );

        this.#stopChildGeometryRefresh();

        ++this.#animationToken;

        this.#animationPhase =
            "idle";

        this.#resizeActive =
            false;

        this.#reorderActive =
            false;

        this.#animationResize =
            false;

        this.#animationReorder =
            false;

        this.#animationGeometryChanged =
            false;

        this.#animationTargetInset =
            undefined;

        this.#animationTargetWidth =
            undefined;

        this.#animationFilter =
            "none";

        this.#animationFrontRamp =
            "0ms";

        this.#animationEndRamp =
            "0ms";

        this.#container.style.filter =
            "none";

        this.#setTransition(
            "--ring-container-inset, --ring-container-width",
            this.resizeDuration
        );

        this.#refreshChildVisualGeometry();
    }

    #cancelAnimation(
        resetFilter = true
    ) {
        clearTimeout(
            this.#phaseTimer
        );

        this.#stopChildGeometryRefresh();

        ++this.#animationToken;

        this.#animationPhase =
            "idle";

        this.#resizeActive =
            false;

        this.#reorderActive =
            false;

        this.#animationResize =
            false;

        this.#animationReorder =
            false;

        this.#animationGeometryChanged =
            false;

        this.#animationTargetInset =
            undefined;

        this.#animationTargetWidth =
            undefined;

        this.#animationFilter =
            "none";

        this.#animationFrontRamp =
            "0ms";

        this.#animationEndRamp =
            "0ms";

        if (
            resetFilter
        ) {
            this.#setTransition(
                "none",
                "0ms"
            );

            this.#container.style.filter =
                "none";

            this.#container
                .getBoundingClientRect();

            this.#setTransition(
                "--ring-container-inset, --ring-container-width",
                this.resizeDuration
            );
        }
    }

    #freezeCurrentGeometry() {
        const geometry =
            this.#getRenderedGeometry();

        this.#cancelAnimation();

        this.#applyGeometryInstant(
            geometry.inset,
            geometry.width
        );
    }

    #getRenderedGeometry() {
        const computedStyle =
            getComputedStyle(
                this.#container
            );

        return {
            inset:
                computedStyle
                    .getPropertyValue(
                        "--ring-container-inset"
                    )
                    .trim() ||
                "0px",

            width:
                computedStyle
                    .getPropertyValue(
                        "--ring-container-width"
                    )
                    .trim() ||
                "0px"
        };
    }

    #applyGeometryInstant(
        inset,
        width
    ) {
        const transitionProperty =
            this.#container.style
                .transitionProperty;

        const transitionDuration =
            this.#container.style
                .transitionDuration;

        const transitionTimingFunction =
            this.#container.style
                .transitionTimingFunction;

        this.#container.style
            .transitionProperty =
            "none";

        this.#container.style
            .transitionDuration =
            "0ms";

        this.#container.style.setProperty(
            "--ring-container-inset",
            inset
        );

        this.#container.style.setProperty(
            "--ring-container-width",
            width
        );

        this.#container
            .getBoundingClientRect();

        this.#container.style
            .transitionProperty =
            transitionProperty;

        this.#container.style
            .transitionDuration =
            transitionDuration;

        this.#container.style
            .transitionTimingFunction =
            transitionTimingFunction;
    }

    #setTransition(
        property,
        duration
    ) {
        this.#container.style
            .transitionProperty =
            property;

        this.#container.style
            .transitionDuration =
            duration;

        this.#container.style
            .transitionTimingFunction =
            "linear";
    }

    #updateDuration() {
        this.#container.style.setProperty(
            "--ring-container-resize-duration",
            this.resizeDuration
        );

        if (
            this.#animationPhase ===
            "idle"
        ) {
            this.#setTransition(
                "--ring-container-inset, --ring-container-width",
                this.resizeDuration
            );
        }
    }

    #parentHasPendingReorder() {
        const parent =
            this.parentElement;

        if (!parent) {
            return false;
        }

        return Array.from(
            parent.children
        ).some(
            child =>
                child instanceof
                    RingContainer &&
                child.#reorderPending
        );
    }

    #markParentRingsPending() {
        const parent =
            this.parentElement;

        if (!parent) {
            return;
        }

        for (
            const child of
            parent.children
        ) {
            if (
                child instanceof
                RingContainer
            ) {
                child.#resizePending =
                    true;
            }
        }
    }

    #updateAutomaticFollowingRings(
        animate = true
    ) {
        let ring =
            this.#getNextRingContainer();

        while (ring) {
            if (
                ring.#usesAutomaticInset()
            ) {
                if (
                    RingContainer.#batchResizing
                ) {
                    ring.#resizePending =
                        true;

                    ring.#pendingLifecycleAction =
                        undefined;
                }
                else if (
                    animate
                ) {
                    ring.#startConfiguredAnimation(
                        ring.#calculateEffectiveInset(),
                        ring.#width ?? "0px",
                        "resize"
                    );
                }
                else {
                    ring.#updateProperties(
                        false
                    );
                }
            }

            ring =
                ring.#getNextRingContainer();
        }
    }

    #usesAutomaticInset() {
        return (
            this.#inset === null ||
            this.#inset === undefined ||
            this.#inset
                .trim()
                .toLowerCase() ===
                "auto"
        );
    }

    static #flushResizeBatch() {
        const rings =
            [
                ...RingContainer.#instances
            ].filter(
                ring =>
                    ring.isConnected &&
                    ring.#resizePending
            );

        const targets =
            rings.map(
                ring => ({
                    ring,

                    inset:
                        ring.#calculateEffectiveInset(),

                    width:
                        ring.#width ??
                        "0px",

                    reorder:
                        ring.#reorderPending,

                    lifecycle:
                        ring.#pendingLifecycleAction
                })
            );

        for (
            const target of
            targets
        ) {
            const {
                ring,
                inset,
                width,
                reorder,
                lifecycle
            } =
                target;

            ring.#resizePending =
                false;

            ring.#reorderPending =
                false;

            ring.#pendingLifecycleAction =
                undefined;

            if (
                lifecycle ===
                    "connect" ||
                lifecycle ===
                    "disconnect"
            ) {
                ring.#startConfiguredAnimation(
                    inset,
                    width,
                    lifecycle
                );

                continue;
            }

            ring.#startConfiguredAnimation(
                inset,
                width,
                reorder
                    ? "reorder"
                    : "resize"
            );
        }
    }

    #setLengthValue(
        name,
        value
    ) {
        const allowAuto =
            name === "inset";

        let original;

        if (
            value !== null &&
            value !== undefined
        ) {
            original =
                String(value).trim();

            if (
                original.toLowerCase() ===
                    "calculated"
            ) {
                return;
            }

            if (
                allowAuto &&
                original.toLowerCase() ===
                    "auto"
            ) {
                original = "auto";
            }
            else if (
                !RingContainer.#isValidLength(
                    original
                )
            ) {
                original = "0px";
            }
        }

        switch (name) {
            case "inset":
                this.#inset = original;
                break;

            case "width":
                this.#width = original;
                break;

            case "margin":
                this.#margin = original;
                break;

            case "inner-margin":
                this.#innerMargin = original;
                break;

            case "outer-margin":
                this.#outerMargin = original;
                break;
        }

        this.#syncingAttribute =
            true;

        try {
            if (
                original === undefined
            ) {
                this.removeAttribute(
                    name
                );
            }
            else {
                this.setAttribute(
                    name,
                    RingContainer.#isSimpleLength(
                        original
                    )
                        ? original
                        : "calculated"
                );
            }

            if (
                name === "margin" &&
                original !== undefined
            ) {
                this.#innerMargin =
                    undefined;

                this.#outerMargin =
                    undefined;

                this.removeAttribute(
                    "inner-margin"
                );

                this.removeAttribute(
                    "outer-margin"
                );
            }
        }
        finally {
            this.#syncingAttribute =
                false;
        }

        this.#afterLengthValueChange();
    }

    static #isSimpleLength(
        value
    ) {
        if (
            value === undefined ||
            value === null
        ) {
            return false;
        }

        const length =
            String(value).trim();

        if (!length) {
            return false;
        }

        let remaining =
            length.replace(
                /var\(\s*--[A-Za-z0-9_-]+(?:\s*,[^()]*)?\s*\)/g,
                ""
            );

        return !/[()\[\]{}+*\/]/.test(
            remaining
        ) &&
            !/(?:^|\s)-(?:\s|$)/.test(
                remaining
            );
    }

    #afterLengthValueChange() {
        if (
            !this.isConnected
        ) {
            this.#cancelAnimation();

            this.#resizePending =
                false;

            this.#reorderPending =
                false;

            this.#pendingLifecycleAction =
                undefined;

            this.#updateProperties(
                false
            );

            return;
        }

        if (
            this.#parentHasPendingReorder()
        ) {
            this.#markParentRingsPending();

            if (
                !RingContainer.#batchResizing
            ) {
                RingContainer.#flushResizeBatch();
            }

            return;
        }

        this.#scheduleResize();

        this.#updateAutomaticFollowingRings(
            true
        );
    }

    #normalizeLengthToPixels(
        value
    ) {
        const measure =
            document.createElement(
                "div"
            );

        measure.style.position =
            "absolute";

        measure.style.visibility =
            "hidden";

        measure.style.pointerEvents =
            "none";

        measure.style.marginLeft =
            value;

        this.#shadowRoot.appendChild(
            measure
        );

        const resolved =
            Number.parseFloat(
                getComputedStyle(
                    measure
                ).marginLeft
            );

        measure.remove();

        const pixels =
            Number.isFinite(resolved)
                ? resolved
                : 0;

        return `${pixels}px`;
    }

    #refreshNormalizedLengthAttributes() {
        this.#syncingAttribute =
            true;

        try {
            const values = [
                ["inset", this.#inset],
                ["width", this.#width],
                ["margin", this.#margin],
                ["inner-margin", this.#innerMargin],
                ["outer-margin", this.#outerMargin]
            ];

            for (
                const [name, original] of
                    values
            ) {
                if (
                    original === null ||
                    original === undefined
                ) {
                    continue;
                }

                const reflected =
                    RingContainer.#isSimpleLength(
                        original
                    )
                        ? original
                        : "calculated";

                if (
                    this.getAttribute(name) !==
                        reflected
                ) {
                    this.setAttribute(
                        name,
                        reflected
                    );
                }
            }
        }
        finally {
            this.#syncingAttribute =
                false;
        }
    }

    #startSizeObserver() {
        if (
            this.#sizeObserver ||
            typeof ResizeObserver ===
                "undefined"
        ) {
            return;
        }

        this.#sizeObserver =
            new ResizeObserver(
                () => {
                    if (
                        this.#animationPhase !==
                            "idle"
                    ) {
                        this.#refreshChildVisualGeometry();
                        return;
                    }

                    this.#updateProperties(
                        false
                    );

                    this.#updateAutomaticFollowingRings(
                        false
                    );

                    this.#refreshChildVisualGeometry();
                }
            );

        this.#sizeObserver.observe(
            this
        );
    }

    #stopSizeObserver() {
        if (
            !this.#sizeObserver
        ) {
            return;
        }

        this.#sizeObserver.disconnect();

        this.#sizeObserver =
            undefined;
    }

    #updateProperties(
        animate = true
    ) {
        const inset =
            this.#calculateEffectiveInset();

        const width =
            this.#width ??
            "0px";

        if (
            animate
        ) {
            this.#startConfiguredAnimation(
                inset,
                width,
                "resize"
            );

            return;
        }

        this.#applyGeometryInstant(
            inset,
            width
        );
    }

    #calculateEffectiveInset() {
        const inset =
            this.#inset;

        if (
            inset !== null &&
            inset
                .trim()
                .toLowerCase() !==
                "auto"
        ) {
            return inset;
        }

        const currentWidth =
            this.#width ??
            "0px";

        const previous =
            this.#getPreviousRingContainer();

        if (!previous) {
            return `
                calc(
                    ${this.#getOuterMargin()}
                    +
                    (${currentWidth} / 2)
                )
            `;
        }

        const previousInset =
            previous.#calculateEffectiveInset();

        const previousWidth =
            previous.#width ??
            "0px";

        const adjoiningMargin =
            RingContainer.#collapseMargins(
                previous.#getInnerMargin(),
                this.#getOuterMargin()
            );

        return `
            calc(
                (0px + ${previousInset})
                +
                (${previousWidth} / 2)
                +
                ${adjoiningMargin}
                +
                (${currentWidth} / 2)
            )
        `;
    }

    #getInnerMargin() {
        if (
            this.#innerMargin !==
                null &&
            this.#innerMargin !==
                undefined
        ) {
            return this.#innerMargin;
        }

        return (
            this.#margin ??
            "0px"
        );
    }

    #getOuterMargin() {
        if (
            this.#outerMargin !==
                null &&
            this.#outerMargin !==
                undefined
        ) {
            return this.#outerMargin;
        }

        return (
            this.#margin ??
            "0px"
        );
    }

    static #collapseMargins(
        first,
        second
    ) {
        return `
            calc(
                max(
                    0px,
                    ${first},
                    ${second}
                )
                +
                min(
                    0px,
                    ${first},
                    ${second}
                )
            )
        `;
    }

    #getPreviousRingContainer() {
        let sibling =
            this.previousElementSibling;

        while (sibling) {
            if (
                sibling instanceof
                    RingContainer
            ) {
                return sibling;
            }

            sibling =
                sibling
                    .previousElementSibling;
        }

        return null;
    }

    #getNextRingContainer() {
        let sibling =
            this.nextElementSibling;

        while (sibling) {
            if (
                sibling instanceof
                    RingContainer
            ) {
                return sibling;
            }

            sibling =
                sibling
                    .nextElementSibling;
        }

        return null;
    }

    static #updateInstanceDurations() {
        for (
            const ring of
            RingContainer.#instances
        ) {
            if (
                ring.isConnected
            ) {
                ring.#updateDuration();
            }
        }
    }

    static #combineFilters(
        ...filters
    ) {
        const result =
            filters
                .filter(
                    filter =>
                        filter &&
                        filter !==
                            "none"
                );

        if (
            result.length === 0
        ) {
            return "none";
        }

        return result.join(
            " "
        );
    }

    static #normalizeOptionalBoolean(
        value
    ) {
        if (
            value === undefined ||
            value === null
        ) {
            return undefined;
        }

        return Boolean(
            value
        );
    }

    static #normalizeOptionalTime(
        value
    ) {
        if (
            value === undefined ||
            value === null
        ) {
            return undefined;
        }

        const time =
            String(value).trim();

        if (
            !time ||
            !CSS.supports(
                "animation-duration",
                time
            ) ||
            !TemporalFormat.isCSSTime(
                time
            )
        ) {
            return undefined;
        }

        return time;
    }

    static #timeToMilliseconds(
        value
    ) {
        return (
            TemporalFormat.cssTimeToMilliseconds(
                String(value).trim()
            ) ?? 0
        );
    }

    static #normalizeOptionalFilter(
        value
    ) {
        if (
            value === undefined ||
            value === null
        ) {
            return undefined;
        }

        const filter =
            String(value).trim();

        if (
            !filter ||
            !CSS.supports(
                "filter",
                filter
            )
        ) {
            return undefined;
        }

        return filter;
    }

    static #isCalculatedLength(
        value
    ) {
        return /(?:^|\W)(?:calc|min|max|clamp|var)\(/i
            .test(
                String(value)
            );
    }

    static #isValidLength(
        value
    ) {
        if (
            value === undefined ||
            value === null
        ) {
            return false;
        }

        const length =
            String(value).trim();

        if (!length) {
            return false;
        }

        if (
            length
                .toLowerCase() ===
            "auto"
        ) {
            return false;
        }

        return CSS.supports(
            "margin-left",
            length
        );
    }

    #updateStyle() {
        this.#style.textContent = `
            :host {
                display: block;
                position: relative;

                width: 100%;
                height: 100%;

                min-width: 0;
                min-height: 0;

                box-sizing: border-box;
                overflow: hidden;

                background:
                    transparent !important;
            }

            #container {
                position: absolute;
                inset: 0;

                display: grid;

                width: 100%;
                height: 100%;

                min-width: 0;
                min-height: 0;

                box-sizing: border-box;

                background:
                    transparent !important;

                grid-template-columns:
                    minmax(0, 1fr);

                grid-template-rows:
                    minmax(0, 1fr);

                transition-property:
                    --ring-container-inset,
                    --ring-container-width;

                transition-duration:
                    var(
                        --ring-container-resize-duration
                    );

                transition-timing-function:
                    linear;

                filter: none;

                clip-path:
                    ${RingContainer.#calculateDonutShape(
                        "var(--ring-container-inset)",
                        "var(--ring-container-width)"
                    )};
            }

            :host([geometry-only]) {
                overflow: visible;
            }

            :host([geometry-only]) #container {
                inset:
                    calc(
                        var(--ring-container-inset)
                        +
                        (
                            var(--ring-container-width)
                            /
                            2
                        )
                    );

                width: auto;
                height: auto;

                overflow: visible;
                clip-path: none;
            }

            ::slotted(*) {
                grid-row: 1;
                grid-column: 1;

                min-width: 0;
                min-height: 0;
            }
        `;
    }

    static #registerProperties() {
        if (
            RingContainer
                .#propertiesRegistered
        ) {
            return;
        }

        try {
            CSS.registerProperty({
                name:
                    "--ring-container-inset",

                syntax:
                    "<length-percentage>",

                inherits:
                    false,

                initialValue:
                    "0px"
            });
        }
        catch (error) {
            if (
                error.name !==
                "InvalidModificationError"
            ) {
                throw error;
            }
        }

        try {
            CSS.registerProperty({
                name:
                    "--ring-container-width",

                syntax:
                    "<length-percentage>",

                inherits:
                    false,

                initialValue:
                    "0px"
            });
        }
        catch (error) {
            if (
                error.name !==
                "InvalidModificationError"
            ) {
                throw error;
            }
        }

        RingContainer.#propertiesRegistered =
            true;
    }

    static #calculateDonutShape(
        inset,
        width
    ) {
        const insetValue =
            inset ??
            "0px";

        const widthValue =
            width ??
            "0px";

        const outerHorizontalRadius = `
            calc(
                50% -
                ${insetValue} +
                (${widthValue} / 2)
            )
        `;

        const outerVerticalRadius = `
            calc(
                50% -
                ${insetValue} +
                (${widthValue} / 2)
            )
        `;

        const innerHorizontalRadius = `
            calc(
                50% -
                ${insetValue} -
                (${widthValue} / 2)
            )
        `;

        const innerVerticalRadius = `
            calc(
                50% -
                ${insetValue} -
                (${widthValue} / 2)
            )
        `;

        const outerX = `
            calc(
                ${outerHorizontalRadius}
                * 0.5
            )
        `;

        const outerY = `
            calc(
                ${outerVerticalRadius}
                * 0.8660254037844386
            )
        `;

        const innerX = `
            calc(
                ${innerHorizontalRadius}
                * 0.5
            )
        `;

        const innerY = `
            calc(
                ${innerVerticalRadius}
                * 0.8660254037844386
            )
        `;

        return `
            shape(
                evenodd from
                    calc(
                        50% -
                        ${outerHorizontalRadius}
                    )
                    50%,

                arc to
                    calc(
                        50% +
                        ${outerX}
                    )
                    calc(
                        50% -
                        ${outerY}
                    )
                    of
                    ${outerHorizontalRadius}
                    ${outerVerticalRadius}
                    small cw,

                arc to
                    calc(
                        50% +
                        ${outerX}
                    )
                    calc(
                        50% +
                        ${outerY}
                    )
                    of
                    ${outerHorizontalRadius}
                    ${outerVerticalRadius}
                    small cw,

                arc to
                    calc(
                        50% -
                        ${outerHorizontalRadius}
                    )
                    50%
                    of
                    ${outerHorizontalRadius}
                    ${outerVerticalRadius}
                    small cw,

                close,

                move to
                    calc(
                        50% -
                        ${innerHorizontalRadius}
                    )
                    50%,

                arc to
                    calc(
                        50% +
                        ${innerX}
                    )
                    calc(
                        50% +
                        ${innerY}
                    )
                    of
                    ${innerHorizontalRadius}
                    ${innerVerticalRadius}
                    small ccw,

                arc to
                    calc(
                        50% +
                        ${innerX}
                    )
                    calc(
                        50% -
                        ${innerY}
                    )
                    of
                    ${innerHorizontalRadius}
                    ${innerVerticalRadius}
                    small ccw,

                arc to
                    calc(
                        50% -
                        ${innerHorizontalRadius}
                    )
                    50%
                    of
                    ${innerHorizontalRadius}
                    ${innerVerticalRadius}
                    small ccw,

                close
            )
        `;
    }
}

customElements.define(
    "ring-container",
    RingContainer
);