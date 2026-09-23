(() => {
    class SpeechDiagnostics extends HTMLElement {
        #shadow = this.attachShadow({mode: "open"});
        #rows = new Map();
        #subscriptions = [];
        #session = {
            startedAt: new Date().toISOString(),
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            hardwareConcurrency: navigator.hardwareConcurrency || null,
            deviceMemory: navigator.deviceMemory || null,
            captureSettings: null,
            recognizer: null,
            sampleRate: null
        };

        constructor() {
            super();
            this.#shadow.innerHTML = `
                <style>
                    :host {
                        position: fixed;
                        z-index: 2147483000;
                        right: 12px;
                        bottom: 12px;
                        width: min(560px, calc(100vw - 24px));
                        max-height: min(72vh, 720px);
                        color: #fff;
                        font: 13px/1.35 system-ui, sans-serif;
                    }
                    * { box-sizing: border-box; }
                    .panel {
                        display: grid;
                        grid-template-rows: auto auto auto minmax(120px, 1fr);
                        overflow: hidden;
                        max-height: inherit;
                        border: 1px solid rgb(169 221 247 / 65%);
                        border-radius: 14px;
                        background: rgb(8 29 64 / 96%);
                        box-shadow: 0 18px 50px rgb(0 0 0 / 42%);
                        backdrop-filter: blur(10px);
                    }
                    header {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        padding: 10px 12px;
                        background: rgb(0 83 226 / 34%);
                        border-bottom: 1px solid rgb(169 221 247 / 25%);
                    }
                    header strong { font-size: 14px; }
                    header span { color: #a9ddf7; }
                    .spacer { flex: 1; }
                    button {
                        border: 1px solid rgb(169 221 247 / 55%);
                        border-radius: 7px;
                        padding: 6px 9px;
                        background: #173a61;
                        color: #fff;
                        font: inherit;
                        font-weight: 700;
                        cursor: pointer;
                    }
                    button:hover { filter: brightness(1.12); }
                    .controls {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        flex-wrap: wrap;
                        padding: 9px 12px;
                        border-bottom: 1px solid rgb(169 221 247 / 18%);
                    }
                    label {
                        display: flex;
                        align-items: center;
                        gap: 7px;
                    }
                    input { accent-color: #ffc220; }
                    .summary {
                        display: grid;
                        grid-template-columns: repeat(5, minmax(70px, 1fr));
                        gap: 6px;
                        padding: 8px 12px;
                        border-bottom: 1px solid rgb(169 221 247 / 18%);
                    }
                    .metric {
                        min-width: 0;
                        padding: 6px 8px;
                        border-radius: 8px;
                        background: rgb(0 30 96 / 58%);
                    }
                    .metric b {
                        display: block;
                        font-size: 15px;
                        color: #a9ddf7;
                    }
                    .metric small {
                        display: block;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        color: rgb(255 255 255 / 68%);
                    }
                    .table-wrap {
                        overflow: auto;
                        min-height: 0;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        table-layout: fixed;
                    }
                    th, td {
                        padding: 6px 7px;
                        border-bottom: 1px solid rgb(169 221 247 / 12%);
                        text-align: left;
                        vertical-align: top;
                    }
                    th {
                        position: sticky;
                        top: 0;
                        z-index: 1;
                        background: #0d2d58;
                        color: #a9ddf7;
                        font-size: 11px;
                    }
                    td {
                        overflow-wrap: anywhere;
                    }
                    .id { width: 38px; }
                    .latency { width: 70px; }
                    .status { width: 86px; }
                    .transcript { width: auto; }
                    tr[data-status="matched"] td:last-child { color: #9ff1c9; }
                    tr[data-status="unrecognized"] td:last-child,
                    tr[data-status="error"] td:last-child { color: #ffaaaa; }
                    @media (max-width: 520px) {
                        :host {
                            right: 6px;
                            bottom: 6px;
                            width: calc(100vw - 12px);
                            max-height: 66vh;
                        }
                        .summary {
                            grid-template-columns: repeat(3, 1fr);
                        }
                        .decode { display: none; }
                    }
                </style>
                <section class="panel">
                    <header>
                        <strong>Raw Sherpa Diagnostics</strong>
                        <span id="device"></span>
                        <span class="spacer"></span>
                        <button id="copy" type="button">Copy JSON</button>
                        <button id="clear" type="button">Clear</button>
                        <button id="close" type="button" aria-label="Close">×</button>
                    </header>
                    <div class="controls">
                        <label>
                            <input id="execute" type="checkbox">
                            Execute matched commands
                        </label>
                        <span id="capture">Mic DSP: waiting…</span>
                    </div>
                    <div class="summary">
                        <div class="metric"><b id="utterances">0</b><small>utterances</small></div>
                        <div class="metric"><b id="matched">0</b><small>matched</small></div>
                        <div class="metric"><b id="first">—</b><small>median first</small></div>
                        <div class="metric"><b id="final">—</b><small>median final</small></div>
                        <div class="metric"><b id="decode">—</b><small>max decode</small></div>
                    </div>
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th class="id">#</th>
                                    <th class="transcript">Transcript</th>
                                    <th class="latency">First</th>
                                    <th class="latency">Final</th>
                                    <th class="latency decode">Decode</th>
                                    <th class="status">Status</th>
                                </tr>
                            </thead>
                            <tbody id="body"></tbody>
                        </table>
                    </div>
                </section>
            `;

            this.#shadow.getElementById("execute")
                .addEventListener("change", event => {
                    if (globalThis.SpeechMenu) {
                        globalThis.SpeechMenu.executionEnabled =
                            event.target.checked;
                    }
                });

            this.#shadow.getElementById("copy")
                .addEventListener("click", () => {
                    void this.#copy();
                });

            this.#shadow.getElementById("clear")
                .addEventListener("click", () => {
                    this.#rows.clear();
                    this.#render();
                });

            this.#shadow.getElementById("close")
                .addEventListener("click", () => {
                    this.remove();
                });
        }

        connectedCallback() {
            if (!globalThis.SpeechMenu?.events) {
                return;
            }

            globalThis.SpeechMenu.executionEnabled = false;

            this.#shadow.getElementById("execute").checked =
                false;

            const types = [
                "started",
                "utteranceStarted",
                "utteranceTranscriptChanged",
                "utteranceFinished",
                "speechRecognitionTiming",
                "speechCommandMatched",
                "speechCommandExecuted",
                "utteranceUnrecognized",
                "speechRecognitionFailed",
                "speechRecognitionStreamingFailed"
            ];

            for (const type of types) {
                const listener =
                    event =>
                        this.#handle(
                            type,
                            event.detail || {}
                        );

                globalThis.SpeechMenu.events
                    .addEventListener(
                        type,
                        listener
                    );

                this.#subscriptions.push([
                    type,
                    listener
                ]);
            }

            this.#renderDevice();
            this.#render();
        }

        disconnectedCallback() {
            for (
                const [type, listener] of
                this.#subscriptions
            ) {
                globalThis.SpeechMenu?.events
                    ?.removeEventListener(
                        type,
                        listener
                    );
            }

            this.#subscriptions = [];
            globalThis.SpeechMenu &&
                (globalThis.SpeechMenu.executionEnabled = true);
        }

        #row(id) {
            if (!this.#rows.has(id)) {
                this.#rows.set(id, {
                    id,
                    transcript: "",
                    firstMs: null,
                    finalMs: null,
                    maxDecodeMs: 0,
                    durationMs: null,
                    matched: false,
                    executed: false,
                    status: "listening"
                });
            }

            return this.#rows.get(id);
        }

        #handle(type, detail) {
            if (type === "started") {
                this.#session.captureSettings =
                    detail.captureSettings || {};
                this.#session.recognizer =
                    detail.recognizer || null;
                this.#session.sampleRate =
                    detail.sampleRate || null;
                this.#renderCapture();
                return;
            }

            const id =
                detail.id ??
                detail.utteranceId;

            if (id === undefined || id === null) {
                return;
            }

            const row = this.#row(id);

            switch (type) {
                case "utteranceStarted":
                    row.status = "listening";
                    break;

                case "utteranceTranscriptChanged":
                    row.transcript =
                        detail.transcript || row.transcript;
                    break;

                case "speechRecognitionTiming":
                    if (detail.isFirstTranscript) {
                        row.firstMs =
                            Number(detail.firstTranscriptMilliseconds);
                    }
                    if (detail.isFinal) {
                        row.finalMs =
                            Number(detail.transcriptMilliseconds);
                    }
                    row.maxDecodeMs =
                        Math.max(
                            row.maxDecodeMs,
                            Number(detail.decodeMilliseconds) || 0
                        );
                    break;

                case "utteranceFinished":
                    row.durationMs =
                        Number(detail.durationMilliseconds) || 0;
                    if (!row.matched && row.status === "listening") {
                        row.status = "finished";
                    }
                    break;

                case "speechCommandMatched":
                    row.matched = true;
                    row.status = "matched";
                    break;

                case "speechCommandExecuted":
                    row.executed = true;
                    row.status = "executed";
                    break;

                case "utteranceUnrecognized":
                    row.status = "unrecognized";
                    break;

                case "speechRecognitionFailed":
                case "speechRecognitionStreamingFailed":
                    row.status = "error";
                    row.error =
                        detail.message ||
                        detail.error ||
                        "Recognition error";
                    break;
            }

            this.#render();
        }

        #renderDevice() {
            const short =
                navigator.userAgentData?.platform ||
                navigator.platform ||
                "device";

            this.#shadow.getElementById("device")
                .textContent =
                    `${short} · ${navigator.hardwareConcurrency || "?"} cores`;
        }

        #renderCapture() {
            const settings =
                this.#session.captureSettings || {};

            const fmt =
                value =>
                    value === undefined
                        ? "?"
                        : value
                            ? "on"
                            : "off";

            this.#shadow.getElementById("capture")
                .textContent =
                    `Mic DSP: EC ${fmt(settings.echoCancellation)} · NS ${fmt(settings.noiseSuppression)} · AGC ${fmt(settings.autoGainControl)}`;
        }

        #median(values) {
            const sorted =
                values
                    .filter(Number.isFinite)
                    .sort((a, b) => a - b);

            if (!sorted.length) {
                return null;
            }

            const middle =
                Math.floor(
                    sorted.length / 2
                );

            return sorted.length % 2
                ? sorted[middle]
                : (
                    sorted[middle - 1] +
                    sorted[middle]
                ) / 2;
        }

        #milliseconds(value) {
            return Number.isFinite(value)
                ? `${Math.round(value)} ms`
                : "—";
        }

        #render() {
            const rows =
                [...this.#rows.values()]
                    .sort(
                        (a, b) =>
                            b.id - a.id
                    );

            const matched =
                rows.filter(
                    row =>
                        row.matched
                ).length;

            const first =
                this.#median(
                    rows.map(
                        row =>
                            row.firstMs
                    )
                );

            const final =
                this.#median(
                    rows.map(
                        row =>
                            row.finalMs
                    )
                );

            const maxDecode =
                rows.length
                    ? Math.max(
                        ...rows.map(
                            row =>
                                row.maxDecodeMs || 0
                        )
                    )
                    : null;

            this.#shadow.getElementById("utterances")
                .textContent =
                    String(rows.length);

            this.#shadow.getElementById("matched")
                .textContent =
                    String(matched);

            this.#shadow.getElementById("first")
                .textContent =
                    this.#milliseconds(first);

            this.#shadow.getElementById("final")
                .textContent =
                    this.#milliseconds(final);

            this.#shadow.getElementById("decode")
                .textContent =
                    this.#milliseconds(maxDecode);

            const body =
                this.#shadow.getElementById("body");

            body.replaceChildren();

            for (const row of rows) {
                const tr =
                    document.createElement("tr");

                tr.dataset.status =
                    row.status;

                const values = [
                    row.id,
                    row.transcript || row.error || "",
                    this.#milliseconds(row.firstMs),
                    this.#milliseconds(row.finalMs),
                    this.#milliseconds(row.maxDecodeMs),
                    row.status
                ];

                values.forEach(
                    (value, index) => {
                        const td =
                            document.createElement("td");

                        td.textContent =
                            String(value);

                        if (index === 4) {
                            td.className =
                                "decode";
                        }

                        tr.append(td);
                    }
                );

                body.append(tr);
            }
        }

        #snapshot() {
            return {
                session:
                    this.#session,
                executionEnabled:
                    Boolean(
                        globalThis.SpeechMenu
                            ?.executionEnabled
                    ),
                utterances:
                    [...this.#rows.values()]
            };
        }

        async #copy() {
            const text =
                JSON.stringify(
                    this.#snapshot(),
                    null,
                    2
                );

            try {
                await navigator.clipboard
                    .writeText(text);

                const button =
                    this.#shadow.getElementById("copy");

                const previous =
                    button.textContent;

                button.textContent =
                    "Copied";

                setTimeout(
                    () =>
                        button.textContent =
                            previous,
                    900
                );
            }
            catch {
                console.log(
                    "Speech diagnostics:",
                    this.#snapshot()
                );
            }
        }
    }

    if (
        !customElements.get(
            "speech-diagnostics"
        )
    ) {
        customElements.define(
            "speech-diagnostics",
            SpeechDiagnostics
        );
    }

    globalThis.SpeechDiagnostics =
        SpeechDiagnostics;
})();