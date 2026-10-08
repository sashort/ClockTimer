(() => {
    'use strict';
    const clone=value=>JSON.parse(JSON.stringify(value));
    const initial=()=>({view:{mode:'trip',start:'',end:'',percent:'',percentScope:null,tripGoal:'',totalGoal:'',sync:'user',timeDisplay:'user'},audio:{muted:false,master:100,microphone:100,program:100}});
    const normalize=value=>{
        const result=initial();
        const allowed={mode:['user','trip','auto','day','week','pay-period','month','year','custom'],sync:['user','on','off'],timeDisplay:['user','remaining','elapsed','calculated-end']};
        for(const [key,values] of Object.entries(allowed))if(values.includes(value.view?.[key]))result.view[key]=value.view[key];
        for(const key of ['start','end'])if(/^\d{4}-\d{2}-\d{2}$/.test(value.view?.[key]))result.view[key]=value.view[key];
        if(value.view?.percent!==''&&Number.isFinite(Number(value.view?.percent))&&Number(value.view.percent)>0)result.view.percent=String(value.view.percent);
        if(['trip','total'].includes(value.view?.percentScope))result.view.percentScope=value.view.percentScope;
        for(const key of ['tripGoal','totalGoal'])if(value.view?.[key]==='mirror'||(/^\d+$/.test(value.view?.[key])&&Number(value.view[key])>0))result.view[key]=String(value.view[key]);
        result.audio.muted=value.audio?.muted===true;
        for(const key of ['master','microphone','program'])if(Number.isFinite(value.audio?.[key]))result.audio[key]=Math.max(0,Math.min(100,value.audio[key]));
        return result;
    };
    const sources=(settings,defaults,provided)=>Object.fromEntries(['view','audio'].map(group=>[group,Object.fromEntries(Object.keys(defaults[group]).map(key=>[key,['default','custom','mirror'].includes(provided?.[group]?.[key])?provided[group][key]:JSON.stringify(settings[group][key])===JSON.stringify(defaults[group][key])?'default':'custom']))]));
    const reconcile=(record,defaults)=>{
        for(const group of ['view','audio'])for(const key of Object.keys(defaults[group])) {
            if(record.sources[group][key]==='default'||JSON.stringify(record.custom[group][key])===JSON.stringify(defaults[group][key])){record.sources[group][key]='default';delete record.custom[group][key];}
        }
        if(record.settingsSource==='custom'&&!Object.values(record.sources.view).some(source=>source!=='default'))record.settingsSource='default';
    };
    class DropInPreferences {
        constructor({persistence=globalThis.WMOFPersistence}={}) {this.persistence=persistence;this.state={defaults:initial(),users:{}};this.queue=Promise.resolve();this.owner=null;}
        async load(owner) {await this.queue;this.state={defaults:initial(),users:{}};this.owner=String(owner);const raw=await this.persistence?.getItem('drop-in-preferences-v1:'+this.owner);if(raw){try{const value=JSON.parse(raw);if(value.defaults?.view&&value.defaults?.audio&&value.users&&typeof value.users==='object'){this.state.defaults=normalize(value.defaults);for(const [id,record] of Object.entries(value.users)){if(/^[1-9]\d*$/.test(id)&&record?.custom)this.state.users[id]={mirror:record.mirror!==false,custom:normalize(record.custom),sources:sources(normalize(record.custom),this.state.defaults,record.sources),settingsSource:['default','custom','user'].includes(record.settingsSource)?record.settingsSource:record.mirror!==false?'user':'custom'};}}}catch{}}return this;}
        get(id) {
            const record=clone(this.state.users[String(id)] || {mirror:true,custom:this.state.defaults,sources:sources(this.state.defaults,this.state.defaults)});
            record.sources ||= sources(record.custom,this.state.defaults);
            record.settingsSource ||= record.mirror?'user':'custom';
            record.mirror=record.settingsSource==='user';
            for(const group of ['view','audio'])for(const [key,source] of Object.entries(record.sources[group]))if(source==='default')record.custom[group][key]=this.state.defaults[group][key];
            return record;
        }
        get defaults(){return clone(this.state.defaults);}
        apply(ids,{view,audio,mirror,custom,defaultAudio,settingsSource}={}) {
            return this.write(()=>{for(const id of ids){const current=this.get(id);if(custom){current.custom=clone(custom);for(const group of ['view','audio'])for(const key of Object.keys(current.sources[group]))current.sources[group][key]='custom';}if(view){Object.assign(current.custom.view,view);for(const key of Object.keys(view))current.sources.view[key]=view[key]==='user'||view[key]==='mirror'?'mirror':'custom';}if(audio){Object.assign(current.custom.audio,audio);for(const key of Object.keys(audio))current.sources.audio[key]='custom';}if(defaultAudio){current.custom.audio=clone(this.state.defaults.audio);for(const key of Object.keys(current.sources.audio))current.sources.audio[key]='default';}if(mirror!==undefined){current.mirror=mirror;current.settingsSource=mirror?'user':'custom';}if(['default','custom','user'].includes(settingsSource)){current.settingsSource=settingsSource;current.mirror=settingsSource==='user';}this.state.users[String(id)]=current;}});
        }
        applyViewTarget(id,view,{defaults,user}) {
            return this.write(()=>{
                if(defaults){Object.assign(this.state.defaults.view,view);this.state.defaults=normalize(this.state.defaults);}
                const record=this.get(id);
                if(user){Object.assign(record.custom.view,view);for(const key of Object.keys(view))record.sources.view[key]=view[key]==='user'||view[key]==='mirror'?'mirror':'custom';record.settingsSource='custom';record.mirror=false;}
                else if(defaults){record.settingsSource='default';record.mirror=false;}
                this.state.users[String(id)]=record;
            });
        }
        updateDefault({view,audio}={}) {return this.write(()=>{if(view)Object.assign(this.state.defaults.view,view);if(audio)Object.assign(this.state.defaults.audio,audio);this.state.defaults=normalize(this.state.defaults);});}
        saveDefault(settings){return this.write(()=>{this.state.defaults=clone(settings);});}
        write(change) {
            // Serialize saves and their checkpoints; a failed save cannot overwrite a later save.
            const operation=this.queue.then(async()=>{const before=clone(this.state);change();for(const record of Object.values(this.state.users))reconcile(record,this.state.defaults);try{await this.persistence?.setItem('drop-in-preferences-v1:'+this.owner,JSON.stringify(this.state));}catch(error){this.state=before;throw error;}});
            this.queue=operation.catch(()=>{});return operation;
        }
    }
    globalThis.WMOFDropInPreferences=DropInPreferences;
})();
