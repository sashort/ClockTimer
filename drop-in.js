(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const stream = new WMOFLiveTripStream({baseUrl: new URL('./', document.baseURI)});
    const view = new WMOFDropInView({root:$('liveStreamDialog'),stream,text:WMOFDropInText});
    const identities = new Map();
    const context = WMOFIdentityContext;
    let user, csrf, exiting=false, busy = false, messageBusy = false, revision = 0, settingsRevision=0;
    const preferences = new WMOFDropInPreferences();
    function currentSettings(){const record=preferences.get(view.userId);if(!view.userId){record.settingsSource='default';record.mirror=false;}return record;}
    let pendingSettings,pendingViewChange,modeMenu,timeMenu,goalPad;
    const permission = mask => Boolean(Number(user?.permissions) & (mask | 4));
    const name = identity => identity?.preferredName || [identity?.firstName,identity?.lastName].filter(Boolean).join(' ') || identity?.username || '—';
    const text = id => WMOFLanguagePack.text(id);
    const status = message => { $('liveStreamViewerStatus').textContent = message; };
    const mirrorView=()=>({mode:'user',start:'',end:'',percent:'',percentScope:null,sync:'user',timeDisplay:'user'});
    const viewFields={liveStreamViewMode:'mode',liveStreamViewStart:'start',liveStreamViewEnd:'end',liveStreamViewPercent:'percent',liveStreamViewSync:'sync',liveStreamViewTime:'timeDisplay'};
    const audioFields={liveStreamMasterVolume:['master','setViewerMasterVolume','liveStreamMasterVolumeValue'],liveStreamMicVolume:['microphone','setViewerMicrophoneVolume','liveStreamMicVolumeValue'],liveStreamProgramVolume:['program','setViewerProgramVolume','liveStreamProgramVolumeValue']};
    function publisherValues(){const data=view.snapshot?.viewData,state=view.snapshot?.uiState;return {timeDisplay:data?.timeDisplay,mode:data?.mode==='total'?data.range:data?.mode,sync:typeof state?.sync_enabled==='boolean'?(state.sync_enabled?'on':'off'):undefined,tripGoal:goalNumber(state?.trip_goal_component),totalGoal:goalNumber(state?.total_goal_component)};}
    function goalNumber(component){if(typeof component?.value==='number'&&Number.isFinite(component.value)&&component.value>0)return String(Math.round(component.value*100));const match=String(component?.text||component||'').match(/^(\d+)\s*%$/);return match?.[1];}
    function valueLabel(field,value){if(value===undefined)return '-';if(field==='mode')return $('liveStreamViewMode').querySelector('option[value="'+value+'"]')?.textContent||'-';if(field==='timeDisplay')return $('liveStreamViewTime').querySelector('option[value="'+value+'"]')?.textContent||'-';if(field==='sync')return $('liveStreamViewSync').querySelector('option[value="'+value+'"]')?.textContent||'-';return WMOFLanguagePack.text('e3620451-3e1a-5638-b0e7-c608c808d5b7',{value0:value});}
    function optionDetails(field,value){const publisher=publisherValues(),record=currentSettings(),defaults=preferences.defaults.view;return {source:globalThis.WMOFObserverSettingBadge?.match(field,value,record,defaults,publisher),label:value==='user'||value==='mirror'?WMOFLanguagePack.text('c7e4b9b9-3df5-53d2-9314-f0b3eb6e8f9a',{value:valueLabel(field,publisher[field])}):undefined};}
    function refreshOptionDetails(){
        modeMenu?.refresh();timeMenu?.refresh();goalPad?.refresh();const menu=$('dropInSyncPopover');
        if(menu)for(const option of menu.querySelectorAll('[data-sync]')){const details=optionDetails('sync',option.dataset.sync);option.querySelector('.mode-option-label').textContent=details.label||WMOFLanguagePack.text(option.dataset.labelId);globalThis.WMOFObserverSettingBadge?.render(option,details.source);}
        for(const [id,field,value] of [['renderedTimeLabel','timeDisplay',$('liveStreamViewTime').value],['scopeToggle','mode',$('liveStreamViewMode').value],['toggleSyncMenuButton','sync',$('liveStreamViewSync').value],['goalPercentValue',view.localScope==='total'?'totalGoal':'tripGoal',goalNumber(view.displayState?.goal_component)]])globalThis.WMOFObserverSettingBadge?.render($(id),optionDetails(field,value).source);
        const timeLabel=$('renderedTimeLabel');
        timeLabel.querySelector('[data-menu-icon="mirror"]')?.remove();
        if($('liveStreamViewTime').value==='user'){const icon=document.createElement('span');icon.dataset.menuIcon='mirror';icon.setAttribute('aria-hidden','true');timeLabel.prepend(icon);}
        if(pendingViewChange){const field=['mode','tripGoal','totalGoal','sync','percent','timeDisplay'].find(key=>key in pendingViewChange.view),value=pendingViewChange.view[field];if(value==='user'||value==='mirror')$('dropInTargetChoice').textContent=optionDetails(field,value).label;}
    }
    function renderClockSettings(){
        const host=$('dropInClockSettings');if(!host)return;host.replaceChildren();
        const appearance=globalThis.WMOFTimerAppearance.capture($('liveStreamClockTimer'));
        if(!appearance){host.textContent=WMOFLanguagePack.text('677452f5-d049-54f5-89a0-7869610bd8e2');return;}
        const labels=globalThis.WMOFTimerAppearance.labels;
        const rows={...appearance.attributes};
        for(const [key,value] of Object.entries(appearance.variables||{}))rows[key.replace('--clock-timer-','')]=value;
        for(const [key,attribute] of Object.entries({'show-early-start':'render-early-start-as-trip','show-break-buffer':'hide-break-buffer','show-overtime':'hide-overtime','show-latency':'hide-latency','show-hour-hand':'hide-hour-hand','show-minute-hand':'hide-minute-hand','show-second-hand':'hide-second-hand'}))rows[key]=!Object.hasOwn(appearance.attributes||{},attribute);
        if(typeof appearance.showTolerance==='boolean')rows['show-tolerance']=appearance.showTolerance;
        for(const [key,id] of Object.entries(labels)){
            if(rows[key]===undefined)continue;
            const row=document.createElement('div');row.className='observer-clock-row';
            const label=document.createElement('span');label.textContent=WMOFLanguagePack.text(id);
            const output=document.createElement('output');output.textContent=typeof rows[key]==='boolean'?WMOFLanguagePack.text(rows[key]?'1c9519e8-3320-5a28-9c4a-18a545b065ca':'22a4fe99-d5e6-5ea4-b2df-32a8be5e9992'):rows[key];
            if(key.endsWith('-color')&&globalThis.CSS?.supports?.('color',rows[key])){const swatch=document.createElement('span');swatch.className='observer-clock-swatch';swatch.style.backgroundColor=rows[key];output.prepend(swatch);}
            row.append(label,output);host.append(row);
        }
    }
    function renderSettingSources(record=currentSettings()) {
        const owner=name(context.current),defaults=preferences.defaults;
        $('dropInSettingsOwner').textContent=WMOFLanguagePack.text('2e3c70a8-3be2-5ceb-b96f-a4e220368697',{name:owner});
        const applied=record.settingsSource==='user'?'userSource':record.settingsSource||'custom';
        $('dropInSettingsApplied').textContent=WMOFLanguagePack.text('43612666-0e7a-5976-9fc7-1ace27dbac32',{name:owner,source:WMOFLanguagePack.text(({userSource:'b65c84d6-1d0d-596b-8962-fdf409f04073',custom:'ce252857-8d0d-5d30-8bcf-0c072901bd18',default:'fc47056b-19eb-5cf0-ac45-9d865e75b708'})[applied])});
        for(const label of document.querySelectorAll('[data-settings-default]')) {
            const [group,field]=label.dataset.settingsDefault.split('.');let value=defaults[group][field];
            if(group==='audio')value=value+'%';
            else if(field==='mode')value=$('liveStreamViewMode').querySelector('option[value="'+value+'"]')?.textContent||'-';
            else if(field==='sync')value=$('liveStreamViewSync').querySelector('option[value="'+value+'"]')?.textContent||'-';
            else value=value ? value+'%' : $('liveStreamViewMode').querySelector('option[value="user"]').textContent;
            label.textContent=WMOFLanguagePack.text('def617d2-8298-57e9-a7d3-32251c5b24d2',{value});
        }
        for(const input of document.querySelectorAll('[data-default-audio]')){input.value=defaults.audio[input.dataset.defaultAudio];input.setAttribute('aria-label',WMOFLanguagePack.text('def617d2-8298-57e9-a7d3-32251c5b24d2',{value:input.closest('label').querySelector('span').textContent}));}
        for(const badge of document.querySelectorAll('[data-settings-source]')) {
            const [group,field]=badge.dataset.settingsSource.split('.');
            const config=record.settingsSource==='default'?defaults.view:record.custom.view;
            const mirrored=group==='view' && (record.mirror || config[field]==='user' || config[field]==='mirror');
            const isDefault=group==='view'&&record.settingsSource==='default'||record.sources?.[group]?.[field]==='default';
            badge.dataset.source=mirrored?'mirror':isDefault?'default':'custom';
            badge.textContent=WMOFLanguagePack.text(mirrored?'8f867772-6f69-59be-a743-6367c524de06':isDefault?'8266febd-cf14-562a-b18d-176c854ffe76':'7425da78-04f5-5e04-aaf1-57bc8a4875a9',{name:owner});
        }
        renderClockSettings();refreshOptionDetails();
    }
    function renderSettings(record=currentSettings()) {
        $('dropInSettingsSource').value=record.settingsSource;
        $('dropInMirrorSettings').checked=record.mirror;
        const values=record.settingsSource==='user' ? mirrorView() : record.settingsSource==='default' ? preferences.defaults.view : record.custom.view;
        if(view.applyPreference)view.applyPreference(values);
        else {for(const [id,key] of Object.entries(viewFields))$(id).value=values[key] || '';view.percentScope=values.percentScope;view.select?.();}
        $('liveStreamMute').checked=record.custom.audio.muted;stream.setViewerMuted?.(record.custom.audio.muted);
        for(const [id,[key,setter,output]] of Object.entries(audioFields)){$(id).value=record.custom.audio[key];$(output).value=record.custom.audio[key]+'%';stream[setter]?.(record.custom.audio[key]/100);}
        if(!view.userId){
            $('renderedTimeLabel').textContent=$('liveStreamViewTime').querySelector('option[value="'+(values.timeDisplay==='user'?'remaining':values.timeDisplay)+'"]')?.textContent||$('liveStreamViewTime').querySelector('option[value="remaining"]').textContent;
            const scope=['trip','user','auto'].includes(values.mode)?'trip':'total';view.localScope=scope;
            $('goalPercentValue').textContent=(values[scope==='total'?'totalGoal':'tripGoal']||100)+'%';
            const icon=$('toggleSyncMenuButton').querySelector('.sync-goals-menu-icon');
            icon.dataset.syncState=values.sync==='on'?'enabled':'disabled';icon.querySelector('.sync-mirror-badge').hidden=values.sync!=='user';
            $('toggleSyncMenuButton').dataset.syncMode=values.sync;$('toggleSyncMenuButton').setAttribute('aria-pressed',String(values.sync==='on'));
        }
        updateModeButton();renderSettingSources(record);
    }
    function updateModeButton() {
        const mode=$('liveStreamViewMode'),button=$('scopeToggle'),mirrored=mode.value==='user';
        const label=document.createElement('span');label.className='mode-button-label';label.textContent=mirrored && !view.userId ? text('b11c3a59-8432-515c-b361-acabaf1e7a88') : mirrored
            ? (view.snapshot?.viewData?.mode==='total' ? mode.querySelector('option[value="'+view.snapshot.viewData.range+'"]')?.textContent : mode.querySelector('option[value="'+(view.snapshot?.viewData?.mode||'trip')+'"]')?.textContent) || mode.selectedOptions[0]?.textContent
            : mode.querySelector('option[value="'+mode.value+'"]')?.textContent;
        button.replaceChildren(label);
        if(mirrored){const icon=document.createElement('span');icon.dataset.menuIcon='mirror';icon.setAttribute('aria-hidden','true');button.prepend(icon);}
    }
    async function commitSettings(patch,targets) {
        const target=Number(view.userId),request=++settingsRevision;
        try {await preferences.apply(targets,patch);if(request===settingsRevision&&target===Number(view.userId)){renderSettings();$('dropInSettingsStatus').textContent=text('d4917f10-f0e0-5eea-9908-82b0d2acb72c');}}
        catch {if(request===settingsRevision&&target===Number(view.userId)){renderSettings();$('dropInSettingsStatus').textContent=text('0272ce50-1b2e-5e54-8447-91af78590f38');}}
    }
    async function changeDefault(patch) {
        try {await preferences.updateDefault(patch);renderSettings();$('dropInDefaultStatus').textContent=text('d4917f10-f0e0-5eea-9908-82b0d2acb72c');}
        catch {renderSettingSources();$('dropInDefaultStatus').textContent=text('0272ce50-1b2e-5e54-8447-91af78590f38');}
    }
    for(const input of document.querySelectorAll('[data-default-audio]'))input.addEventListener('change',()=>void changeDefault({audio:{[input.dataset.defaultAudio]:Number(input.value)}}));
    function changeSettings(patch) {
        if(exiting||busy||!permission(64))return;
        const current=currentSettings(),next=structuredClone(current);
        if(patch.view){Object.assign(next.custom.view,patch.view);for(const key of Object.keys(patch.view))next.sources.view[key]=patch.view[key]==='user'||patch.view[key]==='mirror'?'mirror':'custom';}
        if(patch.audio){Object.assign(next.custom.audio,patch.audio);for(const key of Object.keys(patch.audio))next.sources.audio[key]='custom';}
        if(patch.defaultAudio){next.custom.audio=preferences.defaults.audio;for(const key of Object.keys(next.sources.audio))next.sources.audio[key]='default';}
        if(patch.custom)next.custom=structuredClone(patch.custom);
        if(patch.mirror!==undefined){next.mirror=patch.mirror;next.settingsSource=patch.mirror?'user':'custom';}
        if(patch.settingsSource){next.settingsSource=patch.settingsSource;next.mirror=patch.settingsSource==='user';}
        renderSettings(next);
        if(patch.view && Object.keys(patch.view).some(key=>['mode','sync','tripGoal','totalGoal','percent','timeDisplay'].includes(key))){
            pendingViewChange={target:view.userId?Number(view.userId):null,view:patch.view};
            const key=['mode','tripGoal','totalGoal','sync','percent','timeDisplay'].find(key=>key in patch.view),value=patch.view[key],mirrored=value==='user'||value==='mirror',choice=$('dropInTargetChoice');
            choice.classList.toggle('mirror-option',mirrored);
            if(mirrored){choice.dataset.menuIcon='mirror';choice.textContent=optionDetails(key,value).label;}
            else {delete choice.dataset.menuIcon;choice.textContent=key==='mode'?$('liveStreamViewMode').querySelector('option[value="'+value+'"]')?.textContent:key==='sync'?$('liveStreamViewSync').querySelector('option[value="'+value+'"]')?.textContent:key==='timeDisplay'?$('liveStreamViewTime').querySelector('option[value="'+value+'"]')?.textContent:value+'%';}
            $('dropInTargetDefault').checked=current.settingsSource==='default';$('dropInTargetUser').disabled=!view.userId;$('dropInTargetUser').checked=Boolean(view.userId)&&current.settingsSource!=='default';
            $('dropInTargetName').textContent=view.userId?name(context.current):'';$('dropInTargetApply').disabled=false;$('dropInTargetDialog').showModal();return;
        }
        if(!view.userId){if(patch.audio)void changeDefault({audio:patch.audio});return;}
        if(identities.size>1){pendingSettings={target:Number(view.userId),patch};$('dropInApplyDialog').showModal();}
        else void commitSettings(patch,[view.userId]);
    }
    for(const [id,key] of Object.entries(viewFields))$(id).addEventListener('change',()=>{
        if(!$(id).checkValidity())return;
        const patch={view:{[key]:$(id).value},mirror:false};
        if(key==='percent'){patch.view.percentScope=view.percentScope||view.localScope||'trip';if(patch.view.percentScope==='trip')patch.view.sync='off';}
        changeSettings(patch);
    });
    $('dropInSettingsSource').addEventListener('change',event=>changeSettings({settingsSource:event.target.value}));
    $('dropInMirrorSettings').addEventListener('change',event=>changeSettings({mirror:event.target.checked}));
    $('liveStreamMute').addEventListener('change',event=>changeSettings({audio:{muted:event.target.checked}}));
    for(const [id,[key]] of Object.entries(audioFields))$(id).addEventListener('change',event=>changeSettings({audio:{[key]:Number(event.target.value)}}));
    for(const [id,all] of [['dropInApplySelected',false],['dropInApplyAll',true]])$(id).addEventListener('click',()=>{
        const pending=pendingSettings;pendingSettings=undefined;$('dropInApplyDialog').close();
        if(pending)void commitSettings(pending.patch,all?[...identities.keys()]:[pending.target]);
    });
    function cancelViewChange(){pendingViewChange=undefined;$('dropInTargetDialog').close();renderSettings();}
    $('dropInTargetCancel').addEventListener('click',cancelViewChange);
    $('dropInTargetDialog').addEventListener('cancel',()=>{pendingViewChange=undefined;renderSettings();});
    for(const id of ['dropInTargetDefault','dropInTargetUser'])$(id).addEventListener('change',()=>{$('dropInTargetApply').disabled=!$('dropInTargetDefault').checked&&!$('dropInTargetUser').checked;});
    $('dropInTargetApply').addEventListener('click',async()=>{
        const pending=pendingViewChange,defaults=$('dropInTargetDefault').checked,selected=!$('dropInTargetUser').disabled&&$('dropInTargetUser').checked;
        if(!pending||(!defaults&&!selected))return;pendingViewChange=undefined;$('dropInTargetDialog').close();
        const request=++settingsRevision;
        const stillCurrent=()=>request===settingsRevision&&(view.userId?Number(view.userId):null)===pending.target;
        try {if(pending.target===null)await preferences.updateDefault({view:pending.view});else await preferences.applyViewTarget(pending.target,pending.view,{defaults,user:selected});if(stillCurrent()){renderSettings();$('dropInSettingsStatus').textContent=text('d4917f10-f0e0-5eea-9908-82b0d2acb72c');}}
        catch {if(stillCurrent()){renderSettings();$('dropInSettingsStatus').textContent=text('0272ce50-1b2e-5e54-8447-91af78590f38');}}
    });
    function cancelSettings(){pendingSettings=undefined;renderSettings();}
    $('dropInApplyCancel').addEventListener('click',()=>{$('dropInApplyDialog').close();cancelSettings();});
    $('dropInApplyDialog').addEventListener('cancel',cancelSettings);
    $('dropInSaveDefault').addEventListener('click',async()=>{
        const current=preferences.get(view.userId).custom;
        try {await preferences.updateDefault({audio:current.audio});renderSettingSources();$('dropInDefaultStatus').textContent=text('d4917f10-f0e0-5eea-9908-82b0d2acb72c');}
        catch {$('dropInDefaultStatus').textContent=text('0272ce50-1b2e-5e54-8447-91af78590f38');}
    });
    $('dropInRestoreDefault').addEventListener('click',()=>changeSettings({defaultAudio:true}));
    $('liveStreamResetPercent').addEventListener('click',()=>changeSettings({mirror:true}));
    modeMenu=globalThis.WMOFModeMenu?.bind($('scopeToggle'),{getOptionDetails:value=>optionDetails('mode',value),getValue:()=>$('liveStreamViewMode').value,
        getDates:()=>({start:$('liveStreamViewStart').value,end:$('liveStreamViewEnd').value}),extraOptions:[['user','b11c3a59-8432-515c-b361-acabaf1e7a88']],
        onSelect:(value,dates)=>{changeSettings({view:{mode:value,...dates},mirror:false});}});
    $('liveStreamDialog').addEventListener('drop-in-mode-changed',()=>{updateModeButton();refreshOptionDetails();});

    goalPad=globalThis.WMOFObserverGoalPad?new WMOFObserverGoalPad({getChoices:scope=>{
        const field=scope==='total'?'totalGoal':'tripGoal',record=currentSettings();
        return [...new Set([preferences.defaults.view[field],record.custom.view[field],publisherValues()[field]])].filter(value=>/^\d+$/.test(String(value))).map(value=>({value,source:optionDetails(field,value).source}));
    },getDetails:(scope,value)=>optionDetails(scope==='total'?'totalGoal':'tripGoal',String(value)),onConfirm:(scope,value)=>{
        const patch={percent:'',percentScope:null,[scope==='total'?'totalGoal':'tripGoal']:String(value)};
        if(scope==='trip'&&value!=='mirror')patch.sync='off';changeSettings({view:patch,mirror:false});
    }}):null;
    const configuredGoal=scope=>{
        const custom=currentSettings(),config=custom.settingsSource==='default'?preferences.defaults.view:custom.custom.view,override=!custom.mirror&&config[scope==='total'?'totalGoal':'tripGoal'];
        if(override && override!=='mirror')return Number(override);
        return Number(goalNumber(view.snapshot?.uiState?.[scope==='total'?'total_goal_component':'trip_goal_component']))||100;
    };
    const goalLabel=scope=>{const selected=$('liveStreamViewMode').value;const range=['user','auto','trip'].includes(selected)?view.snapshot?.viewData?.range||'week':selected;return $('liveStreamViewMode').querySelector('option[value="'+(scope==='trip'?'trip':range)+'"]')?.textContent||'-';};
    const openGoal=scope=>{if(!permission(64)||!goalPad)return;void goalPad.open(scope,configuredGoal(scope),goalLabel(scope)).catch(error=>status(error.message));};
    $('goalPercentValue').addEventListener('click',()=>{
        if(!permission(64))return;
        const mode=$('liveStreamViewMode').value==='user'?view.snapshot?.viewData?.mode:$('liveStreamViewMode').value;
        if(mode==='auto'){$('autoTripGoalValue').textContent=configuredGoal('trip')+'%';$('autoTotalGoalValue').textContent=configuredGoal('total')+'%';$('autoGoalDialog').showModal();}
        else openGoal(['trip','user'].includes(mode)?'trip':'total');
    });
    for(const button of $('autoGoalDialog').querySelectorAll('[data-auto-goal-scope]'))button.addEventListener('click',()=>{$('autoGoalDialog').close();openGoal(button.dataset.autoGoalScope);});
    $('autoGoalDialog').querySelector('[data-close-dialog]').addEventListener('click',()=>$('autoGoalDialog').close());
    timeMenu=globalThis.WMOFModeMenu.bind($('toggleRenderedTimeButton'),{getValue:()=>$('liveStreamViewTime').value,
        extraOptions:[['user','b11c3a59-8432-515c-b361-acabaf1e7a88']],
        getOptionDetails:value=>optionDetails('timeDisplay',value),
        optionsList:[['remaining','4b927b44-6410-53c1-98b2-ad81f47e9e61'],['elapsed','89d7fafa-57e0-5a57-93c8-919c0422b960'],['calculated-end','945221ab-82a1-59b2-b957-2ebed11a0a88']],
        onSelect:value=>changeSettings({view:{timeDisplay:value},mirror:false})});
    const syncMenu=document.createElement('div');syncMenu.id='dropInSyncPopover';syncMenu.className='mode-dropdown';syncMenu.hidden=true;syncMenu.setAttribute('popover','auto');syncMenu.setAttribute('role','menu');document.body.append(syncMenu);
    const syncOpen=()=>WMOFModeMenu.isOpen(syncMenu);
    const closeSync=()=>{if(syncMenu.hidePopover&&syncOpen()){try{syncMenu.hidePopover();}catch{}}syncMenu.hidden=true;$('toggleSyncMenuButton').setAttribute('aria-expanded','false');};
    for(const [value,id] of [['on','1c9519e8-3320-5a28-9c4a-18a545b065ca'],['off','22a4fe99-d5e6-5ea4-b2df-32a8be5e9992'],['user','b11c3a59-8432-515c-b361-acabaf1e7a88']]) {
        const button=document.createElement('button');button.type='button';button.dataset.sync=value;if(value==='user')button.classList.add('mirror-option');button.dataset.menuIcon=value==='user'?'mirror':'settings';button.setAttribute('role','menuitemradio');const label=document.createElement('span');label.className='mode-option-label';label.textContent=WMOFLanguagePack.text(id);button.append(label);button.dataset.labelId=id;button.addEventListener('click',()=>{closeSync();changeSettings({view:{sync:value},mirror:false});});syncMenu.append(button);
    }
    $('toggleSyncMenuButton').setAttribute('aria-haspopup','menu');
    $('toggleSyncMenuButton').setAttribute('popovertarget',syncMenu.id);
    $('toggleSyncMenuButton').addEventListener('click',event=>{
        event.preventDefault();
        if(syncOpen()){closeSync();return;}const button=$('toggleSyncMenuButton'),r=button.getBoundingClientRect(),value=$('liveStreamViewSync').value;
        refreshOptionDetails();for(const option of syncMenu.querySelectorAll('button'))option.setAttribute('aria-checked',String(option.dataset.sync===value));
        syncMenu.style.width=Math.min(260,innerWidth-24)+'px';syncMenu.style.left=Math.max(12,Math.min(r.left,innerWidth-272))+'px';syncMenu.style.top=Math.max(12,Math.min(r.bottom+6,innerHeight-180))+'px';syncMenu.style.maxHeight=Math.max(80,innerHeight-parseFloat(syncMenu.style.top)-12)+'px';syncMenu.hidden=false;syncMenu.showPopover?.({source:button});button.setAttribute('aria-expanded','true');syncMenu.querySelector('[aria-checked="true"]')?.focus();
    });
    syncMenu.addEventListener('keydown',event=>{const choices=[...syncMenu.querySelectorAll('button')],index=choices.indexOf(document.activeElement);if(event.key==='Escape'){closeSync();$('toggleSyncMenuButton').focus();}else if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();choices[(index+(event.key==='ArrowDown'?1:choices.length-1))%choices.length].focus();}});
    syncMenu.addEventListener('toggle',()=>{const open=syncOpen();syncMenu.hidden=!open;$('toggleSyncMenuButton').setAttribute('aria-expanded',String(open));});
    document.addEventListener('click',event=>{if(!syncMenu.hidden&&!syncMenu.contains(event.target)&&!$('toggleSyncMenuButton').contains(event.target))closeSync();});

    $('liveStreamDialog').addEventListener('observer-summary-changed',event=>{
        $('toggleSyncMenuButton').setAttribute('aria-pressed',String(Boolean(event.detail?.sync_enabled)));
        const mirrored=$('liveStreamViewSync').value==='user',icon=$('toggleSyncMenuButton').querySelector('.sync-goals-menu-icon');
        $('toggleSyncMenuButton').dataset.syncMode=mirrored?'user':event.detail?.sync_enabled?'on':'off';
        icon.dataset.syncState=event.detail?.sync_enabled?'enabled':'disabled';
        icon.querySelector('.sync-mirror-badge').hidden=!mirrored;
        renderSettingSources();
    });
    const remoteMicrophone=globalThis.WMOFObserverMicrophone ? new WMOFObserverMicrophone({button:$('dropInMicrophoneButton'),stream,onFailure:()=>status(WMOFDropInText('failed'))}):null;
    function controls() {
        const identity = context.current;
        $('dropInMicrophoneButton').hidden=!view.userId;
        $('liveStreamWatchButton').disabled = busy || !permission(64) || !identity || Number(identity.userId) === Number(user?.id);
        $('liveStreamWatchButton').textContent = text(stream.viewing ? 'd82579ae-0ee3-593a-9a3d-6208756e8ae3' : '07ebf99a-22d4-507f-a4b0-7f01bb41ec96');
        $('liveStreamLookupButton').disabled = busy || !permission(128);
        $('liveStreamVolumeControls').disabled = busy || !identity;
        $('dropInMirrorSettings').disabled=$('dropInSettingsSource').disabled = busy || !identity;
        $('goalPercentValue').disabled=$('toggleSyncMenuButton').disabled=$('scopeToggle').disabled=busy||!permission(64);
        $('toggleRenderedTimeButton').disabled=busy||!permission(64);
        $('standardTimeButton').disabled=true;
        $('endTimeGoalLock').hidden=true;
        $('dropInRemoveUser').disabled = busy || !identity;
        $('dropInTripLogButton').disabled = busy || !stream.viewing;
        $('dropInSelectUser').disabled = busy || !identities.size;
        $('dropInSaveDefault').disabled = $('dropInRestoreDefault').disabled = busy || !identity;
        $('liveStreamTrainerMessage').disabled = busy || messageBusy || !permission(64) || !identities.size;
        $('liveStreamTrainerMessageSend').disabled = busy || messageBusy || !permission(64) || !identities.size;
        $('liveStreamUserSelect').replaceChildren();
        for (const identity of identities.values()) {
            const option = document.createElement('option'); option.value = String(identity.userId); option.textContent = name(identity);
            $('liveStreamUserSelect').append(option);
        }
        $('liveStreamUserSelect').value = identity ? String(identity.userId) : '';
        $('liveStreamUserSelect').disabled = busy || !identities.size;
        $('liveStreamPreviousUser').disabled = $('liveStreamNextUser').disabled = busy || identities.size < 2;
    }
    async function select(identity, watch = stream.viewing) {
        if (exiting || busy || !identity || Number(identity.userId) === Number(user?.id)) return;
        pendingViewChange=undefined;$('dropInTargetDialog').close();closeSync();timeMenu?.close();remoteMicrophone?.reset(identity.userId);
        busy = true; const request = ++revision; settingsRevision++;goalPad?.cancel();$('autoGoalDialog').close(); controls();
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
        canLookup:()=>permission(128)});
    lookup.setMode('lookup');
    // The caller owns its action; generic account lookup has no streaming controls.
    let lookupWatchButton;
    function syncLookupWatch(){if(lookupWatchButton)lookupWatchButton.disabled=!permission(64)||!context.current||Number(context.current.userId)===Number(user?.id);}
    context.addEventListener('identity-selected',syncLookupWatch);
    context.addEventListener('identity-cleared',syncLookupWatch);
    $('liveStreamLookupButton').addEventListener('click', () => {
        lookup.setMode('lookup');lookup.sync();
        lookupWatchButton=$('dropInLookupActionTemplate').content.firstElementChild.cloneNode(true);
        lookupWatchButton.addEventListener('click',()=>{if(!lookupWatchButton.disabled)$('userLookupDialog').close();});
        $('userLookupDialog').querySelector('.user-lookup-selected-actions').append(lookupWatchButton);syncLookupWatch();$('userLookupDialog').showModal();
    });
    for (const button of $('userLookupDialog').querySelectorAll('.dialog-close')) button.addEventListener('click', () => $('userLookupDialog').close());
    // Copy/select in Account Lookup can choose an identity without starting a connection.
    $('userLookupDialog').addEventListener('close', () => {
        lookupWatchButton?.remove();lookupWatchButton=undefined;
        const identity = context.current;
        if (!busy && identity && Number(identity.userId) !== view.userId) void select(identity,true);
    });
    $('dropInRemoveUser').addEventListener('click',async()=>{
        if(busy||!view.userId)return;const wasViewing=stream.viewing,removed=Number(view.userId);
        busy=true;revision++;controls();
        try {await stream.stopViewing();view.clear();identities.delete(removed);context.clear();view.userId=null;}
        catch(error){status(error.message);}
        finally{busy=false;controls();}
        const next=identities.values().next().value;if(next)await select(next,wasViewing);else renderSettings();
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
        if (stream.viewing && Number(event.detail.targetUserId) === Number(view.userId) && Number(snapshot?.userId) === Number(view.userId)) {view.update(snapshot);remoteMicrophone?.update(view.userId,snapshot.viewData?.microphone);updateModeButton();renderSettingSources();}
    });
    stream.addEventListener('viewerChanged', event => {
        controls();
        if (!stream.viewing) {pendingViewChange=undefined;$('dropInTargetDialog').close();closeSync();timeMenu?.close();remoteMicrophone?.reset();view.clear();$('liveStreamRemoteSpeech').textContent='—';}
        if (!busy) status(stream.viewing ? String(event.detail.state || '') : text('bafe351c-ceef-5648-9536-fcf9da113818'));
    });
    stream.addEventListener('message', event => {
        const detail=event.detail;
        if (Number(detail.targetUserId) !== Number(view.userId)) return;
        if (detail.type === 'microphone.result') remoteMicrophone?.finish(detail.payload?.commandId,detail.payload);
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
        if(exiting)return;remoteMicrophone?.reset();exiting=true;revision++;logRevision++;$('dropInExitButton').disabled=$('dropInLogoutButton').disabled=true;
        globalThis.WMOFAudio?.stopAll?.();
        try {
            if(logout){await stream.stopViewing();const response=await fetch(new URL('api/users/',document.baseURI),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf||''},body:JSON.stringify({action:'disconnect'})});if(!response.ok){const data=await response.json();throw new Error(data.message || WMOFDropInText('failed'));}}
            await Promise.all([stream.close(),preferences.queue]);view.destroy?.();location.assign(new URL('index.php',document.baseURI));
        } catch(error){exiting=false;status(error.message);$('dropInExitButton').disabled=$('dropInLogoutButton').disabled=false;controls();}
    }
    $('dropInExitButton').addEventListener('click',()=>void leave(false));
    $('dropInLogoutButton').addEventListener('click',()=>void leave(true));
    let pendingMessage,nameSelection,nameOrder=[];
    function openMessageRecipients(){
        const value=[...$('liveStreamTrainerMessageText').value.trim()].slice(0,500).join('');
        if(busy||messageBusy||!permission(64)||!identities.size||!value)return;
        pendingMessage=value;const list=$('dropInRecipients');list.replaceChildren();
        for(const identity of identities.values()){
            const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=true;check.dataset.recipientId=String(identity.userId);
            label.append(check,document.createTextNode(name(identity)));list.append(label);
        }
        $('dropInDeliveryStatus').textContent='';$('dropInMessageConfirm').disabled=false;$('dropInRecipientsDialog').showModal();
    }
    $('dropInRecipients').addEventListener('change',()=>{$('dropInMessageConfirm').disabled=!$('dropInRecipients').querySelector('input:checked');});
    $('dropInMessageCancel').addEventListener('click',()=>{$('dropInRecipientsDialog').close();pendingMessage=undefined;});
    $('dropInRecipientsDialog').addEventListener('cancel',event=>{if(messageBusy)event.preventDefault();else pendingMessage=undefined;});
    async function sendMessage(){
        const selected=[...$('dropInRecipients').querySelectorAll('input:checked')].map(input=>Number(input.dataset.recipientId)).filter(id=>identities.has(id));
        if(messageBusy||exiting||!pendingMessage||!selected.length)return;
        messageBusy=true;$('dropInRecipientFields').disabled=true;$('dropInMessageConfirm').disabled=$('dropInMessageCancel').disabled=true;controls();
        try{
            const result=await stream.sendToPublishers(selected,pendingMessage);
            const sent=result.sentUserIds||[],failed=(result.failures||[]).map(item=>Number(item.userId));
            const names=ids=>ids.map(id=>name(identities.get(Number(id)))).join(', ');
            $('liveStreamTrainerMessageStatus').textContent=[sent.length?WMOFLanguagePack.text('f8afb56f-21c2-54ed-80f5-35a99c97ecd4',{names:names(sent)}):'',failed.length?WMOFLanguagePack.text('4095ea2e-9d80-51fa-b3b5-472b08286b12',{names:names(failed)}):''].filter(Boolean).join('. ');
            for(const input of $('dropInRecipients').querySelectorAll('input'))input.checked=failed.includes(Number(input.dataset.recipientId));
            if(!failed.length){$('liveStreamTrainerMessageText').value='';pendingMessage=undefined;$('dropInRecipientsDialog').close();}
        }catch(error){$('liveStreamTrainerMessageStatus').textContent=error.message;}
        finally{$('dropInDeliveryStatus').textContent=$('liveStreamTrainerMessageStatus').textContent;messageBusy=false;$('dropInRecipientFields').disabled=false;$('dropInMessageCancel').disabled=false;$('dropInMessageConfirm').disabled=!$('dropInRecipients').querySelector('input:checked');controls();}
    }
    $('dropInMessageConfirm').addEventListener('click',()=>void sendMessage());
    $('liveStreamTrainerMessageSend').addEventListener('click',openMessageRecipients);
    $('liveStreamTrainerMessageText').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();openMessageRecipients();}});
    $('liveStreamTrainerMessageText').addEventListener('beforeinput',event=>{
        if(event.data!=='['||messageBusy)return;
        const input=event.target,start=input.selectionStart,end=input.selectionEnd;
        if(input.value[start-1]==='\\')return;
        event.preventDefault();input.setRangeText('[',start,end,'end');nameSelection={start,end:start+1};
        for(const check of $('dropInNamePicker').querySelectorAll('[data-name-field]'))check.checked=false;
        nameOrder=[];refreshNamePicker();$('dropInNamePicker').showModal();
    });
    function refreshNamePicker(){
        for(const output of $('dropInNamePicker').querySelectorAll('[data-name-order]')){const index=nameOrder.indexOf(output.dataset.nameOrder);output.textContent=index<0?'':String(index+1);}
        $('dropInNamePreview').textContent='['+nameOrder.join(' ')+']';$('dropInNameInsert').disabled=!nameOrder.length;
    }
    $('dropInNamePicker').addEventListener('change',event=>{const field=event.target.dataset.nameField;if(!field)return;nameOrder=nameOrder.filter(value=>value!==field);if(event.target.checked)nameOrder.push(field);refreshNamePicker();});
    $('dropInNameClear').addEventListener('click',()=>{nameOrder=[];for(const check of $('dropInNamePicker').querySelectorAll('[data-name-field]'))check.checked=false;refreshNamePicker();});
    $('dropInNameInsert').addEventListener('click',()=>{
        const fields=nameOrder;
        if(!fields.length||!nameSelection)return;const input=$('liveStreamTrainerMessageText'),value='['+fields.join(' ')+']';
        if(input.value.length-(nameSelection.end-nameSelection.start)+value.length>500)return;
        input.setRangeText(value,nameSelection.start,nameSelection.end,'end');$('dropInNamePicker').close();input.focus();nameSelection=undefined;
    });
    function cancelNamePicker(){const input=$('liveStreamTrainerMessageText');if(nameSelection)input.setRangeText('',nameSelection.start,nameSelection.end,'end');$('dropInNamePicker').close();nameSelection=undefined;input.focus();}
    $('dropInNameCancel').addEventListener('click',cancelNamePicker);
    $('dropInNamePicker').addEventListener('cancel',event=>{event.preventDefault();cancelNamePicker();});
    $('dropInNameHelp').addEventListener('click',()=>{$('dropInNameHelpDialog').showModal();});
    $('dropInNameHelpClose').addEventListener('click',()=>{$('dropInNameHelpDialog').close();});
    window.addEventListener('pagehide',()=>{remoteMicrophone?.reset();exiting=true;revision++;view.destroy?.();void stream.close();});
    controls();
    fetch(new URL('api/users/',document.baseURI),{credentials:'same-origin',cache:'no-store'}).then(async response=>{
        if(!response.ok) throw new Error(response.status===401 ? text('07dba185-8a12-583b-bc6c-c900ac30541d') : WMOFDropInText('failed'));
        const session=await response.json();user=session.user;csrf=session.csrfToken;
        await globalThis.WMOFAccountSettings.load(user.id,csrf);
        await preferences.load(user.id);
        let graphical;try{const raw=globalThis.WMOFAccountSettings.peek('orderFiller','wmof.clock.graphicalSettings');graphical=raw?JSON.parse(raw):undefined;}catch{}
        const appearance=globalThis.WMOFTimerAppearance.normalizeGraphicalSettings(graphical);
        if(view.setGraphicalSettings)view.setGraphicalSettings(appearance);else globalThis.WMOFTimerAppearance.applyGraphical($('liveStreamClockTimer'),appearance);
        $('dropInPageStatus').textContent=permission(64) ? '' : text('07dba185-8a12-583b-bc6c-c900ac30541d');
        lookup.sync();renderSettings();controls();
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
