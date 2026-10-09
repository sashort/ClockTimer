/* Context-aware resource loader. Every nested resource receives its parent's context. */
(function (root) {
    "use strict";
    const pending = new Map();
    const contextKey = context => JSON.stringify({
        host: context?.host || "default",
        surface: context?.surface || "application",
        presentation: context?.presentation || "application",
        features: context?.features || [],
        capabilities: context?.capabilities || {},
        options: context?.options || {}
    });
    const keyFor = (kind, url, context) => kind + ":" + new URL(url, document.baseURI).href
        + (kind === "script" || kind === "style" ? ":" + contextKey(context) : "");

    function loadScript(url, context, options = {}) {
        const key = keyFor("script", url, context);
        if (pending.has(key)) return pending.get(key);
        const promise = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = url;
            script.async = options.async === true;
            script.dataset.clocktimerResource = "script";
            script.dataset.clocktimerContext = context?.host || "default";
            script.dataset.clocktimerContextData = JSON.stringify({
                host: context?.host || "default",
                surface: context?.surface || "application",
                presentation: context?.presentation || "application",
                features: context?.features || [],
                capabilities: context?.capabilities || {},
                options: context?.options || {}
            });
            script.onload = () => resolve(script);
            script.onerror = () => { pending.delete(key); reject(new Error("Unable to load script: " + url)); };
            script.addEventListener("load", () => {
                script.dispatchEvent(new CustomEvent("clocktimer-resource-loaded", { detail: { context } }));
            }, { once: true });
            document.head.append(script);
        });
        pending.set(key, promise);
        return promise;
    }

    function loadStyle(url, context) {
        const key = keyFor("style", url, context);
        if (pending.has(key)) return pending.get(key);
        const promise = new Promise((resolve, reject) => {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = url;
            link.dataset.clocktimerResource = "style";
            link.onload = () => resolve(link);
            link.onerror = () => { pending.delete(key); reject(new Error("Unable to load stylesheet: " + url)); };
            link.dataset.clocktimerContext = context?.host || "default";
            link.dataset.clocktimerContextData = JSON.stringify({
                host: context?.host || "default",
                surface: context?.surface || "application",
                presentation: context?.presentation || "application",
                features: context?.features || [],
                capabilities: context?.capabilities || {},
                options: context?.options || {}
            });
            document.head.append(link);
        });
        pending.set(key, promise);
        return promise;
    }

    async function loadTemplate(url, context, target, options = {}) {
        const response = await fetch(url, { credentials: "same-origin", signal: options.signal });
        if (!response.ok) throw new Error("Unable to load template (" + response.status + "): " + url);
        const markup = await response.text();
        const template = document.createElement("template");
        template.innerHTML = markup;
        await hydrate(template.content, context);
        if (target) {
            target.replaceChildren(template.content);
            return target;
        }
        return { template, context };
    }

    function parseContext(value) {
        if (!value) return {};
        try { return JSON.parse(value); } catch { return {}; }
    }

    async function hydrate(container, context) {
        async function visit(node, inheritedContext) {
            let nodeContext = inheritedContext;
            if (node.nodeType === 1 && node.dataset?.clocktimerContext) {
                nodeContext = root.ClockTimerContext.child(
                    inheritedContext,
                    parseContext(node.dataset.clocktimerContext)
                );
                node.dataset.clocktimerResolvedContext = JSON.stringify({
                    host: nodeContext.host,
                    surface: nodeContext.surface,
                    presentation: nodeContext.presentation,
                    features: nodeContext.features,
                    capabilities: nodeContext.capabilities,
                    options: nodeContext.options
                });
            }

            if (node.nodeType === 1 && node.dataset?.clocktimerResourceUrl) {
                const url = node.dataset.clocktimerResourceUrl;
                if (node.dataset.clocktimerResource === "script") {
                    await loadScript(url, nodeContext);
                } else if (node.dataset.clocktimerResource === "style") {
                    await loadStyle(url, nodeContext);
                } else if (node.dataset.clocktimerResource === "template") {
                    await loadTemplate(url, nodeContext, node);
                    return;
                }
            }

            for (const child of Array.from(node.childNodes || [])) {
                await visit(child, nodeContext);
            }
        }

        for (const child of Array.from(container.childNodes || [])) {
            await visit(child, context);
        }
    }

    root.ClockTimerResources = Object.freeze({ loadScript, loadStyle, loadTemplate, hydrate });
})(globalThis);
