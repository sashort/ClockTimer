(() => {
 'use strict';
 const GRAPHICAL_DEFAULTS = {
        timerType: "radial-overflow",
        timerMode: "elapsed",
        tripColor: "#0053e2",
        earlyStartColor: "#4dbdf5",
        showEarlyStart: true,
        breakColor: "#001e60",
        lunchColor: "#ffc220",
        breakBufferColor: "#6b7f99",
        showBreakBuffer: true,
        downColor: "#5f6772",
        approvalSurplusColor: "#9c6b30",
        approvalDeficitColor: "#7a1f3d",
        toleranceColor: "#2e7d32",
        overtimeColor: "#ff5c5c",
        latencyColor: "#e1251b",
        showTolerance: true,
        showOvertime: true,
        showLatency: true,
        militaryTime: true,
        timeFormat: "HHmm",
        dateFormat: "",
        visibleHours: "12,3,6,9",
        tickMarks: "[10]",
        indicatorSymbol: "▲",
        showHourHand: true,
        showMinuteHand: true,
        showSecondHand: true,
        hourHandLength: "28%",
        hourHandColor: "#ffffff",
        minuteHandLength: "38%",
        minuteHandColor: "#ffffff",
        secondHandLength: "42%",
        secondHandColor: "#ffc220",
        clockFont: "Helvetica, Arial, sans-serif",
        hourColor: "#ffffff",
        timeColor: "#ffffff",
        borderColor: "#001e60"
    };
    function normalizeGraphicalSettings(value) {
        const source =
            value &&
            typeof value === "object" &&
            !Array.isArray(value)
                ? value
                : {};

        const settings = {};

        const legacyClockFont =
            typeof source.clockFont === "string"
                ? source.clockFont
                : (
                    typeof source.timeFont === "string" &&
                    source.timeFont !==
                        GRAPHICAL_DEFAULTS.clockFont
                        ? source.timeFont
                        : typeof source.hourFont === "string"
                            ? source.hourFont
                            : typeof source.timeFont === "string"
                                ? source.timeFont
                                : undefined
                );

        for (
            const [key, fallback] of
                Object.entries(GRAPHICAL_DEFAULTS)
        ) {
            const candidate =
                key === "clockFont" &&
                legacyClockFont !== undefined
                    ? legacyClockFont
                    : Object.prototype.hasOwnProperty.call(
                        source,
                        key
                    )
                        ? source[key]
                        : fallback;

            // Move saved defaults to the reference palette; keep custom colors.
            if (
                (key === "lunchColor" && candidate === "#ffc420") ||
                (key === "earlyStartColor" && candidate === "#00a6d2")
            ) {
                settings[key] = fallback;
                continue;
            }

            if (key === "showTolerance") {
                settings[key] =
                    candidate === null ||
                    candidate === undefined
                        ? undefined
                        : typeof candidate === "boolean"
                            ? candidate
                            : fallback;
                continue;
            }

            if (typeof fallback === "boolean") {
                settings[key] =
                    typeof candidate === "boolean"
                        ? candidate
                        : fallback;
                continue;
            }

            settings[key] =
                typeof candidate === "string"
                    ? candidate
                    : fallback;
        }

        settings.timerType =
            settings.timerType === "radial-fitted"
                ? "radial-fitted"
                : "radial-overflow";

        settings.timerMode =
            settings.timerMode === "remaining"
                ? "remaining"
                : "elapsed";

        return settings;
    }

    function setOptionalAttribute(target,name,value){if(value===""||value==null)target.removeAttribute(name);else target.setAttribute(name,value);}
    function setClockVariable(target,name,value){if(value===""||value==null)target.style.removeProperty(name);else target.style.setProperty(name,value);}
    function applyGraphical(timer, settings) {
        timer.setAttribute("timer-type", settings.timerType || GRAPHICAL_DEFAULTS.timerType);
        timer.setAttribute("timer-mode", settings.timerMode || GRAPHICAL_DEFAULTS.timerMode);
        timer.setAttribute("military-time", String(Boolean(settings.militaryTime)));
        timer.setAttribute("time-format", settings.timeFormat || (settings.militaryTime ? "HHmm" : "h:mm A"));

        setOptionalAttribute(timer, "date-format", settings.dateFormat);
        setOptionalAttribute(timer, "visible-hours", settings.visibleHours);
        setOptionalAttribute(timer, "tick-marks", settings.tickMarks);
        setOptionalAttribute(timer, "indicator-symbol", settings.indicatorSymbol);
        timer.removeAttribute("grayscale");
        timer.removeAttribute("grayscale-ramp");
        timer.showTolerance = settings.showTolerance;
        timer.toggleAttribute("render-early-start-as-trip", !Boolean(settings.showEarlyStart));
        timer.toggleAttribute("hide-break-buffer", !Boolean(settings.showBreakBuffer));
        timer.toggleAttribute("hide-overtime", !Boolean(settings.showOvertime));
        timer.toggleAttribute("hide-latency", !Boolean(settings.showLatency));
        timer.toggleAttribute("hide-hour-hand", !Boolean(settings.showHourHand));
        timer.toggleAttribute("hide-minute-hand", !Boolean(settings.showMinuteHand));
        timer.toggleAttribute("hide-second-hand", !Boolean(settings.showSecondHand));

        const variables = {
            "--clock-timer-trip-color": settings.tripColor,
            "--clock-timer-early-start-color": settings.earlyStartColor,
            "--clock-timer-break-color": settings.breakColor,
            "--clock-timer-lunch-color": settings.lunchColor,
            "--clock-timer-break-buffer-color": settings.breakBufferColor,
            "--clock-timer-down-color": settings.downColor,
            "--clock-timer-approval-surplus-color": settings.approvalSurplusColor,
            "--clock-timer-approval-deficit-color": settings.approvalDeficitColor,
            "--clock-timer-tolerance-color": settings.toleranceColor,
            "--clock-timer-overtime-color": settings.overtimeColor,
            "--clock-timer-latency-color": settings.latencyColor,
            "--clock-timer-hour-hand-length": settings.hourHandLength,
            "--clock-timer-hour-hand-color": settings.hourHandColor,
            "--clock-timer-minute-hand-length": settings.minuteHandLength,
            "--clock-timer-minute-hand-color": settings.minuteHandColor,
            "--clock-timer-second-hand-length": settings.secondHandLength,
            "--clock-timer-second-hand-color": settings.secondHandColor,
            "--clock-timer-hour-font": settings.clockFont,
            "--clock-timer-time-font": settings.clockFont,
            "--clock-timer-time-color": settings.timeColor,
            "--clock-timer-tick-color": settings.hourColor,
            "--clock-timer-border-color": settings.borderColor
        };

        for (const [name, value] of Object.entries(variables)) setClockVariable(timer, name, value);
        timer.style.color = settings.hourColor || GRAPHICAL_DEFAULTS.hourColor;

    }
 const attributes=['timer-type','timer-mode','military-time','time-format','date-format','visible-hours','tick-marks','indicator-symbol','grayscale','grayscale-ramp','render-early-start-as-trip','hide-break-buffer','hide-overtime','hide-latency','hide-hour-hand','hide-minute-hand','hide-second-hand'];
 const properties=['trip-color','early-start-color','break-color','lunch-color','break-buffer-color','down-color','approval-surplus-color','approval-deficit-color','tolerance-color','overtime-color','latency-color','hour-hand-length','hour-hand-color','minute-hand-length','minute-hand-color','second-hand-length','second-hand-color','hour-font','time-font','time-color','tick-color','border-color'];
 const css=properties.map(name=>'--clock-timer-'+name);
 function read(raw) {
  let stored;
  try { stored = raw ? JSON.parse(raw) : undefined; } catch { stored = undefined; }
  return normalizeGraphicalSettings(stored);
 }
 function prepareForStorage(value) {
  const normalized = normalizeGraphicalSettings(value);
  const stored = { ...normalized, showTolerance: normalized.showTolerance === undefined ? null : normalized.showTolerance };
  return { normalized, serialized: JSON.stringify(stored) };
 }
 globalThis.WMOFTimerAppearance={graphicalDefaults:GRAPHICAL_DEFAULTS,normalizeGraphicalSettings,applyGraphical,read,prepareForStorage,attributes,properties,labels:{"timer-type": "e7c0803e-7b6a-5f05-b96f-3f33c42f9592", "timer-mode": "665da4b6-41e4-5d19-b2d6-b65770d18e82", "military-time": "e74a6bea-0ea6-5496-b2b2-ec3535ca59c7", "time-format": "76c33c0e-e51c-514e-99b8-8593f2c4d1f2", "date-format": "5b203756-bd16-594c-948d-d87c9f1fd33f", "visible-hours": "dc372a12-a472-515f-adc5-922673440297", "tick-marks": "adb6f6af-f23a-59be-b81c-98634b11f0cd", "indicator-symbol": "5249882b-7f18-55b6-aa7f-811b4deee58c", "trip-color": "8a7e20c6-91ba-597d-a557-d53d9c810c7b", "early-start-color": "abcd6186-be20-5c69-9ef4-4f400cd0309c", "break-color": "1aab6104-e2f6-5d87-bd35-7dc6eb5d4969", "lunch-color": "7da65690-e980-59c0-bb48-6f6e47a8cfe2", "break-buffer-color": "c2f0557c-cc10-580b-8bd6-697b15fe0933", "down-color": "ccd33927-397d-5d4e-a075-0911896ef5b6", "approval-surplus-color": "b19900ba-5089-53dc-963a-18b9ccbfec67", "approval-deficit-color": "ec23675c-d7e5-56ae-84aa-4668dd39c244", "tolerance-color": "26a70897-632e-5358-96c6-df7825c730c3", "overtime-color": "5e73db72-f005-5765-83af-d7973a0c1488", "latency-color": "679b9584-582c-5d1d-a8ad-ef65aac20052", "hour-hand-color": "3c2411e0-d95e-55d1-9ce3-bab36c27a4bd", "minute-hand-color": "2c6acfa1-9800-514c-8d40-488acf065e65", "second-hand-color": "6cddd28f-652b-5246-978d-b50fcc0d6a62", "time-color": "9529d212-c32e-5981-b0bf-ea4c89697808", "tick-color": "4e6ca79a-c294-5ef3-b181-b041f1fac852", "border-color": "c6aed917-edb1-5404-8287-377fbbb52b26", "hour-font": "377731c7-db21-5b71-814c-5c05b82b07b3", "hour-hand-length": "587c6039-9ab6-55de-a3a4-cc5835dda396", "minute-hand-length": "3cc1cf81-fbc8-56f9-809f-0324f2274ba6", "second-hand-length": "f34a1919-3e5f-50d9-a950-758364938999", "show-tolerance": "3ff1600c-1f1e-5e2e-98ea-02c28f47cefa", "show-early-start": "0816ba7b-1075-55fe-a90d-a0838cb1fb7d", "show-break-buffer": "d804af31-46f2-509e-a288-5dd525603b56", "show-overtime": "32ea09ef-8c47-5db0-a5c3-80da8cbe48dd", "show-latency": "ab7aaa22-e64a-5a6d-aa71-42f76420bd9a", "show-hour-hand": "68463c63-89de-5924-b563-0bb7e5beff3f", "show-minute-hand": "bc683892-1677-599c-a99a-4d2d9cde89ec", "show-second-hand": "96ea0e41-ed08-5ea0-b0ec-f2983ab0ed90"},
  capture(timer){const style=getComputedStyle(timer);return {attributes:Object.fromEntries(attributes.filter(name=>timer.hasAttribute(name)).map(name=>[name,timer.getAttribute(name)])),variables:Object.fromEntries(css.map(name=>[name,style.getPropertyValue(name).trim()]).filter(([,value])=>value)),color:style.color,showTolerance:timer.showTolerance??null};},
  apply(timer,settings){if(!settings)return;for(const name of attributes){const value=settings.attributes?.[name];if(typeof value==='string')timer.setAttribute(name,value);else timer.removeAttribute(name);}for(const name of css){const value=settings.variables?.[name];if(typeof value==='string'&&value.length<=200)timer.style.setProperty(name,value);else timer.style.removeProperty(name);}if(typeof settings.color==='string'&&settings.color.length<=100)timer.style.color=settings.color;timer.showTolerance=typeof settings.showTolerance==='boolean'?settings.showTolerance:undefined;timer.refreshLayout?.();}
 };
})();
