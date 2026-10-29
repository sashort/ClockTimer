(() => {
    'use strict';
    const records = new Map(), literalCache = new Map();
    const ns = 'http://www.w3.org/2000/svg';
    let active = false, preference = null, nextId = 0, queued = false, boundary;
    const preferenceKey = 'wmof.clock.theme';
    const palette = new Set(['#ef8b21','#ffd34e','#806094','#ffc83f','#a67b4c','#817c74','#c39a39','#9e5832','#a775c4','#ff6328','#d46324','#ed9124','#ef982f','#e98a20','#f3a329','#ffd04f','#ffd778','#f1a240','#a17ac5']);
    const names = {blue:'#0000ff',navy:'#000080',cyan:'#00ffff',aqua:'#00ffff',teal:'#008080',
        lightblue:'#add8e6',skyblue:'#87ceeb',deepskyblue:'#00bfff',royalblue:'#4169e1',
        purple:'#800080',violet:'#ee82ee',magenta:'#ff00ff',green:'#008000',lime:'#00ff00',
        red:'#ff0000',pink:'#ffc0cb',yellow:'#ffff00',orange:'#ffa500'};
    function color(token, foreground = false) {
        const key = token + ':' + foreground;
        if (literalCache.has(key)) return literalCache.get(key);
        const original = token, named = names[token.toLowerCase()];
        if (named) token = named;
        let rgb, alpha = 1;
        if (token[0] === '#') {
            let hex = token.slice(1);
            if (hex.length === 3 || hex.length === 4) hex = [...hex].map(c => c + c).join('');
            if (hex.length !== 6 && hex.length !== 8) return original;
            rgb = [0,2,4].map(i => parseInt(hex.slice(i,i+2),16));
            if (hex.length === 8) alpha = parseInt(hex.slice(6),16) / 255;
        } else if (/^rgb/i.test(token)) {
            const values = token.match(/[\d.]+%?/g) || [];
            rgb = values.slice(0,3).map(v => parseFloat(v) * (v.endsWith('%') ? 2.55 : 1));
            if (values.length > 3) alpha = parseFloat(values[3]) / (values[3].endsWith('%') ? 100 : 1);
        } else if (/^hsl/i.test(token)) {
            const v = token.match(/[-\d.]+/g)?.map(Number);
            if (!v || v.length < 3) return original;
            const h = ((v[0] % 360) + 360) % 360 / 60, s = v[1] / 100, l = v[2] / 100;
            const c = (1 - Math.abs(2*l-1))*s, x = c*(1-Math.abs(h%2-1)), m = l-c/2;
            rgb = (h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x]).map(n => (n+m)*255);
            alpha = v[3] ?? 1;
        }
        if (!rgb || rgb.length !== 3 || rgb.some(n => !Number.isFinite(n))) return original;
        if (palette.has('#' + rgb.map(n=>Math.round(n).toString(16).padStart(2,'0')).join(''))) return original;
        const [r,g,b] = rgb, max = Math.max(...rgb), min = Math.min(...rgb);
        let replacement;
        if (max-min > 18) {
            if (b > r+12 && r > g*1.18) replacement = '#a17ac5'; // purple stays a highlight
            else if ((b > r+12 && b >= g*.98) || (g > r+18 && b > r+18))
                replacement = max > 185 ? (foreground ? '#ffd778' : min > 110 ? '#eeb55a' : '#2a1a10') :
                    foreground && max > 110 ? '#ffc65b' : '#1d1711';
            else if (g > r+18 && g > b+12) replacement = foreground ? '#e4b443' : '#66501c';
            else if (r > g*1.35 && r > b*1.12 && r > 130) replacement = foreground ? '#ff993b' : '#813b17';
        }
        let result = original;
        if (replacement) {
            const c = replacement.slice(1).match(/../g).map(v => parseInt(v,16));
            result = alpha < 1 ? `rgba(${c.join(',')},${alpha})` : replacement;
        }
        literalCache.set(key, result); return result;
    }
    function colors(value, property = '') {
        const foreground = /^(color|fill|stroke|outline|text|stop-color)|hand-color|tick-color|time-color|node-color/.test(property);
        return value.replace(/url\([^)]*\)|#[\da-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:lightblue|skyblue|deepskyblue|royalblue|blue|navy|cyan|aqua|teal|purple|violet|magenta|green|lime|red|pink|yellow|orange)\b/gi,
            token => /^url\(/i.test(token) ? token : color(token, foreground));
    }
    function declarations(style) {
        let text = '';
        for (const name of style) {
            const value = style.getPropertyValue(name), changed = colors(value, name);
            if (changed !== value) text += `${name}:${changed}!important;`;
        }
        return text;
    }
    function rules(list) {
        let text = '';
        for (const rule of list || []) {
            if (rule.type === 3) {
                try {text += rules(rule.styleSheet.cssRules);} catch {}
            } else if (rule.selectorText && rule.style) {
                const changed = declarations(rule.style);
                if (changed) text += `${rule.selectorText}{${changed}}\n`;
            } else if (rule.type === 7) {
                const changed = colors(rule.cssText);
                if (changed !== rule.cssText) text += changed;
            } else if (rule.cssRules) {
                const changed = rules(rule.cssRules);
                if (changed) text += `${rule.cssText.slice(0,rule.cssText.indexOf('{'))}{${changed}}`;
            }
        }
        return text;
    }
    function style(root, kind) {
        const e = document.createElement('style'); e.dataset.halloweenGenerated = kind;
        (root === document ? document.head : root).append(e); return e;
    }
    function scanSheet(record) {
        if (!active) return;
        let text = '';
        const sheets = record.root === document ? document.styleSheets : [...record.root.querySelectorAll('style,link[rel=stylesheet]')].map(e => e.sheet);
        for (const sheet of sheets) {
            if (!sheet || sheet.ownerNode?.dataset?.halloweenGenerated !== undefined || sheet.ownerNode?.dataset?.halloweenSource !== undefined) continue;
            try {text += rules(sheet.cssRules);} catch {}
        }
        if (record.sheet.textContent !== text) record.sheet.textContent = text;
    }
    function inspect(record, element) {
        if (!active || !element?.getAttribute || element.closest?.('[data-halloween-generated]')) return;
        let text = element.style ? declarations(element.style) : '';
        for (const name of ['fill','stroke','stop-color','color']) {
            const value = element.getAttribute(name);
            if (value && !element.style?.getPropertyValue(name)) {
                const changed = colors(value,name);
                if (changed !== value) text += `${name}:${changed}!important;`;
            }
        }
        const before = record.inline.get(element);
        if (!text && !before) return;
        if (before?.text === text) return;
        if (text) {
            const id = element.dataset.halloweenColor || String(++nextId);
            element.dataset.halloweenColor = id;
            record.inline.set(element, {id,text});
        } else record.inline.delete(element);
        record.dirty = true;
    }
    function scan(record, node) {
        if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
        if (node.nodeType === 1) inspect(record,node);
        for (const e of node.querySelectorAll?.('*') || []) {
            if (e.dataset?.halloweenGenerated !== undefined) continue;
            inspect(record,e); if (e.shadowRoot) registerRoot(e.shadowRoot);
        }
    }
    function flush() {
        queued = false;
        if (!active) return;
        for (const record of records.values()) if (record.dirty) {
            record.dirty = false;
            let text = '';
            for (const [e, entry] of record.inline) {
                if (!e.isConnected && record.root === document) {record.inline.delete(e); continue;}
                text += `[data-halloween-color="${entry.id}"]{${entry.text}}\n`;
            }
            if (record.dynamic.textContent !== text) record.dynamic.textContent = text;
        }
    }
    function queue() {if (!queued) {queued = true; queueMicrotask(flush);}}
    const semantic = `--clock-timer-trip-color:#ef8b21!important;--clock-timer-early-start-color:#ffd34e!important;
        --clock-timer-break-color:#806094!important;--clock-timer-lunch-color:#ffc83f!important;
        --clock-timer-break-buffer-color:#a67b4c!important;--clock-timer-down-color:#817c74!important;
        --clock-timer-approval-surplus-color:#c39a39!important;--clock-timer-approval-deficit-color:#9e5832!important;
        --clock-timer-tolerance-color:#a775c4!important;--clock-timer-overtime-color:#ff6328!important;
        --clock-timer-latency-color:#d46324!important;--clock-timer-hour-hand-color:#fff6df!important;
        --clock-timer-minute-hand-color:#fff6df!important;--clock-timer-second-hand-color:#21170d!important;
        --clock-timer-time-color:#fff7e6!important;--clock-timer-tick-color:#fff4dc!important;
        --clock-timer-border-color:#271808!important;`;
    function enhanceClock(record) {
        if (record.root.host?.localName !== 'clock-timer') return;
        const face = record.root.querySelector('#clock-face'); if (!face) return;
        if (!record.pumpkin) {
            const pumpkin = document.createElementNS(ns,'svg'); pumpkin.classList.add('halloween-pumpkin');
            pumpkin.setAttribute('viewBox','0 0 100 100'); pumpkin.setAttribute('aria-hidden','true');
            pumpkin.innerHTML = '<circle cx="50" cy="50" r="43" fill="#ed9124"/><path d="M48 10Q45 4 52 2L55 5Q49 8 53 12" fill="#80549b"/><path d="M39 13Q22 48 40 88M60 13Q78 50 61 88" fill="none" stroke="#b85f14" stroke-width="1" opacity=".55"/><path d="M24 40L35 25L40 42Z M60 42L66 25L78 40Z" fill="#21150a"/><path d="M23 65L34 69L40 65L45 71L52 67L58 71L67 65L78 63Q70 84 50 84Q31 82 23 65" fill="#21150a"/><path d="M35 69L41 70L40 76L35 74Z M62 70L68 67L66 74L62 76Z" fill="#ffdc69"/>';
            face.append(pumpkin); record.pumpkin = pumpkin;
        }
        const display = active ? '' : 'none';
        if (record.pumpkin.style.display !== display) record.pumpkin.style.display = display;
    }
    function extra(record) {
        const host = record.root.host?.localName;
        if (host === 'clock-timer') return `:host{${semantic}--clock-timer-face-background-color:#6e370f!important;}
            .halloween-pumpkin{position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;}
            .halloween-pumpkin[hidden]{display:none;}#hands{filter:drop-shadow(0 0 1px #21150a);}`;
        if (host === 'speech-mic-bar') return `#bar,#optionsPanel{background:linear-gradient(#30261d,#17120e)!important;border-color:#ef982f!important;}
            #optionsHeader{color:#ffd570!important;}#bar #mic{background:#e98a20!important;color:#20150a!important;}
            :host([state="muted"]) #bar #mic{background:#77716a!important;color:#fff4dc!important;}
            #bar #mic::before{background:currentColor!important;}#optionsClose{background:#32200e!important;color:#ffd34e!important;border-color:#ef982f!important;}`;
        return '';
    }
    function registerRoot(root) {
        if (!root || records.has(root)) return;
        const record = {root,inline:new Map(),dirty:false}; records.set(root,record);
        record.sheet = style(root,'sheet'); record.dynamic = style(root,'inline'); record.extra = style(root,'component');
        record.observer = new MutationObserver(changes => {
            if (!active) return;
            let sheets = false;
            for (const change of changes) {
                const target = change.target.nodeType === 1 ? change.target : change.target.parentElement;
                if (target?.closest?.('[data-halloween-generated]')) continue;
                if (change.type === 'attributes') inspect(record,change.target);
                else {
                    if (target?.localName === 'style') sheets = true;
                    for (const node of change.addedNodes) {
                        if (node.nodeType === 1 && ['style','link'].includes(node.localName) && node.dataset.halloweenGenerated === undefined) sheets = true;
                        scan(record,node);
                    }
                }
            }
            if (sheets) scanSheet(record);
            enhanceClock(record); queue();
        });
        record.observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,
            attributeFilter:['style','fill','stroke','stop-color','color']});
        if (active) activate(record);
    }
    function activate(record) {
        scanSheet(record); scan(record,record.root); enhanceClock(record);
        record.extra.textContent = extra(record); record.dirty = true; queue();
    }
    function isHalloween(date = new Date()) {
        try {if (parent !== window && parent.WMOFSeasonalTheme) return parent.WMOFSeasonalTheme.active;} catch {}
        if (preference === 'halloween') return true;
        if (preference === 'default') return false;
        const preview = new URLSearchParams(location.search);
        if (preview.get('halloweenPreview') === '1' || preview.get('theme') === 'halloween') return true;
        return date.getMonth() === 9 && date.getDate() === 31;
    }
    function refresh(date = new Date()) {
        const next = isHalloween(date), changed = next !== active; active = next;
        if (active) document.documentElement.dataset.seasonalTheme = 'halloween';
        else delete document.documentElement.dataset.seasonalTheme;
        const toggle = document.querySelector('#halloweenThemeToggle'); if (toggle) toggle.checked = active;
        if (changed) {
            for (const record of records.values()) {
                if (active) activate(record);
                else {
                    record.sheet.textContent = record.dynamic.textContent = record.extra.textContent = '';
                    record.inline.clear(); if (record.pumpkin) record.pumpkin.style.display = 'none';
                }
            }
            window.dispatchEvent(new CustomEvent('wmof-seasonal-theme-change',{detail:{active,theme:active?'halloween':null}}));
        }
        return active;
    }
    async function setPreference(value, {persist = true} = {}) {
        const previous = preference;
        preference = ['halloween','default'].includes(value) ? value : null;
        refresh();
        if (persist) try {
            const account = globalThis.WMOFAccountSettings;
            if (account?.loaded) await account.write('orderFiller',{[preferenceKey]:preference});
            else localStorage.setItem('wmof.anonymous.theme',preference || 'auto');
        } catch (error) {
            preference = previous; refresh();
            window.dispatchEvent(new CustomEvent('wmof:persistence-error',{detail:{error}}));
            throw error;
        }
        return active;
    }
    function setupControls() {
        const toggle = document.querySelector('#halloweenThemeToggle');
        if (toggle && !toggle.dataset.themeBound) {
            toggle.dataset.themeBound = 'true'; toggle.checked = active;
            toggle.addEventListener('change',async () => {
                const next = toggle.checked ? 'halloween' : 'default'; toggle.disabled = true;
                try {await setPreference(next);} catch {} finally {toggle.disabled = false;}
            });
        }
        const account = globalThis.WMOFAccountSettings;
        if (account && !account.seasonalThemeBound) {
            account.seasonalThemeBound = true;
            const loaded = () => {void setPreference(account.peek('orderFiller',preferenceKey),{persist:false});};
            account.addEventListener('loaded',loaded);
            account.addEventListener('saved',loaded);
            account.addEventListener('cleared',() => {
                try {preference = localStorage.getItem('wmof.anonymous.theme');} catch {preference=null;}
                refresh();
            });
            if (account.loaded) loaded();
        }
    }
    function schedule() {
        clearTimeout(boundary); const now = new Date(), next = new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
        boundary = setTimeout(() => {refresh(); schedule();},next-now+50);
    }
    try {preference = localStorage.getItem('wmof.anonymous.theme');} catch {}
    globalThis.WMOFSeasonalTheme = Object.freeze({get active(){return active;},get preference(){return preference;},refresh,setPreference,registerRoot,colors,semantic});
    refresh(); registerRoot(document); schedule();
    document.addEventListener('DOMContentLoaded',() => {setupControls();if(active) for(const r of records.values()) activate(r);},{once:true});
    window.addEventListener('clocktimer-app-ready',setupControls);
    document.addEventListener('load',event => {if(active && event.target.localName === 'link') for(const r of records.values()) activate(r);},true);
    document.addEventListener('visibilitychange',() => {if(!document.hidden){refresh();schedule();}});
    try {if(parent!==window)parent.addEventListener('wmof-seasonal-theme-change',() => refresh());} catch {}
})();
