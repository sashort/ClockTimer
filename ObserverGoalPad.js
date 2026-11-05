(() => {
 'use strict';
 class ObserverGoalPad {
  constructor({onConfirm,getDetails=()=>null,getChoices=()=>[],getGoalDetails=()=>null}) {this.getGoalDetails=getGoalDetails;this.onConfirm=onConfirm;this.getDetails=getDetails;this.getChoices=getChoices;this.loading=null;this.dialog=null;this.revision=0;}
  async load() {
   if(this.dialog)return;
   if(!this.loading)this.loading=(async()=>{
    const response=await fetch(new URL('numberpad.html',document.baseURI),{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw new Error(WMOFDropInText('failed'));
    const template=document.createElement('template');template.innerHTML=await response.text();document.body.append(template.content.cloneNode(true));
    this.dialog=document.getElementById('numberPadDialog');this.dialog.classList.add('observer-goal-pad');const $=id=>this.dialog.querySelector('#'+id);
    for(const id of ['numberPadSettingsArea','numberPadVoice','numberPadAM','numberPadPM','numberPadDateRow'])$(id).hidden=true;
    $('numberPadSettingsArea').parentElement.classList.add('settings-hidden');
    const choices=document.createElement('div');choices.id='observerGoalChoices';this.dialog.querySelector('.number-pad-shell').append(choices);
    const mirror=document.createElement('button');mirror.id='observerGoalMirror';mirror.type='button';mirror.className='mirror-option';mirror.dataset.menuIcon='mirror';mirror.textContent=WMOFLanguagePack.text('b11c3a59-8432-515c-b361-acabaf1e7a88');mirror.addEventListener('click',()=>{this.dialog.close();this.confirmValue('mirror');});this.dialog.querySelector('.number-pad-shell').append(mirror);
    const append=digit=>{if(this.replace){this.value='';this.replace=false;}this.value+=digit;this.paint();};
    for(const button of this.dialog.querySelectorAll('[data-number]'))button.addEventListener('click',()=>append(button.dataset.number));
    $('numberPadBackspace').addEventListener('click',()=>{this.replace=false;this.value=this.value.slice(0,-1);this.paint();});
    $('numberPadClear').addEventListener('click',()=>{this.replace=false;this.value='';this.paint();});
    $('numberPadReset').addEventListener('click',()=>{this.replace=true;this.value=this.initial;this.paint();});
    $('numberPadCopy').addEventListener('click',async()=>{if(!this.valid())return;const text=Number(this.value)+'%';try{await navigator.clipboard.writeText(text);this.clipboard=text;this.copiedValue=text;$('numberPadClipboardStatus').textContent='Copied';$('numberPadCopy').classList.add('is-copied');this.paint();}catch{$('numberPadClipboardStatus').textContent='Clipboard access is unavailable.';}});
    $('numberPadPaste').addEventListener('click',async()=>{try{const text=await navigator.clipboard.readText();this.clipboard=text;if(this.clipboardValid(text)){this.value=String(Number(text.trim().replace(/%$/,'')));this.replace=true;}this.paint();}catch{$('numberPadClipboardStatus').textContent='Clipboard access is unavailable.';}});
    window.addEventListener('focus',()=>{void this.readClipboard();});
    $('numberPadCancel').addEventListener('click',()=>this.dialog.close());
    $('numberPadConfirm').addEventListener('click',()=>{if(!this.valid())return;this.dialog.close();this.confirmValue(Number(this.value));});
    this.dialog.addEventListener('keydown',event=>{if(/^\d$/.test(event.key)){event.preventDefault();append(event.key);}else if(event.key==='Enter'){event.preventDefault();$('numberPadConfirm').click();}else if(event.key==='Backspace'){event.preventDefault();$('numberPadBackspace').click();}});
   })().catch(error=>{this.loading=null;throw error;});
   await this.loading;
  }
  clipboardValid(text){return typeof text==='string'&&text.length<=512&&/^\d+%?$/.test(text.trim())&&Number.isSafeInteger(Number(text.trim().replace(/%$/,'')))&&Number(text.trim().replace(/%$/,''))>0;}
  async readClipboard(){if(!this.dialog?.open||!navigator.clipboard?.readText)return;try{if((await navigator.permissions?.query({name:'clipboard-read'}))?.state!=='granted')return;this.clipboard=await navigator.clipboard.readText();this.paint();}catch{}}
  valid(){return /^\d+$/.test(this.value)&&Number.isSafeInteger(Number(this.value))&&Number(this.value)>0;}
  refresh(){
   if(!this.dialog)return;
   const mirror=this.dialog.querySelector('#observerGoalMirror'),details=this.getDetails(this.scope,'mirror');
   mirror.textContent=details?.label||WMOFLanguagePack.text('b11c3a59-8432-515c-b361-acabaf1e7a88');globalThis.WMOFObserverSettingBadge?.render(mirror,details?.source);
   globalThis.WMOFObserverSettingBadge?.render(this.dialog.querySelector('#numberPadContext'),this.getDetails(this.scope,this.value)?.source);
   const host=this.dialog.querySelector('#observerGoalChoices'),choices=this.getChoices(this.scope),signature=JSON.stringify(choices);
   if(host.dataset.signature===signature)return;host.dataset.signature=signature;host.replaceChildren();
   for(const choice of choices){const button=document.createElement('button');button.type='button';button.dataset.menuIcon='settings';button.textContent=WMOFLanguagePack.text('e3620451-3e1a-5638-b0e7-c608c808d5b7',{value0:choice.value});globalThis.WMOFObserverSettingBadge?.render(button,choice.source);button.addEventListener('click',()=>{this.value=String(choice.value);this.replace=true;this.paint();});host.append(button);}
  }

  paint(){this.refresh();globalThis.WMOFTimerSummaryView?.renderGoalDetails(this.dialog.querySelector('#numberPadContext'),(this.session?.getGoalDetails||this.getGoalDetails)(this.scope,Number(this.value)));this.dialog.querySelector('#numberPadDisplay').textContent=this.value?WMOFLanguagePack.text('e3620451-3e1a-5638-b0e7-c608c808d5b7',{value0:Number(this.value)}):'---';this.dialog.querySelector('#numberPadConfirm').disabled=!this.valid();this.dialog.querySelector('#numberPadBackspace').disabled=!this.value;this.dialog.querySelector('#numberPadCopy').classList.toggle('is-copied',Boolean(this.value&&this.copiedValue===Number(this.value)+'%'));this.dialog.querySelector('#numberPadCopy').disabled=!this.valid()||!navigator.clipboard?.writeText;this.dialog.querySelector('#numberPadPaste').hidden=!this.clipboardValid(this.clipboard);}
  confirmValue(value){(this.session?.onConfirm||this.onConfirm)(this.scope,value);}
  async open(scope,value,label,session=null){const request=++this.revision;await this.load();if(request!==this.revision)return;this.session=session;this.scope=scope;this.dialog.querySelector('#observerGoalMirror').hidden=Boolean(session);this.initial=String(Math.round(Number(value)||100));this.value=this.initial;this.replace=true;this.dialog.querySelector('#numberPadContext').textContent=WMOFLanguagePack.text('36e3b3a0-c2ea-5f66-81c2-2ea8b4005ab6',{scope:label});this.paint();if(session?.onClose)this.dialog.addEventListener('close',()=>setTimeout(session.onClose,0),{once:true});this.dialog.showModal();void this.readClipboard();this.dialog.querySelector('#numberPadConfirm').focus();}
  cancel(){this.revision++;this.dialog?.close();}
 }
 globalThis.WMOFObserverGoalPad=ObserverGoalPad;
})();
