(() => {
    "use strict";

    const STYLE_ID = "pane-page-base-styles";

    if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = [
            "pane-page {",
            "  position: relative;",
            "  display: block;",
            "  min-width: 0;",
            "  min-height: 0;",
            "  box-sizing: border-box;",
            "}",
            "pane-page > [data-pane-view] {",
            "  min-width: 0;",
            "  min-height: 0;",
            "  box-sizing: border-box;",
            "}",
            "pane-page > [data-pane-view][hidden] {",
            "  display: none !important;",
            "}",
            "pane-page[overflow=\"y\"] > [data-pane-view] {",
            "  overflow-x: hidden;",
            "  overflow-y: auto;",
            "  overscroll-behavior-y: contain;",
            "  touch-action: pan-y;",
            "  -webkit-overflow-scrolling: touch;",
            "}",
            "pane-page[overflow=\"x\"] > [data-pane-view] {",
            "  overflow-x: auto;",
            "  overflow-y: hidden;",
            "  overscroll-behavior-x: contain;",
            "  touch-action: pan-x;",
            "  -webkit-overflow-scrolling: touch;",
            "}",
            "pane-page[overflow=\"both\"] > [data-pane-view] {",
            "  overflow: auto;",
            "  overscroll-behavior: contain;",
            "  touch-action: pan-x pan-y;",
            "  -webkit-overflow-scrolling: touch;",
            "}",
            "pane-page[data-pane-transitioning=\"true\"] {",
            "  overflow: hidden;",
            "}",
            "pane-page.pane-page-horizontal-item {",
            "  width: 100%;",
            "  min-width: 100%;",
            "  height: var(--pane-page-height, auto);",
            "  flex: 0 0 100%;",
            "  overflow: hidden;",
            "  box-sizing: border-box;",
            "  scroll-snap-align: start;",
            "  scroll-snap-stop: always;",
            "}"
        ].join("\n");
        document.head.append(style);
    }

    class PanePage extends HTMLElement {
        #stack = [];
        #animation;
        #busy = false;

        get activeView() {
            return this.querySelector(":scope > [data-pane-view]:not([hidden])");
        }

        get depth() {
            return this.#stack.length;
        }

        async showView(view, {
            source,
            duration = 420,
            direction = "up"
        } = {}) {
            if (this.#busy) return false;

            const next = typeof view === "string"
                ? this.querySelector(`:scope > [data-pane-view="${CSS.escape(view)}"]`)
                : view;

            const current = this.activeView;

            if (!next || next === current) return false;

            this.#busy = true;
            this.dataset.paneTransitioning = "true";

            const sourceRect = source?.getBoundingClientRect?.();
            const pageRect = this.getBoundingClientRect();

            if (current) {
                this.#stack.push({
                    view: current,
                    source
                });
            }

            next.hidden = false;

            const sign = direction === "down" ? -1 : 1;
            const distance = Math.max(
                pageRect.height || 0,
                sourceRect
                    ? Math.abs(sourceRect.top - pageRect.top) + sourceRect.height
                    : 0,
                80
            );

            if (
                duration > 0 &&
                typeof next.animate === "function"
            ) {
                const incoming = next.animate(
                    [
                        {
                            transform: `translateY(${sign * distance}px)`,
                            opacity: 0
                        },
                        {
                            transform: "translateY(0)",
                            opacity: 1
                        }
                    ],
                    {
                        duration,
                        easing: "cubic-bezier(.2,.8,.2,1)",
                        fill: "both"
                    }
                );

                const outgoing = current?.animate?.(
                    [
                        {
                            transform: "translateY(0)",
                            opacity: 1
                        },
                        {
                            transform: `translateY(${-sign * Math.min(distance, Math.max(48, sourceRect ? sourceRect.top - pageRect.top : distance))}px)`,
                            opacity: 0
                        }
                    ],
                    {
                        duration,
                        easing: "cubic-bezier(.2,.8,.2,1)",
                        fill: "both"
                    }
                );

                this.#animation = incoming;

                await Promise.all([
                    incoming.finished.catch(() => {}),
                    outgoing?.finished?.catch(() => {})
                ]);

                try {
                    incoming.cancel();
                    outgoing?.cancel();
                }
                catch {}
            }

            if (current) current.hidden = true;

            this.#animation = undefined;
            delete this.dataset.paneTransitioning;
            this.#busy = false;

            this.dispatchEvent(new CustomEvent("paneviewchanged", {
                bubbles: true,
                detail: {
                    view: next.dataset.paneView,
                    depth: this.#stack.length
                }
            }));

            return true;
        }

        async back({
            duration = 420
        } = {}) {
            if (this.#busy || !this.#stack.length) return false;

            const previous = this.#stack.pop();
            const current = this.activeView;

            if (!previous?.view || !current) return false;

            this.#busy = true;
            this.dataset.paneTransitioning = "true";
            previous.view.hidden = false;

            const height = Math.max(
                this.getBoundingClientRect().height,
                current.getBoundingClientRect().height,
                80
            );

            if (
                duration > 0 &&
                typeof current.animate === "function"
            ) {
                const outgoing = current.animate(
                    [
                        { transform: "translateY(0)", opacity: 1 },
                        { transform: `translateY(${height}px)`, opacity: 0 }
                    ],
                    {
                        duration,
                        easing: "cubic-bezier(.4,0,.2,1)",
                        fill: "both"
                    }
                );

                const incoming = previous.view.animate(
                    [
                        { transform: `translateY(${-Math.min(height, 96)}px)`, opacity: 0 },
                        { transform: "translateY(0)", opacity: 1 }
                    ],
                    {
                        duration,
                        easing: "cubic-bezier(.2,.8,.2,1)",
                        fill: "both"
                    }
                );

                await Promise.all([
                    outgoing.finished.catch(() => {}),
                    incoming.finished.catch(() => {})
                ]);

                try {
                    outgoing.cancel();
                    incoming.cancel();
                }
                catch {}
            }

            current.hidden = true;
            delete this.dataset.paneTransitioning;
            this.#busy = false;

            previous.source?.focus?.({preventScroll: true});

            this.dispatchEvent(new CustomEvent("paneviewchanged", {
                bubbles: true,
                detail: {
                    view: previous.view.dataset.paneView,
                    depth: this.#stack.length
                }
            }));

            return true;
        }

        reset() {
            this.#animation?.cancel?.();
            this.#animation = undefined;
            this.#stack.length = 0;
            delete this.dataset.paneTransitioning;
            this.#busy = false;

            const views = [
                ...this.querySelectorAll(":scope > [data-pane-view]")
            ];

            views.forEach((view, index) => {
                view.hidden = index > 0;
            });
        }
    }

    if (!customElements.get("pane-page")) {
        customElements.define("pane-page", PanePage);
    }

    globalThis.PanePage = PanePage;
})();
