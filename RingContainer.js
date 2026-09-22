class RingLayer extends HTMLElement {}

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

    #rangeLayers = new Map();
    #rangeObserver;
    #parentObserver;

    #rangeAnimations = new Map();
    #rangeLayerAnimations = new Map();
    #rangeVisualState = new WeakMap();
    #suspendedRanges = new WeakSet();

    static #rangeEpsilon = 1e-7;
    static #millisecondsInHour =
        60 * 60 * 1000;

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
        "outer-margin",
        "active"
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

        slot.id =
            "content";

        this.#container.appendChild(
            slot
        );

        for (
            const layerName of
                [
                    "base",
                    "elapsed",
                    "remaining",
                    "wave"
                ]
        ) {
            this.#ensureRangeLayer(
                layerName
            );
        }

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

        this.addEventListener(
            "time-ranges-changed",
            event =>
                this.#handleTimeRangesChanged(
                    event
                )
        );
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

        this.#normalizeRangeLayers();
        this.#startRangeObserver();
        this.#startParentObserver();
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
        this.#stopRangeObserver();
        this.#stopParentObserver();
        this.#cancelRangeAnimations();

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


    appendChild(
        node
    ) {
        if (
            node?.nodeType === 1 &&
            node.localName ===
                "time-range"
        ) {
            this.#assignRangeLayer(
                node
            );

            this.#updateRangeRendererState(
                true
            );
        }

        return super.appendChild(
            node
        );
    }

    insertBefore(
        node,
        referenceNode
    ) {
        if (
            node?.nodeType === 1 &&
            node.localName ===
                "time-range"
        ) {
            this.#assignRangeLayer(
                node
            );

            this.#updateRangeRendererState(
                true
            );
        }

        return super.insertBefore(
            node,
            referenceNode
        );
    }

    getLayerRanges(
        rangeOrLayer
    ) {
        const layerName =
            typeof rangeOrLayer ===
                "string"
                ? rangeOrLayer
                : this.#getRangeLayerName(
                    rangeOrLayer
                );

        return Array.from(
            this.children
        ).filter(
            range =>
                range.localName ===
                    "time-range" &&
                this.#getRangeLayerName(
                    range
                ) === layerName
        );
    }

    getCollisionRanges(
        source
    ) {
        return this.getLayerRanges(
            source
        ).filter(
            range =>
                range !== source &&
                range.timeRangeExiting !==
                    true
        );
    }

    suspendRangeRendering(
        range
    ) {
        if (!range) {
            return;
        }

        range.clockTimerRangeRenderingSuspended =
            true;

        this.#suspendedRanges.add(
            range
        );

        this.#cancelRangeAnimation(
            range
        );
    }

    resumeRangeRendering(
        range
    ) {
        if (!range) {
            return;
        }

        delete range
            .clockTimerRangeRenderingSuspended;

        this.#suspendedRanges.delete(
            range
        );
    }

    calculateRangeLayout(
        range,
        {
            start,
            end,
            originMilliseconds,
            fittedBounds
        } = {}
    ) {
        if (
            !range ||
            range.localName !==
                "time-range"
        ) {
            return;
        }

        const logicalStart =
            this.#coerceRangeTime(
                start ??
                range.startTime
            );

        const logicalEnd =
            this.#coerceRangeTime(
                end ??
                range.endTime
            );

        if (
            !Number.isFinite(
                logicalStart
            ) ||
            !Number.isFinite(
                logicalEnd
            ) ||
            logicalEnd <
                logicalStart
        ) {
            return;
        }

        const duration =
            logicalEnd -
            logicalStart;

        let startAngle;
        let endAngle;
        let origin;

        const bounds =
            fittedBounds &&
            Number.isFinite(
                fittedBounds.start
            ) &&
            Number.isFinite(
                fittedBounds.duration
            ) &&
            fittedBounds.duration > 0
                ? {
                    start:
                        fittedBounds.start,
                    end:
                        fittedBounds.end,
                    duration:
                        fittedBounds.duration
                }
                : undefined;

        if (bounds) {
            const degreesPerMillisecond =
                360 /
                bounds.duration;

            startAngle =
                (
                    logicalStart -
                    bounds.start
                ) *
                degreesPerMillisecond;

            endAngle =
                (
                    logicalEnd -
                    bounds.start
                ) *
                degreesPerMillisecond;

            startAngle =
                Math.max(
                    0,
                    Math.min(
                        360,
                        startAngle
                    )
                );

            endAngle =
                Math.max(
                    0,
                    Math.min(
                        360,
                        endAngle
                    )
                );

            origin =
                bounds.start;
        }
        else {
            origin =
                Number.isFinite(
                    originMilliseconds
                )
                    ? originMilliseconds
                    : this.#getRangeOriginMilliseconds(
                        range,
                        logicalStart
                    );

            startAngle =
                RingContainer
                    .calculateTimeAngle(
                        logicalStart,
                        origin
                    );

            endAngle =
                RingContainer
                    .calculateTimeAngle(
                        logicalEnd,
                        origin
                    );

            if (
                duration >=
                    RingContainer
                        .#millisecondsInHour
            ) {
                endAngle =
                    startAngle +
                    360;
            }
        }

        if (
            !Number.isFinite(
                startAngle
            ) ||
            !Number.isFinite(
                endAngle
            )
        ) {
            return;
        }

        const layer =
            this.#getRangeLayerLayout(
                range
            );

        const clipPath =
            RingContainer
                .calculateAnnularClipPath({
                    startAngle,
                    endAngle,
                    inset:
                        this.renderedInset ??
                        this.#inset ??
                        "0px",
                    radialWidth:
                        layer.radialWidth
                });

        if (
            typeof clipPath !==
                "string"
        ) {
            return;
        }

        return {
            clipPath,
            startAngle,
            endAngle,
            duration,
            start:
                logicalStart,
            end:
                logicalEnd,
            originMilliseconds:
                origin,
            fittedBounds:
                bounds,
            layerName:
                layer.layerName,
            radialWidth:
                layer.radialWidth,
            zIndex:
                layer.zIndex
        };
    }

    applyRangeLayout(
        range,
        layout,
        {
            commit = false
        } = {}
    ) {
        if (
            !range ||
            !layout ||
            typeof layout.clipPath !==
                "string"
        ) {
            return false;
        }

        range.style.clipPath =
            layout.clipPath;

        range.style.zIndex =
            String(
                layout.zIndex ?? 0
            );

        range.style.setProperty(
            "--ring-layer-radial-width",
            layout.radialWidth ??
                this.renderedWidth ??
                "0px"
        );

        this.#updateWaveGeometry(
            range,
            layout.startAngle,
            layout.endAngle,
            layout.duration
        );

        this.#rangeVisualState.set(
            range,
            {
                start:
                    layout.start,
                end:
                    layout.end,
                originMilliseconds:
                    layout.originMilliseconds,
                fittedBounds:
                    layout.fittedBounds,
                clipPath:
                    layout.clipPath
            }
        );

        if (commit) {
            this.#cancelRangeAnimation(
                range
            );
        }

        return true;
    }

    refreshRangeGeometry(
        range
    ) {
        if (
            !range ||
            this.#isRangeRenderingSuspended(
                range
            )
        ) {
            return false;
        }

        let layout;

        if (
            this.clockTimerExternalRangeLayout ===
                true
        ) {
            const state =
                this.#rangeVisualState.get(
                    range
                );

            if (
                !state ||
                !Number.isFinite(
                    state.start
                ) ||
                !Number.isFinite(
                    state.end
                )
            ) {
                return false;
            }

            layout =
                this.calculateRangeLayout(
                    range,
                    state
                );
        }
        else {
            layout =
                this.calculateRangeLayout(
                    range
                );
        }

        return layout
            ? this.applyRangeLayout(
                range,
                layout,
                {
                    commit: true
                }
            )
            : false;
    }

    snapRangeGeometry(
        range
    ) {
        return this.refreshRangeGeometry(
            range
        );
    }

    animateRangeFromCollapsed(
        range,
        value
    ) {
        const collapsed =
            this.#coerceRangeTime(
                value
            );

        const targetStart =
            this.#coerceRangeTime(
                range?.startTime
            );

        const targetEnd =
            this.#coerceRangeTime(
                range?.endTime
            );

        if (
            !Number.isFinite(
                collapsed
            ) ||
            !Number.isFinite(
                targetStart
            ) ||
            !Number.isFinite(
                targetEnd
            )
        ) {
            return false;
        }

        return this.#animateRangeInterval(
            range,
            collapsed,
            collapsed,
            targetStart,
            targetEnd
        );
    }

    removeRangeAnimated(
        range,
        {
            collapseTo = "end",
            targetStart,
            targetEnd
        } = {}
    ) {
        if (!range) {
            return false;
        }

        range.timeRangeExiting =
            true;

        const visual =
            this.#rangeVisualState.get(
                range
            );

        const logicalStart =
            this.#coerceRangeTime(
                range.startTime
            );

        const logicalEnd =
            this.#coerceRangeTime(
                range.endTime
            );

        const fromStart =
            Number.isFinite(
                visual?.start
            )
                ? visual.start
                : logicalStart;

        const fromEnd =
            Number.isFinite(
                visual?.end
            )
                ? visual.end
                : logicalEnd;

        let finalStart =
            this.#coerceRangeTime(
                targetStart
            );

        let finalEnd =
            this.#coerceRangeTime(
                targetEnd
            );

        if (
            !Number.isFinite(
                finalStart
            ) ||
            !Number.isFinite(
                finalEnd
            )
        ) {
            const collapse =
                collapseTo ===
                    "start"
                    ? fromStart
                    : fromEnd;

            finalStart =
                collapse;

            finalEnd =
                collapse;
        }

        const finish =
            () => {
                this.#rangeVisualState.delete(
                    range
                );

                const layerAnimation =
                    this.#rangeLayerAnimations
                        .get(
                            range
                        );

                layerAnimation
                    ?.cancel?.();

                this.#rangeLayerAnimations.delete(
                    range
                );

                if (
                    range.parentElement ===
                        this
                ) {
                    super.removeChild(
                        range
                    );
                }

                this.#updateRangeRendererState();
            };

        return this.#animateRangeInterval(
            range,
            fromStart,
            fromEnd,
            finalStart,
            finalEnd,
            {
                removeAfter:
                    finish
            }
        );
    }

    pauseRangeAnimation(
        range
    ) {
        range?.style.setProperty(
            "--elapsed-wave-play-state",
            "paused"
        );
    }

    refreshLayerLayout({
        animate = false,
        duration = 333
    } = {}) {
        for (
            const range of
                this.children
        ) {
            if (
                range.localName !==
                    "time-range" ||
                range.timeRangeExiting ===
                    true ||
                this.#isRangeRenderingSuspended(
                    range
                )
            ) {
                continue;
            }

            const state =
                this.#rangeVisualState.get(
                    range
                );

            const layout =
                state
                    ? this.calculateRangeLayout(
                        range,
                        state
                    )
                    : this.calculateRangeLayout(
                        range
                    );

            if (!layout) {
                continue;
            }

            const fromClipPath =
                range.style.clipPath ||
                getComputedStyle(
                    range
                ).clipPath;

            this.applyRangeLayout(
                range,
                layout
            );

            if (
                !animate ||
                typeof range.animate !==
                    "function" ||
                !fromClipPath ||
                fromClipPath ===
                    "none" ||
                fromClipPath ===
                    layout.clipPath
            ) {
                continue;
            }

            const previous =
                this.#rangeLayerAnimations
                    .get(
                        range
                    );

            previous?.cancel?.();

            const animation =
                range.animate(
                    [
                        {
                            clipPath:
                                fromClipPath
                        },
                        {
                            clipPath:
                                layout.clipPath
                        }
                    ],
                    {
                        duration:
                            Math.max(
                                0,
                                Number(
                                    duration
                                ) || 0
                            ),
                        easing:
                            "ease-in-out",
                        fill:
                            "both"
                    }
                );

            this.#rangeLayerAnimations.set(
                range,
                animation
            );

            Promise.resolve(
                animation.finished
            )
                .finally(
                    () => {
                        if (
                            this.#rangeLayerAnimations
                                .get(
                                    range
                                ) !== animation
                        ) {
                            return;
                        }

                        this.#rangeLayerAnimations
                            .delete(
                                range
                            );

                        animation.cancel();
                    }
                )
                .catch(
                    () => {}
                );
        }
    }

    static calculateTimeAngle(
        time,
        origin
    ) {
        const timeMilliseconds =
            time instanceof Date
                ? time.getTime()
                : Number(time);

        const originMilliseconds =
            origin instanceof Date
                ? origin.getTime()
                : Number(origin);

        if (
            !Number.isFinite(
                timeMilliseconds
            )
        ) {
            return;
        }

        let milliseconds;

        if (
            Number.isFinite(
                originMilliseconds
            )
        ) {
            const difference =
                timeMilliseconds -
                originMilliseconds;

            if (
                difference >= 0 &&
                difference <=
                    RingContainer
                        .#millisecondsInHour
            ) {
                milliseconds =
                    difference;
            }
            else {
                milliseconds =
                    (
                        difference %
                            RingContainer
                                .#millisecondsInHour +
                        RingContainer
                            .#millisecondsInHour
                    ) %
                    RingContainer
                        .#millisecondsInHour;
            }
        }
        else {
            const date =
                time instanceof Date
                    ? time
                    : new Date(
                        timeMilliseconds
                    );

            milliseconds =
                date.getMinutes() *
                    60 *
                    1000 +
                date.getSeconds() *
                    1000 +
                date.getMilliseconds();
        }

        return (
            360 /
            RingContainer
                .#millisecondsInHour
        ) *
        milliseconds;
    }

    static calculateAnnularClipPath({
        startAngle,
        endAngle,
        inset = "0px",
        radialWidth = "0px"
    } = {}) {
        if (
            !Number.isFinite(
                startAngle
            ) ||
            !Number.isFinite(
                endAngle
            )
        ) {
            return;
        }

        const rawSweep =
            endAngle -
            startAngle;

        const absoluteSweep =
            Math.abs(
                rawSweep
            );

        const fullCircle =
            absoluteSweep >=
                360 -
                RingContainer
                    .#rangeEpsilon;

        let sweep =
            (
                rawSweep %
                    360 +
                360
            ) %
            360;

        if (fullCircle) {
            sweep = 360;
        }
        else if (
            Math.abs(
                sweep
            ) <=
                RingContainer
                    .#rangeEpsilon
        ) {
            return (
                "polygon(" +
                "50% 50%, " +
                "50% 50%, " +
                "50% 50%" +
                ")"
            );
        }

        const semicircle =
            Math.abs(
                sweep -
                180
            ) <=
                RingContainer
                    .#rangeEpsilon;

        const arcSize =
            semicircle ||
            sweep >
                180 +
                RingContainer
                    .#rangeEpsilon
                ? "large"
                : "small";

        const insetValue =
            inset ??
            "0px";

        const widthValue =
            radialWidth ??
            "0px";

        const outerRadius =
            `max(
                0px,
                calc(
                    50% -
                    (${insetValue}) +
                    ((${widthValue}) / 2)
                )
            )`;

        const innerRadius =
            `max(
                0px,
                calc(
                    50% -
                    (${insetValue}) -
                    ((${widthValue}) / 2)
                )
            )`;

        const point =
            (
                angle,
                radius
            ) => {
                const radians =
                    angle *
                    Math.PI /
                    180;

                const clean =
                    value => {
                        if (
                            Math.abs(
                                value
                            ) <=
                                RingContainer
                                    .#rangeEpsilon
                        ) {
                            return 0;
                        }

                        if (
                            Math.abs(
                                Math.abs(
                                    value
                                ) -
                                1
                            ) <=
                                RingContainer
                                    .#rangeEpsilon
                        ) {
                            return value < 0
                                ? -1
                                : 1;
                        }

                        return Number(
                            value.toFixed(
                                12
                            )
                        );
                    };

                const x =
                    clean(
                        Math.sin(
                            radians
                        )
                    );

                const y =
                    clean(
                        Math.cos(
                            radians
                        )
                    );

                return {
                    x:
                        `calc(
                            50% +
                            (${radius}) *
                            ${x}
                        )`,

                    y:
                        `calc(
                            50% -
                            (${radius}) *
                            ${y}
                        )`
                };
            };

        const outerStart =
            point(
                startAngle,
                outerRadius
            );

        const innerStart =
            point(
                startAngle,
                innerRadius
            );

        if (fullCircle) {
            const middleAngle =
                startAngle +
                180;

            const outerMiddle =
                point(
                    middleAngle,
                    outerRadius
                );

            const innerMiddle =
                point(
                    middleAngle,
                    innerRadius
                );

            return `
                shape(
                    evenodd from
                        ${outerStart.x}
                        ${outerStart.y},

                    arc to
                        ${outerMiddle.x}
                        ${outerMiddle.y}
                        of
                        ${outerRadius}
                        ${outerRadius}
                        large cw,

                    arc to
                        ${outerStart.x}
                        ${outerStart.y}
                        of
                        ${outerRadius}
                        ${outerRadius}
                        large cw,

                    line to
                        ${innerStart.x}
                        ${innerStart.y},

                    arc to
                        ${innerMiddle.x}
                        ${innerMiddle.y}
                        of
                        ${innerRadius}
                        ${innerRadius}
                        large ccw,

                    arc to
                        ${innerStart.x}
                        ${innerStart.y}
                        of
                        ${innerRadius}
                        ${innerRadius}
                        large ccw,

                    close
                )
            `;
        }

        const finishAngle =
            startAngle +
            sweep;

        const outerEnd =
            point(
                finishAngle,
                outerRadius
            );

        const innerEnd =
            point(
                finishAngle,
                innerRadius
            );

        return `
            shape(
                evenodd from
                    ${outerStart.x}
                    ${outerStart.y},

                arc to
                    ${outerEnd.x}
                    ${outerEnd.y}
                    of
                    ${outerRadius}
                    ${outerRadius}
                    ${arcSize} cw,

                line to
                    ${innerEnd.x}
                    ${innerEnd.y},

                arc to
                    ${innerStart.x}
                    ${innerStart.y}
                    of
                    ${innerRadius}
                    ${innerRadius}
                    ${arcSize} ccw,

                close
            )
        `;
    }

    snapGeometry() {
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

        this.#updateAutomaticFollowingRings(
            false
        );

        this.#refreshChildVisualGeometry();

        return this;
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

            case "active":
                this.refreshLayerLayout({
                    animate:
                        true,

                    duration:
                        this.#getRangeAnimationDuration()
                });
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
                    RingContainer &&
                element.clockTimerLayoutDetached !==
                    true
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


    #ensureRangeLayer(
        layerName
    ) {
        if (
            this.#rangeLayers.has(
                layerName
            )
        ) {
            return this.#rangeLayers.get(
                layerName
            );
        }

        const layer =
            document.createElement(
                "ring-layer"
            );

        layer.setAttribute(
            "data-layer",
            layerName
        );

        const slot =
            document.createElement(
                "slot"
            );

        slot.name =
            this.#getRangeSlotName(
                layerName
            );

        layer.appendChild(
            slot
        );

        this.#container.appendChild(
            layer
        );

        const record = {
            name:
                layerName,
            element:
                layer,
            slot
        };

        this.#rangeLayers.set(
            layerName,
            record
        );

        return record;
    }

    #getRangeSlotName(
        layerName
    ) {
        return `ring-layer-${layerName}`;
    }

    #getRangeLayerName(
        range
    ) {
        const type =
            String(
                range?.getAttribute?.(
                    "type"
                ) ??
                ""
            )
                .trim()
                .toLowerCase();

        switch (type) {
            case "elapsed":
                return "elapsed";

            case "remaining":
                return "remaining";

            case "wave":
                return "wave";

            default:
                return "base";
        }
    }

    #assignRangeLayer(
        range
    ) {
        if (
            !range ||
            range.localName !==
                "time-range"
        ) {
            return;
        }

        const layerName =
            this.#getRangeLayerName(
                range
            );

        this.#ensureRangeLayer(
            layerName
        );

        const slotName =
            this.#getRangeSlotName(
                layerName
            );

        if (
            range.getAttribute(
                "slot"
            ) !== slotName
        ) {
            range.setAttribute(
                "slot",
                slotName
            );
        }
    }

    #normalizeRangeLayers() {
        for (
            const range of
                this.children
        ) {
            if (
                range.localName ===
                    "time-range"
            ) {
                this.#assignRangeLayer(
                    range
                );
            }
        }

        this.#updateRangeRendererState();
    }

    #updateRangeRendererState(
        force = false
    ) {
        const hasRanges =
            force ||
            Array.from(
                this.children
            ).some(
                child =>
                    child.localName ===
                        "time-range"
            );

        this.toggleAttribute(
            "range-renderer",
            hasRanges
        );
    }

    #getRangeLayerLayout(
        range
    ) {
        const layerName =
            this.#getRangeLayerName(
                range
            );

        const fullWidth =
            this.renderedWidth ??
            this.#width ??
            "0px";

        const active =
            this.hasAttribute(
                "active"
            );

        const timerMode =
            this.#parent
                ?.getAttribute?.(
                    "timer-mode"
                ) === "remaining"
                ? "remaining"
                : "elapsed";

        let radialWidth =
            fullWidth;

        let zIndex =
            0;

        if (
            layerName ===
                "elapsed" ||
            layerName ===
                "remaining"
        ) {
            const dominant =
                layerName ===
                    timerMode;

            if (
                active &&
                !dominant
            ) {
                radialWidth =
                    `min(
                        ${fullWidth},
                        var(
                            --clock-timer-inactive-ring-width,
                            calc(
                                ${fullWidth} / 2
                            )
                        )
                    )`;
            }

            zIndex =
                active &&
                !dominant
                    ? 20
                    : 10;
        }
        else if (
            layerName ===
                "wave"
        ) {
            zIndex = 30;
        }

        return {
            layerName,
            radialWidth,
            zIndex
        };
    }

    #coerceRangeTime(
        value
    ) {
        if (
            value instanceof Date
        ) {
            return value.getTime();
        }

        if (
            typeof value ===
                "number"
        ) {
            return Number.isFinite(
                value
            )
                ? value
                : undefined;
        }

        if (
            typeof value ===
                "string"
        ) {
            const trimmed =
                value.trim();

            const numeric =
                Number(
                    trimmed
                );

            if (
                trimmed !== "" &&
                Number.isFinite(
                    numeric
                ) &&
                /^[-+]?\d+(?:\.\d+)?$/.test(
                    trimmed
                )
            ) {
                return numeric;
            }

            const parsed =
                TemporalFormat.parseDateTime(
                    value,
                    new Date()
                );

            if (
                parsed instanceof Date &&
                !Number.isNaN(
                    parsed.getTime()
                )
            ) {
                return parsed.getTime();
            }
        }

        return undefined;
    }

    #getRangeOriginMilliseconds(
        range,
        fallbackStart
    ) {
        let earliest =
            Number.isFinite(
                fallbackStart
            )
                ? fallbackStart
                : undefined;

        for (
            const child of
                this.children
        ) {
            if (
                child.localName !==
                    "time-range" ||
                child.timeRangeExiting ===
                    true
            ) {
                continue;
            }

            const start =
                this.#coerceRangeTime(
                    child.startTime
                );

            if (
                Number.isFinite(
                    start
                ) &&
                (
                    !Number.isFinite(
                        earliest
                    ) ||
                    start <
                        earliest
                )
            ) {
                earliest =
                    start;
            }
        }

        if (
            !Number.isFinite(
                earliest
            )
        ) {
            return 0;
        }

        return (
            Math.floor(
                earliest /
                RingContainer
                    .#millisecondsInHour
            ) *
            RingContainer
                .#millisecondsInHour
        );
    }

    #isRangeRenderingSuspended(
        range
    ) {
        return (
            this.#suspendedRanges.has(
                range
            ) ||
            range
                ?.clockTimerRangeRenderingSuspended ===
                    true
        );
    }

    #getRangeAnimationDuration() {
        return (
            RingContainer
                .#timeToMilliseconds(
                    this.resizeDuration
                ) ??
            333
        );
    }

    #cancelRangeAnimation(
        range
    ) {
        const state =
            this.#rangeAnimations.get(
                range
            );

        if (!state) {
            return;
        }

        if (
            state.frame !==
                undefined
        ) {
            cancelAnimationFrame(
                state.frame
            );
        }

        this.#rangeAnimations.delete(
            range
        );
    }

    #cancelRangeAnimations() {
        for (
            const range of
                this.#rangeAnimations
                    .keys()
        ) {
            this.#cancelRangeAnimation(
                range
            );
        }

        for (
            const animation of
                this.#rangeLayerAnimations
                    .values()
        ) {
            animation?.cancel?.();
        }

        this.#rangeLayerAnimations.clear();
    }

    #animateRangeInterval(
        range,
        fromStart,
        fromEnd,
        targetStart,
        targetEnd,
        {
            removeAfter
        } = {}
    ) {
        if (
            !range ||
            ![
                fromStart,
                fromEnd,
                targetStart,
                targetEnd
            ].every(
                Number.isFinite
            )
        ) {
            return false;
        }

        this.#cancelRangeAnimation(
            range
        );

        const duration =
            this.#getRangeAnimationDuration();

        const previous =
            this.#rangeVisualState.get(
                range
            );

        const originMilliseconds =
            Number.isFinite(
                previous
                    ?.originMilliseconds
            )
                ? previous
                    .originMilliseconds
                : this.#getRangeOriginMilliseconds(
                    range,
                    Math.min(
                        fromStart,
                        targetStart
                    )
                );

        const fittedBounds =
            previous
                ?.fittedBounds;

        const apply =
            (
                start,
                end,
                commit = false
            ) => {
                const layout =
                    this.calculateRangeLayout(
                        range,
                        {
                            start,
                            end,
                            originMilliseconds,
                            fittedBounds
                        }
                    );

                if (!layout) {
                    return false;
                }

                return this.applyRangeLayout(
                    range,
                    layout,
                    {
                        commit
                    }
                );
            };

        if (
            duration <= 0 ||
            typeof requestAnimationFrame !==
                "function"
        ) {
            apply(
                targetStart,
                targetEnd,
                true
            );

            removeAfter?.();

            return true;
        }

        const state = {
            frame:
                undefined,
            startedAt:
                undefined
        };

        this.#rangeAnimations.set(
            range,
            state
        );

        const step =
            timestamp => {
                if (
                    this.#rangeAnimations.get(
                        range
                    ) !== state
                ) {
                    return;
                }

                if (
                    state.startedAt ===
                        undefined
                ) {
                    state.startedAt =
                        timestamp;
                }

                const progress =
                    Math.min(
                        1,
                        Math.max(
                            0,
                            (
                                timestamp -
                                state.startedAt
                            ) /
                            duration
                        )
                    );

                const start =
                    fromStart +
                    (
                        targetStart -
                        fromStart
                    ) *
                    progress;

                const end =
                    fromEnd +
                    (
                        targetEnd -
                        fromEnd
                    ) *
                    progress;

                apply(
                    start,
                    end,
                    progress >= 1
                );

                if (
                    progress >= 1
                ) {
                    this.#rangeAnimations.delete(
                        range
                    );

                    removeAfter?.();

                    return;
                }

                state.frame =
                    requestAnimationFrame(
                        step
                    );
            };

        state.frame =
            requestAnimationFrame(
                step
            );

        return true;
    }

    #handleTimeRangesChanged(
        event
    ) {
        const detail =
            event.detail;

        if (
            !detail ||
            !Array.isArray(
                detail.changes
            )
        ) {
            return;
        }

        const sourceChange =
            detail.changes.find(
                change =>
                    change.range ===
                        detail.source
            );

        const sourceTiming =
            sourceChange
                ?.after ??
            sourceChange
                ?.before;

        for (
            const change of
                detail.changes
        ) {
            const range =
                change.range;

            if (
                !range ||
                range.parentElement !==
                    this
            ) {
                continue;
            }

            if (
                change.after ===
                    null
            ) {
                this.removeRangeAnimated(
                    range,
                    {
                        targetStart:
                            sourceTiming
                                ?.startTime,

                        targetEnd:
                            sourceTiming
                                ?.endTime
                    }
                );

                continue;
            }

            if (
                this.#isRangeRenderingSuspended(
                    range
                ) ||
                this.clockTimerExternalRangeLayout ===
                    true
            ) {
                continue;
            }

            if (
                change.before ===
                    null
            ) {
                const fullEntry =
                    range.timeRangeFullEntry ===
                        true ||
                    range.hasAttribute(
                        "data-time-range-full-entry"
                    );

                if (fullEntry) {
                    delete range
                        .timeRangeFullEntry;

                    range.removeAttribute(
                        "data-time-range-full-entry"
                    );

                    this.refreshRangeGeometry(
                        range
                    );
                }
                else {
                    this.animateRangeFromCollapsed(
                        range,
                        change.after
                            ?.startTime
                    );
                }

                continue;
            }

            const beforeStart =
                this.#coerceRangeTime(
                    change.before
                        ?.startTime
                );

            const beforeEnd =
                this.#coerceRangeTime(
                    change.before
                        ?.endTime
                );

            const afterStart =
                this.#coerceRangeTime(
                    change.after
                        ?.startTime
                );

            const afterEnd =
                this.#coerceRangeTime(
                    change.after
                        ?.endTime
                );

            if (
                [
                    beforeStart,
                    beforeEnd,
                    afterStart,
                    afterEnd
                ].every(
                    Number.isFinite
                )
            ) {
                this.#animateRangeInterval(
                    range,
                    beforeStart,
                    beforeEnd,
                    afterStart,
                    afterEnd
                );
            }
            else {
                this.refreshRangeGeometry(
                    range
                );
            }
        }
    }

    #updateWaveGeometry(
        range,
        startAngle,
        endAngle,
        duration
    ) {
        if (
            range?.getAttribute(
                "type"
            ) !==
                "wave" ||
            !Number.isFinite(
                startAngle
            ) ||
            !Number.isFinite(
                endAngle
            ) ||
            !Number.isFinite(
                duration
            )
        ) {
            return;
        }

        const sweepEndAngle =
            duration > 0 &&
            endAngle <=
                startAngle
                ? endAngle + 360
                : endAngle;

        const sweepAngle =
            duration >=
                RingContainer
                    .#millisecondsInHour
                ? 360
                : Math.max(
                    0,
                    sweepEndAngle -
                    startAngle
                );

        const waveWidth =
            Math.max(
                1.5,
                Math.min(
                    38,
                    sweepAngle *
                        0.4
                )
            );

        range.style.setProperty(
            "--elapsed-wave-width",
            `${waveWidth}deg`
        );

        range.style.setProperty(
            "--elapsed-wave-shoulder",
            `${Math.max(
                0.5,
                waveWidth *
                    0.35
            )}deg`
        );

        range.style.setProperty(
            "--elapsed-wave-start-angle",
            `${startAngle - 180}deg`
        );

        range.style.setProperty(
            "--elapsed-wave-end-angle",
            `${sweepEndAngle - 180}deg`
        );
    }

    #startRangeObserver() {
        this.#stopRangeObserver();

        if (
            typeof MutationObserver ===
                "undefined"
        ) {
            return;
        }

        this.#rangeObserver =
            new MutationObserver(
                mutations => {
                    let refresh =
                        false;

                    let childListChanged =
                        false;

                    for (
                        const mutation of
                            mutations
                    ) {
                        if (
                            mutation.type ===
                                "childList"
                        ) {
                            childListChanged =
                                true;

                            for (
                                const node of
                                    mutation
                                        .addedNodes
                            ) {
                                if (
                                    node?.nodeType ===
                                        1 &&
                                    node.localName ===
                                        "time-range"
                                ) {
                                    this.#assignRangeLayer(
                                        node
                                    );

                                    refresh =
                                        true;
                                }
                            }
                        }
                        else if (
                            mutation.type ===
                                "attributes" &&
                            mutation.target
                                ?.localName ===
                                    "time-range"
                        ) {
                            this.#assignRangeLayer(
                                mutation.target
                            );

                            refresh =
                                true;
                        }
                    }

                    if (childListChanged) {
                        this.#updateRangeRendererState();
                    }

                    if (refresh) {
                        this.refreshLayerLayout();
                    }
                }
            );

        this.#rangeObserver.observe(
            this,
            {
                childList: true,
                attributes: true,
                attributeFilter: [
                    "type"
                ]
            }
        );
    }

    #stopRangeObserver() {
        this.#rangeObserver
            ?.disconnect();

        this.#rangeObserver =
            undefined;
    }

    #startParentObserver() {
        this.#stopParentObserver();

        if (
            !this.#parent ||
            typeof MutationObserver ===
                "undefined"
        ) {
            return;
        }

        this.#parentObserver =
            new MutationObserver(
                mutations => {
                    if (
                        mutations.some(
                            mutation =>
                                mutation.type ===
                                    "attributes" &&
                                mutation.attributeName ===
                                    "timer-mode"
                        )
                    ) {
                        this.refreshLayerLayout({
                            animate:
                                true,

                            duration:
                                333
                        });
                    }
                }
            );

        this.#parentObserver.observe(
            this.#parent,
            {
                attributes: true,
                attributeFilter: [
                    "timer-mode"
                ]
            }
        );
    }

    #stopParentObserver() {
        this.#parentObserver
            ?.disconnect();

        this.#parentObserver =
            undefined;
    }

    #refreshChildVisualGeometry() {
        if (
            this.clockTimerLayoutDetached ===
                true ||
            this.clockTimerExternalRangeLayout ===
                true
        ) {
            return;
        }

        for (
            const range of
                this.children
        ) {
            if (
                range.localName ===
                    "time-range" &&
                range.timeRangeExiting !==
                    true
            ) {
                this.refreshRangeGeometry(
                    range
                );
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
                child.clockTimerLayoutDetached !==
                    true &&
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
            this.clockTimerLayoutDetached ===
                true
        ) {
            this.#scheduleResize();
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
            inset !== undefined &&
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
                    RingContainer &&
                sibling.clockTimerLayoutDetached !==
                    true
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
                    RingContainer &&
                sibling.clockTimerLayoutDetached !==
                    true
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
                    var(
                        --ring-container-background-color,
                        transparent
                    ) !important;

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

            :host([range-renderer]) #container {
                clip-path: none;
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

            ring-layer {
                display: contents;
            }

            ::slotted(*) {
                grid-row: 1;
                grid-column: 1;

                min-width: 0;
                min-height: 0;
            }

            ::slotted(time-range) {
                display: block;
                position: relative;

                width: 100%;
                height: 100%;

                box-sizing: border-box;
                transform-origin: 50% 50%;
            }

            ::slotted(time-range.elapsed),
            ::slotted(time-range.remaining) {
                background-color:
                    rgb(255 255 255 / 25%);
            }

            ::slotted(time-range[type="wave"]) {
                --ring-container-wave-angle:
                    var(
                        --elapsed-wave-start-angle,
                        0deg
                    );

                background-color:
                    transparent !important;

                background-image:
                    conic-gradient(
                        from
                            var(
                                --ring-container-wave-angle
                            )
                        at 50% 50%,
                        transparent
                            0deg,
                        transparent
                            calc(
                                180deg -
                                var(
                                    --elapsed-wave-width,
                                    12deg
                                )
                            ),
                        rgb(255 255 255 / 42%)
                            calc(
                                180deg -
                                var(
                                    --elapsed-wave-shoulder,
                                    4deg
                                )
                            ),
                        rgb(255 255 255 / 88%)
                            180deg,
                        rgb(255 255 255 / 42%)
                            calc(
                                180deg +
                                var(
                                    --elapsed-wave-shoulder,
                                    4deg
                                )
                            ),
                        transparent
                            calc(
                                180deg +
                                var(
                                    --elapsed-wave-width,
                                    12deg
                                )
                            ),
                        transparent
                            360deg
                    );

                animation:
                    ring-container-wave-sweep
                    4.5s
                    linear
                    infinite;

                animation-play-state:
                    var(
                        --elapsed-wave-play-state,
                        running
                    );
            }

            ::slotted(time-range[type="wave"][state-change-wave]) {
                animation-duration:
                    750ms;
                animation-iteration-count:
                    1;
                animation-fill-mode:
                    both;
            }

            ::slotted(time-range[type="wave"][timer-type-transition-wave]) {
                animation-duration:
                    var(
                        --timer-type-transition-wave-duration,
                        1833ms
                    );

                animation-iteration-count:
                    1;
                animation-fill-mode:
                    both;

                animation-play-state:
                    var(
                        --timer-type-transition-wave-play-state,
                        running
                    );
            }

            @keyframes ring-container-wave-sweep {
                0% {
                    opacity: 0;

                    --ring-container-wave-angle:
                        var(
                            --elapsed-wave-start-angle,
                            0deg
                        );
                }

                3% {
                    opacity: 1;
                }

                30.333% {
                    opacity: 1;
                }

                33.333% {
                    opacity: 0;

                    --ring-container-wave-angle:
                        var(
                            --elapsed-wave-end-angle,
                            360deg
                        );
                }

                100% {
                    opacity: 0;

                    --ring-container-wave-angle:
                        var(
                            --elapsed-wave-end-angle,
                            360deg
                        );
                }
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

        try {
            CSS.registerProperty({
                name:
                    "--ring-container-wave-angle",

                syntax:
                    "<angle>",

                inherits:
                    false,

                initialValue:
                    "0deg"
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

if (
    !customElements.get(
        "ring-layer"
    )
) {
    customElements.define(
        "ring-layer",
        RingLayer
    );
}

customElements.define(
    "ring-container",
    RingContainer
);