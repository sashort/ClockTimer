class SpeechMicBar extends HTMLElement {
    static #forwardedEvents = [
        "started",
        "stopped",
        "muted",
        "unmuted",
        "utteranceStarted",
        "utteranceFinished",
        "utteranceTranscribed",
        "speechCommandMatched",
        "speechMenuMatched",
        "speechPreprocessed",
        "speechArgumentsPrepared",
        "speechCommandExecuted",
        "speechRecognitionError",
        "speechRecognitionFailed",
        "speechCaptureEnded",
        "utteranceUnrecognized",
        "audioLevelChanged"
    ];

    #shadow = this.attachShadow({mode: "closed"});
    #subscriptions = [];
    #mic;
    #activity;
    #text;
    #codes;
    #responseLane;
    #responseContent;
    #responseAnimation;
    #currentUtteranceId;
    #currentTranscript = "";

    constructor() {
        super();
        this.#shadow.innerHTML = `
            <style>
                :host {
                    box-sizing: border-box;
                    width: 100%;
                    height: 74px;
                    min-width: 0;
                    display: block;
                    color: white;
                    font: inherit;
                    overflow: hidden;
                }

                #bar {
                    box-sizing: border-box;
                    width: 100%;
                    height: 74px;
                    min-width: 0;
                    padding: 8px 12px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    overflow: hidden;
                    border: 3px solid rgb(255 255 255 / 38%);
                    border-radius: 14px;
                    background: linear-gradient(180deg, rgb(47 57 67 / 92%), rgb(34 43 51 / 92%));
                    box-shadow: inset 0 1px 0 rgb(255 255 255 / 14%), 0 7px 16px rgb(0 0 0 / 24%);
                    backdrop-filter: blur(7px);
                }

                #mic {
                    position: relative;
                    width: 48px;
                    height: 48px;
                    flex: 0 0 48px;
                    display: grid;
                    place-items: center;
                    border-radius: 50%;
                    color: rgb(255 255 255 / 70%);
                    background: rgb(0 30 96 / 76%);
                    transition: color 180ms linear, background 180ms linear;
                }

                #mic::before {
                    content: "";
                    width: 27px;
                    height: 27px;
                    background: currentColor;
                    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='8' y='2' width='8' height='13' rx='4' fill='black'/%3E%3Cpath d='M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8' fill='none' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;
                    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='8' y='2' width='8' height='13' rx='4' fill='black'/%3E%3Cpath d='M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8' fill='none' stroke='black' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;
                }

                :host([state="listening"]) #mic,
                :host([state="utterance"]) #mic {
                    color: #a9ddf7;
                    background: rgb(0 83 226 / 78%);
                }

                :host([state="muted"]) #mic {
                    color: rgb(255 255 255 / 48%);
                    background: rgb(70 76 83 / 82%);
                }

                #main {
                    min-width: 0;
                    flex: 1 1 auto;
                    height: 100%;
                    display: grid;
                    grid-template-rows: minmax(0, 1fr) auto;
                    align-items: center;
                    overflow: hidden;
                }

                #activity {
                    min-width: 0;
                    height: 26px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    overflow: hidden;
                }

                .wave {
                    width: 4px;
                    height: 7px;
                    flex: 0 0 4px;
                    border-radius: 999px;
                    background: #a9ddf7;
                    transform-origin: center;
                    opacity: .72;
                }

                :host([state="utterance"]) .wave {
                    animation: pulse 560ms ease-in-out infinite alternate;
                }

                .wave:nth-child(2n) { animation-delay: -160ms; }
                .wave:nth-child(3n) { animation-delay: -310ms; }

                @keyframes pulse {
                    from { height: 6px; opacity: .45; }
                    to { height: 23px; opacity: 1; }
                }

                #text {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    font-size: 16px;
                    font-weight: 700;
                    transition: color 160ms linear;
                }

                :host([phase="matched"]) #text { color: #a9ddf7; }
                :host([phase="preprocessed"]) #text { color: #ffc220; }

                .mutated {
                    padding: 1px 3px;
                    border-radius: 4px;
                    background: rgb(255 194 32 / 20%);
                    color: #ffd86a;
                }

                #codes {
                    min-width: 0;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    overflow: hidden;
                }

                #codes:empty { display: none; }

                code {
                    max-width: 180px;
                    padding: 2px 5px;
                    flex: 0 1 auto;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    border: 1px solid rgb(169 221 247 / 38%);
                    border-radius: 5px;
                    color: #a9ddf7;
                    background: rgb(0 30 96 / 45%);
                    font: 600 12px/1.3 ui-monospace, SFMono-Regular, Consolas, monospace;
                }

                #response {
                    width: 0;
                    max-width: min(42vw, 360px);
                    height: 100%;
                    min-width: 0;
                    flex: 0 0 auto;
                    display: grid;
                    place-items: center;
                    overflow: hidden;
                    opacity: 0;
                    transform: translateX(16px);
                }

                :host([has-response]) #response {
                    width: min(42vw, 360px);
                    opacity: 1;
                    transform: translateX(0);
                }

                #responseContent {
                    box-sizing: border-box;
                    max-width: 100%;
                    max-height: 100%;
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    display: grid;
                    place-items: center;
                }

                #responseContent > * {
                    max-width: 100% !important;
                    max-height: 50px !important;
                    min-width: 0 !important;
                    overflow: hidden !important;
                    pointer-events: none !important;
                    transform-origin: center;
                }

                #responseContent button,
                #responseContent input,
                #responseContent select,
                #responseContent a {
                    pointer-events: none !important;
                }

                @media (prefers-reduced-motion: reduce) {
                    .wave { animation: none !important; }
                }
            </style>
            <div id="bar">
                <div id="mic" aria-hidden="true"></div>
                <div id="main">
                    <div id="activity" aria-live="polite"></div>
                    <div id="codes"></div>
                </div>
                <div id="response" aria-live="polite">
                    <div id="responseContent"></div>
                </div>
            </div>
        `;
        this.#mic = this.#shadow.querySelector("#mic");
        this.#activity = this.#shadow.querySelector("#activity");
        this.#codes = this.#shadow.querySelector("#codes");
        this.#responseLane = this.#shadow.querySelector("#response");
        this.#responseContent = this.#shadow.querySelector("#responseContent");
        this.#showIdleText();
    }

    connectedCallback() {
        this.#subscribe();
    }

    disconnectedCallback() {
        this.#unsubscribe();
    }

    get state() {
        return this.getAttribute("state") || "stopped";
    }

    setResponse(value) {
        this.#responseAnimation?.cancel();
        this.#responseAnimation = undefined;
        this.#responseContent.replaceChildren();

        if (value === undefined || value === null || value === "") {
            return this.clearResponse();
        }

        if (value instanceof Node) {
            const visual =
                value instanceof Element
                    ? this.#cloneVisualElement(value)
                    : value.cloneNode(true);

            this.#responseContent.append(
                visual
            );
        }
        else {
            const span = document.createElement("span");
            span.textContent = String(value);
            this.#responseContent.append(span);
        }

        const wasVisible = this.hasAttribute("has-response");
        this.setAttribute("has-response", "");

        if (!wasVisible && typeof this.#responseLane.animate === "function") {
            this.#responseAnimation = this.#responseLane.animate(
                [
                    {width: "0px", opacity: 0, transform: "translateX(16px)"},
                    {width: "min(42vw, 360px)", opacity: 1, transform: "translateX(0)"}
                ],
                {
                    duration: 220,
                    easing: "cubic-bezier(.2,.8,.2,1)",
                    fill: "both"
                }
            );
            this.#responseAnimation.finished
                .catch(() => {})
                .finally(() => {
                    this.#responseAnimation?.cancel();
                    this.#responseAnimation = undefined;
                });
        }
        else {
            this.#responseContent.animate?.(
                [{opacity: .35, transform: "scale(.96)"}, {opacity: 1, transform: "scale(1)"}],
                {duration: 160, easing: "ease-out"}
            );
        }
    }

    async clearResponse() {
        this.#responseAnimation?.cancel();
        this.#responseAnimation = undefined;
        if (!this.hasAttribute("has-response")) {
            this.#responseContent.replaceChildren();
            return;
        }

        if (typeof this.#responseLane.animate === "function") {
            const width = `${this.#responseLane.getBoundingClientRect().width}px`;
            const animation = this.#responseLane.animate(
                [
                    {width, opacity: 1, transform: "translateX(0)"},
                    {width: "0px", opacity: 0, transform: "translateX(16px)"}
                ],
                {
                    duration: 190,
                    easing: "cubic-bezier(.4,0,.8,.2)",
                    fill: "both"
                }
            );
            this.#responseAnimation = animation;
            try { await animation.finished; } catch {}
            if (this.#responseAnimation === animation) {
                animation.cancel();
                this.#responseAnimation = undefined;
            }
        }

        this.removeAttribute("has-response");
        this.#responseContent.replaceChildren();
    }

    clear() {
        this.#currentUtteranceId = undefined;
        this.#currentTranscript = "";
        this.removeAttribute("phase");
        this.#codes.replaceChildren();
        this.#showIdleText();
    }

    #subscribe() {
        this.#unsubscribe();
        const speechMenu = globalThis.SpeechMenu;
        if (!speechMenu?.events) return;

        for (const type of SpeechMicBar.#forwardedEvents) {
            const listener = event => this.#handleSpeechEvent(type, event.detail);
            speechMenu.events.addEventListener(type, listener);
            this.#subscriptions.push([type, listener]);
        }

        if (speechMenu.started) {
            this.setAttribute("state", speechMenu.muted ? "muted" : "listening");
        }
    }

    #unsubscribe() {
        const speechMenu = globalThis.SpeechMenu;
        for (const [type, listener] of this.#subscriptions) {
            speechMenu?.events?.removeEventListener(type, listener);
        }
        this.#subscriptions = [];
    }

    #handleSpeechEvent(type, detail) {
        switch (type) {
            case "started":
                this.setAttribute("state", "listening");
                this.clear();
                break;
            case "stopped":
            case "speechCaptureEnded":
                this.setAttribute("state", "stopped");
                this.clear();
                break;
            case "muted":
                this.setAttribute("state", "muted");
                break;
            case "unmuted":
                this.setAttribute("state", "listening");
                break;
            case "utteranceStarted":
                this.#currentUtteranceId = detail?.id;
                this.setAttribute("state", "utterance");
                this.removeAttribute("phase");
                this.#codes.replaceChildren();
                this.#showWaveform();
                break;
            case "utteranceFinished":
                if (detail?.id === this.#currentUtteranceId) {
                    this.setAttribute("state", globalThis.SpeechMenu?.muted ? "muted" : "listening");
                    this.#showStatus("Processing…");
                }
                break;
            case "utteranceTranscribed":
                if (detail?.id === this.#currentUtteranceId) {
                    this.#currentTranscript = detail.transcript || "";
                    this.#showText(this.#currentTranscript);
                }
                break;
            case "speechPreprocessed":
                if (detail?.utteranceId === this.#currentUtteranceId) {
                    this.setAttribute("phase", "preprocessed");
                    this.#showPreprocessed(
                        detail.originalText || this.#currentTranscript,
                        detail.processedText || ""
                    );
                }
                break;
            case "speechCommandMatched":
            case "speechMenuMatched":
                if (
                    detail?.utteranceId ===
                    this.#currentUtteranceId &&
                    this.getAttribute("phase") !== "preprocessed"
                ) {
                    this.setAttribute("phase", "matched");
                }
                break;
            case "speechArgumentsPrepared":
                if (detail?.utteranceId === this.#currentUtteranceId) {
                    this.#showArguments(detail.arguments || []);
                    if (detail.targetElement) this.setResponse(detail.targetElement);
                }
                break;
            case "speechCommandExecuted":
                if (
                    detail?.utteranceId ===
                    this.#currentUtteranceId &&
                    detail.targetElement
                ) {
                    this.setResponse(
                        detail.targetElement
                    );
                }
                break;
        }

        this.dispatchEvent(
            new CustomEvent(
                type,
                {
                    detail,
                    bubbles: true,
                    composed: true
                }
            )
        );
    }

    #showIdleText() {
        this.#showStatus(this.state === "muted" ? "Muted" : this.state === "stopped" ? "" : "Listening…");
    }

    #showWaveform() {
        this.#activity.replaceChildren();
        for (let index = 0; index < 18; index++) {
            const bar = document.createElement("span");
            bar.className = "wave";
            this.#activity.append(bar);
        }
    }

    #showStatus(text) {
        this.#activity.replaceChildren();
        const span = document.createElement("span");
        span.id = "text";
        span.textContent = text;
        this.#activity.append(span);
        this.#text = span;
    }

    #showText(text) {
        this.#showStatus(text);
    }

    #showPreprocessed(original, processed) {
        const originalWords = String(original).split(/\s+/);
        const processedWords = String(processed).split(/\s+/);
        const span = document.createElement("span");
        span.id = "text";

        processedWords.forEach((word, index) => {
            if (index) span.append(" ");
            const piece = document.createElement("span");
            piece.textContent = word;
            if (originalWords[index] !== word) piece.className = "mutated";
            span.append(piece);
        });

        this.#activity.replaceChildren(span);
        this.#text = span;
    }

    #showArguments(values) {
        this.#codes.replaceChildren();
        for (const value of values) {
            const code = document.createElement("code");
            code.textContent =
                value === undefined
                    ? "undefined"
                    : value === null
                        ? "null"
                        : typeof value === "string"
                            ? value
                            : JSON.stringify(value);
            this.#codes.append(code);
        }
    }

    #cloneVisualElement(source) {
        const clone =
            source.cloneNode(false);

        this.#copyComputedStyle(
            source,
            clone
        );

        this.#sanitizeResponseNode(
            clone
        );

        const before =
            this.#clonePseudoElement(
                source,
                "::before"
            );

        if (before) {
            clone.append(before);
        }

        for (
            const child of
                source.childNodes
        ) {
            if (
                child instanceof Element
            ) {
                clone.append(
                    this.#cloneVisualElement(
                        child
                    )
                );
            }
            else {
                clone.append(
                    child.cloneNode(true)
                );
            }
        }

        const after =
            this.#clonePseudoElement(
                source,
                "::after"
            );

        if (after) {
            clone.append(after);
        }

        clone.style.setProperty(
            "pointer-events",
            "none",
            "important"
        );

        return clone;
    }

    #copyComputedStyle(source, target, pseudo) {
        let style;

        try {
            style =
                getComputedStyle(
                    source,
                    pseudo
                );
        }
        catch {
            return;
        }

        if (!style) return;

        for (
            let index = 0;
            index < style.length;
            index++
        ) {
            const property =
                style[index];

            try {
                target.style.setProperty(
                    property,
                    style.getPropertyValue(
                        property
                    ),
                    style.getPropertyPriority(
                        property
                    )
                );
            }
            catch {}
        }
    }

    #clonePseudoElement(source, pseudo) {
        let style;

        try {
            style =
                getComputedStyle(
                    source,
                    pseudo
                );
        }
        catch {
            return undefined;
        }

        if (!style) return undefined;

        const content =
            style.content;

        const hasContent =
            content &&
            content !== "none" &&
            content !== "normal" &&
            content !== '""';

        const hasVisual =
            style.backgroundImage !== "none" ||
            style.maskImage !== "none" ||
            style.webkitMaskImage !== "none";

        if (
            !hasContent &&
            !hasVisual
        ) {
            return undefined;
        }

        const node =
            document.createElement(
                "span"
            );

        node.dataset.speechResponsePseudo =
            pseudo === "::before"
                ? "before"
                : "after";

        this.#copyComputedStyle(
            source,
            node,
            pseudo
        );

        if (hasContent) {
            node.textContent =
                content.replace(
                    /^["']|["']$/g,
                    ""
                );
        }

        node.setAttribute(
            "aria-hidden",
            "true"
        );

        return node;
    }

    #sanitizeResponseNode(node) {
        if (!(node instanceof Element)) return;
        node.removeAttribute("id");
        node.removeAttribute("for");
        node.removeAttribute("popovertarget");
        node.setAttribute("aria-hidden", "true");
        if ("disabled" in node) {
            try { node.disabled = true; } catch {}
        }
        for (const child of node.querySelectorAll("[id], [for], [popovertarget]")) {
            child.removeAttribute("id");
            child.removeAttribute("for");
            child.removeAttribute("popovertarget");
            child.setAttribute("aria-hidden", "true");
            if ("disabled" in child) {
                try { child.disabled = true; } catch {}
            }
        }
    }

}

globalThis.SpeechMicBar = SpeechMicBar;
