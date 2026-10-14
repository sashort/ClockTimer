// Generate static previews from the same sub-templates used by the PHP pages.
const fs = require('node:fs');
const path = require('node:path');
const pages = ['index', 'order-filler', 'drop-in'];
function compose(root, template) {
    const folder = fs.realpathSync(path.join(root, 'templates'));
    const read = name => {
        if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*\.html$/.test(name)) throw Error('Invalid page sub-template');
        const file = fs.realpathSync(path.join(folder, name));
        if (!file.startsWith(folder + path.sep)) throw Error('Page sub-template escapes templates');
        return fs.readFileSync(file, 'utf8');
    };
    const expand = (html, page, stack = []) => {
        if (stack.length > 16) throw Error('Page template nesting is too deep');
        return html.replace(/\{\{(page|include):(.+?)\}\}/gs, (_, kind, value) => {
            if (kind === 'page') {
                if (!pages.includes(value) || page) throw Error('Unknown or nested page template');
                return expand(read('page.html'), value, ['page.html']);
            }
            const name = value.replaceAll('{page}', page || '');
            if (stack.includes(name)) throw Error('Cyclic page sub-template');
            return expand(read(name), page, [...stack, name]);
        });
    };
    return expand(template);
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function render(root, template, locale = 'en-US') {
    const pack = Object.fromEntries(['ui-text','speech-patterns','announcements','associations'].map(name =>
        [name, JSON.parse(fs.readFileSync(path.join(root,'lang',locale,name+'.json'),'utf8'))]));
    const text = id => {
        const value = pack['ui-text'].texts[id]?.text;
        if (typeof value !== 'string') throw Error('Unknown UI text ID: ' + id);
        return escape(value);
    };
    const attrs = definition => Object.entries(definition).map(([name,value]) => `${name}="${escape(value)}"`).join(' ');
    return compose(root, template).replace(/\{\{(locale|language-pack|language-rules|text|speech|options)(?::([a-f0-9-]+))?(?::([A-Za-z0-9_-]+))?\}\}/g, (_,kind,id,slot) => {
        if (kind === 'locale') return escape(locale);
        if (kind === 'language-pack') return '<script type="application/json" id="language-pack">' + JSON.stringify(pack).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026') + '</script>';
        if (kind === 'language-rules') return Object.values(pack['speech-patterns'].customRules || {}).filter(r=>r.implementation).map(r=>'<script src="'+escape(r.implementation)+'"></script>').join('\n');
        if (kind === 'options') return pack.associations.selects[id].map(o=>'<option value="'+escape(o.value)+'" data-language-id="'+o.elementId+'"'+['selected','disabled','hidden'].filter(k=>o[k]).map(k=>' '+k).join('')+'>'+text(o.textId)+'</option>').join('');
        const association = pack.associations.elements[id];
        if (kind === 'text') return text(association?.texts[slot] || association?.attributes[slot]);
        const result = {}, pattern = pack['speech-patterns'].patterns[association.patternId];
        if (pattern) Object.assign(result, {'data-speech-pattern-id':pattern.id,'speech-pattern':pattern.pattern,...(pattern.noun ? {'speech-noun':pattern.noun} : {})});
        const rule = pack['speech-patterns'].preprocessors[association.preprocessorId];
        if (rule) {
            result['data-speech-preproc-id'] = rule.id;
            for (const [key,name] of [['handler','speech-preproc'],['context','speech-preproc-context'],['field','speech-preproc-field']]) if (rule[key]) result[name] = rule[key];
        }
        return attrs(result);
    }).trimEnd() + '\n';
}
function build(root) {
    for (const name of pages) fs.writeFileSync(path.join(root,name+'.html'),render(root,fs.readFileSync(path.join(root,'templates',name+'.html'),'utf8')));
}
module.exports = {compose, render, build, pages};
if (require.main === module) {build(path.resolve(process.argv[2] || path.join(__dirname,'..')));console.log('Built landing, Order Filler and Drop-In from shared templates');}
