(() => {
 'use strict';
 class AccountSettings extends EventTarget {
  constructor({fetcher=(...args)=>fetch(...args),timeoutMs=15000}={}){super();this.fetcher=fetcher;this.timeoutMs=timeoutMs;this.owner=null;this.token=null;this.settings={version:1};this.queue=Promise.resolve();this.generation=0;this.loaded=false;this.requests=new Set();}
  async request(options){
   const controller=new AbortController();this.requests.add(controller);
   let rejectAbort;const aborted=new Promise((resolve,reject)=>{rejectAbort=()=>reject(new DOMException('Settings request cancelled.','AbortError'));controller.signal.addEventListener('abort',rejectAbort,{once:true});});
   const timeout=setTimeout(()=>controller.abort(),this.timeoutMs);
   try {return await Promise.race([aborted,(async()=>{const response=await this.fetcher(new URL('api/settings/',document.baseURI),{...options,signal:controller.signal}),data=await response.json();return {ok:response.ok,json:async()=>data};})()]);}
   finally{clearTimeout(timeout);controller.signal.removeEventListener('abort',rejectAbort);this.requests.delete(controller);}
  }
  async load(owner,token){
   this.clear();const generation=this.generation;this.owner=Number(owner);this.token=token;
   const response=await this.request({credentials:'same-origin',cache:'no-store'}),data=await response.json();
   if(generation!==this.generation)throw new DOMException('Account changed.','AbortError');
   if(!response.ok||Number(data.userId)!==this.owner||data.settings?.version!==1)throw new Error(data.message||'Account settings could not be loaded.');
   this.settings=data.settings;this.loaded=true;this.dispatchEvent(new CustomEvent('loaded'));return this;
  }
  clear(){for(const controller of this.requests)controller.abort();this.generation++;this.owner=null;this.token=null;this.settings={version:1};this.loaded=false;this.dispatchEvent(new CustomEvent('cleared'));}
  peek(namespace,key){return this.settings[namespace]?.[key]??null;}
  write(namespace,changes){
   const owner=this.owner,generation=this.generation,token=this.token;
   const work=this.queue.then(async()=>{
    if(!this.loaded||generation!==this.generation||!owner)throw new DOMException('Account changed.','AbortError');
    const response=await this.request({method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':token||''},body:JSON.stringify({userId:owner,namespace,changes})}),data=await response.json();
    if(generation!==this.generation)throw new DOMException('Account changed.','AbortError');
    if(!response.ok||Number(data.userId)!==owner)throw new Error(data.message||'Account settings could not be saved.');
    this.settings=data.settings;this.dispatchEvent(new CustomEvent('saved',{detail:{namespace}}));return true;
   });this.queue=work.catch(()=>{});return work;
  }
  namespaceStorage(namespace){return {getItem:async key=>this.peek(namespace,key),setItem:(key,value)=>this.write(namespace,{[key]:value})};}
  installPersistence(local){
   const account=this,isSetting=key=>key.startsWith('wmof.clock.')||['wmof.tripProductionFilter','wmof-recognizer-names-v1'].includes(key);
   const namespace=key=>key==='wmof-recognizer-names-v1'?'speech':'orderFiller';
   const write=async entries=>{
    if(!account.owner){for(const [key,value] of entries){account.settings[namespace(key)]||={};account.settings[namespace(key)][key]=value;}return true;}
    for(const section of ['orderFiller','speech']){const changes=Object.fromEntries(entries.filter(([key])=>namespace(key)===section));if(Object.keys(changes).length)await account.write(section,changes);}return true;
   };
   return {
    ready:local.ready,initializeLegacy:storage=>local.initializeLegacy(storage),
    peek:key=>isSetting(key)?account.peek(namespace(key),key):local.peek(key),
    getItem:key=>isSetting(key)?Promise.resolve(account.peek(namespace(key),key)):local.getItem(key),
    setItem:(key,value)=>isSetting(key)?write([[key,value]]):local.setItem(key,value),
    async commit(entries,options){if(options?.signal?.aborted)throw new DOMException('State change cancelled.','AbortError');const settings=entries.filter(([key])=>isSetting(key)),other=entries.filter(([key])=>!isSetting(key));if(settings.length)await write(settings);if(options?.signal?.aborted)throw new DOMException('State change cancelled.','AbortError');if(other.length)await local.commit(other,options);return true;},
    removeItem:key=>isSetting(key)?write([[key,null]]):local.removeItem(key),
    async flush(){await account.queue;await local.flush();}
   };
  }
 }
 globalThis.AccountSettings=AccountSettings;
 globalThis.WMOFAccountSettings=new AccountSettings();
 if(globalThis.WMOFPersistence)globalThis.WMOFPersistence=globalThis.WMOFAccountSettings.installPersistence(globalThis.WMOFPersistence);
})();
