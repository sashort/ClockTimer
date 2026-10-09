/* Shared speech-menu DOM mounting for the legacy app command registrar. */
(function (root) {
    "use strict";

    function ensure(container = document.body, modalMode) {
        if (modalMode === "top-level") {
            const topLevel = document.getElementById("speechTopLevelMenu");
            if (topLevel) return topLevel;
        }

        const selector = modalMode
            ? `speech-menu[speech-modal="${modalMode}"]`
            : "speech-menu:not([speech-modal])";
        let menu;
        try {
            menu = [...container.children].find(element => element.matches?.(selector));
        } catch {}

        if (menu) return menu;
        menu = document.createElement("speech-menu");
        menu.dataset.speechRuntimeMenu = "true";
        if (modalMode) menu.setAttribute("speech-modal", modalMode);
        container.append(menu);
        return menu;
    }

    root.ClockTimerSpeechMenuMount = Object.freeze({ ensure });
})(globalThis);
