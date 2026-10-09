/* Context-aware loader for dynamically loaded classic scripts. */
(function (root) {
    "use strict";

    function create({
        documentRef = root.document,
        context = root.ClockTimerPageContext || root.ClockTimerContext?.normalize?.() || {},
        version = ""
    } = {}) {
        const pending = new Map();

        function contextData() {
            return JSON.stringify({
                host: context.host || "order-filler",
                surface: context.surface || "application",
                presentation: context.presentation || "application",
                features: context.features || [],
                capabilities: context.capabilities || {},
                options: context.options || {}
            });
        }

        function load(source) {
            if (typeof source !== "string" || !source.trim()) {
                return Promise.reject(new TypeError("A script source is required."));
            }
            if (pending.has(source)) return pending.get(source);

            const promise = new Promise((resolve, reject) => {
                const existing = Array.from(
                    documentRef.querySelectorAll("script[data-runtime-source]")
                ).find(script => script.dataset.runtimeSource === source);
                if (existing?.dataset.loaded === "true") {
                    resolve(existing);
                    return;
                }

                const script = existing || documentRef.createElement("script");
                if (!script.dataset.clocktimerContextData) {
                    script.dataset.clocktimerContextData = contextData();
                    script.dataset.clocktimerContext = context.host || "order-filler";
                }

                const onLoad = () => {
                    script.dataset.loaded = "true";
                    resolve(script);
                };
                const onError = () => {
                    pending.delete(source);
                    script.remove?.();
                    reject(new Error("Unable to load " + source + "."));
                };
                script.addEventListener("load", onLoad, { once: true });
                script.addEventListener("error", onError, { once: true });

                if (!existing) {
                    script.src = source + version;
                    script.dataset.runtimeSource = source;
                    documentRef.head.append(script);
                }
            });
            pending.set(source, promise);
            return promise;
        }

        return Object.freeze({ load });
    }

    root.ClockTimerClassicScriptLoader = Object.freeze({ create });
})(globalThis);
