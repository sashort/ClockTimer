(() => {
 'use strict';
 class ObserverGoalPad {
  constructor({onConfirm}) {this.onConfirm=onConfirm;this.loading=null;this.dialog=null;this.revision=0;}
  async load() {
   if(this.dialog)return;
   if(!this.loading)this.loading=(async()=>{
    const response=await fetch(new URL('numberpad.html',document.baseURI),{cache:'no-store',credentials:'same-origin'});if(!response.ok)throw new Error(WMOFDropInText('failed'));
    const template=document.createElement('template');template.innerHTML=await response.text();document.body.append(template.content.cloneNode(true));
    this.dialog=document.getElementById('numberPadDialog');const $=id=>this.dialog.querySelector('#'+id);
    for(const id of ['numberPadSettingsArea','numberPadVoice','numberPadAM','numberPadPM','numberPadDateRow'])$(id).hidden=true;
    $('numberPadSettingsArea').parentElement.classList.add('settings-hidden');
    const mirror=document.createElement('button');mirror.id='observerGoalMirror';mirror.type='button';mirror.dataset.menuIcon='mirror';mirror.textContent=WMOFLanguagePack.text('b11c3a59-8432-515c-b361-acabaf1e7a88');mirror.addEventListener('click',()=>{this.dialog.close();this.onConfirm(this.scope,'mirror');});this.dialog.querySelector('.number-pad-shell').append(mirror);
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
  paint(){this.dialog.querySelector('#numberPadDisplay').textContent=this.value?WMOFLanguagePack.text('e3620451-3e1a-5638-b0e7-c608c808d5b7',{value0:Number(this.value)}):'---';this.dialog.querySelector('#numberPadConfirm').disabled=!this.valid();this.dialog.querySelector('#numberPadBackspace').disabled=!this.value;}
  async open(scope,value,label){const request=++this.revision;await this.load();if(request!==this.revision)return;this.scope=scope;this.initial=String(Math.round(Number(value)||100));this.value=this.initial;this.replace=true;this.dialog.querySelector('#numberPadContext').textContent=WMOFLanguagePack.text('36e3b3a0-c2ea-5f66-81c2-2ea8b4005ab6',{scope:label});this.paint();this.dialog.showModal();this.dialog.querySelector('#numberPadConfirm').focus();}
  cancel(){this.revision++;this.dialog?.close();}
 }
 globalThis.WMOFObserverGoalPad=ObserverGoalPad;
})();
