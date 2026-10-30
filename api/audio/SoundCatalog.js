(() => {
    'use strict';
    const revision = document.currentScript?.src?.match(/[?&]build=([^&#]+)/)?.[1];
    const versioned = url => url + (revision ? '?build=' + revision : '');
    const pending = new Map();
    const events = new Map();
    const templates = new Map();
    const theme = () => globalThis.WMOFSeasonalTheme?.active ? 'halloween' : 'default';
    function json(url) {
        if (!pending.has(url)) pending.set(url, fetch(versioned(url), {signal:globalThis.AbortSignal?.timeout?.(8000)}).then(r => {
            if (!r.ok) throw Error('Sound catalog unavailable: ' + url);
            return r.json();
        }).catch(error => { pending.delete(url); throw error; }));
        return pending.get(url);
    }
    async function resolve(name, options, output) {
        const selectedTheme = theme();
        const index = await json('api/audio/themes/' + selectedTheme + '/catalog.json');
        const authored = await json(index.profiles.authored);
        let sound = authored.sounds[name];
        const profile = options.useSelectedInstrument === false ? '' : output.instrument;
        if (profile && index.profiles[profile]) {
            const custom = await json(index.profiles[profile]);
            sound = custom.sounds[name] || sound;
        }
        if (!sound) throw Error('Unknown catalog sound: ' + name);
        const speed = Number(options.toneVelocity ?? output.toneVelocity ?? 1);
        const rate = index.rates.reduce((a,b) => Math.abs(b-speed)<Math.abs(a-speed)?b:a);
        const clip=sound.rates[rate];
        const effectiveSpeed=clip.existing?1:rate;
        const speechStartSeconds=Number.isFinite(sound.speechStartBeat)
            ? sound.speechStartBeat*60/sound.bpm/effectiveSpeed : sound.speechStartSeconds;
        return { ...sound, speechStartSeconds, clip, speed:effectiveSpeed, theme:selectedTheme };
    }
    async function prepareEvents() {
        await Promise.all(['default','halloween'].map(async name => {
            const config=await json('api/audio/themes/'+name+'/events.json');
            events.set(name,config.events||{});
            templates.set(name,config.templates||{});
        }));
    }
    function eventSound(id) {
        const entry=events.get(theme())?.[id];
        return entry && Object.hasOwn(entry,'sound') ? entry.sound : undefined;
    }
    function eventSpeechStart(id) { return events.get(theme())?.[id]?.speechStart; }
    function eventSpeechTemplate(id, phase) {
        const key=events.get(theme())?.[id]?.speech?.[phase];
        if(key!==undefined && (typeof key!=='string' || !/^(announcements|messages)\.[\w.-]+$/.test(key)))
            throw Error('Event speech must reference a language template key');
        return key;
    }
    function eventSpeech(id, phase, values) {
        const key=eventSpeechTemplate(id,phase);
        return key===undefined ? undefined : globalThis.WMOFAnnouncementLanguage.text(key,values);
    }
    function speech(path,values) {
        const match=/^announcements\.([^.]+)\.(.+)$/.exec(path);
        const configured=match?eventSpeechTemplate(match[1],match[2]):undefined;
        const reference=configured ?? templates.get(theme())?.[path] ?? templates.get('default')?.[path] ?? path;
        return globalThis.WMOFAnnouncementLanguage.text(reference,values);
    }
    globalThis.WMOFSoundCatalog = Object.freeze({resolve, theme, json, versioned, prepareEvents, eventSound, eventSpeechStart, eventSpeechTemplate, eventSpeech, speech});
})();
