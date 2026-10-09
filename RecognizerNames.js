(() => {
    'use strict';
    const key='wmof-recognizer-names-v1';
    const locale=()=>globalThis.WMOFLanguagePack?.locale || 'en-US';
    const defaults=()=>globalThis.WMOFLanguagePack?.resources?.['speech-patterns']?.recognizerNames || {presets:[],default:''};
    let saved={};
    const loaded=globalThis.WMOFPersistence?.getItem(key).then(value=>{
        if(value){try{saved=JSON.parse(value)||{};}catch{saved={};}}
    }).catch(()=>{});
    const normalize=value=>String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ');
    const name=()=>saved[locale()]?.name ?? defaults().default;
    function split(transcript) {
        const value=name(); if(!value) return null;
        const escaped=value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
        const regex=new RegExp('(^|[^\\p{L}\\p{N}])('+escaped+')(?=$|[^\\p{L}\\p{N}])','giu');
        const last=regex.exec(transcript);
        if(!last) return null;
        return {name:value,before:transcript.slice(0,last.index).trim(),after:transcript.slice(last.index+last[0].length).replace(/^[\s,.:;!?-]+/u,'').trim()};
    }
    async function save(value) {
        await loaded;
        value=normalize(value);
        if(value && (value.length>40 || !/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(value))) throw new TypeError('Invalid recognizer name');
        const previous=saved;saved={...saved,[locale()]:{name:value}};
        globalThis.SpeechMenu?.refresh();
        try {await globalThis.WMOFPersistence.setItem(key,JSON.stringify(saved));}
        catch(error){saved=previous;globalThis.SpeechMenu?.refresh();throw error;}
        return value;
    }
    function render() {
        const preset=document.getElementById('recognizerNamePreset'),custom=document.getElementById('recognizerNameCustom');if(!preset||!custom)return;
        const off=preset.querySelector('option[value=""]'),customOption=preset.querySelector('option[value="custom"]');preset.replaceChildren(off);
        for(const value of defaults().presets){const o=document.createElement('option');o.value=value;o.textContent=value;preset.append(o);}
        preset.append(customOption);
        preset.value=defaults().presets.includes(name())?name():name()?'custom':'';
        custom.value=name();custom.hidden=preset.value!=='custom';
    }
    function bind() {
        render();const preset=document.getElementById('recognizerNamePreset'),custom=document.getElementById('recognizerNameCustom'),button=document.getElementById('recognizerNameSave'),status=document.getElementById('recognizerNameStatus');
        preset?.addEventListener('change',()=>{custom.hidden=preset.value!=='custom';if(!custom.hidden)custom.focus();});
        button?.addEventListener('click',async()=>{button.disabled=true;try{await save(preset.value==='custom'?custom.value:preset.value);status.textContent=globalThis.WMOFLanguagePack.text('af3d50cd-7878-5c14-b6ca-fb4f881852de');}catch{render();status.textContent=globalThis.WMOFLanguagePack.text('cbad6bab-3510-5942-a01e-c5495c77d65e');}finally{button.disabled=false;}});
    }
    globalThis.WMOFRecognizerNames={get name(){return name();},split,save,normalize};
    globalThis.WMOFAccountSettings?.addEventListener('loaded',()=>{try{saved=JSON.parse(globalThis.WMOFAccountSettings.peek('speech',key)||'{}');}catch{saved={};}render();globalThis.SpeechMenu?.refresh();});
    globalThis.WMOFAccountSettings?.addEventListener('cleared',()=>{saved={};render();globalThis.SpeechMenu?.refresh();});
    loaded?.then(()=>{render();globalThis.SpeechMenu?.refresh();});
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
