class RingContainer extends HTMLElement {
    static #instances = [];
    static #batchResizing = false;
    static #filter = "opacity(75%)";
    static #filterRamp = true;
    static #filterRampDuration = 125;
    static #filterRampConnect = true;
    static #filterRampDisconnect = true;
    static #resizeFilter = "opacity(75%)";
    static #reorderFilter = "opacity(75%)";
    static #connectFilter = "opacity(75%)";
    static #disconnectFilter = "opacity(75%)";

    #shadowRoot;
    #styleElement;
    #contentElement;
    #resizeAnimation;
    #resizeFilterAnimation;
    #reorderAnimation;
    #reorderFilterAnimation;
    #connectAnimation;
    #connectFilterAnimation;
    #disconnectAnimation;
    #disconnectFilterAnimation;
    #resizeObserver;
    #parentObserver;
    #parentElement;
    #connected = false;
    #disconnecting = false;
    #committing = false;
    #pendingResize;
    #pendingReorder;
    #pendingConnect;
    #pendingDisconnect;
    #width;
    #inset;
    #outerMargin;
    #innerMargin;
    #layoutInsetTarget;
    #instanceFilter;
    #instanceFilterRamp;
    #instanceFilterRampDuration;
    #instanceFilterRampConnect;
    #instanceFilterRampDisconnect;
    #instanceResizeFilter;
    #instanceReorderFilter;
    #instanceConnectFilter;
    #instanceDisconnectFilter;

    static get observedAttributes() {
        return [
            "width",
            "inset",
            "outer-margin",
            "inner-margin",
            "geometry-only"
        ];
    }

    static get instances() {
        return [...RingContainer.#instances];
    }

    static get batchResizing() {
        return RingContainer.#batchResizing;
    }

    static set batchResizing(value) {
        const next = Boolean(value);

        if (
            RingContainer.#batchResizing ===
            next
        ) {
            return;
        }

        RingContainer.#batchResizing =
            next;

        if (!next) {
            RingContainer.#recalculateAll();
        }
    }

    static get filter() {
        return RingContainer.#filter;
    }

    static set filter(value) {
        RingContainer.#filter =
            RingContainer.#normalizeFilter(
                value,
                "opacity(75%)"
            );
    }

    static get filterRamp() {
        return RingContainer.#filterRamp;
    }

    static set filterRamp(value) {
        RingContainer.#filterRamp =
            Boolean(value);
    }

    static get filterRampDuration() {
        return RingContainer.#filterRampDuration;
    }

    static set filterRampDuration(value) {
        RingContainer.#filterRampDuration =
            RingContainer.#normalizeDuration(
                value,
                125
            );
    }

    static get filterRampConnect() {
        return RingContainer.#filterRampConnect;
    }

    static set filterRampConnect(value) {
        RingContainer.#filterRampConnect =
            Boolean(value);
    }

    static get filterRampDisconnect() {
        return RingContainer.#filterRampDisconnect;
    }

    static set filterRampDisconnect(value) {
        RingContainer.#filterRampDisconnect =
            Boolean(value);
    }

    static get resizeFilter() {
        return RingContainer.#resizeFilter;
    }

    static set resizeFilter(value) {
        RingContainer.#resizeFilter =
            RingContainer.#normalizeFilter(
                value,
                RingContainer.#filter
            );
    }

    static get reorderFilter() {
        return RingContainer.#reorderFilter;
    }

    static set reorderFilter(value) {
        RingContainer.#reorderFilter =
            RingContainer.#normalizeFilter(
                value,
                "opacity(75%)"
            );
    }

    static get connectFilter() {
        return RingContainer.#connectFilter;
    }

    static set connectFilter(value) {
        RingContainer.#connectFilter =
            RingContainer.#normalizeFilter(
                value,
                RingContainer.#filter
            );
    }

    static get disconnectFilter() {
        return RingContainer.#disconnectFilter;
    }

    static set disconnectFilter(value) {
        RingContainer.#disconnectFilter =
            RingContainer.#normalizeFilter(
                value,
                RingContainer.#filter
            );
    }

    get filter() {
        return this.#instanceFilter ?? RingContainer.filter;
    }

    set filter(value) {
        this.#instanceFilter =
            RingContainer.#normalizeFilter(
                value,
                RingContainer.filter
            );
    }

    get filterRamp() {
        return this.#instanceFilterRamp ?? RingContainer.filterRamp;
    }

    set filterRamp(value) {
        this.#instanceFilterRamp =
            Boolean(value);
    }

    get filterRampDuration() {
        return this.#instanceFilterRampDuration ?? RingContainer.filterRampDuration;
    }

    set filterRampDuration(value) {
        this.#instanceFilterRampDuration =
            RingContainer.#normalizeDuration(
                value,
                RingContainer.filterRampDuration
            );
    }

    get filterRampConnect() {
        return this.#instanceFilterRampConnect ?? RingContainer.filterRampConnect;
    }

    set filterRampConnect(value) {
        this.#instanceFilterRampConnect =
            Boolean(value);
    }

    get filterRampDisconnect() {
        return this.#instanceFilterRampDisconnect ?? RingContainer.filterRampDisconnect;
    }

    set filterRampDisconnect(value) {
        this.#instanceFilterRampDisconnect =
            Boolean(value);
    }

    get resizeFilter() {
        return this.#instanceResizeFilter ?? RingContainer.resizeFilter;
    }

    set resizeFilter(value) {
        this.#instanceResizeFilter =
            RingContainer.#normalizeFilter(
                value,
                this.filter
            );
    }

    get reorderFilter() {
        return this.#instanceReorderFilter ?? RingContainer.reorderFilter;
    }

    set reorderFilter(value) {
        this.#instanceReorderFilter =
            RingContainer.#normalizeFilter(
                value,
                "opacity(75%)"
            );
    }

    get connectFilter() {
        return this.#instanceConnectFilter ?? RingContainer.connectFilter;
    }

    set connectFilter(value) {
        this.#instanceConnectFilter =
            RingContainer.#normalizeFilter(
                value,
                this.filter
            );
    }

    get disconnectFilter() {
        return this.#instanceDisconnectFilter ?? RingContainer.disconnectFilter;
    }

    set disconnectFilter(value) {
        this.#instanceDisconnectFilter =
            RingContainer.#normalizeFilter(
                value,
                this.filter
            );
    }

    constructor() {
        super();

        this.#shadowRoot =
            this.attachShadow({
                mode: "closed"
            });

        this.#styleElement =
            document.createElement(
                "style"
            );

        this.#contentElement =
            document.createElement(
                "div"
            );

        this.#contentElement.id =
            "content";

        const slot =
            document.createElement(
                "slot"
            );

        this.#contentElement.appendChild(
            slot
        );

        this.#shadowRoot.append(
            this.#styleElement,
            this.#contentElement
        );

        this.#updateStyle();
    }

    connectedCallback() {
        if (
            this.#disconnecting
        ) {
            this.#disconnecting =
                false;

            this.#pendingDisconnect =
                undefined;

            this.#disconnectAnimation
                ?.cancel();

            this.#disconnectFilterAnimation
                ?.cancel();
        }

        if (
            !RingContainer.#instances.includes(
                this
            )
        ) {
            RingContainer.#instances.push(
                this
            );
        }

        this.#connected =
            true;

        this.#parentElement =
            this.parentElement;

        this.#readGeometryAttributes();

        this.#observeParent();

        this.#observeSize();

        this.#updateStyle();

        if (
            !RingContainer.#batchResizing
        ) {
            this.#handleConnected();

            RingContainer.#recalculateParent(
                this.parentElement
            );
        }
    }

    disconnectedCallback() {
        this.#connected =
            false;

        this.#resizeObserver
            ?.disconnect();

        this.#resizeObserver =
            undefined;

        this.#parentObserver
            ?.disconnect();

        this.#parentObserver =
            undefined;

        const parent =
            this.#parentElement;

        if (
            !this.#disconnecting &&
            !RingContainer.#batchResizing
        ) {
            this.#handleDisconnected(
                parent
            );
        }

        const index =
            RingContainer.#instances.indexOf(
                this
            );

        if (
            index !== -1
        ) {
            RingContainer.#instances.splice(
                index,
                1
            );
        }

        if (
            !RingContainer.#batchResizing
        ) {
            RingContainer.#recalculateParent(
                parent
            );
        }

        this.#parentElement =
            undefined;
    }

    attributeChangedCallback(
        name,
        oldValue,
        newValue
    ) {
        if (
            oldValue ===
            newValue ||
            this.#committing
        ) {
            return;
        }

        if (
            name ===
                "geometry-only"
        ) {
            this.#updateStyle();
            return;
        }

        const oldGeometry =
            this.#getGeometry();

        this.#readGeometryAttributes();

        const newGeometry =
            this.#getGeometry();

        this.#updateStyle();

        if (
            !this.isConnected ||
            RingContainer.#batchResizing
        ) {
            return;
        }

        this.#animateResize(
            oldGeometry,
            newGeometry,
            {
                commitAttributes: false
            }
        );

        RingContainer.#recalculateParent(
            this.parentElement
        );
    }

    resize({
        width,
        inset,
        outerMargin,
        innerMargin,
        duration = 1000,
        easing = "ease"
    } = {}) {
        const current =
            this.#getGeometry();

        const target = {
            width:
                width === undefined
                    ? current.width
                    : String(width),

            inset:
                inset === undefined
                    ? current.inset
                    : String(inset),

            outerMargin:
                outerMargin === undefined
                    ? current.outerMargin
                    : String(outerMargin),

            innerMargin:
                innerMargin === undefined
                    ? current.innerMargin
                    : String(innerMargin)
        };

        return this.#animateResize(
            current,
            target,
            {
                duration,
                easing,
                commitAttributes: true
            }
        );
    }

    static reorder(
        ...rings
    ) {
        if (
            rings.length ===
                1 &&
            Array.isArray(
                rings[0]
            )
        ) {
            rings =
                rings[0];
        }

        rings =
            rings.filter(
                ring =>
                    ring instanceof
                        RingContainer
            );

        if (
            rings.length ===
                0
        ) {
            return Promise.resolve();
        }

        const parent =
            rings[0].parentElement;

        if (!parent) {
            return Promise.resolve();
        }

        for (
            const ring of
                rings
        ) {
            if (
                ring.parentElement !==
                    parent
            ) {
                throw new Error(
                    "All RingContainer elements passed to reorder() must share the same parent."
                );
            }
        }

        const before =
            RingContainer.#captureRects(
                rings
            );

        RingContainer.#batchResizing =
            true;

        try {
            for (
                const ring of
                    rings
            ) {
                parent.appendChild(
                    ring
                );
            }
        }
        finally {
            RingContainer.#batchResizing =
                false;
        }

        const after =
            RingContainer.#captureRects(
                rings
            );

        const promises = [];

        for (
            const ring of
                rings
        ) {
            promises.push(
                ring.#animateReorder(
                    before.get(ring),
                    after.get(ring)
                )
            );
        }

        RingContainer.#recalculateParent(
            parent
        );

        return Promise.all(
            promises
        );
    }

    static #captureRects(
        rings
    ) {
        const map =
            new Map();

        for (
            const ring of
                rings
        ) {
            map.set(
                ring,
                ring.getBoundingClientRect()
            );
        }

        return map;
    }

    static #normalizeFilter(
        value,
        fallback
    ) {
        if (
            value === undefined ||
            value === null
        ) {
            return fallback;
        }

        const text =
            String(value).trim();

        return text || fallback;
    }

    static #normalizeDuration(
        value,
        fallback
    ) {
        const number =
            Number(value);

        if (
            !Number.isFinite(number) ||
            number < 0
        ) {
            return fallback;
        }

        return number;
    }

    static #recalculateAll() {
        const parents =
            new Set();

        for (
            const ring of
                RingContainer.#instances
        ) {
            if (
                ring.parentElement
            ) {
                parents.add(
                    ring.parentElement
                );
            }
        }

        for (
            const parent of
                parents
        ) {
            RingContainer.#recalculateParent(
                parent
            );
        }
    }

    static #recalculateParent(
        parent
    ) {
        if (!parent) {
            return;
        }

        const rings =
            Array.from(
                parent.children
            ).filter(
                child =>
                    child instanceof
                        RingContainer
            );

        if (
            rings.length ===
                0
        ) {
            return;
        }

        let outerInset =
            "0px";

        for (
            const ring of
                rings
        ) {
            const geometry =
                ring.#getGeometry();

            const width =
                geometry.width;

            const outerMargin =
                geometry.outerMargin;

            const innerMargin =
                geometry.innerMargin;

            const targetInset =
                `calc(${outerInset} + ${outerMargin})`;

            const currentInset =
                ring.#layoutInsetTarget ??
                ring.getAttribute(
                    "inset"
                );

            if (
                currentInset !==
                    targetInset
            ) {
                const current =
                    ring.#getGeometry();

                const target = {
                    ...current,
                    inset:
                        targetInset
                };

                ring.#layoutInsetTarget =
                    targetInset;

                ring.#animateResize(
                    current,
                    target,
                    {
                        commitAttributes: true
                    }
                );
            }

            outerInset =
                `calc(${targetInset} + ${width} + ${innerMargin})`;
        }
    }

    #readGeometryAttributes() {
        this.#width =
            this.getAttribute(
                "width"
            ) ??
            "0px";

        this.#inset =
            this.getAttribute(
                "inset"
            ) ??
            "0px";

        this.#outerMargin =
            this.getAttribute(
                "outer-margin"
            ) ??
            "0px";

        this.#innerMargin =
            this.getAttribute(
                "inner-margin"
            ) ??
            "0px";
    }

    #getGeometry() {
        return {
            width:
                this.#width ??
                this.getAttribute(
                    "width"
                ) ??
                "0px",

            inset:
                this.#inset ??
                this.getAttribute(
                    "inset"
                ) ??
                "0px",

            outerMargin:
                this.#outerMargin ??
                this.getAttribute(
                    "outer-margin"
                ) ??
                "0px",

            innerMargin:
                this.#innerMargin ??
                this.getAttribute(
                    "inner-margin"
                ) ??
                "0px"
        };
    }

    #updateStyle(
        geometry = this.#getGeometry()
    ) {
        const geometryOnly =
            this.hasAttribute(
                "geometry-only"
            );

        this.#styleElement.textContent = `
            :host {
                position: absolute;

                inset:
                    ${geometry.inset};

                display: block;

                box-sizing:
                    border-box;

                pointer-events:
                    none;

                ${
                    geometryOnly
                        ? ""
                        : `
                            border:
                                ${geometry.width}
                                solid
                                transparent;
                        `
                }
            }

            #content {
                position: absolute;

                inset: 0;

                width: 100%;
                height: 100%;

                box-sizing:
                    border-box;

                pointer-events:
                    none;
            }

            ::slotted(time-range) {
                position: absolute;

                inset: 0;

                display: block;

                width: 100%;
                height: 100%;

                box-sizing:
                    border-box;
            }

            ::slotted(*) {
                pointer-events:
                    none;
            }
        `;
    }

    #observeParent() {
        this.#parentObserver
            ?.disconnect();

        const parent =
            this.parentElement;

        if (!parent) {
            return;
        }

        this.#parentObserver =
            new MutationObserver(
                mutations => {
                    if (
                        RingContainer.#batchResizing
                    ) {
                        return;
                    }

                    let changed =
                        false;

                    for (
                        const mutation of
                            mutations
                    ) {
                        if (
                            mutation.type !==
                                "childList"
                        ) {
                            continue;
                        }

                        if (
                            mutation.addedNodes.length > 0 ||
                            mutation.removedNodes.length > 0
                        ) {
                            changed =
                                true;
                            break;
                        }
                    }

                    if (changed) {
                        RingContainer.#recalculateParent(
                            parent
                        );
                    }
                }
            );

        this.#parentObserver.observe(
            parent,
            {
                childList: true
            }
        );
    }

    #observeSize() {
        this.#resizeObserver
            ?.disconnect();

        if (
            typeof ResizeObserver !==
                "function"
        ) {
            return;
        }

        this.#resizeObserver =
            new ResizeObserver(
                () => {
                    if (
                        RingContainer.#batchResizing
                    ) {
                        return;
                    }

                    RingContainer.#recalculateParent(
                        this.parentElement
                    );
                }
            );

        this.#resizeObserver.observe(
            this
        );
    }

    #handleConnected() {
        const parent =
            this.parentElement;

        if (!parent) {
            return;
        }

        const rect =
            this.getBoundingClientRect();

        const keyframes = [
            {
                opacity: 0,
                transform:
                    "scale(.98)"
            },
            {
                opacity: 1,
                transform:
                    "scale(1)"
            }
        ];

        const options = {
            duration: 250,
            easing: "ease-out",
            fill: "both"
        };

        this.#connectAnimation
            ?.cancel();

        this.#connectAnimation =
            this.animate(
                keyframes,
                options
            );

        if (
            this.filterRampConnect
        ) {
            this.#connectFilterAnimation =
                this.#animateFilterRamp(
                    this.connectFilter,
                    this.#connectAnimation
                );
        }

        this.#pendingConnect =
            this.#connectAnimation.finished
                .catch(() => {})
                .finally(
                    () => {
                        this.#connectAnimation =
                            undefined;

                        this.#connectFilterAnimation =
                            undefined;

                        this.#pendingConnect =
                            undefined;

                        RingContainer.#recalculateParent(
                            parent
                        );
                    }
                );

        return this.#pendingConnect;
    }

    #handleDisconnected(
        parent
    ) {
        if (
            this.#disconnecting
        ) {
            return this.#pendingDisconnect;
        }

        this.#disconnecting =
            true;

        const keyframes = [
            {
                opacity: 1,
                transform:
                    "scale(1)"
            },
            {
                opacity: 0,
                transform:
                    "scale(.98)"
            }
        ];

        const options = {
            duration: 250,
            easing: "ease-in",
            fill: "both"
        };

        this.#disconnectAnimation
            ?.cancel();

        this.#disconnectAnimation =
            this.animate(
                keyframes,
                options
            );

        if (
            this.filterRampDisconnect
        ) {
            this.#disconnectFilterAnimation =
                this.#animateFilterRamp(
                    this.disconnectFilter,
                    this.#disconnectAnimation
                );
        }

        this.#pendingDisconnect =
            this.#disconnectAnimation.finished
                .catch(() => {})
                .finally(
                    () => {
                        this.#disconnectAnimation =
                            undefined;

                        this.#disconnectFilterAnimation =
                            undefined;

                        this.#pendingDisconnect =
                            undefined;

                        this.#disconnecting =
                            false;

                        RingContainer.#recalculateParent(
                            parent
                        );
                    }
                );

        return this.#pendingDisconnect;
    }

    #animateResize(
        from,
        to,
        {
            duration = 1000,
            easing = "ease",
            commitAttributes = false
        } = {}
    ) {
        this.#resizeAnimation
            ?.cancel();

        this.#resizeFilterAnimation
            ?.cancel();

        const oldGeometry = {
            ...from
        };

        const targetGeometry = {
            ...to
        };

        const animationStyle =
            document.createElement(
                "style"
            );

        animationStyle.dataset.ringContainerResize =
            "";

        const animationName =
            `ring-container-resize-${Math.random().toString(36).slice(2)}`;

        animationStyle.textContent = `
            @keyframes ${animationName} {
                from {
                    inset:
                        ${oldGeometry.inset};

                    ${
                        this.hasAttribute(
                            "geometry-only"
                        )
                            ? ""
                            : `
                                border-width:
                                    ${oldGeometry.width};
                            `
                    }
                }

                to {
                    inset:
                        ${targetGeometry.inset};

                    ${
                        this.hasAttribute(
                            "geometry-only"
                        )
                            ? ""
                            : `
                                border-width:
                                    ${targetGeometry.width};
                            `
                    }
                }
            }

            :host {
                animation:
                    ${animationName}
                    ${duration}ms
                    ${easing}
                    both;
            }
        `;

        this.#shadowRoot.appendChild(
            animationStyle
        );

        this.#resizeAnimation =
            this.animate(
                [
                    {
                        opacity: 1
                    },
                    {
                        opacity: 1
                    }
                ],
                {
                    duration,
                    easing,
                    fill: "both"
                }
            );

        const resizeAnimation =
            this.#resizeAnimation;

        if (
            this.filterRamp
        ) {
            this.#resizeFilterAnimation =
                this.#animateFilterRamp(
                    this.resizeFilter,
                    this.#resizeAnimation
                );
        }

        this.#pendingResize =
            resizeAnimation.finished
                .catch(() => {})
                .finally(
                    () => {
                        animationStyle.remove();

                        if (
                            this.#resizeAnimation !==
                                resizeAnimation
                        ) {
                            return;
                        }

                        if (
                            commitAttributes
                        ) {
                            this.#commitGeometryAttributes(
                                targetGeometry
                            );
                        }
                        else {
                            this.#width =
                                targetGeometry.width;

                            this.#inset =
                                targetGeometry.inset;

                            this.#outerMargin =
                                targetGeometry.outerMargin;

                            this.#innerMargin =
                                targetGeometry.innerMargin;
                        }

                        this.#updateStyle(
                            targetGeometry
                        );

                        if (
                            this.#layoutInsetTarget ===
                                targetGeometry.inset
                        ) {
                            this.#layoutInsetTarget =
                                undefined;
                        }

                        this.#resizeAnimation =
                            undefined;

                        this.#resizeFilterAnimation =
                            undefined;

                        this.#pendingResize =
                            undefined;
                    }
                );

        return this.#pendingResize;
    }

    #animateReorder(
        before,
        after
    ) {
        if (
            !before ||
            !after
        ) {
            return Promise.resolve();
        }

        this.#reorderAnimation
            ?.cancel();

        this.#reorderFilterAnimation
            ?.cancel();

        const deltaX =
            before.left -
            after.left;

        const deltaY =
            before.top -
            after.top;

        const scaleX =
            after.width === 0
                ? 1
                : before.width /
                    after.width;

        const scaleY =
            after.height === 0
                ? 1
                : before.height /
                    after.height;

        this.#reorderAnimation =
            this.animate(
                [
                    {
                        transformOrigin:
                            "top left",

                        transform:
                            `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`
                    },
                    {
                        transformOrigin:
                            "top left",

                        transform:
                            "translate(0px, 0px) scale(1, 1)"
                    }
                ],
                {
                    duration: 1000,
                    easing: "ease",
                    fill: "both"
                }
            );

        if (
            this.filterRamp
        ) {
            this.#reorderFilterAnimation =
                this.#animateFilterRamp(
                    this.reorderFilter,
                    this.#reorderAnimation
                );
        }

        this.#pendingReorder =
            this.#reorderAnimation.finished
                .catch(() => {})
                .finally(
                    () => {
                        this.#reorderAnimation =
                            undefined;

                        this.#reorderFilterAnimation =
                            undefined;

                        this.#pendingReorder =
                            undefined;
                    }
                );

        return this.#pendingReorder;
    }

    #animateFilterRamp(
        filter,
        primaryAnimation
    ) {
        const duration =
            this.filterRampDuration;

        if (
            !this.filterRamp ||
            duration <= 0 ||
            !primaryAnimation
        ) {
            return undefined;
        }

        const primaryDuration =
            Number(
                primaryAnimation.effect
                    ?.getTiming()
                    ?.duration
            );

        const totalDuration =
            Number.isFinite(
                primaryDuration
            )
                ? primaryDuration
                : 0;

        const ramp =
            Math.min(
                duration,
                totalDuration /
                    2
            );

        if (
            ramp <= 0
        ) {
            return undefined;
        }

        const middleStart =
            ramp /
            totalDuration;

        const middleEnd =
            1 -
            middleStart;

        return this.animate(
            [
                {
                    filter: "none",
                    offset: 0
                },
                {
                    filter,
                    offset:
                        middleStart
                },
                {
                    filter,
                    offset:
                        middleEnd
                },
                {
                    filter: "none",
                    offset: 1
                }
            ],
            {
                duration:
                    totalDuration,

                easing:
                    "linear",

                fill:
                    "both"
            }
        );
    }

    #commitGeometryAttributes(
        geometry
    ) {
        this.#committing =
            true;

        try {
            this.#setOrRemoveAttribute(
                "width",
                geometry.width
            );

            this.#setOrRemoveAttribute(
                "inset",
                geometry.inset
            );

            this.#setOrRemoveAttribute(
                "outer-margin",
                geometry.outerMargin
            );

            this.#setOrRemoveAttribute(
                "inner-margin",
                geometry.innerMargin
            );
        }
        finally {
            this.#committing =
                false;
        }

        this.#width =
            geometry.width;

        this.#inset =
            geometry.inset;

        this.#outerMargin =
            geometry.outerMargin;

        this.#innerMargin =
            geometry.innerMargin;
    }

    #setOrRemoveAttribute(
        name,
        value
    ) {
        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {
            this.removeAttribute(
                name
            );

            return;
        }

        this.setAttribute(
            name,
            String(value)
        );
    }
}

if (
    !customElements.get(
        "ring-container"
    )
) {
    customElements.define(
        "ring-container",
        RingContainer
    );
}
