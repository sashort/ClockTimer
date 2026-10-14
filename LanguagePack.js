(() => {
    "use strict";
    const source = document.getElementById('language-pack');
    if (!source) throw new Error('The page is missing its language pack.');
    const pack = JSON.parse(source.textContent);
    const locale = pack['ui-text']?.locale;
    const definitions = new Set();
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const name of ['ui-text', 'speech-patterns', 'announcements', 'associations']) {
        if (pack[name]?.version !== 1 || pack[name].locale !== locale) throw new Error(`Invalid language resource: ${name}`);
    }
    for (const records of [pack['ui-text'].texts, pack['speech-patterns'].patterns,
        pack['speech-patterns'].preprocessors, pack['speech-patterns'].customRules, pack.announcements.announcements]) {
        for (const definition of Object.values(records || {})) {
            if (!uuid.test(definition.id) || definitions.has(definition.id)) throw new Error('Language definitions must have unique UUIDs.');
            definitions.add(definition.id);
        }
    }
    const patterns = pack['speech-patterns'].patterns;
    const associations = pack.associations.elements;
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
    const pattern = id => {
        const value = patterns[id]?.pattern;
        if (typeof value !== 'string') throw new Error(`Unknown speech pattern: ${id}`);
        return value;
    };
    const text = (id, values = {}) => {
        const template = pack['ui-text'].texts[id]?.text;
        if (typeof template !== 'string') throw new Error(`Unknown UI text: ${id}`);
        return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, key) => {
            if (!Object.prototype.hasOwnProperty.call(values, key)) throw new Error(`Missing UI text value: ${key}`);
            return String(values[key] ?? '');
        });
    };
    const speechAttributes = elementId => {
        const association = associations[elementId];
        if (!association) throw new Error(`Unknown language association: ${elementId}`);
        const attributes = {};
        if (association.patternId) {
            const definition = patterns[association.patternId];
            attributes['data-speech-pattern-id'] = definition.id;
            attributes['speech-pattern'] = definition.pattern;
            if (definition.noun) attributes['speech-noun'] = definition.noun;
        }
        if (association.preprocessorId) {
            const rule = pack['speech-patterns'].preprocessors[association.preprocessorId];
            attributes['data-speech-preproc-id'] = rule.id;
            for (const [key, attribute] of [['handler','speech-preproc'],['context','speech-preproc-context'],['field','speech-preproc-field']])
                if (rule[key]) attributes[attribute] = rule[key];
        }
        return attributes;
    };
    const optionsMarkup = elementId => (pack.associations.selects[elementId] || []).map(option =>
        `<option value="${escape(option.value)}" data-language-id="${option.elementId}"${['selected','disabled','hidden'].filter(key => option[key]).map(key => ` ${key}`).join('')}>${escape(text(option.textId))}</option>`).join('');
    const markup = template => template.replace(/\{\{(text|speech|options):([a-f0-9-]+)(?::([A-Za-z0-9_-]+))?\}\}/g, (_, kind, id, slot) => {
        if (kind === 'options') return optionsMarkup(id);
        if (kind === 'speech') return Object.entries(speechAttributes(id)).map(([name,value]) => `${name}="${escape(value)}"`).join(' ');
        const association = associations[id];
        return escape(text(association?.texts[slot] || association?.attributes[slot]));
    });
    const language = JSON.parse(JSON.stringify(pack['speech-patterns'].language));
    for (const [key, id] of Object.entries(language.speech.commands)) language.speech.commands[key] = pattern(id);
    for (const key of ['wakePhrase','sleepPhrase','offPhrase']) language.speech[key] = pattern(language.speech[key]);
    globalThis.WMOFLanguages ||= Object.create(null);
    globalThis.WMOFLanguages[locale] = language;

    const tracked = new WeakSet();
    const elements = new Map(), speechInstances = new Map(), preprocessingInstances = new Map();
    const identity = (element, attribute, registry) => {
        let id = element.getAttribute(attribute);
        if (!uuid.test(id || '') || (registry.get(id)?.deref() && registry.get(id).deref() !== element)) {
            if (id) element.setAttribute(attribute + '-definition', id);
            id = crypto.randomUUID();
            element.setAttribute(attribute, id);
        }
        registry.set(id, new WeakRef(element));
        return id;
    };
    const identify = element => {
        identity(element, 'data-language-id', elements);
        if (element.hasAttribute('speech-pattern')) identity(element, 'data-speech-pattern-id', speechInstances);
        if (element.hasAttribute('speech-preproc')) identity(element, 'data-speech-preproc-id', preprocessingInstances);
        return element;
    };
    const observe = root => {
        if (tracked.has(root)) return;
        tracked.add(root);
        const visit = element => {
            if (!(element instanceof Element) || element.matches("script,style")) return;
            if (element.matches('[speech-pattern],[speech-preproc],[data-language-id],[title],[aria-label],[placeholder],[alt],select') ||
                [...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())) identify(element);
            if (element.shadowRoot) observe(element.shadowRoot);
        };
        const scan = node => { if (!node) return; if (node instanceof Element) visit(node); node.querySelectorAll?.('*').forEach(visit); };
        scan(root);
        const observer = new MutationObserver(records => {
            for (const record of records) {
                if (record.type === 'attributes') visit(record.target);
                else for (const node of record.addedNodes) scan(node.nodeType === 3 ? node.parentElement : node);
            }
        });
        observer.observe(root, {subtree:true,childList:true,attributes:true,
            attributeFilter:['speech-pattern','speech-preproc','speech-preproc-context','speech-preproc-field','title','aria-label','placeholder','alt']});
    };
    const patternFor = key => {
        const id = pack['speech-patterns'].sourceKeys?.[key];
        if (!id) throw new Error(`Unknown speech pattern source: ${key}`);
        return pattern(id);
    };
    const bindPreprocessor = (element, key, fallback = {}) => {
        const patternId = pack['speech-patterns'].language.speech.commands[key];
        const definition = patterns[patternId];
        const rule = pack['speech-patterns'].preprocessors[definition?.preprocessorId];
        const selected = rule || fallback;
        if (!selected.handler) return;
        for (const [name, attribute] of [['handler','speech-preproc'],['context','speech-preproc-context'],['field','speech-preproc-field']])
            if (selected[name]) element.setAttribute(attribute, selected[name]);
        if (rule) element.setAttribute('data-speech-preproc-definition', rule.id);
        identify(element);
    };
    const preprocess = (value, ruleId) => {
        const rule = pack['speech-patterns'].preprocessors[ruleId];
        for (const id of rule?.transforms || []) {
            const transform = pack['speech-patterns'].customRules[id];
            if (transform?.kind !== 'replace') throw new Error(`Unknown preprocessing transform: ${id}`);
            value = String(value).replace(new RegExp(transform.pattern, transform.flags || 'g'), transform.replacement);
        }
        return value;
    };
    const bindCommand = (element, key) => {
        const id = pack['speech-patterns'].language.speech.commands[key];
        if (!id) throw new Error(`Unknown speech command: ${key}`);
        identify(element);
        element.setAttribute('speech-pattern', pattern(id));
        element.setAttribute('data-speech-pattern-definition', id);
        identity(element, 'data-speech-pattern-id', speechInstances);
        return element;
    };
    globalThis.WMOFLanguagePack = Object.freeze({locale, resources:pack, language, text, pattern, patternFor, markup, identify, observe, bindCommand, bindPreprocessor, preprocess, speechAttributes});
    observe(document);
})();
