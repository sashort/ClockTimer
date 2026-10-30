(() => {
    'use strict';
    const sessions = new Map();
    const pressed = new Map();
    const transients = new Set();
    const report = error => console.warn('Window audio unavailable', error);
    function stop(session) {
        session.controller.abort();
        for (const handle of session.handles) handle?.stop?.();
        session.handles.clear();
    }
    async function phase(session, definition, sustained = false) {
        if (!definition || session.controller.signal.aborted) return;
        const audio = globalThis.WMOFAudio;
        let handle;
        if (definition.cue) {
            handle = await audio.playSound(definition.cue, {useSelectedInstrument:false,
                loop:sustained, signal:session.controller.signal});
        } else if (definition.instrument) {
            const registry = await WMOFSoundCatalog.json('api/audio/instruments/interactions.json');
            const instrument = registry.instruments[definition.instrument];
            if (!instrument || instrument.kind !== 'frequencies') throw Error('Unknown window instrument: '+definition.instrument);
            if (session.controller.signal.aborted) return;
            handle = await audio.startFrequencies(instrument.frequencies, {...instrument,signal:session.controller.signal});
        } else throw Error('Window sound must reference a cue or instrument');
        if (session.controller.signal.aborted) {handle?.stop?.();return;}
        if (handle) session.handles.add(handle);
        if (!sustained) {
            const result=await handle?.finished;
            session.handles.delete(handle);
            if(result?.reason==='stopped'||result?.reason==='error')stop(session);
        }
    }
    async function open(id) {
        if (!id || sessions.get(id)?.open) return;
        const previous = sessions.get(id);if(previous)stop(previous);
        const session = {open:true,controller:new AbortController(),handles:new Set()};
        sessions.set(id,session);
        try {
            const config = await WMOFSoundCatalog.json('api/audio/themes/'+WMOFSoundCatalog.theme()+'/windows.json');
            if(session.controller.signal.aborted)return;
            session.definition=config.windows?.[id];
            await phase(session,session.definition?.opening);
            await phase(session,session.definition?.sustained,true);
        } catch(error) {if(!session.controller.signal.aborted)report(error);}
    }
    async function close(id, {silent=false}={}) {
        for(const session of [...pressed.values(),...transients])if(session.windowId===id)stop(session);
        const session=sessions.get(id);if(!session?.open)return;
        stop(session);session.open=false;
        const closing={open:false,controller:new AbortController(),handles:new Set()};
        sessions.set(id,closing);
        if(!silent)try{await phase(closing,session.definition?.closing);}catch(error){report(error);}
        if(sessions.get(id)===closing)sessions.delete(id);
    }
    function cancelAll(){for(const session of sessions.values())stop(session);sessions.clear();for(const session of [...pressed.values(),...transients])stop(session);pressed.clear();transients.clear();}
    async function control(event, name) {
        const button=event.target?.closest?.('button, [role="button"], [data-audio-control]');
        if(!button || button.disabled || button.getAttribute('aria-disabled')==='true')return;
        const windowElement=button.closest('dialog, [data-audio-window]');
        const windowId=windowElement?.dataset.audioWindow || windowElement?.id || 'main';
        const id=button.dataset.audioControl || button.id || button.dataset.action;
        if(!id)return;
        const theme=WMOFSoundCatalog.theme();
        const config=await WMOFSoundCatalog.json('api/audio/themes/'+theme+'/windows.json');
        if(theme!==WMOFSoundCatalog.theme())return;
        const definition=config.windows?.[windowId]?.controls?.buttons?.[id]?.[name];
        if(!definition)return;
        // A pointer released while configuration loads must not start a late held voice.
        if(name==='press' && definition.hold && !pressed.has(event.pointerId))return;
        const session=definition.hold ? pressed.get(event.pointerId) :
            {controller:new AbortController(),handles:new Set()};
        if(!session)return;
        session.windowId=windowId;
        if(!definition.hold)transients.add(session);
        try {await phase(session,definition,!!definition.hold);}catch(error){if(!session.controller.signal.aborted)report(error);}
        finally {if(!definition.hold)transients.delete(session);}
    }
    document.addEventListener('pointerdown',event=>{
        const prior=pressed.get(event.pointerId);if(prior)stop(prior);
        pressed.set(event.pointerId,{controller:new AbortController(),handles:new Set()});
        void control(event,'press').catch(report);
    },true);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,event=>{
        const session=pressed.get(event.pointerId);if(session)stop(session);pressed.delete(event.pointerId);
        if(type==='pointerup')void control(event,'release').catch(report);
    },true);
    document.addEventListener('click',event=>{void control(event,'click').catch(report);},true);
    globalThis.addEventListener?.('wmof-seasonal-theme-change',()=>{
        const visible=[...sessions].filter(([,s])=>s.open).map(([id])=>id);
        cancelAll();for(const id of visible)void open(id);
    });
    globalThis.addEventListener?.('pagehide',cancelAll);
    globalThis.WMOFWindowAudio=Object.freeze({open,close,cancelAll});
})();
