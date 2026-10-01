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
            pipeline: null,
            sampleRate: null,
            vadMaxProcessMilliseconds: 0
        };

        constructor() {
            super();
            this.#shadow.innerHTML = globalThis.WMOFLanguagePack.markup(`
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
                        grid-template-columns: repeat(6, minmax(70px, 1fr));
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
                        <strong data-language-id="3b370944-1322-5c2b-ba28-ca4fe078d8ee">{{text:3b370944-1322-5c2b-ba28-ca4fe078d8ee:text0}}</strong>
                        <span id="device"></span>
                        <span class="spacer"></span>
                        <button id="copy" type="button" data-language-id="520d6d61-06e2-5858-87af-67bb2119c306">{{text:520d6d61-06e2-5858-87af-67bb2119c306:text0}}</button>
                        <button id="clear" type="button" data-language-id="211555b3-3393-5fda-bdac-70d96a90c24f">{{text:211555b3-3393-5fda-bdac-70d96a90c24f:text0}}</button>
                        <button id="close" type="button" aria-label="{{text:05b57c42-d19f-5ae4-a819-2d1f59f371ae:aria-label}}" data-language-id="05b57c42-d19f-5ae4-a819-2d1f59f371ae">{{text:05b57c42-d19f-5ae4-a819-2d1f59f371ae:text0}}</button>
                    </header>
                    <div class="controls">
                        <label data-language-id="8a762e16-ebe3-5d2d-b41e-9022767b5a55">
                            <input id="execute" type="checkbox">{{text:8a762e16-ebe3-5d2d-b41e-9022767b5a55:text0}}</label>
                        <span id="capture" data-language-id="1344a310-dc45-5422-a378-cc0dc0c392da">{{text:1344a310-dc45-5422-a378-cc0dc0c392da:text0}}</span>
                    </div>
                    <div class="summary">
                        <div class="metric"><b id="utterances" data-language-id="ac9c02f4-1530-5467-9154-2b3c19c0586b">{{text:ac9c02f4-1530-5467-9154-2b3c19c0586b:text0}}</b><small data-language-id="b2ae3f22-9d53-52a8-a1a1-0c4d1660af59">{{text:b2ae3f22-9d53-52a8-a1a1-0c4d1660af59:text0}}</small></div>
                        <div class="metric"><b id="matched" data-language-id="cd7fe480-ba89-5c85-a1f1-a5b38fc865f0">{{text:cd7fe480-ba89-5c85-a1f1-a5b38fc865f0:text0}}</b><small data-language-id="e152de11-f83a-53e2-919d-f8ec96659737">{{text:e152de11-f83a-53e2-919d-f8ec96659737:text0}}</small></div>
                        <div class="metric"><b id="first" data-language-id="6ed8b126-03f8-5869-b622-eb17365b1cd3">{{text:6ed8b126-03f8-5869-b622-eb17365b1cd3:text0}}</b><small data-language-id="9e504b23-c3d0-5880-b116-df2d80b478f6">{{text:9e504b23-c3d0-5880-b116-df2d80b478f6:text0}}</small></div>
                        <div class="metric"><b id="final" data-language-id="05cacaf2-1a49-5c14-a8a7-add539853f39">{{text:05cacaf2-1a49-5c14-a8a7-add539853f39:text0}}</b><small data-language-id="8d48c4d6-89f3-5c68-ac37-e780c78f04a0">{{text:8d48c4d6-89f3-5c68-ac37-e780c78f04a0:text0}}</small></div>
                        <div class="metric"><b id="decode" data-language-id="c0c012bc-86bf-5581-83a4-336298e13c12">{{text:c0c012bc-86bf-5581-83a4-336298e13c12:text0}}</b><small data-language-id="6c0822c9-2d65-5c1f-bfcb-e6cff9851bd3">{{text:6c0822c9-2d65-5c1f-bfcb-e6cff9851bd3:text0}}</small></div>
                        <div class="metric"><b id="vad" data-language-id="f9407d4d-20e3-550a-9ec0-fbd7cc855a74">{{text:f9407d4d-20e3-550a-9ec0-fbd7cc855a74:text0}}</b><small data-language-id="f7f4545c-e887-5d61-8aaf-530ebbe1bf1e">{{text:f7f4545c-e887-5d61-8aaf-530ebbe1bf1e:text0}}</small></div>
                    </div>
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th class="id" data-language-id="643d11bb-975b-5898-83df-e121e7b094ef">{{text:643d11bb-975b-5898-83df-e121e7b094ef:text0}}</th>
                                    <th class="transcript" data-language-id="cfa6a354-2eae-51f3-ac5c-7a41bb1f56b5">{{text:cfa6a354-2eae-51f3-ac5c-7a41bb1f56b5:text0}}</th>
                                    <th class="latency" data-language-id="08e15368-e9e4-50c0-b9d4-3a7b9b17f38c">{{text:08e15368-e9e4-50c0-b9d4-3a7b9b17f38c:text0}}</th>
                                    <th class="latency" data-language-id="30e0a9c3-95bf-5e9a-bd82-ce9d8d74087b">{{text:30e0a9c3-95bf-5e9a-bd82-ce9d8d74087b:text0}}</th>
                                    <th class="latency decode" data-language-id="1378239f-817f-5c11-9251-05ac18894c12">{{text:1378239f-817f-5c11-9251-05ac18894c12:text0}}</th>
                                    <th class="status" data-language-id="88e72b76-c213-5869-96ec-e0d85e7ce110">{{text:88e72b76-c213-5869-96ec-e0d85e7ce110:text0}}</th>
                                </tr>
                            </thead>
                            <tbody id="body"></tbody>
                        </table>
                    </div>
                </section>
            `);
        globalThis.WMOFLanguagePack.observe(this.#shadow);

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
                "speechVadChanged",
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
                this.#session.pipeline =
                    detail.pipeline || "raw";
                this.#session.sampleRate =
                    detail.sampleRate || null;
                this.#renderCapture();
                return;
            }

            if (
                type === "speechVadChanged"
            ) {
                this.#session
                    .vadMaxProcessMilliseconds =
                    Math.max(
                        this.#session
                            .vadMaxProcessMilliseconds ||
                            0,
                        Number(
                            detail
                                .maxProcessMilliseconds
                        ) || 0
                    );

                this.#render();
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
                        globalThis.WMOFLanguagePack.text("de25229e-79b4-4fdb-84be-b850ec419c4b");
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
                    globalThis.WMOFLanguagePack.text("86efedcc-9b49-57aa-bc4f-7583746adfd4", {value0: (this.#session.pipeline || "raw"), value1: (short), value2: (navigator.hardwareConcurrency || "?")});
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
                    globalThis.WMOFLanguagePack.text("26a4dc24-9a0f-5e45-818b-e5430b66a0d0", {value0: (fmt(settings.echoCancellation)), value1: (fmt(settings.noiseSuppression)), value2: (fmt(settings.autoGainControl))});
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

            this.#shadow.getElementById("vad")
                .textContent =
                    this.#session.pipeline === globalThis.WMOFLanguagePack.text("1644aee1-d80d-50d4-a781-598589d458c3")
                        ? this.#milliseconds(
                            this.#session
                                .vadMaxProcessMilliseconds
                        )
                        : "—";

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
                    globalThis.WMOFLanguagePack.text("691baafb-681e-5f62-bc45-a6a6f8c29a2f");

                setTimeout(
                    () =>
                        button.textContent =
                            previous,
                    900
                );
            }
            catch {
                console.log(
                    globalThis.WMOFLanguagePack.text("052bd581-4379-41c4-8cc9-410a95b21f15"),
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