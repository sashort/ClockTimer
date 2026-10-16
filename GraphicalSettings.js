(() => {
'use strict';
globalThis.WMOFGraphicalSettings = {create({clockTimer, clockPreview = document.querySelector('#clockPreview')}) {
    const $ = selector => document.querySelector(selector);
    const graphicalDialog = $('#graphicalSettingsDialog');
    const GRAPHICAL_DEFAULTS = WMOFTimerAppearance.graphicalDefaults;
    const settingsHelpRevealTimers = new WeakMap(), graphicalDetailsAnimations = new WeakMap();
    const GRAPHICAL_DETAILS_DURATION = 180;
    const SETTINGS_HELP_FADE_DURATION = 250;
    const SETTINGS_HELP_VISIBLE_DURATION = 4000;
    let activeSettingsHelpButton, graphicalHelpVisible = false, graphicalPreviewAnimationFrame, graphicalPreviewResizeObserver, settingsHelpAnimation;
    if (clockPreview) clockPreview.keepAspectRatio = true;
    const GRAPHICAL_HELP = {
        timerMode: {
            title: globalThis.WMOFLanguagePack.text("20963a74-5865-56b4-b5af-2f073c86cbbe"),
            text: globalThis.WMOFLanguagePack.text("97fa55a1-b46b-50e1-84b1-921381af98df")
        },
        timerType: {
            title: globalThis.WMOFLanguagePack.text("c4c43c88-5f2b-5d95-9372-bd4b473ce706"),
            text: globalThis.WMOFLanguagePack.text("5f50ccf4-3cd4-5a0c-9564-b27a57a5c276")
        },
        tripColor: {title: globalThis.WMOFLanguagePack.text("f179a94e-fd69-5b23-8258-cc765e0c3521"), text: globalThis.WMOFLanguagePack.text("39aae00c-6e71-51e1-b559-3c8a556543e4")},
        earlyStartColor: {title: globalThis.WMOFLanguagePack.text("4fa71adf-90f3-57be-9de9-37445b7b08e7"), text: globalThis.WMOFLanguagePack.text("e4920a3d-3d1a-5c4c-a4cc-915536f3f12e"), stateControl: "showEarlyStart", stateText: {true: globalThis.WMOFLanguagePack.text("c249bf19-3793-4d02-bf8b-e752eec3cf50"), false: globalThis.WMOFLanguagePack.text("54f5a90e-9fdf-4d7a-9565-86cab9116cea")}},
        lunchColor: {title: globalThis.WMOFLanguagePack.text("c8c62814-cf9f-5b64-bf93-534a2383b957"), text: globalThis.WMOFLanguagePack.text("04459416-7e0f-5e2f-92d7-c247d514b383")},
        breakColor: {title: globalThis.WMOFLanguagePack.text("b3d9f04f-4062-5c30-b90f-bc5822e6bac8"), text: globalThis.WMOFLanguagePack.text("c70e9af7-c9c2-57cc-8014-6b833e307466")},
        breakBufferColor: {title: globalThis.WMOFLanguagePack.text("58abef60-c292-547e-89bc-7889457f9037"), text: globalThis.WMOFLanguagePack.text("894f6706-7f64-5c01-b989-d9ed3365f78d"), stateControl: "showBreakBuffer", stateText: {true: "to/from Break uses this color.", false: globalThis.WMOFLanguagePack.text("30790cc1-6ac6-4461-b9eb-33ececd1835f")}},
        downColor: {title: globalThis.WMOFLanguagePack.text("056758c1-276d-5357-953d-28ce0530da09"), text: globalThis.WMOFLanguagePack.text("bd1758b8-6a66-5a03-a1a3-51d53c15b1f3")},
        approvalSurplusColor: {title: globalThis.WMOFLanguagePack.text("4b3a5003-5d74-5b94-975a-b5781d68f1b2"), text: globalThis.WMOFLanguagePack.text("342df0e0-b348-530e-9ab3-10567eb3e073")},
        approvalDeficitColor: {title: globalThis.WMOFLanguagePack.text("d8728b83-9792-5701-a66f-82051b1aeab4"), text: globalThis.WMOFLanguagePack.text("76cb75e0-1061-5917-ab2a-81df4982da3d")},
        overtimeColor: {title: globalThis.WMOFLanguagePack.text("aa271074-0603-5cc2-b076-c306f716850e"), text: globalThis.WMOFLanguagePack.text("700bdc92-1820-55cb-9ae3-3fb9c19640d2"), stateControl: "showOvertime", stateText: {true: globalThis.WMOFLanguagePack.text("bffa06f8-bddf-4046-b925-67bc08a02e63"), false: globalThis.WMOFLanguagePack.text("4e540920-0c55-482a-89f7-52678909687b")}},
        toleranceColor: {title: globalThis.WMOFLanguagePack.text("f07dc6d4-dbbf-5c3f-9dc9-ae7183f0caec"), text: globalThis.WMOFLanguagePack.text("5569534d-252a-503c-8869-a4ce5b956c4a"), stateControl: "showTolerance", stateText: {true: globalThis.WMOFLanguagePack.text("0498aab2-8d70-4bde-b585-473bfb0a74ee"), false: globalThis.WMOFLanguagePack.text("702e97ca-db6c-41d5-8b9b-b7ce1d44d2f1"), undefined: globalThis.WMOFLanguagePack.text("91b34e04-48eb-453b-bb02-ad1958d99a11")}},
        latencyColor: {title: globalThis.WMOFLanguagePack.text("92704b89-f209-52c2-9495-8f00c5c4c17a"), text: globalThis.WMOFLanguagePack.text("1f6618cd-1496-5293-9e63-21b57ecbd327"), stateControl: "showLatency", stateText: {true: globalThis.WMOFLanguagePack.text("de2815df-0269-42f6-a02a-ab64c0205a15"), false: globalThis.WMOFLanguagePack.text("4ffeb636-fc6b-4de4-9b0b-4ac25cba69b9")}}
    };

    function getContrastingTextColor(value) {
        const match = /^#([0-9a-f]{6})$/i.exec(String(value || "").trim());
        if (!match) return "#ffffff";

        const hex = match[1];
        const channels = [0, 2, 4].map(index => {
            const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
            return channel <= 0.04045
                ? channel / 12.92
                : ((channel + 0.055) / 1.055) ** 2.4;
        });
        const luminance =
            0.2126 * channels[0] +
            0.7152 * channels[1] +
            0.0722 * channels[2];
        const blackContrast = (luminance + 0.05) / 0.05;
        const whiteContrast = 1.05 / (luminance + 0.05);

        return blackContrast >= whiteContrast
            ? "#000000"
            : "#ffffff";
    }

    function applyGraphicalSettings(settings, target = clockTimer) {
        globalThis.WMOFTimerAppearance.applyGraphical(target,settings);

        if (target === clockPreview) {
            renderClockPreviewRanges(settings);
        }

        if (target === clockTimer) {
            const paletteRoot = document.documentElement;
            const tripColor = settings.tripColor || GRAPHICAL_DEFAULTS.tripColor;
            const earlyStartColor = settings.earlyStartColor || GRAPHICAL_DEFAULTS.earlyStartColor;
            const breakColor = settings.breakColor || GRAPHICAL_DEFAULTS.breakColor;
            const lunchColor = settings.lunchColor || GRAPHICAL_DEFAULTS.lunchColor;
            const breakBufferColor = settings.breakBufferColor || GRAPHICAL_DEFAULTS.breakBufferColor;
            const downColor = settings.downColor || GRAPHICAL_DEFAULTS.downColor;
            const approvalSurplusColor = settings.approvalSurplusColor || GRAPHICAL_DEFAULTS.approvalSurplusColor;
            const approvalDeficitColor = settings.approvalDeficitColor || GRAPHICAL_DEFAULTS.approvalDeficitColor;
            const toleranceColor = settings.toleranceColor || GRAPHICAL_DEFAULTS.toleranceColor;
            const overtimeColor = settings.overtimeColor || GRAPHICAL_DEFAULTS.overtimeColor;
            const latencyColor = settings.latencyColor || GRAPHICAL_DEFAULTS.latencyColor;

            paletteRoot.style.setProperty("--timer-trip-color", tripColor);
            paletteRoot.style.setProperty("--timer-early-start-color", earlyStartColor);
            paletteRoot.style.setProperty("--timer-break-color", breakColor);
            paletteRoot.style.setProperty("--timer-break-text-color", getContrastingTextColor(breakColor));
            paletteRoot.style.setProperty("--timer-lunch-color", lunchColor);
            paletteRoot.style.setProperty("--timer-lunch-text-color", getContrastingTextColor(lunchColor));
            paletteRoot.style.setProperty("--timer-break-buffer-color", breakBufferColor);
            paletteRoot.style.setProperty("--timer-down-color", downColor);
            paletteRoot.style.setProperty("--timer-down-text-color", getContrastingTextColor(downColor));
            paletteRoot.style.setProperty("--timer-approval-surplus-color", approvalSurplusColor);
            paletteRoot.style.setProperty("--timer-approval-deficit-color", approvalDeficitColor);
            paletteRoot.style.setProperty("--timer-tolerance-color", toleranceColor);
            paletteRoot.style.setProperty("--timer-overtime-color", overtimeColor);
            paletteRoot.style.setProperty("--timer-latency-color", latencyColor);
        }
    }

    function setToleranceCheckboxValue(control, value) {
        if (!control) return;

        const state =
            value === undefined
                ? "undefined"
                : value
                    ? "true"
                    : "false";

        control.dataset.toleranceState =
            state;

        control.indeterminate =
            state === "undefined";

        control.checked =
            state === "true";

        control.setAttribute(
            "aria-checked",
            state === "undefined"
                ? "mixed"
                : state
        );
    }

    function getToleranceCheckboxValue(control) {
        const state =
            control?.dataset.toleranceState;

        if (state === "undefined") {
            return undefined;
        }

        if (state === "false") {
            return false;
        }

        return true;
    }

    function settingsFromForm(form) {
        const data = new FormData(form);
        const text = name => String(data.get(name) || "").trim();
        return {
            timerType: text("timerType"),
            timerMode: text("timerMode"),
            tripColor: text("tripColor"),
            earlyStartColor: text("earlyStartColor"),
            showEarlyStart: form.elements.showEarlyStart.checked,
            breakColor: text("breakColor"),
            lunchColor: text("lunchColor"),
            breakBufferColor: text("breakBufferColor"),
            showBreakBuffer: form.elements.showBreakBuffer.checked,
            downColor: text("downColor"),
            approvalSurplusColor: text("approvalSurplusColor"),
            approvalDeficitColor: text("approvalDeficitColor"),
            toleranceColor: text("toleranceColor"),
            overtimeColor: text("overtimeColor"),
            latencyColor: text("latencyColor"),
            showTolerance:
                getToleranceCheckboxValue(
                    form.elements.showTolerance
                ),
            showOvertime: form.elements.showOvertime.checked,
            showLatency: form.elements.showLatency.checked,
            militaryTime: form.elements.militaryTime.checked,
            timeFormat: text("timeFormat"),
            dateFormat: text("dateFormat"),
            visibleHours: text("visibleHours"),
            tickMarks: text("tickMarks"),
            indicatorSymbol: text("indicatorSymbol"),
            showHourHand: form.elements.showHourHand.checked,
            showMinuteHand: form.elements.showMinuteHand.checked,
            showSecondHand: form.elements.showSecondHand.checked,
            hourHandLength: text("hourHandLength"),
            hourHandColor: text("hourHandColor"),
            minuteHandLength: text("minuteHandLength"),
            minuteHandColor: text("minuteHandColor"),
            secondHandLength: text("secondHandLength"),
            secondHandColor: text("secondHandColor"),
            clockFont: text("clockFont"),
            hourColor: text("hourColor"),
            timeColor: text("timeColor"),
            borderColor: text("borderColor")
        };
    }

    const GENERIC_CLOCK_FONTS =
        new Set([
            "serif",
            "sans-serif",
            "monospace",
            "cursive",
            "fantasy",
            "system-ui",
            "ui-serif",
            "ui-sans-serif",
            "ui-monospace",
            "ui-rounded"
        ]);

    function splitClockFontList(value) {
        return String(value || "")
            .split(",")
            .map(font =>
                font.trim()
                    .replace(/^(['"])(.*)\1$/, "$2")
                    .trim()
            )
            .filter(Boolean);
    }

    function serializeClockFontList(fonts) {
        return fonts
            .map(font => String(font || "").trim())
            .filter(Boolean)
            .join(", ");
    }

    function clockFontCanRender(font) {
        const normalized =
            String(font || "")
                .trim();

        if (!normalized) return false;

        if (
            GENERIC_CLOCK_FONTS.has(
                normalized.toLowerCase()
            )
        ) {
            return true;
        }

        if (!document.fonts?.check) {
            return true;
        }

        const escaped =
            normalized.replace(
                /[\\"]/g,
                "\\$&"
            );

        try {
            return document.fonts.check(
                `16px "${escaped}"`
            );
        }
        catch {
            return false;
        }
    }

    function getFirstRenderableClockFont(fonts) {
        return (
            fonts.find(
                clockFontCanRender
            ) ||
            fonts[0] ||
            "sans-serif"
        );
    }

    function syncClockFontPicker(form) {
        const picker =
            form?.querySelector(
                "[data-clock-font-picker]"
            );

        const control =
            form?.elements?.clockFont;

        if (!picker || !control) return;

        const fonts =
            splitClockFontList(
                control.value
            );

        const normalizedFonts =
            fonts.length > 0
                ? fonts
                : ["sans-serif"];

        if (fonts.length === 0) {
            control.value =
                serializeClockFontList(
                    normalizedFonts
                );
        }

        const active =
            getFirstRenderableClockFont(
                normalizedFonts
            );

        const activeText =
            picker.querySelector(
                "[data-clock-font-active]"
            );

        if (activeText) {
            activeText.textContent =
                active;
            activeText.style.fontFamily =
                serializeClockFontList([
                    active,
                    "sans-serif"
                ]);
        }

        const list =
            picker.querySelector(
                "[data-clock-font-options]"
            );

        if (!list) return;

        list.replaceChildren();

        for (
            const [index, font] of
                normalizedFonts.entries()
        ) {
            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "clock-font-option";

            if (font === active) {
                row.dataset.activeFont =
                    "true";
            }

            const name =
                document.createElement(
                    "span"
                );

            name.className =
                "clock-font-option-name";

            name.textContent =
                font;

            name.style.fontFamily =
                serializeClockFontList([
                    font,
                    "sans-serif"
                ]);

            const available =
                document.createElement(
                    "span"
                );

            available.className =
                "clock-font-option-state";

            available.textContent =
                font === active
                    ? globalThis.WMOFLanguagePack.text("911f99ba-8f23-5b32-a4c1-e703caa7a75a")
                    : clockFontCanRender(font)
                        ? globalThis.WMOFLanguagePack.text("76177d3e-e2e1-5711-908c-e3f13a8cda51")
                        : globalThis.WMOFLanguagePack.text("91c6f1cc-7f82-5ab7-8ddb-4c03ecd30c47");

            const remove =
                document.createElement(
                    "button"
                );

            remove.type =
                "button";

            remove.className =
                "clock-font-remove";

            remove.dataset.fontIndex =
                String(index);

            remove.setAttribute(
                "aria-label",
                globalThis.WMOFLanguagePack.text("ea78b5d4-9979-562e-90f0-e35a0695285d", {value0: (font)})
            );

            remove.textContent =
                "×";

            row.append(
                name,
                available,
                remove
            );

            list.appendChild(
                row
            );
        }
    }

    function installClockFontPicker() {
        const form =
            $("#graphicalSettingsForm");

        const picker =
            form?.querySelector(
                "[data-clock-font-picker]"
            );

        const control =
            form?.elements?.clockFont;

        if (!form || !picker || !control) {
            return;
        }

        const trigger =
            picker.querySelector(
                "[data-clock-font-trigger]"
            );

        const menu =
            picker.querySelector(
                "[data-clock-font-menu]"
            );

        const addButton =
            picker.querySelector(
                "[data-clock-font-add]"
            );

        const editor =
            picker.querySelector(
                "[data-clock-font-editor]"
            );

        const input =
            picker.querySelector(
                "[data-clock-font-input]"
            );

        const confirm =
            picker.querySelector(
                "[data-clock-font-confirm]"
            );

        const cancel =
            picker.querySelector(
                "[data-clock-font-cancel]"
            );

        const closeEditor = () => {
            if (editor) editor.hidden = true;
            if (addButton) addButton.hidden = false;
            if (input) input.value = "";
        };

        const closeMenu = () => {
            if (menu) menu.hidden = true;
            trigger?.setAttribute(
                "aria-expanded",
                "false"
            );
            closeEditor();
        };

        const commitFonts = fonts => {
            control.value =
                serializeClockFontList(
                    fonts.length > 0
                        ? fonts
                        : ["sans-serif"]
                );

            syncClockFontPicker(
                form
            );

            control.dispatchEvent(
                new Event(
                    "input",
                    {
                        bubbles: true
                    }
                )
            );
        };

        trigger?.addEventListener(
            "click",
            () => {
                const opening =
                    menu?.hidden !== false;

                if (menu) menu.hidden = !opening;

                trigger.setAttribute(
                    "aria-expanded",
                    String(opening)
                );

                if (!opening) {
                    closeEditor();
                }
            }
        );

        addButton?.addEventListener(
            "click",
            () => {
                addButton.hidden = true;
                if (editor) editor.hidden = false;
                input?.focus();
            }
        );

        const addFont = () => {
            const font =
                String(
                    input?.value || ""
                ).trim();

            if (!font) return;

            const fonts =
                splitClockFontList(
                    control.value
                );

            if (
                !fonts.some(
                    existing =>
                        existing.toLowerCase() ===
                            font.toLowerCase()
                )
            ) {
                fonts.unshift(
                    font
                );
            }

            commitFonts(
                fonts
            );

            closeEditor();
        };

        confirm?.addEventListener(
            "click",
            addFont
        );

        cancel?.addEventListener(
            "click",
            closeEditor
        );

        input?.addEventListener(
            "keydown",
            event => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    addFont();
                }
                else if (
                    event.key === "Escape"
                ) {
                    event.preventDefault();
                    closeEditor();
                }
            }
        );

        picker.addEventListener(
            "click",
            event => {
                const remove =
                    event.target.closest(
                        ".clock-font-remove"
                    );

                if (!remove) return;

                const index =
                    Number(
                        remove.dataset.fontIndex
                    );

                const fonts =
                    splitClockFontList(
                        control.value
                    );

                if (
                    Number.isInteger(index) &&
                    index >= 0 &&
                    index < fonts.length
                ) {
                    fonts.splice(
                        index,
                        1
                    );

                    commitFonts(
                        fonts
                    );
                }
            }
        );

        document.addEventListener(
            "pointerdown",
            event => {
                if (
                    !menu ||
                    menu.hidden ||
                    picker.contains(
                        event.target
                    )
                ) {
                    return;
                }

                closeMenu();
            },
            true
        );

        syncClockFontPicker(
            form
        );
    }

    function fillGraphicalForm(settings) {
        const form = $("#graphicalSettingsForm");
        for (const [key, value] of Object.entries(settings)) {
            const control = form.elements[key];
            if (!control) continue;
            if (key === "showTolerance") {
                setToleranceCheckboxValue(
                    control,
                    value
                );
                continue;
            }
            if (control.type === "checkbox") control.checked = Boolean(value);
            else control.value = value;
        }
        syncTimeFormatForMilitaryToggle(form);
        syncClockFontPicker(form);
        applyGraphicalSettings(
            settingsFromForm(form),
            clockPreview
        );
    }

    function formatPreviewDate(value) {
        const pad = (part, length = 2) => String(part).padStart(length, "0");
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}.${pad(value.getMilliseconds(), 3)}`;
    }

    function renderClockPreviewRanges(settings = settingsFromForm($("#graphicalSettingsForm"))) {
        if (!clockPreview) return;

        clockPreview.querySelector('[data-settings-preview="ranges"]')?.remove();

        const ring = document.createElement("ring-container");
        ring.dataset.settingsPreview = "ranges";
        ring.clockTimerRing = 0;
        ring.clockTimerRingIndex = 0;
        ring.clockTimerExternalRangeLayout =
            settings.timerType === "radial-fitted";
        ring.setAttribute("width", "18px");
        ring.setAttribute("inset", "18px");

        const segments = [
            ["trip", 5],
            [settings.showEarlyStart ? "earlystart" : "trip", 10],
            ["break", 10],
            [settings.showBreakBuffer ? "buffer" : "break", 10],
            ["lunch", 15],
            ["down", 10],
            ["approval-surplus", 5],
            ["approval-deficit", 5],
            [settings.showOvertime ? "overtime" : "trip", 5],
            [settings.showTolerance === false ? "trip" : "tolerance", 5],
            [settings.showLatency ? "latency" : "trip", 10]
        ];
        let cursor = new Date();
        cursor.setSeconds(0, 0);
        cursor = new Date(cursor.getTime() - 45 * 60 * 1000);

        for (const [type, minutes] of segments) {
            const end = new Date(cursor.getTime() + minutes * 60 * 1000);
            const range = document.createElement("time-range");
            range.setAttribute("type", type);
            range.setAttribute("start-time", formatPreviewDate(cursor));
            range.setAttribute("end-time", formatPreviewDate(end));
            ring.append(range);
            cursor = end;
        }

        clockPreview.prepend(ring);
    }

    function installGraphicalHelpButtons() {
        const form = $("#graphicalSettingsForm");
        for (const key of Object.keys(GRAPHICAL_HELP)) {
            if (getSettingsHelpButton(key)) continue;
            const control = form.elements[key];
            if (!control) continue;
            const button = document.createElement("button");
            button.className = "settings-help-button";
            button.type = "button";
            button.textContent = "?";
            button.dataset.helpKey = key;
            button.setAttribute("aria-label", globalThis.WMOFLanguagePack.text("537b08c7-3f4d-56ee-be88-6a4a1a082674", {value0: (GRAPHICAL_HELP[key].title)}));
            button.setAttribute("aria-hidden", "true");
            button.tabIndex = -1;

            const colorRow = control.closest(".timer-color-row");
            if (colorRow) {
                colorRow.classList.add("has-setting-help");
                colorRow.querySelector("label")?.before(button);
                continue;
            }

            const label = control.closest("label");
            if (!label) continue;
            label.classList.add("has-inline-setting-help");
            if (control.type === "color") label.classList.add("has-inline-color-help");
            const caption = document.createElement("span");
            caption.className = "setting-help-caption";
            for (const node of Array.from(label.childNodes)) {
                if (node === control || node === button) continue;
                if (node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) continue;
                caption.append(node);
            }
            if (control.type === "color") label.prepend(button, caption);
            else label.prepend(caption, button);
        }
    }

    function setGraphicalHelpVisibility(visible) {
        graphicalHelpVisible = Boolean(visible);
        graphicalDialog.classList.toggle("show-setting-help", graphicalHelpVisible);
        const toggle = $("#graphicalHelpToggle");
        toggle?.setAttribute("aria-pressed", String(graphicalHelpVisible));
        toggle?.setAttribute("aria-label", graphicalHelpVisible ? globalThis.WMOFLanguagePack.text("a92e1d7b-774c-5235-98be-7e6bfed271fe") : globalThis.WMOFLanguagePack.text("7395482d-1c7b-5ebb-925d-ec2db7f980c6"));
        graphicalDialog.querySelectorAll(".settings-help-button").forEach(button => {
            button.setAttribute("aria-hidden", String(!graphicalHelpVisible));
            button.tabIndex = graphicalHelpVisible ? 0 : -1;
        });
        if (!graphicalHelpVisible) void closeSettingsHelpPopover({immediate: true});
    }

    function getGraphicalTimeFormatType(value) {
        const format = String(value || "").trim();
        if (!format || typeof TemporalFormat === "undefined") {
            return undefined;
        }

        const formatType =
            TemporalFormat.getFormatType(
                format
            );

        return formatType?.type === "time"
            ? formatType["time-type"]
            : undefined;
    }

    function syncTimeFormatForMilitaryToggle(form) {
        const control = form.elements.timeFormat;
        const current = String(control.value || "").trim();
        const military = form.elements.militaryTime.checked;
        const formatType = getGraphicalTimeFormatType(current);
        const conflict = military
            ? formatType !== "military"
            : formatType !== "12-hour";

        if (!current || conflict) {
            const includesSeconds = /s/i.test(current);
            control.value = military
                ? (includesSeconds ? "HHmmss" : "HHmm")
                : (includesSeconds ? "h:mm:ss A" : "h:mm A");
        }
    }

    function syncMilitaryToggleForTimeFormat(form) {
        const formatType = getGraphicalTimeFormatType(
            form.elements.timeFormat.value
        );

        if (formatType === "military") {
            form.elements.militaryTime.checked = true;
        }
        else if (formatType === "12-hour") {
            form.elements.militaryTime.checked = false;
        }
    }

    function getSettingsHelpElements() {
        return {
            popover: $("#graphicalHelpPopover"),
            title: $("#graphicalHelpTitle"),
            body: $("#graphicalHelpBody"),
            close: $("#graphicalHelpClose")
        };
    }

    function getSettingsHelpTemplate(key) {
        const ids = {
            speechRecognition: "settingsHelpSpeechRecognition",
            syncGoals: "settingsHelpSyncGoals",
            tolerance: "settingsHelpTolerance",
            toleranceColor: "settingsHelpTolerance",
            overtimeColor: "settingsHelpOvertime",
            latency: "settingsHelpLatency",
            latencyColor: "settingsHelpLatency",
            timeFormat: "settingsHelpTimeFormat",
            dateFormat: "settingsHelpDateFormat",
            visibleHours: "settingsHelpVisibleHours",
            tickMarks: "settingsHelpTickMarks"
        };

        return document.getElementById(
            ids[key]
        );
    }

    function getSettingsHelpButton(key) {
        return Array.from(
            graphicalDialog.querySelectorAll(
                ".settings-help-button"
            )
        ).find(
            button =>
                button.dataset.helpKey === key
        );
    }

    function hideSettingsHelpButton(button) {
        if (!button) return;
        if (button.classList.contains("menu-help-button")) return;

        clearTimeout(
            settingsHelpRevealTimers.get(
                button
            )
        );

        settingsHelpRevealTimers.delete(
            button
        );

        button.classList.remove(
            "is-visible"
        );

        if (
            graphicalHelpVisible &&
            graphicalDialog.contains(button)
        ) {
            button.setAttribute("aria-hidden", "false");
            button.tabIndex = 0;
            return;
        }

        button.setAttribute(
            "aria-hidden",
            "true"
        );

        button.tabIndex =
            -1;
    }

    function revealSettingsHelpButton(button) {
        if (!button) return;

        for (
            const candidate of
                graphicalDialog.querySelectorAll(
                    ".settings-help-button.is-visible"
                )
        ) {
            if (
                candidate !== button &&
                candidate !== activeSettingsHelpButton
            ) {
                hideSettingsHelpButton(
                    candidate
                );
            }
        }

        clearTimeout(
            settingsHelpRevealTimers.get(
                button
            )
        );

        button.classList.add(
            "is-visible"
        );

        button.setAttribute(
            "aria-hidden",
            "false"
        );

        button.tabIndex =
            0;

        if (button === activeSettingsHelpButton) {
            return;
        }

        settingsHelpRevealTimers.set(
            button,
            setTimeout(
                () =>
                    hideSettingsHelpButton(
                        button
                    ),
                SETTINGS_HELP_FADE_DURATION +
                    SETTINGS_HELP_VISIBLE_DURATION
            )
        );
    }

    async function closeSettingsHelpPopover({
        immediate = false
    } = {}) {
        const {
            popover,
            title,
            body
        } = getSettingsHelpElements();

        const button =
            activeSettingsHelpButton;

        activeSettingsHelpButton =
            undefined;

        settingsHelpAnimation?.cancel();
        settingsHelpAnimation =
            undefined;

        hideSettingsHelpButton(
            button
        );

        if (
            !popover ||
            !popover.matches(
                ":popover-open"
            )
        ) {
            return;
        }

        if (!immediate) {
            const opacity =
                Number.parseFloat(
                    getComputedStyle(
                        popover
                    ).opacity
                );

            settingsHelpAnimation =
                popover.animate(
                    [
                        {
                            opacity:
                                Number.isFinite(opacity)
                                    ? opacity
                                    : 1
                        },
                        { opacity: 0 }
                    ],
                    {
                        duration:
                            SETTINGS_HELP_FADE_DURATION,
                        easing: "linear",
                        fill: "both"
                    }
                );

            try {
                await settingsHelpAnimation.finished;
            }
            catch {}
        }

        settingsHelpAnimation?.cancel();
        settingsHelpAnimation =
            undefined;

        if (
            popover.matches(
                ":popover-open"
            )
        ) {
            popover.hidePopover();
        }

        if (title) title.textContent = "";
        if (body) body.replaceChildren();
    }

    function getGraphicalHelpState(control) {
        return control?.name === "showTolerance"
            ? getToleranceCheckboxValue(control)
            : Boolean(control?.checked);
    }

    function syncGraphicalHelpState(definition, body) {
        if (!definition?.stateControl || !body) return;
        const source = $("#graphicalSettingsForm").elements[definition.stateControl];
        const checkbox = body.querySelector(".settings-help-state-toggle");
        const label = body.querySelector(".settings-help-state-label");
        const description = body.querySelector(".settings-help-state-behavior");
        if (!source || !checkbox || !label || !description) return;

        const state = getGraphicalHelpState(source);
        checkbox.checked = state === true;
        checkbox.indeterminate = state === undefined;
        checkbox.setAttribute("aria-checked", state === undefined ? "mixed" : String(state));
        label.textContent = state === undefined ? globalThis.WMOFLanguagePack.text("b3678f92-d975-5d01-8dfc-184743dd98fa") : state ? globalThis.WMOFLanguagePack.text("f77a96e2-203f-5f99-8aa5-cad67f9e6491") : globalThis.WMOFLanguagePack.text("c3c025a4-fb0f-5314-a48e-57e49eedadfe");
        description.textContent = definition.stateText[String(state)];
    }

    function appendGraphicalHelpState(definition, body) {
        if (!definition?.stateControl) return;
        const divider = document.createElement("hr");
        divider.className = "settings-help-divider";
        const row = document.createElement("label");
        row.className = "settings-help-state-row";
        const checkbox = document.createElement("input");
        checkbox.className = "settings-help-state-toggle";
        checkbox.type = "checkbox";
        const label = document.createElement("strong");
        label.className = "settings-help-state-label";
        row.append(checkbox, label);
        const state = document.createElement("p");
        state.className = "settings-help-state-behavior";
        body.append(divider, row, state);
        checkbox.addEventListener("change", () => {
            const source = $("#graphicalSettingsForm").elements[definition.stateControl];
            source?.click();
            syncGraphicalHelpState(definition, body);
        });
        syncGraphicalHelpState(definition, body);
    }

    function refreshActiveGraphicalHelpState() {
        const key = activeSettingsHelpButton?.dataset.helpKey;
        const definition = GRAPHICAL_HELP[key];
        if (definition?.stateControl) {
            syncGraphicalHelpState(definition, $("#graphicalHelpBody"));
        }
    }

    async function openSettingsHelpPopover(
        key,
        button
    ) {
        const definition = GRAPHICAL_HELP[key];
        const template =
            getSettingsHelpTemplate(
                key
            );

        const {
            popover,
            title,
            body,
            close
        } = getSettingsHelpElements();

        if (
            (!template && !definition) ||
            !popover ||
            !title ||
            !body
        ) {
            return;
        }

        if (
            popover.matches(
                ":popover-open"
            )
        ) {
            await closeSettingsHelpPopover();
        }

        // A closed dialog hides its descendants; an open modal makes outside
        // content inert. Keep shared help in the requesting button's context.
        const helpHost = button.closest("dialog") || document.body;
        if (popover.parentElement !== helpHost) {
            helpHost.append(popover);
        }

        clearTimeout(
            settingsHelpRevealTimers.get(
                button
            )
        );

        settingsHelpRevealTimers.delete(
            button
        );

        activeSettingsHelpButton =
            button;

        revealSettingsHelpButton(
            button
        );

        title.textContent =
            template?.dataset.helpTitle ||
            definition?.title ||
            globalThis.WMOFLanguagePack.text("e7c534ac-1637-5863-a681-b1be3f42bf3c");

        if (template) {
            body.replaceChildren(
                template.content.cloneNode(true)
            );
            appendGraphicalHelpState(
                definition,
                body
            );
        }
        else if (definition) {
            const paragraph =
                document.createElement("p");

            paragraph.textContent =
                definition.text;

            body.replaceChildren(
                paragraph
            );

            appendGraphicalHelpState(
                definition,
                body
            );
        }

        const latencyColor =
            graphicalDialog.querySelector(
                '[name="latencyColor"]'
            )?.value ||
            GRAPHICAL_DEFAULTS.latencyColor;

        popover.style.setProperty(
            "--settings-help-latency-color",
            latencyColor
        );

        popover.showPopover();

        settingsHelpAnimation?.cancel();

        settingsHelpAnimation =
            popover.animate(
                [
                    { opacity: 0 },
                    { opacity: 1 }
                ],
                {
                    duration:
                        SETTINGS_HELP_FADE_DURATION,
                    easing: "linear",
                    fill: "both"
                }
            );

        try {
            await settingsHelpAnimation.finished;
        }
        catch {}

        settingsHelpAnimation?.cancel();
        settingsHelpAnimation =
            undefined;

        close?.focus({
            preventScroll: true
        });
    }

    function getGraphicalSettingsLayout() {
        const groups =
            graphicalDialog.querySelector(
                ".graphical-settings-grid > .settings-groups"
            );

        const preview =
            graphicalDialog.querySelector(
                ".graphical-settings-grid > .clock-preview"
            );

        const categories =
            Array.from(
                graphicalDialog.querySelectorAll(
                    ".settings-category"
                )
            );

        return {
            groups,
            preview,
            categories
        };
    }

    function graphicalRectsOverlap(first, second) {
        return (
            first.right > second.left &&
            first.left < second.right &&
            first.bottom > second.top &&
            first.top < second.bottom
        );
    }

    function updateGraphicalPreviewOverlap({
        immediate = false
    } = {}) {
        const {
            groups,
            preview,
            categories
        } = getGraphicalSettingsLayout();

        if (!groups || !preview) return;

        const applyOverlap = () => {
            if (!graphicalDialog.open) {
                preview.classList.remove(
                    "has-settings-overlap"
                );
                return;
            }

            const previewRect =
                preview.getBoundingClientRect();

            const groupsRect =
                groups.getBoundingClientRect();

            const visiblePreviewRect = {
                top: Math.max(
                    previewRect.top,
                    groupsRect.top
                ),
                right: Math.min(
                    previewRect.right,
                    groupsRect.right
                ),
                bottom: Math.min(
                    previewRect.bottom,
                    groupsRect.bottom
                ),
                left: Math.max(
                    previewRect.left,
                    groupsRect.left
                )
            };

            const hasVisiblePreviewArea =
                visiblePreviewRect.right >
                    visiblePreviewRect.left &&
                visiblePreviewRect.bottom >
                    visiblePreviewRect.top;

            const overlaps =
                hasVisiblePreviewArea &&
                categories.some(
                    category => {
                        const rect =
                            category.getBoundingClientRect();

                        return (
                            rect.width > 0 &&
                            rect.height > 0 &&
                            graphicalRectsOverlap(
                                rect,
                                visiblePreviewRect
                            )
                        );
                    }
                );

            preview.classList.toggle(
                "has-settings-overlap",
                overlaps
            );
        };

        if (!immediate) {
            applyOverlap();
            return;
        }

        const previousTransition =
            preview.style.transition;

        preview.style.transition =
            "none";

        applyOverlap();

        void preview.offsetWidth;

        if (previousTransition) {
            preview.style.transition =
                previousTransition;
        }
        else {
            preview.style.removeProperty(
                "transition"
            );
        }
    }

    function scheduleGraphicalPreviewOverlap() {
        if (graphicalPreviewAnimationFrame) return;

        graphicalPreviewAnimationFrame =
            requestAnimationFrame(
                () => {
                    graphicalPreviewAnimationFrame =
                        undefined;

                    updateGraphicalPreviewOverlap();
                }
            );
    }

    function cancelGraphicalDetailsAnimation(category) {
        const state =
            graphicalDetailsAnimations.get(
                category
            );

        if (!state) return;

        state.heightAnimation?.cancel();
        state.contentAnimation?.cancel();

        graphicalDetailsAnimations.delete(
            category
        );
    }

    function finishGraphicalCategoryAnimation(
        category,
        shouldOpen,
        token
    ) {
        const state =
            graphicalDetailsAnimations.get(
                category
            );

        if (!state || state.token !== token) {
            return;
        }

        state.heightAnimation?.cancel();
        state.contentAnimation?.cancel();

        if (!shouldOpen) {
            category.open = false;
        }

        category.style.removeProperty(
            "height"
        );

        category.classList.remove(
            "is-opening",
            "is-closing"
        );

        graphicalDetailsAnimations.delete(
            category
        );

        scheduleGraphicalPreviewOverlap();
    }

    function followGraphicalDetailsAnimation(
        animation,
        token,
        category
    ) {
        const tick = () => {
            const state =
                graphicalDetailsAnimations.get(
                    category
                );

            if (
                !state ||
                state.token !== token ||
                (
                    animation.playState !== "running" &&
                    animation.playState !== "pending"
                )
            ) {
                updateGraphicalPreviewOverlap();
                return;
            }

            updateGraphicalPreviewOverlap();

            requestAnimationFrame(
                tick
            );
        };

        requestAnimationFrame(
            tick
        );
    }

    function animateGraphicalCategory(
        category,
        shouldOpen
    ) {
        const summary =
            category.querySelector(
                ":scope > summary"
            );

        const content =
            category.querySelector(
                ":scope > .settings-category-content"
            );

        if (!summary || !content) return;

        const existing =
            graphicalDetailsAnimations.get(
                category
            );

        const currentlyTargetedOpen =
            existing?.shouldOpen ??
            category.open;

        if (
            currentlyTargetedOpen === shouldOpen &&
            existing
        ) {
            return;
        }

        const startHeight =
            category.getBoundingClientRect()
                .height;

        const renderedContentOpacity =
            Number.parseFloat(
                getComputedStyle(
                    content
                ).opacity
            );

        const wasOpen =
            category.open;

        cancelGraphicalDetailsAnimation(
            category
        );

        category.style.removeProperty(
            "height"
        );

        category.classList.remove(
            "is-opening",
            "is-closing"
        );

        if (shouldOpen) {
            category.open = true;
            category.classList.add(
                "is-opening"
            );
        }
        else {
            category.classList.add(
                "is-closing"
            );
        }

        const categoryStyle =
            getComputedStyle(
                category
            );

        const borderHeight =
            (
                Number.parseFloat(
                    categoryStyle.borderTopWidth
                ) || 0
            ) +
            (
                Number.parseFloat(
                    categoryStyle.borderBottomWidth
                ) || 0
            );

        const endHeight =
            shouldOpen
                ? category.getBoundingClientRect()
                    .height
                : summary.getBoundingClientRect()
                    .height + borderHeight;

        const reducedMotion =
            typeof matchMedia === "function" &&
            matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches;

        const duration =
            reducedMotion
                ? 0
                : GRAPHICAL_DETAILS_DURATION;

        if (
            duration === 0 ||
            typeof category.animate !== "function"
        ) {
            category.open =
                shouldOpen;

            category.style.removeProperty(
                "height"
            );

            category.classList.remove(
                "is-opening",
                "is-closing"
            );

            updateGraphicalPreviewOverlap({
                immediate: true
            });

            return;
        }

        category.style.height =
            `${startHeight}px`;

        const startOpacity =
            shouldOpen && !wasOpen
                ? 0
                : Number.isFinite(
                    renderedContentOpacity
                )
                    ? renderedContentOpacity
                    : 1;

        const token =
            Symbol(
                "graphical-details-animation"
            );

        const heightAnimation =
            category.animate(
                [
                    {
                        height:
                            `${startHeight}px`
                    },
                    {
                        height:
                            `${endHeight}px`
                    }
                ],
                {
                    duration,
                    easing:
                        "cubic-bezier(.2,.8,.2,1)",
                    fill: "both"
                }
            );

        const contentAnimation =
            content.animate(
                [
                    {
                        opacity:
                            startOpacity
                    },
                    {
                        opacity:
                            shouldOpen
                                ? 1
                                : 0
                    }
                ],
                {
                    duration:
                        Math.min(
                            duration,
                            150
                        ),
                    easing: "ease-out",
                    fill: "both"
                }
            );

        graphicalDetailsAnimations.set(
            category,
            {
                token,
                shouldOpen,
                heightAnimation,
                contentAnimation
            }
        );

        followGraphicalDetailsAnimation(
            heightAnimation,
            token,
            category
        );

        heightAnimation.finished
            .then(
                () =>
                    finishGraphicalCategoryAnimation(
                        category,
                        shouldOpen,
                        token
                    )
            )
            .catch(
                () => {}
            );
    }

    function toggleGraphicalCategory(
        category
    ) {
        const categories =
            getGraphicalSettingsLayout()
                .categories;

        const state =
            graphicalDetailsAnimations.get(
                category
            );

        const shouldOpen =
            !(
                state?.shouldOpen ??
                category.open
            );

        if (shouldOpen) {
            for (const other of categories) {
                if (other === category) continue;

                const otherState =
                    graphicalDetailsAnimations.get(
                        other
                    );

                if (
                    otherState?.shouldOpen ??
                    other.open
                ) {
                    animateGraphicalCategory(
                        other,
                        false
                    );
                }
            }
        }

        animateGraphicalCategory(
            category,
            shouldOpen
        );
    }

    function resetGraphicalSettingsAccordion() {
        const {
            groups,
            preview,
            categories
        } = getGraphicalSettingsLayout();

        if (graphicalPreviewAnimationFrame) {
            cancelAnimationFrame(
                graphicalPreviewAnimationFrame
            );

            graphicalPreviewAnimationFrame =
                undefined;
        }

        for (const category of categories) {
            cancelGraphicalDetailsAnimation(
                category
            );

            category.open = false;

            category.style.removeProperty(
                "height"
            );

            category.classList.remove(
                "is-opening",
                "is-closing"
            );
        }

        if (groups) {
            groups.scrollTop = 0;
        }

        preview?.classList.remove(
            "has-settings-overlap"
        );
    }

    function installGraphicalSettingsAccordion() {
        const {
            groups,
            preview,
            categories
        } = getGraphicalSettingsLayout();

        for (const category of categories) {
            const summary =
                category.querySelector(
                    ":scope > summary"
                );

            summary?.addEventListener(
                "click",
                event => {
                    event.preventDefault();

                    toggleGraphicalCategory(
                        category
                    );
                }
            );
        }

        groups?.addEventListener(
            "scroll",
            scheduleGraphicalPreviewOverlap,
            {
                passive: true
            }
        );

        window.addEventListener(
            "resize",
            scheduleGraphicalPreviewOverlap,
            {
                passive: true
            }
        );

        if (
            typeof ResizeObserver ===
            "function"
        ) {
            graphicalPreviewResizeObserver =
                new ResizeObserver(
                    scheduleGraphicalPreviewOverlap
                );

            if (groups) {
                graphicalPreviewResizeObserver.observe(
                    groups
                );
            }

            if (preview) {
                graphicalPreviewResizeObserver.observe(
                    preview
                );
            }

            for (const category of categories) {
                graphicalPreviewResizeObserver.observe(
                    category
                );
            }
        }

        graphicalDialog.addEventListener(
            "opening",
            resetGraphicalSettingsAccordion
        );

        graphicalDialog.addEventListener(
            "closed",
            resetGraphicalSettingsAccordion
        );

        graphicalDialog.addEventListener(
            "opened",
            () => {
                resetGraphicalSettingsAccordion();

                requestAnimationFrame(
                    () => {
                        applyGraphicalSettings(
                            settingsFromForm(
                                $("#graphicalSettingsForm")
                            ),
                            clockPreview
                        );

                        requestAnimationFrame(
                            () => {
                                clockPreview
                                    ?.refreshLayout?.();

                                updateGraphicalPreviewOverlap({
                                    immediate: true
                                });
                            }
                        );
                    }
                );
            }
        );

        resetGraphicalSettingsAccordion();
    }

    installGraphicalHelpButtons();
    installGraphicalSettingsAccordion();
    installClockFontPicker();
    renderClockPreviewRanges();
    setGraphicalHelpVisibility(false);

    $("#graphicalHelpToggle")?.addEventListener("click", () => {
        setGraphicalHelpVisibility(!graphicalHelpVisible);
    });

    document.querySelectorAll(
        ".settings-help-button"
    ).forEach(
        button => {
            button.addEventListener(
                "click",
                event => {
                    event.preventDefault();
                    event.stopPropagation();

                    revealSettingsHelpButton(
                        button
                    );

                    void openSettingsHelpPopover(
                        button.dataset.helpKey,
                        button
                    );
                }
            );
        }
    );

    $("#graphicalHelpClose")?.addEventListener(
        "click",
        () => {
            void closeSettingsHelpPopover();
        }
    );

    document.addEventListener(
        "pointerdown",
        event => {
            const {
                popover
            } = getSettingsHelpElements();

            if (
                !popover?.matches(
                    ":popover-open"
                )
            ) {
                return;
            }

            const path =
                event.composedPath();

            if (
                path.includes(popover) ||
                path.includes(
                    activeSettingsHelpButton
                )
            ) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            void closeSettingsHelpPopover();
        },
        true
    );

    document.addEventListener(
        "keydown",
        event => {
            if (event.key !== "Escape") {
                return;
            }

            const {
                popover
            } = getSettingsHelpElements();

            if (
                !popover?.matches(
                    ":popover-open"
                )
            ) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            void closeSettingsHelpPopover();
        },
        true
    );

    graphicalDialog.addEventListener(
        "close",
        () => {
            void closeSettingsHelpPopover({
                immediate: true
            });
        }
    );


    return {
        applyGraphicalSettings,
        setToleranceCheckboxValue,
        getToleranceCheckboxValue,
        settingsFromForm,
        fillGraphicalForm,
        setGraphicalHelpVisibility,
        syncTimeFormatForMilitaryToggle,
        syncMilitaryToggleForTimeFormat,
        refreshActiveGraphicalHelpState,
        updateGraphicalPreviewOverlap,
        closeSettingsHelpPopover
    };
}};
})();
