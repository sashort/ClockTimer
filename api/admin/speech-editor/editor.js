(() => {
    "use strict";

    const $ = id =>
        document.getElementById(id);

    const frame =
        $("appFrame");

    const form =
        $("attributeForm");

    const editorActionFunctions =
        globalThis
            .WMOFSpeechEditorActionFunctions;

    const editorActions =
        globalThis
            .WMOFSpeechEditorActions;

    if (
        !editorActionFunctions ||
        !editorActions
    ) {
        throw new Error(
            "Speech Editor action registry was not loaded."
        );
    }

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
    let savedMacros = [];
    let draftMacros = [];
    let macrosLoaded = false;
    let macroWorking = {
        name: "",
        parameters: [],
        steps: []
    };
    let macroEditingName = "";
    let macroRecorderEvents;
    let revision = "empty";
    let overlay = true;
    let frameDocument;
    let selectedElement;
    let selectedLocator;
    let highlighted;
    let functionNames = [];
    const emptyFunctionRoles =
        () => ({
            "speech-processing": [],
            action: [],
            interaction: [],
            presentation: [],
            helper: []
        });
    let savedFunctionRoles =
        emptyFunctionRoles();
    let draftFunctionRoles =
        emptyFunctionRoles();
    let registryRevision = "missing";
    let applyTimer;
    let refreshTimer;
    let frameObserver;
    const tierOpenState = new Map();
    const menuOpenState = new Map();
    let draggedPhraseItem;
    let viewportResizeObserver;
    let regexBuilderResult = {
        valid: false,
        pattern: "",
        error: "Enter a phrase template."
    };
    let regexBuilderPickerRange;

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
                JSON.stringify(saved) ||
            JSON.stringify(
                draftMacros
            ) !==
                JSON.stringify(
                    savedMacros
                ) ||
            JSON.stringify(
                draftFunctionRoles
            ) !==
                JSON.stringify(
                    savedFunctionRoles
                );

    const updateButtons = () => {
        const clean =
            !dirty();

        $("saveButton").disabled =
            clean;

        $("discardButton").disabled =
            clean;
    };

    const devicePresets = [
        {brand:"Apple", model:"iPad", generation:"10th generation", width:820, height:1180},
        {brand:"Apple", model:"iPad Air", generation:"11-inch (M2)", width:820, height:1180},
        {brand:"Apple", model:"iPad mini", generation:"A17 Pro", width:744, height:1133},
        {brand:"Apple", model:"iPad Pro", generation:"11-inch (M4)", width:834, height:1210},
        {brand:"Apple", model:"iPad Pro", generation:"13-inch (M4)", width:1032, height:1376},
        {brand:"Apple", model:"iPhone", generation:"13", width:390, height:844},
        {brand:"Apple", model:"iPhone", generation:"13 mini", width:375, height:812},
        {brand:"Apple", model:"iPhone", generation:"13 Pro Max", width:428, height:926},
        {brand:"Apple", model:"iPhone", generation:"14", width:390, height:844},
        {brand:"Apple", model:"iPhone", generation:"14 Plus", width:428, height:926},
        {brand:"Apple", model:"iPhone", generation:"14 Pro", width:393, height:852},
        {brand:"Apple", model:"iPhone", generation:"14 Pro Max", width:430, height:932},
        {brand:"Apple", model:"iPhone", generation:"15", width:393, height:852},
        {brand:"Apple", model:"iPhone", generation:"15 Plus", width:430, height:932},
        {brand:"Apple", model:"iPhone", generation:"15 Pro", width:393, height:852},
        {brand:"Apple", model:"iPhone", generation:"15 Pro Max", width:430, height:932},
        {brand:"Apple", model:"iPhone", generation:"16", width:393, height:852},
        {brand:"Apple", model:"iPhone", generation:"16 Plus", width:430, height:932},
        {brand:"Apple", model:"iPhone", generation:"16 Pro", width:402, height:874},
        {brand:"Apple", model:"iPhone", generation:"16 Pro Max", width:440, height:956},
        {brand:"Apple", model:"iPhone", generation:"16e", width:390, height:844},
        {brand:"Apple", model:"iPhone", generation:"17", width:402, height:874},
        {brand:"Apple", model:"iPhone", generation:"Air", width:420, height:912},
        {brand:"Apple", model:"iPhone", generation:"17 Pro", width:402, height:874},
        {brand:"Apple", model:"iPhone", generation:"17 Pro Max", width:440, height:956},
        {brand:"Apple", model:"iPhone", generation:"18 Pro", width:402, height:874},
        {brand:"Apple", model:"iPhone", generation:"18 Pro Max", width:440, height:956},
        {brand:"ASUS", model:"Zenbook 14 OLED", generation:"2024", width:1280, height:800},
        {brand:"Dell", model:"XPS 13", generation:"9350", width:1280, height:800},
        {brand:"Dell", model:"XPS 14", generation:"9440", width:1600, height:1000},
        {brand:"Dell", model:"XPS 16", generation:"9640", width:1728, height:1080},
        {brand:"Framework", model:"Laptop 13", generation:"2024", width:1504, height:1003},
        {brand:"Framework", model:"Laptop 16", generation:"2024", width:1707, height:1067},
        {brand:"Google", model:"Pixel", generation:"8", width:412, height:915},
        {brand:"Google", model:"Pixel", generation:"8 Pro", width:448, height:998},
        {brand:"Google", model:"Pixel", generation:"8a", width:412, height:915},
        {brand:"Google", model:"Pixel", generation:"9", width:412, height:923},
        {brand:"Google", model:"Pixel", generation:"9 Pro", width:427, height:952},
        {brand:"Google", model:"Pixel", generation:"9 Pro XL", width:448, height:998},
        {brand:"Google", model:"Pixel", generation:"10", width:412, height:923},
        {brand:"Google", model:"Pixel", generation:"10 Pro", width:427, height:952},
        {brand:"Google", model:"Pixel", generation:"10 Pro XL", width:448, height:998},
        {brand:"HP", model:"Spectre x360 14", generation:"2024", width:1280, height:853},
        {brand:"Lenovo", model:"ThinkPad X1 Carbon", generation:"Gen 12", width:1280, height:800},
        {brand:"Microsoft", model:"Surface Laptop 7", generation:"13.8-inch", width:1280, height:853},
        {brand:"Microsoft", model:"Surface Laptop 7", generation:"15-inch", width:1440, height:960},
        {brand:"Microsoft", model:"Surface Pro", generation:"9", width:1440, height:960},
        {brand:"Microsoft", model:"Surface Pro", generation:"11", width:1440, height:960},
        {brand:"Samsung", model:"Galaxy S", generation:"23", width:360, height:780},
        {brand:"Samsung", model:"Galaxy S", generation:"23 Ultra", width:384, height:824},
        {brand:"Samsung", model:"Galaxy S", generation:"24", width:360, height:780},
        {brand:"Samsung", model:"Galaxy S", generation:"24 Ultra", width:384, height:824},
        {brand:"Samsung", model:"Galaxy S", generation:"25", width:360, height:780},
        {brand:"Samsung", model:"Galaxy S", generation:"25 Ultra", width:384, height:824},
        {brand:"Samsung", model:"Galaxy S", generation:"26", width:360, height:780},
        {brand:"Samsung", model:"Galaxy S", generation:"26 Ultra", width:384, height:832}
    ]
        .sort(
            (a, b) =>
                a.brand.localeCompare(
                    b.brand,
                    undefined,
                    {numeric:true}
                ) ||
                a.model.localeCompare(
                    b.model,
                    undefined,
                    {numeric:true}
                ) ||
                a.generation.localeCompare(
                    b.generation,
                    undefined,
                    {numeric:true}
                )
        )
        .map(
            (
                device,
                index
            ) => ({
                ...device,
                id:
                    "device-" +
                    index
            })
        );

    const deviceById =
        new Map(
            devicePresets.map(
                device => [
                    device.id,
                    device
                ]
            )
        );

    const populateDeviceSelects =
        () => {
            for (
                const select of
                [
                    $("screenSizeSelect"),
                    $("compareSizeSelect")
                ]
            ) {
                for (
                    const device of
                    devicePresets
                ) {
                    const option =
                        document.createElement(
                            "option"
                        );

                    option.value =
                        device.id;

                    option.textContent =
                        device.brand +
                        " " +
                        device.model +
                        " " +
                        device.generation;

                    select.append(
                        option
                    );
                }
            }
        };

    const rulerTicks =
        (
            element,
            length,
            vertical = false
        ) => {
            const fragment =
                document
                    .createDocumentFragment();

            for (
                let value = 0;
                value <= length;
                value += 10
            ) {
                const tick =
                    document.createElement(
                        "span"
                    );

                tick.className =
                    "ruler-tick";

                if (vertical) {
                    tick.style.top =
                        value + "px";
                    tick.style.width =
                        (
                            value % 100 === 0
                                ? 12
                                : value % 50 === 0
                                    ? 8
                                    : 4
                        ) +
                        "px";
                }
                else {
                    tick.style.left =
                        value + "px";
                    tick.style.height =
                        (
                            value % 100 === 0
                                ? 12
                                : value % 50 === 0
                                    ? 8
                                    : 4
                        ) +
                        "px";
                }

                fragment.append(
                    tick
                );

                if (
                    value % 100 === 0
                ) {
                    const label =
                        document
                            .createElement(
                                "span"
                            );

                    label.className =
                        "ruler-label";
                    label.textContent =
                        String(value);

                    if (vertical) {
                        label.style.top =
                            (
                                value +
                                3
                            ) +
                            "px";
                    }
                    else {
                        label.style.left =
                            value + "px";
                    }

                    fragment.append(
                        label
                    );
                }
            }

            if (
                length % 100 !== 0
            ) {
                const endLabel =
                    document.createElement(
                        "span"
                    );

                endLabel.className =
                    "ruler-label ruler-end-label";
                endLabel.textContent =
                    Math.round(
                        length
                    ) +
                    " px";

                if (vertical) {
                    endLabel.style.top =
                        Math.max(
                            0,
                            length - 34
                        ) +
                        "px";
                }
                else {
                    endLabel.style.left =
                        Math.max(
                            0,
                            length - 44
                        ) +
                        "px";
                }

                fragment.append(
                    endLabel
                );
            }

            element.replaceChildren(
                fragment
            );
        };

    const setRect =
        (
            element,
            {
                left,
                top,
                width,
                height
            }
        ) => {
            element.style.left =
                left + "px";
            element.style.top =
                top + "px";
            element.style.width =
                Math.max(
                    0,
                    width
                ) +
                "px";
            element.style.height =
                Math.max(
                    0,
                    height
                ) +
                "px";
        };

    const hideCompareMasks =
        () => {
            for (
                const id of
                [
                    "compareMaskTop",
                    "compareMaskRight",
                    "compareMaskBottom",
                    "compareMaskLeft"
                ]
            ) {
                $(id).style.display =
                    "none";
            }
        };

    const hideCompareDeltas =
        () => {
            for (
                const id of
                [
                    "compareDeltaLeft",
                    "compareDeltaRight",
                    "compareDeltaTop",
                    "compareDeltaBottom"
                ]
            ) {
                $(id).style.display =
                    "none";
            }
        };

    const showDelta =
        (
            id,
            text,
            left,
            top
        ) => {
            const element =
                $(id);

            element.textContent =
                text;
            element.style.display =
                "block";
            element.style.left =
                left + "px";
            element.style.top =
                top + "px";
        };

    const applyViewport =
        () => {
            const scroller =
                $("previewScroller");

            if (
                !scroller ||
                !scroller.clientWidth ||
                !scroller.clientHeight
            ) {
                return;
            }

            const ruler = 28;
            const padding = 24;
            const selectedPreset =
                deviceById.get(
                    $("screenSizeSelect")
                        .value
                );

            const fillWidth =
                Math.max(
                    280,
                    scroller.clientWidth -
                        ruler -
                        padding * 2
                );

            const fillHeight =
                Math.max(
                    360,
                    scroller.clientHeight -
                        ruler -
                        padding * 2
                );

            const screen = {
                width:
                    selectedPreset
                        ?.width ||
                    fillWidth,
                height:
                    selectedPreset
                        ?.height ||
                    fillHeight
            };

            const compare =
                deviceById.get(
                    $("compareSizeSelect")
                        .value
                );

            const extentWidth =
                Math.max(
                    screen.width,
                    compare?.width ||
                        0
                );

            const extentHeight =
                Math.max(
                    screen.height,
                    compare?.height ||
                        0
                );

            const stageWidth =
                Math.max(
                    scroller.clientWidth,
                    ruler +
                        padding * 2 +
                        extentWidth
                );

            const stageHeight =
                Math.max(
                    scroller.clientHeight,
                    ruler +
                        padding * 2 +
                        extentHeight
                );

            const stage =
                $("previewStage");

            stage.style.width =
                stageWidth + "px";
            stage.style.height =
                stageHeight + "px";

            const extentLeft =
                ruler +
                padding +
                Math.max(
                    0,
                    (
                        stageWidth -
                        (
                            ruler +
                            padding * 2 +
                            extentWidth
                        )
                    ) / 2
                );

            const extentTop =
                ruler +
                padding +
                Math.max(
                    0,
                    (
                        stageHeight -
                        (
                            ruler +
                            padding * 2 +
                            extentHeight
                        )
                    ) / 2
                );

            const screenLeft =
                extentLeft +
                (
                    extentWidth -
                    screen.width
                ) / 2;

            const screenTop =
                extentTop +
                (
                    extentHeight -
                    screen.height
                ) / 2;

            setRect(
                $("screenFrame"),
                {
                    left:
                        screenLeft,
                    top:
                        screenTop,
                    width:
                        screen.width,
                    height:
                        screen.height
                }
            );

            const topRuler =
                $("topRuler");

            setRect(
                topRuler,
                {
                    left:
                        screenLeft,
                    top:
                        screenTop -
                        ruler,
                    width:
                        screen.width,
                    height:
                        ruler
                }
            );

            const leftRuler =
                $("leftRuler");

            setRect(
                leftRuler,
                {
                    left:
                        screenLeft -
                        ruler,
                    top:
                        screenTop,
                    width:
                        ruler,
                    height:
                        screen.height
                }
            );

            rulerTicks(
                topRuler,
                screen.width
            );

            rulerTicks(
                leftRuler,
                screen.height,
                true
            );

            hideCompareMasks();
            hideCompareDeltas();

            const compareFrame =
                $("compareFrame");

            if (!compare) {
                compareFrame.style
                    .display =
                    "none";
                return;
            }

            const compareLeft =
                screenLeft +
                (
                    screen.width -
                    compare.width
                ) / 2;

            const compareTop =
                screenTop +
                (
                    screen.height -
                    compare.height
                ) / 2;

            compareFrame.style
                .display =
                "block";

            setRect(
                compareFrame,
                {
                    left:
                        compareLeft,
                    top:
                        compareTop,
                    width:
                        compare.width,
                    height:
                        compare.height
                }
            );

            const x1 =
                Math.max(
                    0,
                    (
                        screen.width -
                        compare.width
                    ) / 2
                );

            const x2 =
                Math.min(
                    screen.width,
                    (
                        screen.width +
                        compare.width
                    ) / 2
                );

            const y1 =
                Math.max(
                    0,
                    (
                        screen.height -
                        compare.height
                    ) / 2
                );

            const y2 =
                Math.min(
                    screen.height,
                    (
                        screen.height +
                        compare.height
                    ) / 2
                );

            const masks = [
                [
                    "compareMaskTop",
                    0,
                    0,
                    screen.width,
                    y1
                ],
                [
                    "compareMaskBottom",
                    0,
                    y2,
                    screen.width,
                    screen.height -
                        y2
                ],
                [
                    "compareMaskLeft",
                    0,
                    y1,
                    x1,
                    y2 - y1
                ],
                [
                    "compareMaskRight",
                    x2,
                    y1,
                    screen.width -
                        x2,
                    y2 - y1
                ]
            ];

            for (
                const [
                    id,
                    left,
                    top,
                    width,
                    height
                ] of masks
            ) {
                const mask =
                    $(id);

                if (
                    width <= 0 ||
                    height <= 0
                ) {
                    mask.style.display =
                        "none";
                    continue;
                }

                mask.style.display =
                    "block";

                setRect(
                    mask,
                    {
                        left,
                        top,
                        width,
                        height
                    }
                );
            }

            if (
                compare.width >
                    screen.width
            ) {
                const half =
                    (
                        compare.width -
                        screen.width
                    ) / 2;

                const label =
                    "+" +
                    half +
                    " px";

                showDelta(
                    "compareDeltaLeft",
                    label,
                    compareLeft +
                        Math.max(
                            2,
                            half / 2 -
                                20
                        ),
                    screenTop +
                        screen.height / 2
                );

                showDelta(
                    "compareDeltaRight",
                    label,
                    screenLeft +
                        screen.width +
                        Math.max(
                            2,
                            half / 2 -
                                20
                        ),
                    screenTop +
                        screen.height / 2
                );
            }

            if (
                compare.height >
                    screen.height
            ) {
                const half =
                    (
                        compare.height -
                        screen.height
                    ) / 2;

                const label =
                    "+" +
                    half +
                    " px";

                showDelta(
                    "compareDeltaTop",
                    label,
                    screenLeft +
                        screen.width / 2 -
                        25,
                    compareTop +
                        Math.max(
                            2,
                            half / 2 -
                                8
                        )
                );

                showDelta(
                    "compareDeltaBottom",
                    label,
                    screenLeft +
                        screen.width / 2 -
                        25,
                    screenTop +
                        screen.height +
                        Math.max(
                            2,
                            half / 2 -
                                8
                        )
                );
            }

            requestAnimationFrame(
                () => {
                    scroller.scrollLeft =
                        Math.max(
                            0,
                            (
                                stageWidth -
                                scroller.clientWidth
                            ) / 2
                        );

                    scroller.scrollTop =
                        Math.max(
                            0,
                            (
                                stageHeight -
                                scroller.clientHeight
                            ) / 2
                        );
                }
            );
        };

    populateDeviceSelects();

    $("screenSizeSelect")
        .addEventListener(
            "change",
            event =>
                editorActions
                    .setViewport({
                        screenSize:
                            event.target
                                .value
                    })
        );

    $("compareSizeSelect")
        .addEventListener(
            "change",
            event =>
                editorActions
                    .setViewport({
                        compareSize:
                            event.target
                                .value
                    })
        );

    viewportResizeObserver =
        new ResizeObserver(
            applyViewport
        );

    viewportResizeObserver.observe(
        $("previewScroller")
    );

    requestAnimationFrame(
        applyViewport
    );

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

            if (
                selectedElement &&
                selectedElement !==
                    element
            ) {
                setRegexBuilderLive(
                    false
                );
            }

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

    const syncFunctionCatalog =
        () => {
            const runtime =
                frame.contentWindow
                    ?.WMOFSpeechEditorRuntime;

            functionNames =
                runtime
                    ?.listFunctions
                    ?.() ||
                functionNames;

            const runtimeRoles =
                normalizeFunctionRoles(
                    runtime
                        ?.listFunctionRoles
                        ?.()
                        ?.functionRoles
                );

            const savedRoles =
                normalizeFunctionRoles(
                    savedFunctionRoles
                );

            const draftRoles =
                normalizeFunctionRoles(
                    draftFunctionRoles
                );

            const assignedDraft =
                new Set(
                    Object.values(
                        draftRoles
                    )
                        .flat()
                );

            for (
                const role of
                Object.keys(
                    runtimeRoles
                )
            ) {
                for (
                    const name of
                    runtimeRoles[role]
                ) {
                    if (
                        assignedDraft.has(
                            name
                        )
                    ) {
                        continue;
                    }

                    draftRoles[role]
                        .push(
                            name
                        );

                    savedRoles[role]
                        .push(
                            name
                        );

                    assignedDraft.add(
                        name
                    );
                }
            }

            savedFunctionRoles =
                normalizeFunctionRoles(
                    savedRoles
                );

            draftFunctionRoles =
                normalizeFunctionRoles(
                    draftRoles
                );

            functionCombo
                ?.refresh?.();

            preprocCombo
                ?.refresh?.();
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
                                syncFunctionCatalog();
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

            if (!entry) {
                return;
            }

            editorActions
                .removeSpeechConfiguration({
                    id:
                        entry.id,
                    selector:
                        selectorFor(
                            element
                        )
                });
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

            editorActions
                .setSpeechAttributes({
                    id:
                        entryForElement(
                            element
                        )?.id,
                    selector:
                        selectorFor(
                            element
                        ),
                    attrs: {
                        "speech-pattern":
                            nextPattern
                    }
                });

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
            const entries = [];

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
                        entries.push({
                            id:
                                entry.id,
                            order
                        });
                    }
                }
            );

            if (entries.length) {
                editorActions
                    .reorderSpeechEntries({
                        entries
                    });
            }
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

            if (after) {
                parent.insertBefore(
                    dragged,
                    target.nextSibling
                );
            }
            else {
                parent.insertBefore(
                    dragged,
                    target
                );
            }

            const selector =
                isCommand
                    ? "speech-command"
                    : "speech-menu";

            persistSiblingOrder(
                directSpeechChildren(
                    parent,
                    selector
                )
            );

            status(
                isCommand
                    ? "Speech Command order changed."
                    : "Speech Menu order changed."
            );

            scheduleLiveRefresh();

            return true;
        };

    const attachDragBehavior =
        (
            wrapper,
            handle,
            element,
            kind
        ) => {
            wrapper.dataset
                .dragKind =
                kind;

            handle.draggable =
                true;

            handle.setAttribute(
                "role",
                "button"
            );

            handle.tabIndex =
                0;

            handle.addEventListener(
                "pointerdown",
                event =>
                    event.stopPropagation()
            );

            handle.addEventListener(
                "click",
                event => {
                    event.preventDefault();
                    event.stopPropagation();
                }
            );

            handle.addEventListener(
                "dragstart",
                event => {
                    draggedPhraseItem = {
                        element,
                        kind,
                        wrapper
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

            handle.addEventListener(
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

                    if (
                        event.dataTransfer
                    ) {
                        event.dataTransfer
                            .dropEffect =
                            "move";
                    }

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
                event => {
                    if (
                        wrapper.contains(
                            event.relatedTarget
                        )
                    ) {
                        return;
                    }

                    wrapper.classList
                        .remove(
                            "drop-before",
                            "drop-after"
                        );
                }
            );

            wrapper.addEventListener(
                "drop",
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

                    event.preventDefault();
                    event.stopPropagation();

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
                    "div"
                );

            button.className =
                "phrase-group-button";
            button.setAttribute(
                "role",
                "button"
            );
            button.tabIndex =
                0;

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
                    handle,
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

            button.addEventListener(
                "keydown",
                event => {
                    if (
                        event.key !==
                            "Enter" &&
                        event.key !==
                            " "
                    ) {
                        return;
                    }

                    event.preventDefault();

                    selectElement(
                        group.element,
                        {
                            scrollPhrase:
                                false
                        }
                    );
                }
            );

            wrapper.append(
                button
            );

            return wrapper;
        };

    const menuStateKey =
        menu =>
            entryForElement(
                menu
            )?.id ||
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
                        : true;

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

                const label =
                    document.createElement(
                        "span"
                    );

                label.className =
                    "speech-menu-label";

                label.textContent =
                    "Speech Menu" +
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
                    );

                const editButton =
                    document.createElement(
                        "button"
                    );

                editButton.type =
                    "button";
                editButton.className =
                    "speech-menu-edit";
                editButton.textContent =
                    "Edit";

                editButton.addEventListener(
                    "pointerdown",
                    event =>
                        event.stopPropagation()
                );

                editButton.addEventListener(
                    "click",
                    event => {
                        event.preventDefault();
                        event.stopPropagation();

                        selectElement(
                            menu,
                            {
                                scrollPhrase:
                                    false
                            }
                        );
                    }
                );

                summary.append(
                    handle,
                    label,
                    editButton
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
                    handle,
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
                true;

            if (!edit) {
                refreshRegexBuilderControls();
                return;
            }

            const isMenu =
                edit.matches(
                    "speech-menu"
                );

            $("menuActions").hidden =
                !isMenu;

            $("removeButton").hidden =
                false;

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
                    "speech-preproc-field",
                    "speech-index"
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
                    "Remove Speech Menu";
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
                    "Delete Speech Command";
            }
            else {
                $("removeButton")
                    .textContent =
                    "Remove speech attributes";
            }

            refreshRegexBuilderControls();
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

    const regexBuilderCanTarget =
        () => {
            const edit =
                candidateEditElement();

            return Boolean(
                edit &&
                !edit.matches(
                    "speech-menu"
                )
            );
        };

    const regexBuilderIsLive =
        () =>
            $("regexBuilderLive")
                .getAttribute(
                    "aria-pressed"
                ) ===
                "true";

    const setRegexBuilderMessage =
        (
            message,
            error = false
        ) => {
            $("regexBuilderMessage")
                .textContent =
                message || "";

            $("regexBuilderMessage")
                .classList
                .toggle(
                    "error",
                    error
                );
        };

    const refreshRegexBuilderControls =
        () => {
            const valid =
                Boolean(
                    regexBuilderResult
                        .valid
                );

            const canTarget =
                regexBuilderCanTarget();

            $("regexBuilderCopy")
                .disabled =
                !valid;

            $("regexBuilderPaste")
                .disabled =
                !valid ||
                !canTarget;

            $("regexBuilderLive")
                .disabled =
                !canTarget;

            if (
                !canTarget &&
                regexBuilderIsLive()
            ) {
                $("regexBuilderLive")
                    .setAttribute(
                        "aria-pressed",
                        "false"
                    );
            }
        };

    const applyRegexBuilderPattern =
        (
            source = "paste"
        ) => {
            if (
                !regexBuilderResult
                    .valid ||
                !regexBuilderCanTarget()
            ) {
                return false;
            }

            const input =
                form.elements
                    .namedItem(
                        "speech-pattern"
                    );

            if (!input) {
                return false;
            }

            if (
                input.value ===
                regexBuilderResult
                    .pattern
            ) {
                return true;
            }

            input.value =
                regexBuilderResult
                    .pattern;

            input.dispatchEvent(
                new Event(
                    "input",
                    {
                        bubbles:
                            true
                    }
                )
            );

            setRegexBuilderMessage(
                source === "live"
                    ? "Live pattern updated in the editor draft."
                    : "Regex pasted into speech-pattern. Save changes to commit it."
            );

            return true;
        };

    const setRegexBuilderLive =
        enabled => {
            const active =
                Boolean(
                    enabled &&
                    regexBuilderCanTarget()
                );

            $("regexBuilderLive")
                .setAttribute(
                    "aria-pressed",
                    String(active)
                );

            if (active) {
                if (
                    regexBuilderResult
                        .valid
                ) {
                    applyRegexBuilderPattern(
                        "live"
                    );
                }
                else {
                    setRegexBuilderMessage(
                        "Live is on. The draft will update when the template becomes valid."
                    );
                }
            }
            else if (enabled) {
                setRegexBuilderMessage(
                    "Select a Speech Command or speech-enabled element before enabling Live.",
                    true
                );
            }
        };

    const regexBuilderContextChoices =
        () => {
            const choices = [];

            const templates =
                globalThis
                    .WMOFRegexBuilder
                    ?.templates ||
                [];

            for (
                const template of
                templates.filter(
                    item =>
                        item.group ===
                        "app"
                )
            ) {
                choices.push({
                    kind:
                        "App templates",
                    appSpecific:
                        true,
                    canonical:
                        template.token
                            .slice(
                                1,
                                -1
                            ),
                    label:
                        template.token,
                    description:
                        template.description
                });
            }

            if (frameDocument) {
                const contexts =
                    new Set();

                for (
                    const element of
                    frameDocument
                        .querySelectorAll(
                            "[speech-preproc-context]"
                        )
                ) {
                    const value =
                        element
                            .getAttribute(
                                "speech-preproc-context"
                            )
                            ?.trim();

                    if (
                        value &&
                        /^[A-Za-z_$][\w$]*$/
                            .test(value)
                    ) {
                        contexts.add(
                            value
                        );
                    }
                }

                for (
                    const context of
                    [...contexts]
                        .sort()
                ) {
                    if (
                        templates.some(
                            template =>
                                template.group ===
                                    "app" &&
                                template.token ===
                                    "<" +
                                    context +
                                    ">"
                        )
                    ) {
                        continue;
                    }

                    choices.push({
                        kind:
                            "App templates",
                        appSpecific:
                            true,
                        canonical:
                            context,
                        label:
                            "<" +
                            context +
                            ">",
                        description:
                            "WMOF speech preprocessing context used by the app."
                    });
                }
            }

            for (
                const template of
                templates.filter(
                    item =>
                        item.group !==
                        "app"
                )
            ) {
                choices.push({
                    kind:
                        "Generic templates",
                    appSpecific:
                        false,
                    canonical:
                        template.token
                            .slice(
                                1,
                                -1
                            ),
                    label:
                        template.token,
                    description:
                        template.description
                });
            }

            if (frameDocument) {
                const fields =
                    new Set();

                for (
                    const element of
                    frameDocument
                        .querySelectorAll(
                            "[speech-preproc-field]"
                        )
                ) {
                    const value =
                        element
                            .getAttribute(
                                "speech-preproc-field"
                            )
                            ?.trim();

                    if (
                        value &&
                        /^[A-Za-z_$][\w$]*$/
                            .test(value)
                    ) {
                        fields.add(
                            value
                        );
                    }
                }

                for (
                    const element of
                    frameDocument
                        .querySelectorAll(
                            "[speech-pattern]"
                        )
                ) {
                    for (
                        const field of
                        namedFields(
                            element
                                .getAttribute(
                                    "speech-pattern"
                                ) ||
                                ""
                        )
                    ) {
                        fields.add(
                            field
                        );
                    }
                }

                for (
                    const field of
                    [...fields]
                        .sort()
                ) {
                    choices.push({
                        kind:
                            "Existing fields",
                        appSpecific:
                            false,
                        canonical:
                            field,
                        label:
                            "<" +
                            field +
                            ">",
                        description:
                            "Existing named speech capture."
                    });
                }
            }

            return choices;
        };

    const renderRegexBuilderPicker =
        choices => {
            const picker =
                $("regexBuilderPicker");

            picker.replaceChildren();

            let previousKind;

            for (
                const choice of
                choices
            ) {
                if (
                    choice.kind !==
                    previousKind
                ) {
                    const heading =
                        document
                            .createElement(
                                "div"
                            );

                    heading.className =
                        "regex-picker-heading";

                    if (
                        choice.appSpecific
                    ) {
                        heading.classList
                            .add(
                                "app-specific"
                            );
                    }

                    heading.textContent =
                        choice.kind;

                    picker.append(
                        heading
                    );

                    previousKind =
                        choice.kind;
                }

                const button =
                    document
                        .createElement(
                            "button"
                        );

                button.type =
                    "button";
                button.className =
                    "regex-picker-option";

                if (
                    choice.appSpecific
                ) {
                    button.classList
                        .add(
                            "app-specific"
                        );
                }

                button.setAttribute(
                    "role",
                    "option"
                );

                const token =
                    document
                        .createElement(
                            "span"
                        );

                token.className =
                    "regex-picker-token";

                token.textContent =
                    choice.label;

                const description =
                    document
                        .createElement(
                            "span"
                        );

                description.className =
                    "regex-picker-description";

                description.textContent =
                    choice.description ||
                    "";

                button.append(
                    token,
                    description
                );

                button.addEventListener(
                    "pointerdown",
                    event =>
                        event.preventDefault()
                );

                button.addEventListener(
                    "click",
                    () => {
                        const input =
                            $("regexBuilderInput");

                        const range =
                            regexBuilderPickerRange;

                        if (!range) {
                            return;
                        }

                        const before =
                            input.value.slice(
                                0,
                                range.start
                            );

                        const after =
                            input.value.slice(
                                range.closed
                                    ? range.end + 1
                                    : range.end
                            );

                        const inserted =
                            "<" +
                            choice.canonical +
                            ">";

                        input.value =
                            before +
                            inserted +
                            after;

                        const caret =
                            before.length +
                            inserted.length;

                        input.setSelectionRange(
                            caret,
                            caret
                        );

                        picker.hidden =
                            true;

                        regexBuilderPickerRange =
                            undefined;

                        updateRegexBuilder();
                        input.focus();
                    }
                );

                picker.append(
                    button
                );
            }

            picker.hidden =
                choices.length === 0;
        };

    const showRegexBuilderPicker =
        (
            range,
            choices
        ) => {
            regexBuilderPickerRange =
                range;

            renderRegexBuilderPicker(
                choices
            );
        };

    const hideRegexBuilderPicker =
        () => {
            $("regexBuilderPicker")
                .hidden =
                true;

            regexBuilderPickerRange =
                undefined;
        };

    const regexBuilderChoicesFor =
        value => {
            const source =
                String(value || "");

            const inferred =
                globalThis
                    .WMOFRegexBuilder
                    ?.inferWildcard(
                        source
                    ) ||
                [];

            if (inferred.length) {
                return inferred.map(
                    canonical => {
                        const appSpecific =
                            /(?:^|:)(?:time|duration|percent|date)$/
                                .test(
                                    canonical
                                );

                        return {
                            kind:
                                appSpecific
                                    ? (
                                        inferred.length >
                                            1
                                            ? "Matching app templates"
                                            : "App template"
                                    )
                                    : (
                                        inferred.length >
                                            1
                                            ? "Matching wildcard templates"
                                            : "Template"
                                    ),
                            appSpecific,
                            canonical,
                            label:
                                "<" +
                                canonical +
                                ">",
                            description:
                                "Inferred from <" +
                                source +
                                ">."
                        };
                    }
                );
            }

            const filter =
                source
                    .trim()
                    .toLowerCase();

            return regexBuilderContextChoices()
                .filter(
                    choice =>
                        !filter ||
                        choice.canonical
                            .toLowerCase()
                            .includes(
                                filter
                            ) ||
                        choice.label
                            .toLowerCase()
                            .includes(
                                filter
                            )
                );
        };

    const updateRegexBuilder =
        () => {
            regexBuilderResult =
                globalThis
                    .WMOFRegexBuilder
                    ?.compile(
                        $("regexBuilderInput")
                            .value
                    ) ||
                {
                    valid:
                        false,
                    pattern:
                        "",
                    error:
                        "Regex Builder is unavailable."
                };

            $("regexBuilderRegexRow")
                .dataset
                .valid =
                String(
                    regexBuilderResult
                        .valid
                );

            $("regexBuilderOutput")
                .textContent =
                regexBuilderResult
                    .valid
                    ? regexBuilderResult
                        .pattern
                    : (
                        "Invalid: " +
                        regexBuilderResult
                            .error
                    );

            refreshRegexBuilderControls();

            if (
                regexBuilderResult
                    .valid &&
                regexBuilderIsLive()
            ) {
                applyRegexBuilderPattern(
                    "live"
                );
            }
        };

    const handleRegexBuilderInput =
        () => {
            const input =
                $("regexBuilderInput");

            let caret =
                input.selectionStart ??
                input.value.length;

            if (
                caret > 0 &&
                input.value[
                    caret - 1
                ] === ">"
            ) {
                const close =
                    caret - 1;

                const start =
                    input.value
                        .lastIndexOf(
                            "<",
                            close
                        );

                if (start >= 0) {
                    const raw =
                        input.value.slice(
                            start + 1,
                            close
                        );

                    const candidates =
                        globalThis
                            .WMOFRegexBuilder
                            ?.inferWildcard(
                                raw
                            ) ||
                        [];

                    if (
                        candidates.length ===
                            1
                    ) {
                        const replacement =
                            "<" +
                            candidates[0] +
                            ">";

                        input.value =
                            input.value.slice(
                                0,
                                start
                            ) +
                            replacement +
                            input.value.slice(
                                close + 1
                            );

                        caret =
                            start +
                            replacement.length;

                        input.setSelectionRange(
                            caret,
                            caret
                        );

                        hideRegexBuilderPicker();
                    }
                    else if (
                        candidates.length >
                            1
                    ) {
                        showRegexBuilderPicker(
                            {
                                start,
                                end:
                                    close,
                                closed:
                                    true
                            },
                            regexBuilderChoicesFor(
                                raw
                            )
                        );
                    }
                    else {
                        hideRegexBuilderPicker();
                    }
                }
            }
            else {
                const start =
                    input.value
                        .lastIndexOf(
                            "<",
                            Math.max(
                                0,
                                caret - 1
                            )
                        );

                const previousClose =
                    input.value
                        .lastIndexOf(
                            ">",
                            Math.max(
                                0,
                                caret - 1
                            )
                        );

                if (
                    start >= 0 &&
                    start >
                        previousClose
                ) {
                    const raw =
                        input.value.slice(
                            start + 1,
                            caret
                        );

                    showRegexBuilderPicker(
                        {
                            start,
                            end:
                                caret,
                            closed:
                                false
                        },
                        regexBuilderChoicesFor(
                            raw
                        )
                    );
                }
                else {
                    hideRegexBuilderPicker();
                }
            }

            updateRegexBuilder();
        };

    const normalizeFunctionRoles =
        value => {
            const source =
                value &&
                typeof value ===
                    "object"
                    ? value
                    : {};

            const result =
                emptyFunctionRoles();

            for (
                const role of
                Object.keys(result)
            ) {
                result[role] =
                    [
                        ...new Set(
                            Array.isArray(
                                source[role]
                            )
                                ? source[role]
                                : []
                        )
                    ].sort(
                        (a, b) =>
                            a.localeCompare(b)
                    );
            }

            return result;
        };

    const roleOfFunction =
        name => {
            for (
                const role of
                Object.keys(
                    draftFunctionRoles
                )
            ) {
                if (
                    draftFunctionRoles[
                        role
                    ].includes(
                        name
                    )
                ) {
                    return role;
                }
            }

            return "";
        };

    const setFunctionRole =
        (
            name,
            nextRole
        ) => {
            const roles =
                normalizeFunctionRoles(
                    draftFunctionRoles
                );

            for (
                const role of
                Object.keys(roles)
            ) {
                roles[role] =
                    roles[role]
                        .filter(
                            value =>
                                value !==
                                name
                        );
            }

            if (
                Object.prototype
                    .hasOwnProperty
                    .call(
                        roles,
                        nextRole
                    )
            ) {
                roles[nextRole]
                    .push(name);

                roles[nextRole]
                    .sort(
                        (a, b) =>
                            a.localeCompare(b)
                    );
            }

            draftFunctionRoles =
                roles;

            functionCombo.refresh();
            preprocCombo.refresh();
            updateButtons();

            status(
                name +
                " marked as " +
                nextRole +
                "."
            );
        };

    const attachCombobox =
        (
            input,
            optionsNode,
            role
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

            const roleNames =
                () =>
                    functionNames.filter(
                        name =>
                            roleOfFunction(
                                name
                            ) ===
                                role
                    );

            const renderOptions =
                () => {
                    optionsNode
                        .replaceChildren();

                    for (
                        const name of
                        roleNames()
                    ) {
                        const row =
                            document.createElement(
                                "div"
                            );

                        row.className =
                            "combo-option-row";

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

                        const toggle =
                            document.createElement(
                                "button"
                            );

                        toggle.type =
                            "button";
                        toggle.className =
                            "combo-role-toggle";

                        const alternateRole =
                            role ===
                                "speech-processing"
                                ? "action"
                                : "speech-processing";

                        toggle.textContent =
                            role ===
                                "speech-processing"
                                ? "Mark action"
                                : "Mark speech processing";

                        toggle.title =
                            "Change function role to " +
                            alternateRole;

                        toggle.addEventListener(
                            "pointerdown",
                            event => {
                                event.preventDefault();
                                event.stopPropagation();
                            }
                        );

                        toggle.addEventListener(
                            "click",
                            event => {
                                event.preventDefault();
                                event.stopPropagation();

                                editorActions
                                    .setFunctionRole({
                                        name,
                                        role:
                                            alternateRole
                                    });

                                requestAnimationFrame(
                                    () => {
                                        optionsNode.hidden =
                                            false;
                                        input.setAttribute(
                                            "aria-expanded",
                                            "true"
                                        );
                                    }
                                );
                            }
                        );

                        row.append(
                            button,
                            toggle
                        );

                        optionsNode.append(
                            row
                        );
                    }

                    active = -1;
                    moveToPrefix();
                };

            const show = () => {
                renderOptions();

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
                        160
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
            $("functionOptions"),
            "action"
        );

    const preprocCombo =
        attachCombobox(
            $("preprocInput"),
            $("preprocOptions"),
            "speech-processing"
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
                        "speech-index",
                        "open",
                        "hidden",
                        "disabled"
                    ]
                }
            );

            functionNames = [];

            if (macrosLoaded) {
                syncMacrosToFrame();
            }

            const actionEvents =
                macroApi()
                    ?.events;

            if (
                actionEvents &&
                actionEvents !==
                    macroRecorderEvents
            ) {
                macroRecorderEvents =
                    actionEvents;

                actionEvents
                    .addEventListener(
                        "recorded",
                        event => {
                            const recording =
                                event.detail
                                    ?.recording;

                            if (!recording) {
                                return;
                            }

                            macroWorking.steps =
                                cloneMacroValue(
                                    recording.steps ||
                                    []
                                );

                            renderMacroSteps();
                            updateMacroControls();
                        }
                    );
            }

            syncFunctionCatalog();
            renderMacroBuilder();

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
            () =>
                editorActions
                    .setOverlay({})
        );

    $("regexBuilderHelpButton")
        .addEventListener(
            "click",
            () => {
                const help =
                    $("regexBuilderHelp");

                help.hidden =
                    !help.hidden;

                $("regexBuilderHelpButton")
                    .setAttribute(
                        "aria-expanded",
                        String(
                            !help.hidden
                        )
                    );
            }
        );

    $("regexBuilderInput")
        .addEventListener(
            "input",
            handleRegexBuilderInput
        );

    $("regexBuilderInput")
        .addEventListener(
            "keydown",
            event => {
                if (
                    event.key ===
                    "Escape"
                ) {
                    hideRegexBuilderPicker();
                }
            }
        );

    $("regexBuilderCopy")
        .addEventListener(
            "click",
            async () => {
                if (
                    !regexBuilderResult
                        .valid
                ) {
                    return;
                }

                try {
                    await navigator
                        .clipboard
                        .writeText(
                            regexBuilderResult
                                .pattern
                        );

                    setRegexBuilderMessage(
                        "Regex copied."
                    );
                }
                catch {
                    const copy =
                        document
                            .createElement(
                                "textarea"
                            );

                    copy.value =
                        regexBuilderResult
                            .pattern;

                    copy.style.position =
                        "fixed";
                    copy.style.opacity =
                        "0";

                    document.body.append(
                        copy
                    );

                    copy.select();

                    const copied =
                        document.execCommand(
                            "copy"
                        );

                    copy.remove();

                    setRegexBuilderMessage(
                        copied
                            ? "Regex copied."
                            : "Copy failed.",
                        !copied
                    );
                }
            }
        );

    $("regexBuilderPaste")
        .addEventListener(
            "click",
            () =>
                applyRegexBuilderPattern(
                    "paste"
                )
        );

    $("regexBuilderLive")
        .addEventListener(
            "click",
            () =>
                setRegexBuilderLive(
                    !regexBuilderIsLive()
                )
        );

    document.addEventListener(
        "pointerdown",
        event => {
            if (
                !event.target.closest(
                    ".regex-builder-field"
                )
            ) {
                hideRegexBuilderPicker();
            }
        }
    );

    updateRegexBuilder();

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

            editorActions
                .setSpeechAttributes({
                    id:
                        entryForElement(
                            edit
                        )?.id,
                    selector:
                        selectorFor(
                            edit
                        ),
                    attrs: {
                        [target.name]:
                            target.value
                    }
                });

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

                editorActions
                    .setSpeechAttributes({
                        id:
                            entryForElement(
                                edit
                            )?.id,
                        selector:
                            selectorFor(
                                edit
                            ),
                        attrs: {
                            "speech-modal":
                                event.target
                                    .value
                        }
                    });
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
                    if (!existing) {
                        editorActions
                            .addSpeechMenu({
                                target:
                                    selectorFor(
                                        host
                                    )
                            });

                        status(
                            "Speech Menu added."
                        );
                    }

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

                const childCount =
                    existing
                        .querySelectorAll(
                            ":scope > speech-command"
                        )
                        .length;

                if (
                    childCount &&
                    !confirm(
                        "This Speech Menu contains " +
                        childCount +
                        " speech command" +
                        (
                            childCount ===
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

                editorActions
                    .removeSpeechMenu({
                        id:
                            menuEntry.id,
                        target:
                            menuEntry.target
                    });

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

                if (!menu) {
                    return;
                }

                const menuEntry =
                    writableEntry(
                        menu
                    );

                if (!menuEntry) {
                    return;
                }

                editorActions
                    .addSpeechCommand({
                        parentId:
                            menuEntry.id
                    });

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

                if (!edit) {
                    return;
                }

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
                    const childCount =
                        edit.querySelectorAll(
                            ":scope > speech-command"
                        )
                            .length;

                    if (
                        childCount &&
                        !confirm(
                            "Removing this Speech Menu will also remove " +
                            childCount +
                            " child speech command" +
                            (
                                childCount ===
                                    1
                                    ? ""
                                    : "s"
                            ) +
                            ". Continue?"
                        )
                    ) {
                        return;
                    }
                }

                editorActions
                    .removeSpeechConfiguration({
                        id:
                            entry.id,
                        selector:
                            selectorFor(
                                edit
                            )
                    });
            }
        );

    const WORKSPACE_STORAGE =
        "wmof.speechEditor.workspace";

    const workspacePane =
        id =>
            document
                .querySelector(
                    `[data-pane-id="${id}"]`
                );

    const workspaceDock =
        side =>
            document
                .querySelector(
                    `[data-workspace-dock="${side}"]`
                );

    const workspacePaneIds =
        () => [
            "dom",
            "phrases",
            "attributes",
            "regex",
            "macro"
        ];

    const saveWorkspaceState =
        () => {
            const state = {
                left:
                    [
                        ...workspaceDock(
                            "left"
                        )
                            .querySelectorAll(
                                ":scope > .workspace-pane"
                            )
                    ]
                        .map(
                            pane =>
                                pane.dataset
                                    .paneId
                        ),
                right:
                    [
                        ...workspaceDock(
                            "right"
                        )
                            .querySelectorAll(
                                ":scope > .workspace-pane"
                            )
                    ]
                        .map(
                            pane =>
                                pane.dataset
                                    .paneId
                        ),
                sizes:
                    Object.fromEntries(
                        workspacePaneIds()
                            .map(
                                id => [
                                    id,
                                    Math.round(
                                        workspacePane(
                                            id
                                        )
                                            ?.getBoundingClientRect()
                                            .height ||
                                        0
                                    )
                                ]
                            )
                    )
            };

            try {
                localStorage
                    .setItem(
                        WORKSPACE_STORAGE,
                        JSON.stringify(
                            state
                        )
                    );
            }
            catch {}

            $("workspacePreset")
                .value =
                "custom";
        };

    const rebuildWorkspaceSplitters =
        dock => {
            dock
                .querySelectorAll(
                    ":scope > .workspace-splitter"
                )
                .forEach(
                    splitter =>
                        splitter.remove()
                );

            const panes =
                [
                    ...dock
                        .querySelectorAll(
                            ":scope > .workspace-pane"
                        )
                ];

            for (
                let index = 1;
                index < panes.length;
                index += 1
            ) {
                const previous =
                    panes[
                        index -
                        1
                    ];

                const next =
                    panes[
                        index
                    ];

                const splitter =
                    document
                        .createElement(
                            "div"
                        );

                splitter.className =
                    "workspace-splitter";

                splitter.tabIndex =
                    0;

                splitter.setAttribute(
                    "role",
                    "separator"
                );

                splitter.setAttribute(
                    "aria-orientation",
                    "horizontal"
                );

                splitter.setAttribute(
                    "aria-label",
                    "Resize " +
                        previous.dataset
                            .paneId +
                        " and " +
                        next.dataset
                            .paneId
                );

                let startY;
                let previousHeight;
                let nextHeight;

                const resize =
                    delta => {
                        const minimum =
                            84;

                        const first =
                            Math.max(
                                minimum,
                                previousHeight +
                                    delta
                            );

                        const second =
                            Math.max(
                                minimum,
                                nextHeight -
                                    delta
                            );

                        if (
                            first +
                                second >
                            previousHeight +
                                nextHeight
                        ) {
                            return;
                        }

                        previous.style.flex =
                            `0 0 ${first}px`;

                        next.style.flex =
                            `0 0 ${second}px`;
                    };

                splitter
                    .addEventListener(
                        "pointerdown",
                        event => {
                            startY =
                                event.clientY;

                            previousHeight =
                                previous
                                    .getBoundingClientRect()
                                    .height;

                            nextHeight =
                                next
                                    .getBoundingClientRect()
                                    .height;

                            splitter
                                .setPointerCapture?.(
                                    event.pointerId
                                );

                            event.preventDefault();
                        }
                    );

                splitter
                    .addEventListener(
                        "pointermove",
                        event => {
                            if (
                                startY ===
                                    undefined
                            ) {
                                return;
                            }

                            resize(
                                event.clientY -
                                    startY
                            );
                        }
                    );

                const finish =
                    () => {
                        if (
                            startY !==
                                undefined
                        ) {
                            saveWorkspaceState();
                        }

                        startY =
                            undefined;
                    };

                splitter
                    .addEventListener(
                        "pointerup",
                        finish
                    );

                splitter
                    .addEventListener(
                        "pointercancel",
                        finish
                    );

                splitter
                    .addEventListener(
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

                            previousHeight =
                                previous
                                    .getBoundingClientRect()
                                    .height;

                            nextHeight =
                                next
                                    .getBoundingClientRect()
                                    .height;

                            resize(
                                event.key ===
                                    "ArrowDown"
                                    ? 20
                                    : -20
                            );

                            saveWorkspaceState();
                        }
                    );

                next.before(
                    splitter
                );
            }
        };

    const refreshWorkspace =
        () => {
            rebuildWorkspaceSplitters(
                workspaceDock(
                    "left"
                )
            );

            rebuildWorkspaceSplitters(
                workspaceDock(
                    "right"
                )
            );
        };

    const moveWorkspacePane =
        (
            pane,
            side,
            {
                save = true
            } = {}
        ) => {
            const dock =
                workspaceDock(
                    side
                );

            if (
                !pane ||
                !dock
            ) {
                return;
            }

            pane.style.flex =
                "";

            dock.append(
                pane
            );

            refreshWorkspace();

            if (save) {
                saveWorkspaceState();
            }
        };

    const applyWorkspacePreset =
        preset => {
            const layouts = {
                authoring: {
                    left: [
                        "dom",
                        "macro"
                    ],
                    right: [
                        "phrases",
                        "attributes",
                        "regex"
                    ]
                },
                macro: {
                    left: [
                        "dom",
                        "phrases",
                        "regex"
                    ],
                    right: [
                        "macro",
                        "attributes"
                    ]
                },
                regex: {
                    left: [
                        "dom",
                        "phrases",
                        "macro"
                    ],
                    right: [
                        "regex",
                        "attributes"
                    ]
                }
            };

            const layout =
                layouts[
                    preset
                ];

            if (!layout) {
                return;
            }

            for (
                const [
                    side,
                    ids
                ] of Object.entries(
                    layout
                )
            ) {
                const dock =
                    workspaceDock(
                        side
                    );

                for (
                    const id of
                    ids
                ) {
                    const pane =
                        workspacePane(
                            id
                        );

                    pane.style.flex =
                        "";

                    dock.append(
                        pane
                    );
                }
            }

            refreshWorkspace();

            try {
                localStorage
                    .setItem(
                        WORKSPACE_STORAGE,
                        JSON.stringify({
                            left:
                                layout.left,
                            right:
                                layout.right,
                            sizes: {}
                        })
                    );
            }
            catch {}

            $("workspacePreset")
                .value =
                preset;
        };

    const restoreWorkspace =
        () => {
            let state;

            try {
                state =
                    JSON.parse(
                        localStorage
                            .getItem(
                                WORKSPACE_STORAGE
                            ) ||
                        "null"
                    );
            }
            catch {}

            if (
                !state ||
                !Array.isArray(
                    state.left
                ) ||
                !Array.isArray(
                    state.right
                )
            ) {
                applyWorkspacePreset(
                    "authoring"
                );

                return;
            }

            const seen =
                new Set();

            for (
                const [
                    side,
                    ids
                ] of [
                    [
                        "left",
                        state.left
                    ],
                    [
                        "right",
                        state.right
                    ]
                ]
            ) {
                const dock =
                    workspaceDock(
                        side
                    );

                for (
                    const id of
                    ids
                ) {
                    const pane =
                        workspacePane(
                            id
                        );

                    if (
                        !pane ||
                        seen.has(
                            id
                        )
                    ) {
                        continue;
                    }

                    seen.add(
                        id
                    );

                    dock.append(
                        pane
                    );

                    const size =
                        Number(
                            state.sizes?.[
                                id
                            ]
                        );

                    pane.style.flex =
                        size >=
                            84
                            ? `0 0 ${size}px`
                            : "";
                }
            }

            for (
                const id of
                workspacePaneIds()
            ) {
                if (
                    !seen.has(
                        id
                    )
                ) {
                    workspaceDock(
                        id ===
                            "dom"
                            ? "left"
                            : "right"
                    )
                        .append(
                            workspacePane(
                                id
                            )
                        );
                }
            }

            refreshWorkspace();

            $("workspacePreset")
                .value =
                "custom";
        };

    const installWorkspace =
        () => {
            for (
                const pane of
                document
                    .querySelectorAll(
                        ".workspace-pane[data-pane-id]"
                    )
            ) {
                const heading =
                    pane
                        .querySelector(
                            ".workspace-pane-heading"
                        );

                if (!heading) {
                    continue;
                }

                heading.draggable =
                    true;

                heading
                    .addEventListener(
                        "dragstart",
                        event => {
                            if (
                                event.target
                                    .closest?.(
                                        "button,input,select,textarea,a"
                                    )
                            ) {
                                event.preventDefault();

                                return;
                            }

                            pane.classList.add(
                                "is-dragging"
                            );

                            event.dataTransfer
                                ?.setData(
                                    "text/x-wmof-pane",
                                    pane.dataset
                                        .paneId
                                );
                        }
                    );

                heading
                    .addEventListener(
                        "dragend",
                        () =>
                            pane.classList
                                .remove(
                                    "is-dragging"
                                )
                    );

                const controls =
                    document
                        .createElement(
                            "span"
                        );

                controls.className =
                    "workspace-pane-controls";

                for (
                    const [
                        side,
                        label
                    ] of [
                        [
                            "left",
                            "←"
                        ],
                        [
                            "right",
                            "→"
                        ]
                    ]
                ) {
                    const button =
                        document
                            .createElement(
                                "button"
                            );

                    button.type =
                        "button";

                    button.textContent =
                        label;

                    button.title =
                        "Snap " +
                        pane.dataset
                            .paneId +
                        " " +
                        side;

                    button.setAttribute(
                        "aria-label",
                        button.title
                    );

                    button
                        .addEventListener(
                            "click",
                            event => {
                                event
                                    .stopPropagation();

                                editorActions
                                    .moveWorkspacePane({
                                        pane:
                                            pane.dataset
                                                .paneId,
                                        side
                                    });
                            }
                        );

                    controls.append(
                        button
                    );
                }

                heading.append(
                    controls
                );
            }

            for (
                const dock of
                document
                    .querySelectorAll(
                        "[data-workspace-dock]"
                    )
            ) {
                dock
                    .addEventListener(
                        "dragover",
                        event => {
                            if (
                                event.dataTransfer
                                    ?.types
                                    ?.includes(
                                        "text/x-wmof-pane"
                                    )
                            ) {
                                event.preventDefault();

                                dock.classList.add(
                                    "is-drop-target"
                                );
                            }
                        }
                    );

                dock
                    .addEventListener(
                        "dragleave",
                        event => {
                            if (
                                !dock.contains(
                                    event.relatedTarget
                                )
                            ) {
                                dock.classList
                                    .remove(
                                        "is-drop-target"
                                    );
                            }
                        }
                    );

                dock
                    .addEventListener(
                        "drop",
                        event => {
                            const id =
                                event.dataTransfer
                                    ?.getData(
                                        "text/x-wmof-pane"
                                    );

                            dock.classList
                                .remove(
                                    "is-drop-target"
                                );

                            if (!id) {
                                return;
                            }

                            event.preventDefault();

                            moveWorkspacePane(
                                workspacePane(
                                    id
                                ),
                                dock.dataset
                                    .workspaceDock
                            );
                        }
                    );
            }

            $("workspacePreset")
                .addEventListener(
                    "change",
                    event => {
                        if (
                            event.target
                                .value !==
                            "custom"
                        ) {
                            editorActions
                                .applyWorkspacePreset({
                                    preset:
                                        event.target
                                            .value
                                });
                        }
                    }
                );

            restoreWorkspace();
        };

    const macroApi =
        () =>
            frame.contentWindow
                ?.WMOFActionFunctions;

    const emptyMacro =
        () => ({
            name: "",
            parameters: [],
            steps: []
        });

    const cloneMacroValue =
        value =>
            structuredClone(
                value
            );

    const macroLiteralText =
        value => {
            if (
                value &&
                typeof value ===
                    "object" &&
                value.__wmofMacroType ===
                    "undefined"
            ) {
                return "undefined";
            }

            try {
                return JSON.stringify(
                    value
                );
            }
            catch {
                return String(
                    value
                );
            }
        };

    const parseMacroLiteral =
        value => {
            const text =
                String(
                    value
                )
                    .trim();

            if (
                text ===
                "undefined"
            ) {
                return {
                    __wmofMacroType:
                        "undefined"
                };
            }

            if (!text) {
                return "";
            }

            try {
                return JSON.parse(
                    text
                );
            }
            catch {
                return text;
            }
        };

    const actionNamesForMacro =
        () => {
            const api =
                macroApi();

            return (
                api?.list?.() ||
                []
            )
                .filter(
                    name =>
                        name !==
                        macroWorking.name
                );
        };

    const macroParameterMetadata =
        (
            action,
            index
        ) =>
            macroApi()
                ?.describe?.(
                    action
                )
                ?.parameters?.[
                    index
                ] ||
            {};

    const uniqueMacroParameterName =
        preferred => {
            let base =
                String(
                    preferred ||
                    "value"
                )
                    .replace(
                        /[^A-Za-z0-9_$]/g,
                        ""
                    );

            if (
                !/^[A-Za-z_$]/
                    .test(base)
            ) {
                base =
                    "value" +
                    base;
            }

            if (!base) {
                base =
                    "value";
            }

            let name =
                base;

            let suffix =
                2;

            while (
                macroWorking
                    .parameters
                    .some(
                        parameter =>
                            parameter.name ===
                            name
                    )
            ) {
                name =
                    base +
                    suffix;

                suffix += 1;
            }

            return name;
        };

    const ensureMacroParameter =
        (
            name,
            {
                type = "value",
                defaultValue,
                hasDefault = false
            } = {}
        ) => {
            const existing =
                macroWorking
                    .parameters
                    .find(
                        parameter =>
                            parameter.name ===
                            name
                    );

            if (existing) {
                return existing;
            }

            const parameter = {
                name,
                type:
                    type ||
                    "value"
            };

            if (hasDefault) {
                parameter.default =
                    cloneMacroValue(
                        defaultValue
                    );
            }

            macroWorking
                .parameters
                .push(
                    parameter
                );

            return parameter;
        };

    const removeMacroRole =
        name => {
            const path =
                "WMOFActions." +
                name;

            draftFunctionRoles
                .action =
                (
                    draftFunctionRoles
                        .action ||
                    []
                )
                    .filter(
                        value =>
                            value !==
                            path
                    );
        };

    const ensureMacroRole =
        name => {
            const path =
                "WMOFActions." +
                name;

            draftFunctionRoles
                .action =
                [
                    ...new Set([
                        ...(
                            draftFunctionRoles
                                .action ||
                            []
                        ),
                        path
                    ])
                ]
                    .sort(
                        (a, b) =>
                            a.localeCompare(
                                b
                            )
                    );
        };

    const syncMacrosToFrame =
        () => {
            if (!macrosLoaded) {
                return;
            }

            try {
                macroApi()
                    ?.registerMacros?.(
                        draftMacros
                    );
            }
            catch (
                error
            ) {
                $("macroMessage")
                    .textContent =
                    error.message;
            }
        };

    const updateMacroSelect =
        () => {
            const select =
                $("macroSelect");

            const selected =
                macroEditingName;

            select.replaceChildren(
                new Option(
                    "New macro…",
                    ""
                )
            );

            for (
                const macro of
                draftMacros
                    .slice()
                    .sort(
                        (a, b) =>
                            a.name
                                .localeCompare(
                                    b.name
                                )
                    )
            ) {
                select.append(
                    new Option(
                        macro.name,
                        macro.name
                    )
                );
            }

            select.value =
                draftMacros.some(
                    macro =>
                        macro.name ===
                        selected
                )
                    ? selected
                    : "";
        };

    const validateMacroWorking =
        () => {
            const api =
                macroApi();

            if (!api) {
                return {
                    valid: false,
                    reason:
                        "Preview action runtime is not ready."
                };
            }

            const name =
                String(
                    $("macroName")
                        .value ||
                    ""
                )
                    .trim();

            macroWorking.name =
                name;

            const nameResult =
                api.validateName(
                    name,
                    {
                        allowExistingMacro:
                            true
                    }
                );

            if (
                !nameResult.valid
            ) {
                return nameResult;
            }

            if (
                draftMacros.some(
                    macro =>
                        macro.name ===
                            name &&
                        macro.name !==
                            macroEditingName
                )
            ) {
                return {
                    valid: false,
                    reason:
                        "Another macro already uses this name."
                };
            }

            return api
                .validateMacro(
                    macroWorking,
                    {
                        allowExistingMacro:
                            true,
                        requireActions:
                            true
                    }
                );
        };

    const updateMacroControls =
        () => {
            const result =
                validateMacroWorking();

            $("macroNameMessage")
                .textContent =
                result.reason ||
                (
                    macroWorking.name
                        ? "Valid action function name."
                        : ""
                );

            $("macroNameMessage")
                .classList
                .toggle(
                    "error",
                    !result.valid
                );

            $("macroStage")
                .disabled =
                !result.valid;

            $("macroTest")
                .disabled =
                !result.valid;

            $("macroDelete")
                .disabled =
                !macroEditingName;
        };

    const renderMacroParameters =
        () => {
            const host =
                $("macroParameters");

            host.replaceChildren();

            if (
                !macroWorking
                    .parameters
                    .length
            ) {
                const empty =
                    document
                        .createElement(
                            "p"
                        );

                empty.className =
                    "macro-empty";

                empty.textContent =
                    "No macro parameters. Promote a recorded argument to Parameter or add one.";

                host.append(
                    empty
                );

                return;
            }

            for (
                const [
                    index,
                    parameter
                ] of macroWorking
                    .parameters
                    .entries()
            ) {
                const card =
                    document
                        .createElement(
                            "div"
                        );

                card.className =
                    "macro-parameter-card";

                const nameLabel =
                    document
                        .createElement(
                            "label"
                        );

                nameLabel.append(
                    document
                        .createTextNode(
                            "Name"
                        )
                );

                const nameInput =
                    document
                        .createElement(
                            "input"
                        );

                nameInput.value =
                    parameter.name;

                nameInput.spellcheck =
                    false;

                nameInput
                    .addEventListener(
                        "change",
                        () => {
                            const previous =
                                parameter.name;

                            const next =
                                String(
                                    nameInput.value
                                )
                                    .trim();

                            if (
                                !/^[A-Za-z_$][\\w$]*$/
                                    .test(
                                        next
                                    ) ||
                                macroWorking
                                    .parameters
                                    .some(
                                        (
                                            item,
                                            itemIndex
                                        ) =>
                                            itemIndex !==
                                                index &&
                                            item.name ===
                                                next
                                    )
                            ) {
                                nameInput.value =
                                    previous;

                                return;
                            }

                            parameter.name =
                                next;

                            for (
                                const step of
                                macroWorking
                                    .steps
                            ) {
                                for (
                                    const argument of
                                    step.args
                                ) {
                                    if (
                                        argument.source ===
                                            "parameter" &&
                                        argument.name ===
                                            previous
                                    ) {
                                        argument.name =
                                            next;
                                    }
                                }
                            }

                            renderMacroBuilder();
                        }
                    );

                nameLabel.append(
                    nameInput
                );

                const typeLabel =
                    document
                        .createElement(
                            "label"
                        );

                typeLabel.append(
                    document
                        .createTextNode(
                            "Type"
                        )
                );

                const type =
                    document
                        .createElement(
                            "select"
                        );

                for (
                    const value of
                    [
                        "value",
                        "text",
                        "number",
                        "boolean",
                        "percent",
                        "time",
                        "duration",
                        "choice"
                    ]
                ) {
                    type.append(
                        new Option(
                            value,
                            value
                        )
                    );
                }

                type.value =
                    parameter.type ||
                    "value";

                type
                    .addEventListener(
                        "change",
                        () => {
                            parameter.type =
                                type.value;

                            updateMacroControls();
                        }
                    );

                typeLabel.append(
                    type
                );

                const defaultLabel =
                    document
                        .createElement(
                            "label"
                        );

                defaultLabel.append(
                    document
                        .createTextNode(
                            "Default"
                        )
                );

                const defaultInput =
                    document
                        .createElement(
                            "input"
                        );

                defaultInput.placeholder =
                    "optional";

                if (
                    Object.prototype
                        .hasOwnProperty
                        .call(
                            parameter,
                            "default"
                        )
                ) {
                    defaultInput.value =
                        macroLiteralText(
                            parameter.default
                        );
                }

                defaultInput
                    .addEventListener(
                        "change",
                        () => {
                            if (
                                !defaultInput
                                    .value
                                    .trim()
                            ) {
                                delete parameter
                                    .default;
                            }
                            else {
                                parameter.default =
                                    parseMacroLiteral(
                                        defaultInput
                                            .value
                                    );
                            }

                            updateMacroControls();
                        }
                    );

                defaultLabel.append(
                    defaultInput
                );

                const remove =
                    document
                        .createElement(
                            "button"
                        );

                remove.type =
                    "button";

                remove.textContent =
                    "×";

                remove.setAttribute(
                    "aria-label",
                    "Remove parameter " +
                        parameter.name
                );

                remove
                    .addEventListener(
                        "click",
                        () => {
                            const fallback =
                                Object.prototype
                                    .hasOwnProperty
                                    .call(
                                        parameter,
                                        "default"
                                    )
                                    ? cloneMacroValue(
                                        parameter
                                            .default
                                    )
                                    : {
                                        __wmofMacroType:
                                            "undefined"
                                    };

                            for (
                                const step of
                                macroWorking
                                    .steps
                            ) {
                                for (
                                    const argument of
                                    step.args
                                ) {
                                    if (
                                        argument.source ===
                                            "parameter" &&
                                        argument.name ===
                                            parameter.name
                                    ) {
                                        argument.source =
                                            "literal";

                                        delete argument
                                            .name;

                                        argument.value =
                                            cloneMacroValue(
                                                fallback
                                            );
                                    }
                                }
                            }

                            macroWorking
                                .parameters
                                .splice(
                                    index,
                                    1
                                );

                            renderMacroBuilder();
                        }
                    );

                card.append(
                    nameLabel,
                    typeLabel,
                    defaultLabel,
                    remove
                );

                host.append(
                    card
                );
            }
        };

    const renderMacroSteps =
        () => {
            const host =
                $("macroSteps");

            host.replaceChildren();

            if (
                !macroWorking
                    .steps
                    .length
            ) {
                const empty =
                    document
                        .createElement(
                            "p"
                        );

                empty.className =
                    "macro-empty";

                empty.textContent =
                    "Press Record, then use the preview. Every WMOFActions call will appear here.";

                host.append(
                    empty
                );

                return;
            }

            const actionNames =
                actionNamesForMacro();

            for (
                const [
                    stepIndex,
                    step
                ] of macroWorking
                    .steps
                    .entries()
            ) {
                const card =
                    document
                        .createElement(
                            "article"
                        );

                card.className =
                    "macro-step-card";

                const header =
                    document
                        .createElement(
                            "div"
                        );

                header.className =
                    "macro-step-header";

                const number =
                    document
                        .createElement(
                            "span"
                        );

                number.className =
                    "macro-step-number";

                number.textContent =
                    String(
                        stepIndex +
                            1
                    );

                const action =
                    document
                        .createElement(
                            "select"
                        );

                action.className =
                    "macro-step-action";

                const names =
                    [
                        ...new Set([
                            step.action,
                            ...actionNames
                        ])
                    ]
                        .filter(
                            Boolean
                        )
                        .sort(
                            (a, b) =>
                                a.localeCompare(
                                    b
                                )
                        );

                for (
                    const name of
                    names
                ) {
                    action.append(
                        new Option(
                            name,
                            name
                        )
                    );
                }

                action.value =
                    step.action;

                action
                    .addEventListener(
                        "change",
                        () => {
                            step.action =
                                action.value;

                            renderMacroBuilder();
                        }
                    );

                const moveUp =
                    document
                        .createElement(
                            "button"
                        );

                moveUp.type =
                    "button";

                moveUp.textContent =
                    "↑";

                moveUp.disabled =
                    stepIndex ===
                    0;

                moveUp.setAttribute(
                    "aria-label",
                    "Move action up"
                );

                moveUp
                    .addEventListener(
                        "click",
                        () => {
                            if (
                                stepIndex ===
                                    0
                            ) {
                                return;
                            }

                            const [
                                moved
                            ] =
                                macroWorking
                                    .steps
                                    .splice(
                                        stepIndex,
                                        1
                                    );

                            macroWorking
                                .steps
                                .splice(
                                    stepIndex -
                                        1,
                                    0,
                                    moved
                                );

                            renderMacroBuilder();
                        }
                    );

                const moveDown =
                    document
                        .createElement(
                            "button"
                        );

                moveDown.type =
                    "button";

                moveDown.textContent =
                    "↓";

                moveDown.disabled =
                    stepIndex ===
                    macroWorking
                        .steps
                        .length -
                        1;

                moveDown.setAttribute(
                    "aria-label",
                    "Move action down"
                );

                moveDown
                    .addEventListener(
                        "click",
                        () => {
                            if (
                                stepIndex >=
                                macroWorking
                                    .steps
                                    .length -
                                    1
                            ) {
                                return;
                            }

                            const [
                                moved
                            ] =
                                macroWorking
                                    .steps
                                    .splice(
                                        stepIndex,
                                        1
                                    );

                            macroWorking
                                .steps
                                .splice(
                                    stepIndex +
                                        1,
                                    0,
                                    moved
                                );

                            renderMacroBuilder();
                        }
                    );

                const addArgument =
                    document
                        .createElement(
                            "button"
                        );

                addArgument.type =
                    "button";

                addArgument.textContent =
                    "+ Arg";

                addArgument
                    .addEventListener(
                        "click",
                        () => {
                            step.args.push({
                                source:
                                    "literal",
                                value: {
                                    __wmofMacroType:
                                        "undefined"
                                }
                            });

                            renderMacroBuilder();
                        }
                    );

                const remove =
                    document
                        .createElement(
                            "button"
                        );

                remove.type =
                    "button";

                remove.textContent =
                    "×";

                remove.setAttribute(
                    "aria-label",
                    "Remove macro action"
                );

                remove
                    .addEventListener(
                        "click",
                        () => {
                            macroWorking
                                .steps
                                .splice(
                                    stepIndex,
                                    1
                                );

                            renderMacroBuilder();
                        }
                    );

                header.append(
                    number,
                    action,
                    moveUp,
                    moveDown,
                    addArgument,
                    remove
                );

                const args =
                    document
                        .createElement(
                            "div"
                        );

                args.className =
                    "macro-arguments";

                for (
                    const [
                        argumentIndex,
                        argument
                    ] of step.args
                        .entries()
                ) {
                    const metadata =
                        macroParameterMetadata(
                            step.action,
                            argumentIndex
                        );

                    const row =
                        document
                            .createElement(
                                "div"
                            );

                    row.className =
                        "macro-argument-row";

                    const label =
                        document
                            .createElement(
                                "span"
                            );

                    label.className =
                        "macro-argument-label";

                    label.textContent =
                        metadata.name ||
                        "arg" +
                            (
                                argumentIndex +
                                1
                            );

                    const source =
                        document
                            .createElement(
                                "select"
                            );

                    for (
                        const [
                            value,
                            text
                        ] of [
                            [
                                "literal",
                                "Fixed"
                            ],
                            [
                                "parameter",
                                "Parameter"
                            ],
                            [
                                "context",
                                "Context"
                            ]
                        ]
                    ) {
                        source.append(
                            new Option(
                                text,
                                value
                            )
                        );
                    }

                    source.value =
                        argument.source ||
                        "literal";

                    const value =
                        document
                            .createElement(
                                "input"
                            );

                    value.spellcheck =
                        false;

                    const syncValueControl =
                        () => {
                            value.removeAttribute(
                                "list"
                            );

                            if (
                                argument.source ===
                                    "parameter"
                            ) {
                                value.placeholder =
                                    "parameter name";

                                value.value =
                                    argument.name ||
                                    "";
                            }
                            else if (
                                argument.source ===
                                    "context"
                            ) {
                                value.placeholder =
                                    "<context> or path";

                                value.value =
                                    argument.path ||
                                    "";

                                value.setAttribute(
                                    "list",
                                    "macroContextOptions"
                                );
                            }
                            else {
                                value.placeholder =
                                    "JSON or text";

                                value.value =
                                    macroLiteralText(
                                        argument.value
                                    );
                            }
                        };

                    source
                        .addEventListener(
                            "change",
                            () => {
                                const previous =
                                    argument.source ||
                                    "literal";

                                const previousValue =
                                    previous ===
                                        "literal"
                                        ? cloneMacroValue(
                                            argument.value
                                        )
                                        : undefined;

                                if (
                                    source.value ===
                                        "parameter"
                                ) {
                                    const name =
                                        uniqueMacroParameterName(
                                            metadata.name ||
                                            "arg" +
                                                (
                                                    argumentIndex +
                                                    1
                                                )
                                        );

                                    argument.source =
                                        "parameter";

                                    argument.name =
                                        name;

                                    delete argument
                                        .value;

                                    delete argument
                                        .path;

                                    ensureMacroParameter(
                                        name,
                                        {
                                            type:
                                                metadata.type ||
                                                "value",
                                            defaultValue:
                                                previousValue,
                                            hasDefault:
                                                previous ===
                                                    "literal"
                                        }
                                    );
                                }
                                else if (
                                    source.value ===
                                        "context"
                                ) {
                                    argument.source =
                                        "context";

                                    argument.path =
                                        "";

                                    delete argument
                                        .value;

                                    delete argument
                                        .name;
                                }
                                else {
                                    argument.source =
                                        "literal";

                                    argument.value =
                                        previous ===
                                            "literal"
                                            ? previousValue
                                            : {
                                                __wmofMacroType:
                                                    "undefined"
                                            };

                                    delete argument
                                        .name;

                                    delete argument
                                        .path;
                                }

                                renderMacroBuilder();
                            }
                        );

                    value
                        .addEventListener(
                            "change",
                            () => {
                                if (
                                    argument.source ===
                                        "parameter"
                                ) {
                                    const name =
                                        String(
                                            value.value
                                        )
                                            .trim();

                                    if (
                                        /^[A-Za-z_$][\\w$]*$/
                                            .test(
                                                name
                                            )
                                    ) {
                                        argument.name =
                                            name;

                                        ensureMacroParameter(
                                            name,
                                            {
                                                type:
                                                    metadata.type ||
                                                    "value"
                                            }
                                        );
                                    }
                                }
                                else if (
                                    argument.source ===
                                        "context"
                                ) {
                                    argument.path =
                                        String(
                                            value.value
                                        )
                                            .trim()
                                            .replace(
                                                /^<context(?::([^>]+))?>$/,
                                                (
                                                    _,
                                                    path
                                                ) =>
                                                    path ||
                                                    ""
                                            );
                                }
                                else {
                                    argument.value =
                                        parseMacroLiteral(
                                            value.value
                                        );
                                }

                                renderMacroParameters();
                                updateMacroControls();
                            }
                        );

                    syncValueControl();

                    row.append(
                        label,
                        source,
                        value
                    );

                    args.append(
                        row
                    );
                }

                card.append(
                    header,
                    args
                );

                host.append(
                    card
                );
            }
        };

    const renderMacroBuilder =
        () => {
            $("macroName").value =
                macroWorking.name ||
                "";

            updateMacroSelect();
            renderMacroSteps();
            renderMacroParameters();
            updateMacroControls();
        };

    const resetMacroBuilder =
        () => {
            macroWorking =
                emptyMacro();

            macroEditingName =
                "";

            $("macroMessage")
                .textContent =
                "";

            renderMacroBuilder();
        };

    const loadMacroForEditing =
        name => {
            const macro =
                draftMacros
                    .find(
                        value =>
                            value.name ===
                            name
                    );

            if (!macro) {
                resetMacroBuilder();

                return;
            }

            macroWorking =
                cloneMacroValue(
                    macro
                );

            macroEditingName =
                macro.name;

            $("macroMessage")
                .textContent =
                "";

            renderMacroBuilder();
        };

    const stageMacro =
        () => {
            const validation =
                validateMacroWorking();

            if (
                !validation.valid
            ) {
                $("macroMessage")
                    .textContent =
                    validation.reason;

                $("macroMessage")
                    .classList.add(
                        "error"
                    );

                return false;
            }

            const macro =
                validation.macro;

            try {
                if (
                    macroEditingName &&
                    macroEditingName !==
                        macro.name
                ) {
                    draftMacros =
                        draftMacros
                            .filter(
                                item =>
                                    item.name !==
                                    macroEditingName
                            );

                    macroApi()
                        ?.removeMacro?.(
                            macroEditingName
                        );

                    removeMacroRole(
                        macroEditingName
                    );
                }

                macroApi()
                    ?.registerMacro?.(
                        macro
                    );
            }
            catch (
                error
            ) {
                $("macroMessage")
                    .textContent =
                    error.message;

                $("macroMessage")
                    .classList.add(
                        "error"
                    );

                return false;
            }

            const existing =
                draftMacros
                    .findIndex(
                        item =>
                            item.name ===
                            macro.name
                    );

            if (
                existing >=
                    0
            ) {
                draftMacros[
                    existing
                ] =
                    cloneMacroValue(
                        macro
                    );
            }
            else {
                draftMacros.push(
                    cloneMacroValue(
                        macro
                    )
                );
            }

            macroWorking =
                cloneMacroValue(
                    macro
                );

            macroEditingName =
                macro.name;

            ensureMacroRole(
                macro.name
            );

            syncFunctionCatalog();
            updateButtons();
            renderMacroBuilder();

            $("macroMessage")
                .classList
                .remove(
                    "error"
                );

            $("macroMessage")
                .textContent =
                "Macro staged. Save changes to persist it.";

            return true;
        };

    const installMacroBuilder =
        () => {
            $("macroName")
                .addEventListener(
                    "input",
                    event => {
                        macroWorking.name =
                            event.target
                                .value
                                .trim();

                        updateMacroControls();
                    }
                );

            $("macroSelect")
                .addEventListener(
                    "change",
                    event =>
                        loadMacroForEditing(
                            event.target
                                .value
                        )
                );

            $("macroNew")
                .addEventListener(
                    "click",
                    resetMacroBuilder
                );

            $("macroAddParameter")
                .addEventListener(
                    "click",
                    () => {
                        ensureMacroParameter(
                            uniqueMacroParameterName(
                                "value"
                            )
                        );

                        renderMacroBuilder();
                    }
                );

            $("macroRecord")
                .addEventListener(
                    "click",
                    () => {
                        const api =
                            macroApi();

                        if (!api) {
                            return;
                        }

                        if (
                            api.isRecording()
                        ) {
                            const recording =
                                api.stopRecording();

                            macroWorking.steps =
                                cloneMacroValue(
                                    recording.steps ||
                                    []
                                );

                            $("macroRecord")
                                .setAttribute(
                                    "aria-pressed",
                                    "false"
                                );

                            $("macroRecord")
                                .textContent =
                                "● Record";

                            $("macroRecordingState")
                                .textContent =
                                "Not recording";

                            renderMacroBuilder();

                            return;
                        }

                        api.startRecording({
                            name:
                                macroWorking.name
                        });

                        macroWorking.steps =
                            [];

                        if (overlay) {
                            $("overlayToggle")
                                .click();
                        }

                        $("macroRecord")
                            .setAttribute(
                                "aria-pressed",
                                "true"
                            );

                        $("macroRecord")
                            .textContent =
                            "■ Stop";

                        $("macroRecordingState")
                            .textContent =
                            "Recording actions…";

                        renderMacroSteps();
                        updateMacroControls();
                    }
                );

            $("macroStage")
                .addEventListener(
                    "click",
                    stageMacro
                );

            $("macroTest")
                .addEventListener(
                    "click",
                    async () => {
                        if (
                            !stageMacro()
                        ) {
                            return;
                        }

                        const supplied =
                            Object.fromEntries(
                                macroWorking
                                    .parameters
                                    .filter(
                                        parameter =>
                                            Object.prototype
                                                .hasOwnProperty
                                                .call(
                                                    parameter,
                                                    "default"
                                                )
                                    )
                                    .map(
                                        parameter => [
                                            parameter.name,
                                            parameter.default
                                        ]
                                    )
                            );

                        try {
                            await macroApi()
                                .runMacro(
                                    macroWorking.name,
                                    supplied
                                );

                            $("macroMessage")
                                .textContent =
                                "Macro test completed.";
                        }
                        catch (
                            error
                        ) {
                            $("macroMessage")
                                .classList.add(
                                    "error"
                                );

                            $("macroMessage")
                                .textContent =
                                error.message;
                        }
                    }
                );

            $("macroDelete")
                .addEventListener(
                    "click",
                    () => {
                        if (
                            !macroEditingName
                        ) {
                            return;
                        }

                        const name =
                            macroEditingName;

                        draftMacros =
                            draftMacros
                                .filter(
                                    macro =>
                                        macro.name !==
                                        name
                                );

                        macroApi()
                            ?.removeMacro?.(
                                name
                            );

                        removeMacroRole(
                            name
                        );

                        resetMacroBuilder();
                        syncFunctionCatalog();
                        updateButtons();

                        $("macroMessage")
                            .textContent =
                            "Macro removed. Save changes to persist.";
                    }
                );

            renderMacroBuilder();
        };

    installWorkspace();
    installMacroBuilder();

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

        const api =
            macroApi();

        if (api) {
            for (
                const macro of
                draftMacros
            ) {
                const result =
                    api.validateMacro(
                        macro,
                        {
                            allowExistingMacro:
                                true,
                            requireActions:
                                true
                        }
                    );

                if (!result.valid) {
                    return (
                        "Macro " +
                        macro.name +
                        ": " +
                        result.reason
                    );
                }
            }
        }

        return "";
    };


    const editorElementReference =
        input => {
            if (!frameDocument) {
                return null;
            }

            if (
                input?.id
            ) {
                const escaped =
                    CSS.escape(
                        String(
                            input.id
                        )
                    );

                const byId =
                    frameDocument
                        .querySelector(
                            '[data-speech-editor-id="' +
                            escaped +
                            '"]'
                        );

                if (byId) {
                    return byId;
                }
            }

            const selector =
                String(
                    input?.selector ||
                    input?.target ||
                    ""
                )
                    .trim();

            if (!selector) {
                return (
                    candidateEditElement() ||
                    selectedElement ||
                    null
                );
            }

            try {
                return frameDocument
                    .querySelector(
                        selector
                    );
            }
            catch {
                return null;
            }
        };

    const editorEntryReference =
        (
            input,
            {
                createAttribute = false
            } = {}
        ) => {
            const id =
                String(
                    input?.id ||
                    ""
                )
                    .trim();

            if (id) {
                const found =
                    draft.find(
                        entry =>
                            entry.id ===
                            id
                    );

                if (found) {
                    return found;
                }
            }

            const element =
                editorElementReference(
                    input
                );

            if (element) {
                const writable =
                    writableEntry(
                        element
                    );

                if (writable) {
                    return writable;
                }
            }

            if (!createAttribute) {
                return null;
            }

            const target =
                String(
                    input?.selector ||
                    input?.target ||
                    (
                        element
                            ? selectorFor(
                                element
                            )
                            : ""
                    )
                )
                    .trim();

            if (!target) {
                throw new Error(
                    "A target selector is required."
                );
            }

            const existing =
                draft.find(
                    entry =>
                        normalizeKind(
                            entry.kind
                        ) ===
                            "attribute" &&
                        entry.target ===
                            target
                );

            if (existing) {
                return existing;
            }

            const entry = {
                id:
                    id ||
                    "edit:attribute:" +
                    sanitizeId(
                        target
                    ),
                kind:
                    "attribute",
                target,
                attrs: {}
            };

            draft.push(
                entry
            );

            return entry;
        };

    const normalizeEditorAttributes =
        value => {
            if (
                !value ||
                typeof value !==
                    "object" ||
                Array.isArray(
                    value
                )
            ) {
                throw new TypeError(
                    "attrs must be an object."
                );
            }

            const result = {};

            for (
                const [
                    name,
                    raw
                ] of Object.entries(
                    value
                )
            ) {
                if (
                    !attributeNames
                        .includes(
                            name
                        )
                ) {
                    throw new Error(
                        "Unsupported speech attribute: " +
                        name
                    );
                }

                if (
                    raw ===
                        undefined ||
                    raw ===
                        null ||
                    raw ===
                        ""
                ) {
                    result[name] =
                        undefined;

                    continue;
                }

                result[name] =
                    String(
                        raw
                    );
            }

            return result;
        };

    const applyEditorAttributes =
        (
            entry,
            attrs,
            replace = false
        ) => {
            if (replace) {
                entry.attrs =
                    {};
            }

            entry.attrs =
                entry.attrs ||
                {};

            for (
                const [
                    name,
                    value
                ] of Object.entries(
                    normalizeEditorAttributes(
                        attrs
                    )
                )
            ) {
                if (
                    value ===
                        undefined
                ) {
                    delete entry
                        .attrs[
                            name
                        ];
                }
                else {
                    entry.attrs[
                        name
                    ] =
                        value;
                }
            }

            return entry;
        };

    const createEditorId =
        kind =>
            "edit:" +
            kind +
            ":" +
            Date.now()
                .toString(
                    36
                ) +
            Math.random()
                .toString(
                    36
                )
                .slice(
                    2,
                    7
                );

    const persistEditorChanges =
        async () => {
            const error =
                validate();

            if (error) {
                throw new Error(
                    error
                );
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
                                    macros:
                                        draftMacros,
                                    revision,
                                    functionRoles:
                                        draftFunctionRoles,
                                    registryRevision
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

                savedMacros =
                    Array.isArray(
                        data.macros
                    )
                        ? data.macros
                        : [];

                draftMacros =
                    structuredClone(
                        savedMacros
                    );

                macrosLoaded =
                    true;

                revision =
                    data.revision;

                savedFunctionRoles =
                    normalizeFunctionRoles(
                        data.functionRoles
                    );

                draftFunctionRoles =
                    structuredClone(
                        savedFunctionRoles
                    );

                registryRevision =
                    data.registryRevision;

                frame.contentWindow
                    .location
                    .reload();

                status(
                    "Speech commands and macros saved."
                );

                return {
                    saved:
                        true,
                    revision,
                    registryRevision
                };
            }
            finally {
                updateButtons();
            }
        };

    const discardEditorChanges =
        () => {
            setRegexBuilderLive(
                false
            );

            draft =
                structuredClone(
                    saved
                );

            draftMacros =
                structuredClone(
                    savedMacros
                );

            resetMacroBuilder();

            draftFunctionRoles =
                structuredClone(
                    savedFunctionRoles
                );

            functionCombo.refresh();
            preprocCombo.refresh();

            syncMacrosToFrame();

            frame.contentWindow
                .location
                .reload();

            status(
                "Unsaved speech changes discarded."
            );

            updateButtons();

            return true;
        };

    const workspaceSnapshot =
        () => ({
            left:
                [
                    ...workspaceDock(
                        "left"
                    )
                        .querySelectorAll(
                            ":scope > .workspace-pane"
                        )
                ]
                    .map(
                        pane =>
                            pane.dataset
                                .paneId
                    ),
            right:
                [
                    ...workspaceDock(
                        "right"
                    )
                        .querySelectorAll(
                            ":scope > .workspace-pane"
                        )
                ]
                    .map(
                        pane =>
                            pane.dataset
                                .paneId
                    ),
            sizes:
                Object.fromEntries(
                    workspacePaneIds()
                        .map(
                            id => [
                                id,
                                workspacePane(
                                    id
                                )
                                    ?.style
                                    ?.flex ||
                                ""
                            ]
                        )
                )
        });

    const restoreWorkspaceSnapshot =
        state => {
            if (!state) {
                return;
            }

            for (
                const side of
                [
                    "left",
                    "right"
                ]
            ) {
                const dock =
                    workspaceDock(
                        side
                    );

                for (
                    const id of
                    state[side] ||
                    []
                ) {
                    const pane =
                        workspacePane(
                            id
                        );

                    if (pane) {
                        dock.append(
                            pane
                        );

                        pane.style.flex =
                            state.sizes?.[
                                id
                            ] ||
                            "";
                    }
                }
            }

            refreshWorkspace();
        };

    const editorStateSnapshot =
        () => ({
            version:
                1,
            loaded:
                macrosLoaded,
            dirty:
                dirty(),
            revision,
            registryRevision,
            overlay,
            viewport: {
                screenSize:
                    $("screenSizeSelect")
                        .value,
                compareSize:
                    $("compareSizeSelect")
                        .value
            },
            selection:
                selectedLocator
                    ? structuredClone(
                        selectedLocator
                    )
                    : null,
            workspace:
                workspaceSnapshot(),
            entries:
                structuredClone(
                    draft
                ),
            macros:
                structuredClone(
                    draftMacros
                ),
            functionRoles:
                structuredClone(
                    draftFunctionRoles
                ),
            functions:
                functionNames
                    .slice()
                    .sort(
                        (
                            left,
                            right
                        ) =>
                            left.localeCompare(
                                right
                            )
                    )
        });

    editorActionFunctions
        .setStateProvider(
            editorStateSnapshot
        );

    editorActionFunctions
        .setTransactionProvider({
            snapshot() {
                return {
                    draft:
                        structuredClone(
                            draft
                        ),
                    draftMacros:
                        structuredClone(
                            draftMacros
                        ),
                    draftFunctionRoles:
                        structuredClone(
                            draftFunctionRoles
                        ),
                    macroWorking:
                        structuredClone(
                            macroWorking
                        ),
                    macroEditingName,
                    selectedLocator:
                        selectedLocator
                            ? structuredClone(
                                selectedLocator
                            )
                            : undefined,
                    overlay,
                    viewport: {
                        screenSize:
                            $("screenSizeSelect")
                                .value,
                        compareSize:
                            $("compareSizeSelect")
                                .value
                    },
                    workspace:
                        workspaceSnapshot()
                };
            },

            restore(
                snapshot
            ) {
                draft =
                    structuredClone(
                        snapshot.draft
                    );

                draftMacros =
                    structuredClone(
                        snapshot
                            .draftMacros
                    );

                draftFunctionRoles =
                    structuredClone(
                        snapshot
                            .draftFunctionRoles
                    );

                macroWorking =
                    structuredClone(
                        snapshot
                            .macroWorking
                    );

                macroEditingName =
                    snapshot
                        .macroEditingName;

                selectedLocator =
                    snapshot
                        .selectedLocator
                        ? structuredClone(
                            snapshot
                                .selectedLocator
                        )
                        : undefined;

                overlay =
                    Boolean(
                        snapshot.overlay
                    );

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

                $("screenSizeSelect")
                    .value =
                    snapshot.viewport
                        ?.screenSize ||
                    "";

                $("compareSizeSelect")
                    .value =
                    snapshot.viewport
                        ?.compareSize ||
                    "";

                restoreWorkspaceSnapshot(
                    snapshot.workspace
                );

                syncMacrosToFrame();
                functionCombo.refresh();
                preprocCombo.refresh();
                renderMacroBuilder();
                applyViewport();
                scheduleApply();
                updateButtons();
            }
        });

    editorActionFunctions
        .define(
            "getEditorState",
            () =>
                editorStateSnapshot(),
            {
                description:
                    "Return the current Speech Editor draft, macro catalog, function roles, selection, viewport and workspace state.",
                mutates:
                    false,
                input: {
                    type:
                        "object",
                    additionalProperties:
                        false
                }
            }
        );

    editorActionFunctions
        .define(
            "validateChanges",
            () => {
                const error =
                    validate();

                return {
                    valid:
                        !error,
                    error:
                        error ||
                        ""
                };
            },
            {
                description:
                    "Validate the current editor draft without saving it.",
                mutates:
                    false
            }
        );

    editorActionFunctions
        .define(
            "selectElement",
            input => {
                const element =
                    editorElementReference(
                        input
                    );

                if (!element) {
                    throw new Error(
                        "Speech Editor element was not found."
                    );
                }

                selectElement(
                    element,
                    {
                        scrollPhrase:
                            input
                                ?.scrollPhrase !==
                            false
                    }
                );

                return {
                    locator:
                        structuredClone(
                            selectedLocator
                        ),
                    label:
                        displayName(
                            element
                        )
                };
            },
            {
                description:
                    "Select a preview element by CSS selector or speech-editor id.",
                mutates:
                    false,
                input: {
                    type:
                        "object",
                    properties: {
                        id: {
                            type:
                                "string"
                        },
                        selector: {
                            type:
                                "string"
                        },
                        scrollPhrase: {
                            type:
                                "boolean"
                        }
                    }
                }
            }
        );

    editorActionFunctions
        .define(
            "setOverlay",
            input => {
                overlay =
                    input?.enabled ===
                    undefined
                        ? !overlay
                        : Boolean(
                            input.enabled
                        );

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

                return {
                    enabled:
                        overlay
                };
            },
            {
                description:
                    "Enable, disable, or toggle the preview selection overlay.",
                input: {
                    type:
                        "object",
                    properties: {
                        enabled: {
                            type:
                                "boolean"
                        }
                    }
                }
            }
        );

    editorActionFunctions
        .define(
            "setViewport",
            input => {
                if (
                    input?.screenSize !==
                    undefined
                ) {
                    $("screenSizeSelect")
                        .value =
                        String(
                            input.screenSize ||
                            ""
                        );
                }

                if (
                    input?.compareSize !==
                    undefined
                ) {
                    $("compareSizeSelect")
                        .value =
                        String(
                            input.compareSize ||
                            ""
                        );
                }

                applyViewport();

                return {
                    screenSize:
                        $("screenSizeSelect")
                            .value,
                    compareSize:
                        $("compareSizeSelect")
                            .value
                };
            },
            {
                description:
                    "Set the preview and comparison viewport presets.",
                input: {
                    type:
                        "object",
                    properties: {
                        screenSize: {
                            type:
                                "string"
                        },
                        compareSize: {
                            type:
                                "string"
                        }
                    }
                }
            }
        );

    editorActionFunctions
        .define(
            "applyWorkspacePreset",
            input => {
                const preset =
                    String(
                        input?.preset ||
                        ""
                    );

                if (
                    ![
                        "authoring",
                        "macro",
                        "regex"
                    ].includes(
                        preset
                    )
                ) {
                    throw new Error(
                        "Unknown workspace preset: " +
                        preset
                    );
                }

                applyWorkspacePreset(
                    preset
                );

                return {
                    preset
                };
            },
            {
                description:
                    "Apply a named Speech Editor workspace layout."
            }
        );

    editorActionFunctions
        .define(
            "moveWorkspacePane",
            input => {
                const pane =
                    workspacePane(
                        String(
                            input?.pane ||
                            ""
                        )
                    );

                const side =
                    String(
                        input?.side ||
                        ""
                    );

                if (
                    !pane ||
                    ![
                        "left",
                        "right"
                    ].includes(
                        side
                    )
                ) {
                    throw new Error(
                        "pane and side (left/right) are required."
                    );
                }

                moveWorkspacePane(
                    pane,
                    side
                );

                return {
                    pane:
                        pane.dataset
                            .paneId,
                    side
                };
            },
            {
                description:
                    "Move a workspace pane to the left or right dock."
            }
        );

    editorActionFunctions
        .define(
            "setSpeechAttributes",
            input => {
                const entry =
                    editorEntryReference(
                        input,
                        {
                            createAttribute:
                                true
                        }
                    );

                applyEditorAttributes(
                    entry,
                    input?.attrs ||
                    {},
                    Boolean(
                        input?.replace
                    )
                );

                selectedLocator = {
                    type:
                        "editor-id",
                    value:
                        entry.id
                };

                scheduleApply();

                return structuredClone(
                    entry
                );
            },
            {
                description:
                    "Create or update speech attributes for an entry or preview target selector.",
                input: {
                    type:
                        "object",
                    required: [
                        "attrs"
                    ],
                    properties: {
                        id: {
                            type:
                                "string"
                        },
                        selector: {
                            type:
                                "string"
                        },
                        target: {
                            type:
                                "string"
                        },
                        attrs: {
                            type:
                                "object"
                        },
                        replace: {
                            type:
                                "boolean"
                        }
                    }
                }
            }
        );

    editorActionFunctions
        .define(
            "addSpeechMenu",
            input => {
                const target =
                    String(
                        input?.target ||
                        input?.selector ||
                        ""
                    )
                        .trim();

                if (!target) {
                    throw new Error(
                        "A target selector is required."
                    );
                }

                const existing =
                    draft.find(
                        entry =>
                            normalizeKind(
                                entry.kind
                            ) ===
                                "menu" &&
                            entry.target ===
                                target
                    );

                if (existing) {
                    return structuredClone(
                        existing
                    );
                }

                const entry = {
                    id:
                        String(
                            input?.id ||
                            createEditorId(
                                "menu"
                            )
                        ),
                    kind:
                        "menu",
                    target,
                    attrs: {}
                };

                if (
                    Number.isInteger(
                        input?.order
                    )
                ) {
                    entry.order =
                        input.order;
                }

                applyEditorAttributes(
                    entry,
                    input?.attrs ||
                    {},
                    true
                );

                draft.push(
                    entry
                );

                selectedLocator = {
                    type:
                        "editor-id",
                    value:
                        entry.id
                };

                scheduleApply();

                return structuredClone(
                    entry
                );
            },
            {
                description:
                    "Add a Speech Menu attached to a target selector."
            }
        );

    editorActionFunctions
        .define(
            "removeSpeechMenu",
            input => {
                let entry =
                    editorEntryReference(
                        input
                    );

                if (
                    !entry &&
                    input?.target
                ) {
                    entry =
                        draft.find(
                            candidate =>
                                normalizeKind(
                                    candidate.kind
                                ) ===
                                    "menu" &&
                                candidate.target ===
                                    input.target
                        );
                }

                if (!entry) {
                    throw new Error(
                        "Speech Menu was not found."
                    );
                }

                if (
                    entry.id
                        .startsWith(
                            "edit:"
                        )
                ) {
                    draft =
                        draft.filter(
                            candidate =>
                                candidate.id !==
                                    entry.id &&
                                candidate.parentId !==
                                    entry.id
                        );
                }
                else {
                    entry =
                        draft.find(
                            candidate =>
                                candidate.id ===
                                entry.id
                        ) ||
                        normalizeEntry(
                            entry
                        );

                    if (
                        !draft.includes(
                            entry
                        )
                    ) {
                        draft.push(
                            entry
                        );
                    }

                    entry.attrs =
                        {};
                }

                selectedLocator = {
                    type:
                        "selector",
                    value:
                        entry.target
                };

                scheduleApply();

                return true;
            },
            {
                description:
                    "Remove an editor-created Speech Menu and its commands, or clear a built-in menu configuration."
            }
        );

    editorActionFunctions
        .define(
            "addSpeechCommand",
            input => {
                let parent =
                    String(
                        input?.parentId ||
                        ""
                    )
                        .trim()
                        ? draft.find(
                            entry =>
                                entry.id ===
                                input.parentId
                        )
                        : null;

                if (!parent) {
                    const menuElement =
                        editorElementReference({
                            id:
                                input?.parentId,
                            selector:
                                input?.menuSelector ||
                                input?.menuTarget
                        });

                    if (
                        menuElement?.matches(
                            "speech-menu"
                        )
                    ) {
                        parent =
                            writableEntry(
                                menuElement
                            );
                    }
                }

                if (!parent) {
                    const target =
                        String(
                            input?.menuTarget ||
                            ""
                        )
                            .trim();

                    if (target) {
                        parent =
                            draft.find(
                                entry =>
                                    normalizeKind(
                                        entry.kind
                                    ) ===
                                        "menu" &&
                                    entry.target ===
                                        target
                            );
                    }
                }

                if (
                    !parent ||
                    normalizeKind(
                        parent.kind
                    ) !==
                        "menu"
                ) {
                    throw new Error(
                        "A valid parent Speech Menu is required."
                    );
                }

                const entry = {
                    id:
                        String(
                            input?.id ||
                            createEditorId(
                                "command"
                            )
                        ),
                    kind:
                        "command",
                    target:
                        String(
                            input?.target ||
                            parent.target ||
                            "body"
                        ),
                    parentId:
                        parent.id,
                    attrs: {}
                };

                if (
                    Number.isInteger(
                        input?.order
                    )
                ) {
                    entry.order =
                        input.order;
                }

                applyEditorAttributes(
                    entry,
                    input?.attrs ||
                    {},
                    true
                );

                draft.push(
                    entry
                );

                selectedLocator = {
                    type:
                        "editor-id",
                    value:
                        entry.id
                };

                scheduleApply();

                return structuredClone(
                    entry
                );
            },
            {
                description:
                    "Add a Speech Command to a Speech Menu."
            }
        );

    editorActionFunctions
        .define(
            "removeSpeechConfiguration",
            input => {
                const entry =
                    editorEntryReference(
                        input
                    );

                if (!entry) {
                    throw new Error(
                        "Speech configuration was not found."
                    );
                }

                if (
                    normalizeKind(
                        entry.kind
                    ) ===
                        "menu"
                ) {
                    return editorActions
                        .removeSpeechMenu({
                            id:
                                entry.id,
                            target:
                                entry.target
                        });
                }

                if (
                    entry.id
                        .startsWith(
                            "edit:"
                        )
                ) {
                    draft =
                        draft.filter(
                            candidate =>
                                candidate.id !==
                                entry.id
                        );
                }
                else {
                    const writable =
                        draft.find(
                            candidate =>
                                candidate.id ===
                                entry.id
                        ) ||
                        normalizeEntry(
                            entry
                        );

                    if (
                        !draft.includes(
                            writable
                        )
                    ) {
                        draft.push(
                            writable
                        );
                    }

                    writable.attrs =
                        {};
                }

                scheduleApply();

                return true;
            },
            {
                description:
                    "Remove a Speech Command/attribute entry or clear configuration on a built-in element."
            }
        );

    editorActionFunctions
        .define(
            "removeSpeechPhrase",
            input => {
                const entry =
                    editorEntryReference(
                        input
                    );

                if (!entry) {
                    throw new Error(
                        "Speech configuration was not found."
                    );
                }

                const phrase =
                    String(
                        input?.phrase ||
                        ""
                    );

                if (!phrase) {
                    throw new Error(
                        "phrase is required."
                    );
                }

                const element =
                    editorElementReference(
                        input
                    );

                const pattern =
                    entry.attrs?.[
                        "speech-pattern"
                    ] ||
                    element
                        ?.getAttribute(
                            "speech-pattern"
                        ) ||
                    "";

                const speechMenu =
                    frame.contentWindow
                        ?.SpeechMenu;

                const phrases =
                    speechMenu
                        ?.phrasesFromPattern?.(
                            pattern
                        ) ||
                    [];

                if (
                    phrases.length <=
                    1
                ) {
                    editorActions
                        .removeSpeechConfiguration(
                            input
                        );

                    return {
                        removed:
                            phrase,
                        pattern:
                            ""
                    };
                }

                const nextPattern =
                    speechMenu
                        ?.withoutPhrase?.(
                            pattern,
                            phrase
                        );

                if (
                    !nextPattern ||
                    nextPattern ===
                        pattern
                ) {
                    throw new Error(
                        "That phrase could not be removed from the pattern."
                    );
                }

                applyEditorAttributes(
                    entry,
                    {
                        "speech-pattern":
                            nextPattern
                    }
                );

                scheduleApply();

                return {
                    removed:
                        phrase,
                    pattern:
                        nextPattern
                };
            },
            {
                description:
                    "Remove one spoken phrase from a speech-pattern; clearing the configuration when it was the last phrase."
            }
        );

    editorActionFunctions
        .define(
            "reorderSpeechEntries",
            input => {
                if (
                    !Array.isArray(
                        input?.entries
                    )
                ) {
                    throw new TypeError(
                        "entries must be an array."
                    );
                }

                for (
                    const item of
                    input.entries
                ) {
                    const entry =
                        draft.find(
                            candidate =>
                                candidate.id ===
                                item?.id
                        );

                    if (!entry) {
                        throw new Error(
                            "Speech entry was not found: " +
                            item?.id
                        );
                    }

                    const order =
                        Number(
                            item?.order
                        );

                    if (
                        !Number.isInteger(
                            order
                        ) ||
                        order <
                            0
                    ) {
                        throw new Error(
                            "Speech entry order must be a non-negative integer."
                        );
                    }

                    entry.order =
                        order;
                }

                scheduleApply();

                return structuredClone(
                    input.entries
                );
            },
            {
                description:
                    "Set persisted order values for one or more speech entries."
            }
        );

    editorActionFunctions
        .define(
            "setFunctionRole",
            input => {
                const name =
                    String(
                        input?.name ||
                        ""
                    )
                        .trim();

                const role =
                    String(
                        input?.role ||
                        ""
                    )
                        .trim();

                if (!name) {
                    throw new Error(
                        "Function name is required."
                    );
                }

                if (
                    role &&
                    !Object.prototype
                        .hasOwnProperty
                        .call(
                            draftFunctionRoles,
                            role
                        )
                ) {
                    throw new Error(
                        "Unknown function role: " +
                        role
                    );
                }

                setFunctionRole(
                    name,
                    role
                );

                return {
                    name,
                    role
                };
            },
            {
                description:
                    "Assign or clear a Speech Editor function role."
            }
        );

    editorActionFunctions
        .define(
            "compileSpeechPattern",
            input => {
                const template =
                    String(
                        input?.template ||
                        ""
                    );

                return (
                    globalThis
                        .WMOFRegexBuilder
                        ?.compile(
                            template
                        ) ||
                    {
                        valid:
                            false,
                        pattern:
                            "",
                        error:
                            "Regex Builder is unavailable."
                    }
                );
            },
            {
                description:
                    "Compile a human-readable speech phrase template into a speech-pattern regex.",
                mutates:
                    false
            }
        );

    editorActionFunctions
        .define(
            "setRegexTemplate",
            input => {
                $("regexBuilderInput")
                    .value =
                    String(
                        input?.template ||
                        ""
                    );

                updateRegexBuilder();

                if (
                    input?.apply ===
                        true
                ) {
                    if (
                        !applyRegexBuilderPattern(
                            "json"
                        )
                    ) {
                        throw new Error(
                            regexBuilderResult
                                .error ||
                            "Regex pattern could not be applied."
                        );
                    }
                }

                return structuredClone(
                    regexBuilderResult
                );
            },
            {
                description:
                    "Set the Regex Builder phrase template and optionally apply its compiled pattern to the selected speech target."
            }
        );

    editorActionFunctions
        .define(
            "stageMacro",
            input => {
                const macro =
                    input?.macro;

                if (
                    !macro ||
                    typeof macro !==
                        "object"
                ) {
                    throw new TypeError(
                        "macro is required."
                    );
                }

                macroWorking =
                    structuredClone(
                        macro
                    );

                macroEditingName =
                    draftMacros.some(
                        item =>
                            item.name ===
                            macroWorking.name
                    )
                        ? macroWorking.name
                        : "";

                $("macroName")
                    .value =
                    macroWorking.name ||
                    "";

                renderMacroBuilder();

                if (!stageMacro()) {
                    throw new Error(
                        $("macroMessage")
                            .textContent ||
                        "Macro validation failed."
                    );
                }

                return structuredClone(
                    macroWorking
                );
            },
            {
                description:
                    "Validate and stage a complete macro definition in the editor draft."
            }
        );

    editorActionFunctions
        .define(
            "deleteMacro",
            input => {
                const name =
                    String(
                        input?.name ||
                        ""
                    )
                        .trim();

                if (!name) {
                    throw new Error(
                        "Macro name is required."
                    );
                }

                const before =
                    draftMacros.length;

                draftMacros =
                    draftMacros.filter(
                        macro =>
                            macro.name !==
                            name
                    );

                if (
                    draftMacros.length ===
                    before
                ) {
                    return false;
                }

                macroApi()
                    ?.removeMacro?.(
                        name
                    );

                removeMacroRole(
                    name
                );

                if (
                    macroEditingName ===
                    name
                ) {
                    resetMacroBuilder();
                }

                syncFunctionCatalog();
                updateButtons();
                renderMacroBuilder();

                return true;
            },
            {
                description:
                    "Delete a staged macro by name."
            }
        );

    editorActionFunctions
        .define(
            "runMacro",
            async input => {
                const name =
                    String(
                        input?.name ||
                        ""
                    )
                        .trim();

                if (!name) {
                    throw new Error(
                        "Macro name is required."
                    );
                }

                return macroApi()
                    ?.runMacro?.(
                        name,
                        input?.parameters ||
                        {},
                        input?.context
                    );
            },
            {
                description:
                    "Execute a macro against the preview application.",
                transactional:
                    false
            }
        );

    editorActionFunctions
        .define(
            "startMacroRecording",
            input => {
                const api =
                    macroApi();

                if (!api) {
                    throw new Error(
                        "Preview action runtime is not ready."
                    );
                }

                api.startRecording({
                    name:
                        String(
                            input?.name ||
                            macroWorking
                                .name ||
                            ""
                        )
                });

                macroWorking.steps =
                    [];

                if (overlay) {
                    editorActions
                        .setOverlay({
                            enabled:
                                false
                        });
                }

                $("macroRecord")
                    .setAttribute(
                        "aria-pressed",
                        "true"
                    );

                $("macroRecord")
                    .textContent =
                    "■ Stop";

                $("macroRecordingState")
                    .textContent =
                    "Recording actions…";

                renderMacroSteps();
                updateMacroControls();

                return true;
            },
            {
                description:
                    "Start recording WMOFActions calls from the preview application.",
                transactional:
                    false
            }
        );

    editorActionFunctions
        .define(
            "stopMacroRecording",
            () => {
                const api =
                    macroApi();

                const recording =
                    api?.stopRecording?.() ||
                    {
                        name:
                            "",
                        steps: []
                    };

                macroWorking.steps =
                    structuredClone(
                        recording.steps ||
                        []
                    );

                $("macroRecord")
                    .setAttribute(
                        "aria-pressed",
                        "false"
                    );

                $("macroRecord")
                    .textContent =
                    "● Record";

                $("macroRecordingState")
                    .textContent =
                    "Not recording";

                renderMacroBuilder();

                return structuredClone(
                    recording
                );
            },
            {
                description:
                    "Stop macro recording and load the recorded actions into the Macro Builder.",
                transactional:
                    false
            }
        );

    editorActionFunctions
        .define(
            "saveChanges",
            () =>
                persistEditorChanges(),
            {
                description:
                    "Validate and persist the current Speech Editor draft.",
                transactional:
                    false
            }
        );

    editorActionFunctions
        .define(
            "discardChanges",
            () =>
                discardEditorChanges(),
            {
                description:
                    "Discard all unsaved Speech Editor changes and reload the preview.",
                transactional:
                    false
            }
        );

    editorActionFunctions
        .define(
            "reloadPreview",
            () => {
                frame.contentWindow
                    .location
                    .reload();

                return true;
            },
            {
                description:
                    "Reload the WMOF preview iframe without changing the editor draft.",
                transactional:
                    false
            }
        );

    $("saveButton")
        .addEventListener(
            "click",
            async () => {
                try {
                    await editorActions
                        .saveChanges();
                }
                catch (
                    error
                ) {
                    status(
                        error.message,
                        true
                    );
                }
            }
        );

    $("discardButton")
        .addEventListener(
            "click",
            () => {
                editorActions
                    .discardChanges();
            }
        );

    const writeJSONActionOutput =
        value => {
            $("jsonActionsOutput")
                .value =
                typeof value ===
                    "string"
                    ? value
                    : JSON.stringify(
                        value,
                        null,
                        2
                    );
        };

    $("jsonActionsButton")
        .addEventListener(
            "click",
            () => {
                $("jsonActionsDialog")
                    .showModal();
            }
        );

    $("jsonActionsClose")
        .addEventListener(
            "click",
            () => {
                $("jsonActionsDialog")
                    .close();
            }
        );

    $("jsonActionsExample")
        .addEventListener(
            "click",
            () => {
                $("jsonActionsInput")
                    .value =
                    JSON.stringify(
                        {
                            atomic:
                                true,
                            actions: [
                                {
                                    action:
                                        "addSpeechMenu",
                                    input: {
                                        target:
                                            "#tripActionControls"
                                    }
                                },
                                {
                                    action:
                                        "addSpeechCommand",
                                    input: {
                                        menuTarget:
                                            "#tripActionControls",
                                        attrs: {
                                            "speech-pattern":
                                                "^open trip log$",
                                            "speech-function":
                                                "WMOFActions.openTripLog"
                                        }
                                    }
                                },
                                {
                                    action:
                                        "validateChanges",
                                    input: {}
                                }
                            ]
                        },
                        null,
                        2
                    );
            }
        );

    $("jsonActionsManifest")
        .addEventListener(
            "click",
            () =>
                writeJSONActionOutput(
                    editorActionFunctions
                        .getManifest()
                )
        );

    $("jsonActionsState")
        .addEventListener(
            "click",
            () =>
                writeJSONActionOutput(
                    editorActionFunctions
                        .getState()
                )
        );

    $("jsonActionsExecute")
        .addEventListener(
            "click",
            async () => {
                try {
                    const result =
                        await editorActionFunctions
                            .executeJSON(
                                $("jsonActionsInput")
                                    .value
                            );

                    writeJSONActionOutput({
                        ok:
                            true,
                        result,
                        state:
                            editorActionFunctions
                                .getState()
                    });
                }
                catch (
                    error
                ) {
                    writeJSONActionOutput({
                        ok:
                            false,
                        error:
                            error.message
                    });
                }
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

                savedMacros =
                    Array.isArray(
                        data.macros
                    )
                        ? data.macros
                        : [];

                draftMacros =
                    structuredClone(
                        savedMacros
                    );

                macrosLoaded =
                    true;

                revision =
                    data.revision;

                savedFunctionRoles =
                    normalizeFunctionRoles(
                        data.functionRoles
                    );

                draftFunctionRoles =
                    structuredClone(
                        savedFunctionRoles
                    );

                registryRevision =
                    data.registryRevision ||
                    "missing";

                syncMacrosToFrame();
                syncFunctionCatalog();
                renderMacroBuilder();
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
