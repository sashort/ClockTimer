(() => {
 'use strict';
 class ObserverGoalPad {
  constructor({onConfirm,getDetails=()=>null,getChoices=()=>[]}) {this.onConfirm=onConfirm;this.getDetails=getDetails;this.getChoices=getChoices;this.loading=null;this.dialog=null;this.revision=0;}
  async load() {
   if(this.dialog)return;
   if(!this.loading)this.loading=(async()=>{
    const response=await fetch(new URL('numberpad.html',document.baseURI),{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw new Error(WMOFDropInText('failed'));
    const template=document.createElement('template');template.innerHTML=await response.text();document.body.append(template.content.cloneNode(true));
    this.dialog=document.getElementById('numberPadDialog');const $=id=>this.dialog.querySelector('#'+id);
    for(const id of ['numberPadSettingsArea','numberPadVoice','numberPadAM','numberPadPM','numberPadDateRow'])$(id).hidden=true;
    $('numberPadSettingsArea').parentElement.classList.add('settings-hidden');
    const choices=document.createElement('div');choices.id='observerGoalChoices';this.dialog.querySelector('.number-pad-shell').append(choices);
    const mirror=document.createElement('button');mirror.id='observerGoalMirror';mirror.type='button';mirror.className='mirror-option';mirror.dataset.menuIcon='mirror';mirror.textContent=WMOFLanguagePack.text('b11c3a59-8432-515c-b361-acabaf1e7a88');mirror.addEventListener('click',()=>{this.dialog.close();this.onConfirm(this.scope,'mirror');});this.dialog.querySelector('.number-pad-shell').append(mirror);
    const append=digit=>{if(this.replace){this.value='';this.replace=false;}this.value+=digit;this.paint();};
    for(const button of this.dialog.querySelectorAll('[data-number]'))button.addEventListener('click',()=>append(button.dataset.number));
    $('numberPadBackspace').addEventListener('click',()=>{this.replace=false;this.value=this.value.slice(0,-1);this.paint();});
    $('numberPadClear').addEventListener('click',()=>{this.replace=false;this.value='';this.paint();});
    $('numberPadReset').addEventListener('click',()=>{this.replace=true;this.value=this.initial;this.paint();});
    $('numberPadCancel').addEventListener('click',()=>this.dialog.close());
    $('numberPadConfirm').addEventListener('click',()=>{if(!this.valid())return;this.dialog.close();this.onConfirm(this.scope,Number(this.value));});
    this.dialog.addEventListener('keydown',event=>{if(/^\d$/.test(event.key)){event.preventDefault();append(event.key);}else if(event.key==='Enter'){event.preventDefault();$('numberPadConfirm').click();}else if(event.key==='Backspace'){event.preventDefault();$('numberPadBackspace').click();}});
   })().catch(error=>{this.loading=null;throw error;});
   await this.loading;
  }
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

  paint(){this.refresh();this.dialog.querySelector('#numberPadDisplay').textContent=this.value?WMOFLanguagePack.text('e3620451-3e1a-5638-b0e7-c608c808d5b7',{value0:Number(this.value)}):'---';this.dialog.querySelector('#numberPadConfirm').disabled=!this.valid();this.dialog.querySelector('#numberPadBackspace').disabled=!this.value;}
  async open(scope,value,label){const request=++this.revision;await this.load();if(request!==this.revision)return;this.scope=scope;this.initial=String(Math.round(Number(value)||100));this.value=this.initial;this.replace=true;this.dialog.querySelector('#numberPadContext').textContent=WMOFLanguagePack.text('36e3b3a0-c2ea-5f66-81c2-2ea8b4005ab6',{scope:label});this.paint();this.dialog.showModal();this.dialog.querySelector('#numberPadConfirm').focus();}
  cancel(){this.revision++;this.dialog?.close();}
 }
 globalThis.WMOFObserverGoalPad=ObserverGoalPad;
})();
