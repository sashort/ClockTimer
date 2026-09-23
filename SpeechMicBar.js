class SpeechMicBar extends HTMLElement {
    static #forwardedEvents = [
        "started",
        "stopped",
        "muted",
        "unmuted",
        "utteranceStarted",
        "utteranceFinished",
        "utteranceTranscriptChanged",
        "utteranceTranscribed",
        "utteranceCommitted",
        "speechCommandMatched",
        "speechMenuMatched",
        "speechPreprocessed",
        "speechArgumentsPrepared",
        "speechCommandExecuted",
        "speechRecognitionError",
        "speechRecognitionFailed",
        "speechRecognitionStreamingFailed",
        "speechRecognitionStatusChanged",
        "speechCaptureEnded",
        "utteranceUnrecognized",
        "audioLevelChanged"
    ];

    #shadow = this.attachShadow({mode: "closed"});
    #subscriptions = [];
    #bar;
    #mic;
    #activity;
    #text;
    #codes;
    #responseLane;
    #responseContent;
    #responseAnimation;
    #currentUtteranceId;
    #currentTranscript = "";
    #currentTranscriptFinal = false;
    #rejectedClearTimer;

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
                    --speech-load-progress: 0%;
                    position: relative;
                    isolation: isolate;
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

                #bar::before {
                    content: "";
                    position: absolute;
                    inset: 0 auto 0 0;
                    width: var(--speech-load-progress);
                    z-index: 0;
                    border-radius: inherit;
                    background:
                        linear-gradient(
                            90deg,
                            #003b73 0%,
                            #0068c9 55%,
                            #a9ddf7 100%
                        );
                    opacity: 0;
                    transition:
                        width 160ms linear,
                        opacity 160ms linear;
                    pointer-events: none;
                }

                :host([loading]) #bar::before {
                    opacity: .86;
                }

                #bar > * {
                    position: relative;
                    z-index: 1;
                }

                :host([loading]) #text {
                    text-shadow:
                        0 1px 2px rgb(0 0 0 / 72%),
                        0 0 8px rgb(0 30 96 / 52%);
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
                    box-sizing: border-box !important;
                    max-width: 100% !important;
                    max-height: 50px !important;
                    min-width: 0 !important;
                    overflow: hidden !important;
                    pointer-events: none !important;
                    transform-origin: center;
                }

                .response-transition-stage {
                    width: 100%;
                    height: 50px;
                    display: grid !important;
                    place-items: center;
                    overflow: hidden;
                }

                .response-transition-stage > * {
                    grid-area: 1 / 1;
                    max-width: 100% !important;
                    max-height: 50px !important;
                    min-width: 0 !important;
                    pointer-events: none !important;
                    transform-origin: center;
                }

                .response-button-facsimile {
                    width: max-content;
                    max-width: min(100%, 240px) !important;
                    height: auto !important;
                    min-height: 24px;
                    padding: 4px 10px !important;
                    display: flex !important;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden !important;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    line-height: 1.15 !important;
                    font-size: 12px !important;
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
        this.#bar = this.#shadow.querySelector("#bar");
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

    #responseVisual(value) {
        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {
            return undefined;
        }

        if (value instanceof Node) {
            if (
                value instanceof Element &&
                value.hasAttribute(
                    "data-speech-response-snapshot"
                )
            ) {
                return value.cloneNode(
                    true
                );
            }

            return value instanceof Element
                ? this.#cloneVisualElement(
                    value
                )
                : value.cloneNode(true);
        }

        const span =
            document.createElement(
                "span"
            );

        span.textContent =
            String(value);

        return span;
    }

    #showResponseLane() {
        const wasVisible =
            this.hasAttribute(
                "has-response"
            );

        this.setAttribute(
            "has-response",
            ""
        );

        if (
            !wasVisible &&
            typeof this.#responseLane
                .animate ===
                "function"
        ) {
            this.#responseAnimation =
                this.#responseLane
                    .animate(
                        [
                            {
                                width: "0px",
                                opacity: 0,
                                transform:
                                    "translateX(16px)"
                            },
                            {
                                width:
                                    "min(42vw, 360px)",
                                opacity: 1,
                                transform:
                                    "translateX(0)"
                            }
                        ],
                        {
                            duration: 220,
                            easing:
                                "cubic-bezier(.2,.8,.2,1)",
                            fill: "both"
                        }
                    );

            this.#responseAnimation
                .finished
                .catch(
                    () => {}
                )
                .finally(
                    () => {
                        this.#responseAnimation
                            ?.cancel();
                        this.#responseAnimation =
                            undefined;
                    }
                );
        }

        return wasVisible;
    }

    setResponse(value) {
        this.#responseAnimation?.cancel();
        this.#responseAnimation = undefined;

        const visual =
            this.#responseVisual(
                value
            );

        if (!visual) {
            return this.clearResponse();
        }

        const wasVisible =
            this.#showResponseLane();

        this.#responseContent
            .replaceChildren(
                visual
            );

        if (wasVisible) {
            this.#responseContent
                .animate?.(
                    [
                        {
                            opacity: .35,
                            transform:
                                "scale(.96)"
                        },
                        {
                            opacity: 1,
                            transform:
                                "scale(1)"
                        }
                    ],
                    {
                        duration: 160,
                        easing:
                            "ease-out"
                    }
                );
        }
    }

    presentResponseTransition(
        fromValue,
        toValue,
        {
            duration = 320
        } = {}
    ) {
        this.#responseAnimation?.cancel();
        this.#responseAnimation = undefined;

        const from =
            this.#responseVisual(
                fromValue
            );
        const to =
            this.#responseVisual(
                toValue
            );

        if (!from && !to) {
            return this.clearResponse();
        }

        if (!from || !to) {
            return this.setResponse(
                to ||
                from
            );
        }

        this.#showResponseLane();

        const stage =
            document.createElement(
                "div"
            );

        stage.className =
            "response-transition-stage";

        stage.append(
            from,
            to
        );

        this.#responseContent
            .replaceChildren(
                stage
            );

        to.style.opacity = "0";

        if (
            typeof from.animate !==
                "function" ||
            typeof to.animate !==
                "function"
        ) {
            this.#responseContent
                .replaceChildren(
                    to
                );
            to.style.opacity = "";
            return;
        }

        const options = {
            duration:
                Math.max(
                    0,
                    Number(duration) ||
                    0
                ),
            easing:
                "cubic-bezier(.2,.8,.2,1)",
            fill:
                "both"
        };

        const fromAnimation =
            from.animate(
                [
                    {
                        opacity: 1,
                        transform:
                            "scale(1)"
                    },
                    {
                        opacity: 0,
                        transform:
                            "scale(.94)"
                    }
                ],
                options
            );

        const toAnimation =
            to.animate(
                [
                    {
                        opacity: 0,
                        transform:
                            "scale(1.06)"
                    },
                    {
                        opacity: 1,
                        transform:
                            "scale(1)"
                    }
                ],
                options
            );

        const sharedStart =
            document.timeline
                ?.currentTime;

        if (
            sharedStart !==
            null &&
            sharedStart !==
            undefined
        ) {
            try {
                fromAnimation.startTime =
                    sharedStart;
                toAnimation.startTime =
                    sharedStart;
            }
            catch {}
        }

        Promise
            .allSettled([
                fromAnimation.finished,
                toAnimation.finished
            ])
            .then(
                () => {
                    if (
                        stage.isConnected
                    ) {
                        this.#responseContent
                            .replaceChildren(
                                to
                            );
                        to.style.opacity =
                            "";
                    }
                }
            );
    }

    async clearResponse(
        {
            duration = 190
        } = {}
    ) {
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
                    duration:
                        Math.max(
                            0,
                            Number(duration) ||
                            0
                        ),
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
        clearTimeout(
            this.#rejectedClearTimer
        );
        this.#rejectedClearTimer =
            undefined;
        this.#currentUtteranceId = undefined;
        this.#currentTranscript = "";
        this.#currentTranscriptFinal = false;
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
                this.#clearLoadingProgress();
                this.setAttribute("state", "listening");
                this.clear();
                break;
            case "stopped":
            case "speechCaptureEnded":
                this.#clearLoadingProgress();
                this.setAttribute("state", "stopped");
                this.clear();
                break;
            case "muted":
                this.setAttribute("state", "muted");
                break;
            case "unmuted":
                this.setAttribute("state", "listening");
                break;
            case "speechRecognitionFailed":
                this.#clearLoadingProgress();
                this.setAttribute("state", "stopped");
                this.#showStatus(
                    detail?.message ||
                    "Speech recognition unavailable"
                );
                break;
            case "speechRecognitionStatusChanged":
                if (
                    this.#showLoadingProgress(
                        detail?.status
                    )
                ) {
                    break;
                }

                if (this.hasAttribute("loading")) {
                    this.#clearLoadingProgress();
                }

                if (detail?.status) {
                    this.#showStatus(
                        detail.status
                    );
                }
                else {
                    this.#showIdleText();
                }
                break;
            case "utteranceStarted":
                clearTimeout(
                    this.#rejectedClearTimer
                );
                this.#rejectedClearTimer =
                    undefined;
                this.#currentUtteranceId = detail?.id;
                this.#currentTranscript = "";
                this.#currentTranscriptFinal = false;
                this.setAttribute("state", "utterance");
                this.removeAttribute("phase");
                this.#codes.replaceChildren();
                this.#showWaveform();
                break;
            case "utteranceFinished":
                if (detail?.id === this.#currentUtteranceId) {
                    this.setAttribute(
                        "state",
                        globalThis.SpeechMenu?.muted
                            ? "muted"
                            : "listening"
                    );

                    if (!detail?.committed) {
                        this.#showStatus("Processing…");
                    }
                }
                break;
            case "utteranceTranscriptChanged":
                if (detail?.id === this.#currentUtteranceId) {
                    this.#currentTranscript =
                        detail.transcript || "";
                    this.#currentTranscriptFinal =
                        Boolean(
                            detail.isFinal
                        );

                    if (this.#currentTranscriptFinal) {
                        this.#showText(
                            this.#currentTranscript
                        );
                    }
                }
                break;
            case "utteranceTranscribed":
                if (detail?.id === this.#currentUtteranceId) {
                    this.#currentTranscript =
                        detail.transcript || "";
                    this.#currentTranscriptFinal =
                        true;
                    this.#showText(
                        this.#currentTranscript
                    );
                }
                break;
            case "utteranceCommitted":
                if (detail?.id === this.#currentUtteranceId) {
                    this.#currentTranscript =
                        detail.transcript ||
                        this.#currentTranscript;
                    this.#currentTranscriptFinal =
                        true;

                    if (
                        this.getAttribute(
                            "phase"
                        ) !==
                        "preprocessed"
                    ) {
                        this.#showText(
                            this.#currentTranscript
                        );
                    }

                    this.setAttribute(
                        "state",
                        globalThis.SpeechMenu?.muted
                            ? "muted"
                            : "listening"
                    );
                }
                break;
            case "speechPreprocessed":
                if (
                    detail?.utteranceId === this.#currentUtteranceId &&
                    !detail?.provisional
                ) {
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
                    !detail?.provisional &&
                    this.getAttribute("phase") !== "preprocessed"
                ) {
                    this.setAttribute("phase", "matched");
                }
                break;
            case "speechArgumentsPrepared":
                if (
                    detail?.utteranceId === this.#currentUtteranceId &&
                    !detail?.provisional
                ) {
                    this.#showArguments(
                        detail.arguments ||
                        []
                    );
                }
                break;
            case "utteranceUnrecognized":
                if (detail?.id === this.#currentUtteranceId) {
                    this.#scheduleRejectedClear(
                        detail.id
                    );
                }
                break;
            case "speechCommandExecuted":
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

    #showLoadingProgress(status) {
        const match =
            String(
                status ||
                ""
            ).match(
                /\(?\s*(\d+)\s*\/\s*(\d+)\s*\)?/
            );

        if (!match) {
            return false;
        }

        const current =
            Number(
                match[1]
            );
        const total =
            Number(
                match[2]
            );

        if (
            !Number.isFinite(
                current
            ) ||
            !Number.isFinite(
                total
            ) ||
            total <= 0
        ) {
            return false;
        }

        const progress =
            Math.max(
                0,
                Math.min(
                    100,
                    current /
                    total *
                    100
                )
            );

        this.setAttribute(
            "loading",
            ""
        );
        this.setAttribute(
            "aria-busy",
            "true"
        );
        this.#bar.style
            .setProperty(
                "--speech-load-progress",
                progress + "%"
            );
        this.#showStatus(
            current +
            " / " +
            total
        );

        return true;
    }

    #clearLoadingProgress() {
        this.removeAttribute(
            "loading"
        );
        this.removeAttribute(
            "aria-busy"
        );
        this.#bar.style
            .setProperty(
                "--speech-load-progress",
                "0%"
            );
    }

    #scheduleRejectedClear(
        utteranceId
    ) {
        clearTimeout(
            this.#rejectedClearTimer
        );

        this.#rejectedClearTimer =
            setTimeout(
                () => {
                    this.#rejectedClearTimer =
                        undefined;

                    if (
                        this.#currentUtteranceId !==
                        utteranceId
                    ) {
                        return;
                    }

                    this.#currentTranscript = "";
                    this.#currentTranscriptFinal =
                        false;
                    this.removeAttribute(
                        "phase"
                    );
                    this.#codes
                        .replaceChildren();
                    void this.clearResponse();
                    this.#showIdleText();
                },
                2000
            );
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

    #shouldUseButtonFacsimile(
        source
    ) {
        if (
            !source.matches?.(
                "button, [role='button'], input[type='button'], input[type='submit'], input[type='reset']"
            )
        ) {
            return false;
        }

        let width = 0;
        let height = 0;

        try {
            const rect =
                source.getBoundingClientRect();

            width =
                Number(
                    rect?.width
                ) ||
                0;
            height =
                Number(
                    rect?.height
                ) ||
                0;
        }
        catch {}

        try {
            const style =
                getComputedStyle(
                    source
                );

            width =
                Math.max(
                    width,
                    parseFloat(
                        style.width
                    ) ||
                    0
                );
            height =
                Math.max(
                    height,
                    parseFloat(
                        style.height
                    ) ||
                    0
                );
        }
        catch {}

        width =
            Math.max(
                width,
                Number(
                    source.scrollWidth
                ) ||
                0
            );
        height =
            Math.max(
                height,
                Number(
                    source.scrollHeight
                ) ||
                0
            );

        return (
            width > 280 ||
            height > 48
        );
    }

    #createButtonFacsimile(
        source
    ) {
        const visual =
            document.createElement(
                "div"
            );

        visual.className =
            "response-button-facsimile";

        let style;

        try {
            style =
                getComputedStyle(
                    source
                );
        }
        catch {}

        for (
            const property of
            [
                "background",
                "background-color",
                "color",
                "border",
                "border-color",
                "border-style",
                "border-width",
                "border-radius",
                "box-shadow",
                "font-family",
                "font-weight",
                "text-transform",
                "letter-spacing"
            ]
        ) {
            const value =
                style?.getPropertyValue(
                    property
                );

            if (value) {
                visual.style
                    .setProperty(
                        property,
                        value
                    );
            }
        }

        visual.textContent =
            (
                source.getAttribute(
                    "aria-label"
                ) ||
                (
                    "value" in source
                        ? source.value
                        : ""
                ) ||
                source.textContent ||
                ""
            )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();

        visual.setAttribute(
            "aria-hidden",
            "true"
        );

        return visual;
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

if (!customElements.get("speech-mic-bar")) {
    customElements.define("speech-mic-bar", SpeechMicBar);
}

globalThis.SpeechMicBar = SpeechMicBar;
