/* Context-aware resource loader. Every nested resource receives its parent's context. */
(function (root) {
    "use strict";
    const pending = new Map();
    const keyFor = (kind, url) => kind + ":" + new URL(url, document.baseURI).href;

    function loadScript(url, context, options = {}) {
        const key = keyFor("script", url);
        if (pending.has(key)) return pending.get(key);
        const promise = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = url;
            script.async = options.async === true;
            script.dataset.clocktimerResource = "script";
            script.onload = () => resolve(script);
            script.onerror = () => { pending.delete(key); reject(new Error("Unable to load script: " + url)); };
            script.addEventListener("load", () => {
                if (script.dataset.clocktimerContext) return;
                script.dataset.clocktimerContext = context?.host || "default";
                script.dispatchEvent(new CustomEvent("clocktimer-resource-loaded", { detail: { context } }));
            }, { once: true });
            document.head.append(script);
        });
        pending.set(key, promise);
        return promise;
    }

    function loadStyle(url, context) {
        const key = keyFor("style", url);
        if (pending.has(key)) return pending.get(key);
        const promise = new Promise((resolve, reject) => {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = url;
            link.dataset.clocktimerResource = "style";
            link.onload = () => resolve(link);
            link.onerror = () => { pending.delete(key); reject(new Error("Unable to load stylesheet: " + url)); };
            link.dataset.clocktimerContext = context?.host || "default";
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
        template.content.querySelectorAll("[data-clocktimer-context]").forEach(node => {
            const childContext = root.ClockTimerContext.child(context, parseContext(node.dataset.clocktimerContext));
            node.__clockTimerContext = childContext;
        });
        if (target) {
            target.replaceChildren(template.content);
            await hydrate(target, context);
            return target;
        }
        return { template, context };
    }

    function parseContext(value) {
        if (!value) return {};
        try { return JSON.parse(value); } catch { return {}; }
    }

    async function hydrate(container, context) {
        const resources = [...container.querySelectorAll("[data-clocktimer-resource-url]")];
        for (const node of resources) {
            const childContext = root.ClockTimerContext.child(context, parseContext(node.dataset.clocktimerContext));
            const url = node.dataset.clocktimerResourceUrl;
            if (node.dataset.clocktimerResource === "script") await loadScript(url, childContext);
            else if (node.dataset.clocktimerResource === "style") await loadStyle(url, childContext);
            else if (node.dataset.clocktimerResource === "template") await loadTemplate(url, childContext, node);
        }
    }

    root.ClockTimerResources = Object.freeze({ loadScript, loadStyle, loadTemplate, hydrate });
})(globalThis);
