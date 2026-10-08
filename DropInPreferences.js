(() => {
    'use strict';
    const clone=value=>JSON.parse(JSON.stringify(value));
    const initial=()=>({view:{mode:'trip',start:'',end:'',percent:'',percentScope:null,sync:'user',timeDisplay:'user'},audio:{muted:false,master:100,microphone:100,program:100}});
    const normalize=value=>{
        const result=initial();
        const allowed={mode:['trip','auto','day','week','pay-period','month','year','custom'],sync:['user','on','off'],timeDisplay:['user','remaining','elapsed','calculated-end']};
        for(const [key,values] of Object.entries(allowed))if(values.includes(value.view?.[key]))result.view[key]=value.view[key];
        for(const key of ['start','end'])if(/^\d{4}-\d{2}-\d{2}$/.test(value.view?.[key]))result.view[key]=value.view[key];
        if(value.view?.percent!==''&&Number.isFinite(Number(value.view?.percent))&&Number(value.view.percent)>0)result.view.percent=String(value.view.percent);
        if(['trip','total'].includes(value.view?.percentScope))result.view.percentScope=value.view.percentScope;
        result.audio.muted=value.audio?.muted===true;
        for(const key of ['master','microphone','program'])if(Number.isFinite(value.audio?.[key]))result.audio[key]=Math.max(0,Math.min(100,value.audio[key]));
        return result;
    };
    class DropInPreferences {
        constructor({persistence=globalThis.WMOFPersistence}={}) {this.persistence=persistence;this.state={defaults:initial(),users:{}};this.queue=Promise.resolve();this.owner=null;}
        async load(owner) {await this.queue;this.state={defaults:initial(),users:{}};this.owner=String(owner);const raw=await this.persistence?.getItem('drop-in-preferences-v1:'+this.owner);if(raw){try{const value=JSON.parse(raw);if(value.defaults?.view&&value.defaults?.audio&&value.users&&typeof value.users==='object'){this.state.defaults=normalize(value.defaults);for(const [id,record] of Object.entries(value.users)){if(/^[1-9]\d*$/.test(id)&&record?.custom)this.state.users[id]={mirror:record.mirror!==false,custom:normalize(record.custom)};}}}catch{}}return this;}
        get(id) {return clone(this.state.users[String(id)] || {mirror:true,custom:this.state.defaults});}
        get defaults(){return clone(this.state.defaults);}
        apply(ids,{view,audio,mirror,custom}={}) {
            return this.write(()=>{for(const id of ids){const current=this.get(id);if(custom)current.custom=clone(custom);if(view)Object.assign(current.custom.view,view);if(audio)Object.assign(current.custom.audio,audio);if(mirror!==undefined)current.mirror=mirror;this.state.users[String(id)]=current;}});
        }
        saveDefault(settings){return this.write(()=>{this.state.defaults=clone(settings);});}
        write(change) {
            // Serialize saves and their checkpoints; a failed save cannot overwrite a later save.
            const operation=this.queue.then(async()=>{const before=clone(this.state);change();try{await this.persistence?.setItem('drop-in-preferences-v1:'+this.owner,JSON.stringify(this.state));}catch(error){this.state=before;throw error;}});
            this.queue=operation.catch(()=>{});return operation;
        }
    }
    globalThis.WMOFDropInPreferences=DropInPreferences;
})();
