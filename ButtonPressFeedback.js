/* Delegated pointer/keyboard press feedback for buttons. */
(function (root) {
    "use strict";

    function install({
        documentRef = document,
        buttonClass = HTMLButtonElement,
        getComputedStyleRef = getComputedStyle,
        excludedButton,
        pressInDuration = 120,
        pressOutDuration = 140
    } = {}) {
        const states = new WeakMap();
        const pointerButtons = new Map();
        const listeners = [];
        const add = (type, handler, options = true) => {
            documentRef.addEventListener(type, handler, options);
            listeners.push([type, handler, options]);
        };
        const pressedShadow = (base, pressed) =>
            !base || base === "none" ? pressed : base + ", " + pressed;
        const pressedTextShadow = base => {
            const pressed = "0 2px 3px rgb(0 0 0 / 48%), 0 0 5px rgb(255 255 255 / 18%)";
            return !base || base === "none" ? pressed : base + ", " + pressed;
        };

        function finish(button, state) {
            if (!state || state.releaseStarted) return;
            state.releaseStarted = true;
            state.releaseAnimation = button.animate([
                {boxShadow: state.pressedBoxShadow, textShadow: state.pressedTextShadow},
                {boxShadow: state.baseBoxShadow, textShadow: state.baseTextShadow}
            ], {duration: pressOutDuration, easing: "ease-in-out", fill: "forwards"});
            state.releaseAnimation.finished.catch(() => {}).finally(() => {
                state.pressAnimation?.cancel();
                state.releaseAnimation?.cancel();
                if (states.get(button) === state) states.delete(button);
            });
        }

        function begin(button) {
            if (!(button instanceof buttonClass) || button.disabled) return;
            if (button === excludedButton || states.has(button)) return;
            const style = getComputedStyleRef(button);
            const baseBoxShadow = style.boxShadow || "none";
            const baseTextShadow = style.textShadow || "none";
            const state = {
                released: false,
                pressFinished: false,
                releaseStarted: false,
                baseBoxShadow,
                baseTextShadow,
                pressedBoxShadow: pressedShadow(baseBoxShadow,
                    "inset 0 4px 8px rgb(0 0 0 / 38%), inset 0 1px 2px rgb(0 0 0 / 52%)"),
                pressedTextShadow: pressedTextShadow(baseTextShadow)
            };
            states.set(button, state);
            state.pressAnimation = button.animate([
                {boxShadow: state.baseBoxShadow, textShadow: state.baseTextShadow},
                {boxShadow: state.pressedBoxShadow, textShadow: state.pressedTextShadow}
            ], {duration: pressInDuration, easing: "ease-out", fill: "forwards"});
            state.pressAnimation.finished.then(() => {
                state.pressFinished = true;
                if (state.released) finish(button, state);
            }).catch(() => {});
        }

        function release(button) {
            const state = states.get(button);
            if (!state) return;
            state.released = true;
            if (state.pressFinished) finish(button, state);
        }

        function eventButton(event) {
            return event.composedPath().find(node => node instanceof buttonClass);
        }

        add("pointerdown", event => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            const button = eventButton(event);
            if (!button || button.disabled) return;
            pointerButtons.set(event.pointerId, button);
            begin(button);
        });
        for (const type of ["pointerup", "pointercancel"]) {
            add(type, event => {
                const button = pointerButtons.get(event.pointerId);
                if (!button) return;
                pointerButtons.delete(event.pointerId);
                release(button);
            });
        }
        add("keydown", event => {
            if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
            const button = eventButton(event);
            if (!button || button.disabled) return;
            begin(button);
        });
        add("keyup", event => {
            if (event.key !== " " && event.key !== "Enter") return;
            const button = eventButton(event);
            if (!button) return;
            release(button);
        });

        return Object.freeze({
            dispose() {
                for (const [type, handler, options] of listeners) {
                    documentRef.removeEventListener(type, handler, options);
                }
                listeners.length = 0;
                pointerButtons.clear();
            }
        });
    }

    root.ClockTimerButtonPressFeedback = Object.freeze({install});
})(globalThis);
