(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const stream = new WMOFLiveTripStream({baseUrl: new URL('./', document.baseURI)});
    const view = new WMOFDropInView({root:$('liveStreamDialog'),stream,text:WMOFDropInText});
    const identities = new Map();
    const context = WMOFIdentityContext;
    let user, csrf, exiting=false, busy = false, messageBusy = false, revision = 0, settingsRevision=0;
    const preferences = new WMOFDropInPreferences();
    let pendingSettings;
    const permission = mask => Boolean(Number(user?.permissions) & (mask | 4));
    const name = identity => identity?.preferredName || [identity?.firstName,identity?.lastName].filter(Boolean).join(' ') || identity?.username || '—';
    const text = id => WMOFLanguagePack.text(id);
    const status = message => { $('liveStreamViewerStatus').textContent = message; };
    const mirrorView=()=>({mode:'user',start:'',end:'',percent:'',percentScope:null,sync:'user',timeDisplay:'user'});
    const viewFields={liveStreamViewMode:'mode',liveStreamViewStart:'start',liveStreamViewEnd:'end',liveStreamViewPercent:'percent',liveStreamViewSync:'sync',liveStreamViewTime:'timeDisplay'};
    const audioFields={liveStreamMasterVolume:['master','setViewerMasterVolume','liveStreamMasterVolumeValue'],liveStreamMicVolume:['microphone','setViewerMicrophoneVolume','liveStreamMicVolumeValue'],liveStreamProgramVolume:['program','setViewerProgramVolume','liveStreamProgramVolumeValue']};
    function renderSettings(record=preferences.get(view.userId)) {
        $('dropInMirrorSettings').checked=record.mirror;
        const values=record.mirror ? mirrorView() : record.custom.view;
        if(view.applyPreference)view.applyPreference(values);
        else {for(const [id,key] of Object.entries(viewFields))$(id).value=values[key] || '';view.percentScope=values.percentScope;view.select?.();}
        $('liveStreamMute').checked=record.custom.audio.muted;stream.setViewerMuted?.(record.custom.audio.muted);
        for(const [id,[key,setter,output]] of Object.entries(audioFields)){$(id).value=record.custom.audio[key];$(output).value=record.custom.audio[key]+'%';stream[setter]?.(record.custom.audio[key]/100);}
        updateModeButton();
    }
    function updateModeButton() {
        const mode=$('liveStreamViewMode');$('dropInModeButton').textContent=mode.value==='user'
            ? (view.snapshot?.viewData?.mode==='total' ? mode.querySelector('option[value="'+view.snapshot.viewData.range+'"]')?.textContent : mode.querySelector('option[value="'+(view.snapshot?.viewData?.mode||'trip')+'"]')?.textContent) || mode.selectedOptions[0]?.textContent
            : mode.selectedOptions[0]?.textContent;
    }
    async function commitSettings(patch,targets) {
        const target=Number(view.userId),request=++settingsRevision;
        try {await preferences.apply(targets,patch);if(request===settingsRevision&&target===Number(view.userId)){renderSettings();$('dropInSettingsStatus').textContent=text('d4917f10-f0e0-5eea-9908-82b0d2acb72c');}}
        catch {if(request===settingsRevision&&target===Number(view.userId)){renderSettings();$('dropInSettingsStatus').textContent=text('0272ce50-1b2e-5e54-8447-91af78590f38');}}
    }
    function changeSettings(patch) {
        if(!view.userId||exiting)return;
        const current=preferences.get(view.userId),next=structuredClone(current);
        if(patch.view)Object.assign(next.custom.view,patch.view);
        if(patch.audio)Object.assign(next.custom.audio,patch.audio);
        if(patch.custom)next.custom=structuredClone(patch.custom);
        if(patch.mirror!==undefined)next.mirror=patch.mirror;
        renderSettings(next);
        if(identities.size>1){pendingSettings={target:Number(view.userId),patch};$('dropInApplyDialog').showModal();}
        else void commitSettings(patch,[view.userId]);
    }
    for(const [id,key] of Object.entries(viewFields))$(id).addEventListener('change',()=>{
        if(!$(id).checkValidity())return;
        const patch={view:{[key]:$(id).value},mirror:false};
        if(key==='percent'){patch.view.percentScope=view.percentScope||view.localScope||'trip';if(patch.view.percentScope==='trip')patch.view.sync='off';}
        changeSettings(patch);
    });
    $('dropInMirrorSettings').addEventListener('change',event=>changeSettings({mirror:event.target.checked}));
    $('liveStreamMute').addEventListener('change',event=>changeSettings({audio:{muted:event.target.checked}}));
    for(const [id,[key]] of Object.entries(audioFields))$(id).addEventListener('change',event=>changeSettings({audio:{[key]:Number(event.target.value)}}));
    for(const [id,all] of [['dropInApplySelected',false],['dropInApplyAll',true]])$(id).addEventListener('click',()=>{
        const pending=pendingSettings;pendingSettings=undefined;$('dropInApplyDialog').close();
        if(pending)void commitSettings(pending.patch,all?[...identities.keys()]:[pending.target]);
    });
    function cancelSettings(){pendingSettings=undefined;renderSettings();}
    $('dropInApplyCancel').addEventListener('click',()=>{$('dropInApplyDialog').close();cancelSettings();});
    $('dropInApplyDialog').addEventListener('cancel',cancelSettings);
    $('dropInSaveDefault').addEventListener('click',async()=>{
        const current=preferences.get(view.userId).custom;
        try {await preferences.saveDefault(current);$('dropInDefaultStatus').textContent=text('d4917f10-f0e0-5eea-9908-82b0d2acb72c');}
        catch {$('dropInDefaultStatus').textContent=text('0272ce50-1b2e-5e54-8447-91af78590f38');}
    });
    $('dropInRestoreDefault').addEventListener('click',()=>changeSettings({custom:preferences.defaults,mirror:false}));
    $('liveStreamResetPercent').addEventListener('click',()=>changeSettings({mirror:true}));
    globalThis.WMOFModeMenu?.bind($('dropInModeButton'),{getValue:()=>$('liveStreamViewMode').value,
        getDates:()=>({start:$('liveStreamViewStart').value,end:$('liveStreamViewEnd').value}),
        onSelect:(value,dates)=>{changeSettings({view:{mode:value,...dates},mirror:false});}});
    $('liveStreamDialog').addEventListener('drop-in-mode-changed',updateModeButton);
    function controls() {
        const identity = context.current;
        $('liveStreamWatchedName').textContent = name(identity);
        $('liveStreamWatchButton').disabled = busy || !permission(64) || !identity || Number(identity.userId) === Number(user?.id);
        $('liveStreamWatchButton').textContent = text(stream.viewing ? 'd82579ae-0ee3-593a-9a3d-6208756e8ae3' : '07ebf99a-22d4-507f-a4b0-7f01bb41ec96');
        $('liveStreamLookupButton').disabled = busy || !permission(128);
        $('liveStreamVolumeControls').disabled = busy || !identity;
        $('dropInMirrorSettings').disabled = busy || !identity;
        $('dropInRemoveUser').disabled = busy || !identity;
        $('dropInTripLogButton').disabled = busy || !stream.viewing;
        $('dropInSelectUser').disabled = busy || !identities.size;
        $('dropInSaveDefault').disabled = $('dropInRestoreDefault').disabled = busy || !identity;
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
        if (exiting || busy || !identity || Number(identity.userId) === Number(user?.id)) return;
        busy = true; const request = ++revision; settingsRevision++; controls();
        try {
            await stream.stopViewing();
            view.clear(); $('liveStreamRemoteSpeech').textContent = '—';
            $('liveStreamTrainerMessageText').value = ''; $('liveStreamTrainerMessageStatus').textContent = '';
            identities.set(Number(identity.userId), identity);
            context.select(identity); view.setUser(Number(identity.userId)); renderSettings(); controls();
            if (watch && request === revision && !exiting) await stream.startViewing(identity.userId);
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
        if (!busy && identity && Number(identity.userId) !== view.userId) void select(identity,true);
    });
    $('dropInRemoveUser').addEventListener('click',async()=>{
        if(busy||!view.userId)return;const wasViewing=stream.viewing,removed=Number(view.userId);
        busy=true;revision++;controls();
        try {await stream.stopViewing();view.clear();identities.delete(removed);context.clear();view.userId=null;}
        catch(error){status(error.message);}
        finally{busy=false;controls();}
        const next=identities.values().next().value;if(next)await select(next,wasViewing);
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
        if (stream.viewing && Number(event.detail.targetUserId) === Number(view.userId) && Number(snapshot?.userId) === Number(view.userId)) {view.update(snapshot);updateModeButton();}
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
    let logOffset=0,logRevision=0;
    async function loadTripLog() {
        const target=Number(view.userId),request=++logRevision;
        $('dropInTripLogName').textContent=name(context.current);$('dropInTripLogRows').replaceChildren();
        $('dropInTripLogStatus').textContent=WMOFDropInText('loading');
        $('dropInTripLogPrevious').disabled=$('dropInTripLogNext').disabled=true;
        try {
            const snapshot=view.snapshot;if(!snapshot)throw new Error(WMOFDropInText('unavailable'));
            const calendar=new CalendarRange({databaseOnly:true});calendar.setDatabaseRecords(snapshot.viewData.calendars);
            const mode=$('liveStreamViewMode').value;
            const range=['trip','auto','user'].includes(mode)?snapshot.viewData.range||'week':mode;
            const dates=mode==='user' ? snapshot.viewData.customDates : {start:$('liveStreamViewStart').value,end:$('liveStreamViewEnd').value};
            const window=range==='custom'?CalendarRange.custom(dates?.start,dates?.end,calendar.getTimezone()):await calendar.resolve({range,at:snapshot.timestamp});
            const data=await stream.fetchViewerTrips(CalendarRange.tripWindow(window),{offset:logOffset,limit:25});
            if(request!==logRevision||target!==Number(view.userId)||!stream.viewing)return;
            for(const trip of data.trips){const row=document.createElement('tr');for(const value of [trip.startTime,trip.endTime||'-',view.duration(trip.standardTimeMilliseconds),view.duration(trip.actualTimeMilliseconds)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}$('dropInTripLogRows').append(row);}
            $('dropInTripLogStatus').textContent=data.trips.length?'':text('5e494ddd-bd9b-531b-b534-29e5b16a7afb');
            $('dropInTripLogPrevious').disabled=logOffset===0;$('dropInTripLogNext').disabled=data.trips.length<25;
        }catch(error){if(request===logRevision&&target===Number(view.userId))$('dropInTripLogStatus').textContent=error.message;}
    }
    $('dropInTripLogButton').addEventListener('click',()=>{logOffset=0;$('dropInTripLogDialog').showModal();void loadTripLog();});
    $('dropInTripLogPrevious').addEventListener('click',()=>{logOffset=Math.max(0,logOffset-25);void loadTripLog();});
    $('dropInTripLogNext').addEventListener('click',()=>{logOffset+=25;void loadTripLog();});
    $('dropInTripLogCancel').addEventListener('click',()=>{$('dropInTripLogDialog').close();logRevision++;});
    async function leave(logout) {
        if(exiting)return;exiting=true;revision++;logRevision++;$('dropInExitButton').disabled=$('dropInLogoutButton').disabled=true;
        globalThis.WMOFAudio?.stopAll?.();
        try {
            if(logout){await stream.stopViewing();const response=await fetch(new URL('api/users/',document.baseURI),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf||''},body:JSON.stringify({action:'disconnect'})});if(!response.ok){const data=await response.json();throw new Error(data.message || WMOFDropInText('failed'));}}
            await Promise.all([stream.close(),preferences.queue]);view.destroy?.();location.assign(new URL('index.php',document.baseURI));
        } catch(error){exiting=false;status(error.message);$('dropInExitButton').disabled=$('dropInLogoutButton').disabled=false;controls();}
    }
    $('dropInExitButton').addEventListener('click',()=>void leave(false));
    $('dropInLogoutButton').addEventListener('click',()=>void leave(true));
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
    window.addEventListener('pagehide',()=>{exiting=true;revision++;view.destroy?.();void stream.close();});
    controls();
    fetch(new URL('api/users/',document.baseURI),{credentials:'same-origin',cache:'no-store'}).then(async response=>{
        if(!response.ok) throw new Error(response.status===401 ? text('07dba185-8a12-583b-bc6c-c900ac30541d') : WMOFDropInText('failed'));
        const session=await response.json();user=session.user;csrf=session.csrfToken;
        try {await preferences.load(user.id);}catch {$('dropInSettingsStatus').textContent=text('0272ce50-1b2e-5e54-8447-91af78590f38');}
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
