// Opt-in, local-only recorder. Paste into DevTools before reproducing login.
// Records geometry and focus identifiers, never credentials or spoken text.
(() => {
    'use strict';
    globalThis.LoginViewportDiagnostics?.stop();
    const entries = [], removers = [], timers = new Set();
    const bounds = element => {
        if (!element) return null;
        const {top, bottom, width, height} = element.getBoundingClientRect();
        return {top, bottom, width, height};
    };
    function capture(reason) {
        const viewport = globalThis.visualViewport;
        const app = document.querySelector('#app');
        const mic = document.querySelector('#speechMicBar');
        const active = document.activeElement;
        const visibleBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight);
        const micBounds = bounds(mic), appBounds = bounds(app);
        const entry = {
            reason, milliseconds: Math.round(performance.now()),
            fullscreen: Boolean(document.fullscreenElement),
            window: {width: innerWidth, height: innerHeight, scrollX, scrollY},
            screen: {width: screen.width, height: screen.height, availableHeight: screen.availHeight,
                orientation: screen.orientation?.type, pixelRatio: devicePixelRatio},
            document: {width: document.documentElement.clientWidth, height: document.documentElement.clientHeight},
            visual: viewport ? {width: viewport.width, height: viewport.height,
                offsetTop: viewport.offsetTop, scale: viewport.scale} : null,
            app: appBounds, mic: micBounds,
            containers: [document.documentElement, document.body, app, mic?.parentElement].filter(Boolean).map(element => ({
                tag: element.tagName, id: element.id, bounds: bounds(element),
                padding: getComputedStyle(element).padding, margin: getComputedStyle(element).margin
            })),
            belowApp: appBounds ? visibleBottom - appBounds.bottom : null,
            belowMic: micBounds ? visibleBottom - micBounds.bottom : null,
            appHeightOverride: document.documentElement.style.getPropertyValue('--app-viewport-height'),
            micBottomOverride: mic?.style.getPropertyValue('--speech-mic-fixed-bottom'),
            micPresentation: mic ? {hidden: mic.hidden, popover: mic.matches(':popover-open'),
                opacity: getComputedStyle(mic).opacity, transform: getComputedStyle(mic).transform} : null,
            bodyBackground: getComputedStyle(document.body).backgroundColor,
            focus: active ? {tag: active.tagName, id: active.id,
                loginStage: active.dataset?.loginDigit, digitIndex: active.dataset?.digitIndex} : null,
            login: ['loginDialog', 'legacyLoginDialog'].map(id => ({id, open: Boolean(document.getElementById(id)?.open)}))
        };
        entries.push(entry);
        if (entries.length > 400) entries.shift();
        return entry;
    }
    function sample(event) {
        const reason = event.type || String(event);
        capture(reason);
        for (const delay of [100, 350, 1000]) {
            const timer = setTimeout(() => {timers.delete(timer);capture(reason + '+' + delay);}, delay);
            timers.add(timer);
        }
    }
    for (const [target, events] of [[globalThis, ['resize', 'orientationchange', 'pageshow']],
        [document, ['fullscreenchange', 'focusin', 'focusout']],
        [globalThis.visualViewport, ['resize', 'scroll']]]) {
        for (const type of events) {
            const listener = () => sample({type: (target === globalThis.visualViewport ? 'visual.' : '') + type});
            target?.addEventListener(type, listener);
            removers.push(() => target?.removeEventListener(type, listener));
        }
    }
    const observer = new MutationObserver(() => sample({type: 'login-open-change'}));
    for (const id of ['loginDialog', 'legacyLoginDialog']) {
        const dialog = document.getElementById(id);
        if (dialog) observer.observe(dialog, {attributes: true, attributeFilter: ['open']});
    }
    globalThis.LoginViewportDiagnostics = {
        capture, report: () => JSON.parse(JSON.stringify(entries)),
        stop() {for (const remove of removers) remove();for (const timer of timers) clearTimeout(timer);observer.disconnect();}
    };
    capture('installed');
})();
