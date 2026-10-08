(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const stream = new WMOFLiveTripStream({baseUrl: new URL('./', document.baseURI)});
    const view = new WMOFDropInView({root:$('liveStreamDialog'),stream,text:WMOFDropInText});
    const identities = new Map();
    const context = WMOFIdentityContext;
    let user, busy = false, messageBusy = false, revision = 0;
    const permission = mask => Boolean(Number(user?.permissions) & (mask | 4));
    const name = identity => identity?.preferredName || [identity?.firstName,identity?.lastName].filter(Boolean).join(' ') || identity?.username || '—';
    const text = id => WMOFLanguagePack.text(id);
    const status = message => { $('liveStreamViewerStatus').textContent = message; };
    function controls() {
        const identity = context.current;
        $('liveStreamWatchedName').textContent = name(identity);
        $('liveStreamWatchButton').disabled = busy || !permission(64) || !identity || Number(identity.userId) === Number(user?.id);
        $('liveStreamWatchButton').textContent = text(stream.viewing ? 'd82579ae-0ee3-593a-9a3d-6208756e8ae3' : '07ebf99a-22d4-507f-a4b0-7f01bb41ec96');
        $('liveStreamLookupButton').disabled = busy || !permission(128);
        $('liveStreamVolumeControls').disabled = !stream.viewing;
        $('liveStreamTrainerMessage').disabled = busy || !stream.viewing;
        $('liveStreamTrainerMessageSend').disabled = busy || messageBusy || !stream.viewing;
        $('liveStreamUserSelect').replaceChildren();
        for (const identity of identities.values()) {
            const option = document.createElement('option'); option.value = identity.userId; option.textContent = name(identity);
            $('liveStreamUserSelect').append(option);
        }
        $('liveStreamUserSelect').value = identity?.userId || '';
        $('liveStreamUserSelect').disabled = busy || !identities.size;
        $('liveStreamPreviousUser').disabled = $('liveStreamNextUser').disabled = busy || identities.size < 2;
    }
    async function select(identity, watch = stream.viewing) {
        if (busy || !identity || Number(identity.userId) === Number(user?.id)) return;
        busy = true; const request = ++revision; controls();
        try {
            await stream.stopViewing();
            view.clear(); $('liveStreamRemoteSpeech').textContent = '—';
            $('liveStreamTrainerMessageText').value = ''; $('liveStreamTrainerMessageStatus').textContent = '';
            identities.set(Number(identity.userId), identity);
            context.select(identity); view.setUser(Number(identity.userId)); controls();
            if (watch) await stream.startViewing(identity.userId);
            if (request === revision) status(stream.viewing ? text('5f0f4c0d-61e8-5fae-8051-67b7285bfcaa') : text('bafe351c-ceef-5648-9536-fcf9da113818'));
        } catch (error) { if (request === revision) status(error.message); }
        finally { if (request === revision) {busy = false; controls();} }
    }
    const lookup = new WMOFUserLookup({baseUrl:new URL('./',document.baseURI),identityContext:context,
        canLookup:()=>permission(128),canViewLive:()=>permission(64),currentUserId:()=>user?.id,
        onLiveStream:identity => { $('userLookupDialog').close(); void select(identity, true); }});
    lookup.setMode('lookup');
    $('liveStreamLookupButton').addEventListener('click', () => {lookup.setMode('lookup');lookup.sync();$('userLookupDialog').showModal();});
    for (const button of $('userLookupDialog').querySelectorAll('.dialog-close')) button.addEventListener('click', () => $('userLookupDialog').close());
    // Copy/select in Account Lookup can choose an identity without starting a connection.
    $('userLookupDialog').addEventListener('close', () => {
        const identity = context.current;
        if (!busy && identity && Number(identity.userId) !== view.userId) void select(identity,false);
    });
    $('liveStreamWatchButton').addEventListener('click', async () => {
        void globalThis.WMOFAudio?.unlock?.();
        if (stream.viewing) {
            busy = true; controls();
            try {await stream.stopViewing();view.clear();status(text('bafe351c-ceef-5648-9536-fcf9da113818'));}
            catch(error) {status(error.message);}
            finally {busy=false;controls();}
        } else await select(context.current,true);
    });
    $('liveStreamUserSelect').addEventListener('change', event => void select(identities.get(Number(event.target.value))));
    for (const [id, step] of [['liveStreamPreviousUser',-1],['liveStreamNextUser',1]]) $(id).addEventListener('click',()=>{
        const ids = [...identities.keys()]; const index = ids.indexOf(Number(context.current?.userId));
        if(ids.length > 1) void select(identities.get(ids[(index+step+ids.length)%ids.length]));
    });
    stream.addEventListener('snapshot', event => {
        const snapshot = event.detail?.snapshot;
        if (stream.viewing && Number(event.detail.targetUserId) === Number(view.userId) && Number(snapshot?.userId) === Number(view.userId)) view.update(snapshot);
    });
    stream.addEventListener('viewerChanged', event => {
        controls();
        if (!stream.viewing) {view.clear();$('liveStreamRemoteSpeech').textContent='—';}
        if (!busy) status(stream.viewing ? String(event.detail.state || '') : text('bafe351c-ceef-5648-9536-fcf9da113818'));
    });
    stream.addEventListener('message', event => {
        const detail=event.detail;
        if (Number(detail.targetUserId) !== Number(view.userId)) return;
        if (detail.type === 'speech.command') $('liveStreamRemoteSpeech').textContent = detail.payload?.canonicalTranscript || detail.payload?.transcript || '—';
    });
    stream.addEventListener('error', event => status(event.detail?.error?.message || WMOFDropInText('failed')));
    $('liveStreamMute').addEventListener('change', event => stream.setViewerMuted(event.target.checked));
    for(const [id,setter,output] of [
        ['liveStreamMasterVolume','setViewerMasterVolume','liveStreamMasterVolumeValue'],
        ['liveStreamMicVolume','setViewerMicrophoneVolume','liveStreamMicVolumeValue'],
        ['liveStreamProgramVolume','setViewerProgramVolume','liveStreamProgramVolumeValue']
    ]) $(id).addEventListener('input', event => {stream[setter](Number(event.target.value)/100);$(output).value=event.target.value+'%';});
    async function sendMessage() {
        const value = $('liveStreamTrainerMessageText').value.trim().slice(0,500);
        if(busy || messageBusy || !stream.viewing || !value) return;
        const target=Number(view.userId);messageBusy=true;controls();
        try {
            await stream.sendToPublisher('trainer.tts',{text:value});
            if(target === Number(view.userId)) {$('liveStreamTrainerMessageText').value='';$('liveStreamTrainerMessageStatus').textContent=text('ffdd5c41-57e5-59b3-ae39-4004ccc270a0');}
        } catch(error) {if(target === Number(view.userId)) $('liveStreamTrainerMessageStatus').textContent=error.message;}
        finally {messageBusy=false;controls();}
    }
    $('liveStreamTrainerMessageSend').addEventListener('click',()=>void sendMessage());
    $('liveStreamTrainerMessageText').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();void sendMessage();}});
    window.addEventListener('pagehide',()=>{revision++;void stream.close();});
    controls();
    fetch(new URL('api/users/',document.baseURI),{credentials:'same-origin',cache:'no-store'}).then(async response=>{
        if(!response.ok) throw new Error(response.status===401 ? text('07dba185-8a12-583b-bc6c-c900ac30541d') : WMOFDropInText('failed'));
        user=(await response.json()).user;
        $('dropInPageStatus').textContent=permission(64) ? '' : text('07dba185-8a12-583b-bc6c-c900ac30541d');
        lookup.sync();controls();
        const target = new URL(document.URL).searchParams.get('userId');
        if (permission(64) && permission(128) && /^[1-9]\d*$/.test(target || '')) {
            const url = new URL('api/admin/user-lookup/',document.baseURI); url.searchParams.set('id',target);
            const result = await fetch(url,{credentials:'same-origin',cache:'no-store'});
            const data = await result.json();
            if(!result.ok) throw new Error(data.message || WMOFDropInText('failed'));
            const identity = data.identities?.find(identity=>Number(identity.userId) === Number(target));
            if(identity) await select(identity,false);
        }
    }).catch(error=>{$('dropInPageStatus').textContent=error.message;controls();});
})();
