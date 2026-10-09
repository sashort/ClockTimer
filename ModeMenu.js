(() => {
 'use strict';
 const options=[['day','679e79f2-5cb5-50a2-9625-3f019146213c'],['week','0cd2eb74-19fc-5121-af25-d600a813907d'],['pay-period','2d36d8c6-7d35-5b36-8634-12c6e2677fb7'],['month','dbcdee29-519f-5a37-bf6c-03adee4241f7'],['year','b8c105f6-d44e-5ec3-b548-45d5a317d3a9'],['custom','fcc1b60f-e7a5-5194-b230-07a963542f72'],['trip','906193ec-18dd-5208-a4bc-162df6b650c4'],['auto','4030be28-c088-5b0d-9039-92fb3e84f3d6']];
 globalThis.WMOFModeMenu={bind(button,{getValue,onSelect,getDates=()=>({}),extraOptions=[],getOptionDetails=()=>null}) {
  const menu=document.createElement('div');menu.className='mode-dropdown';menu.id=button.id+'Dropdown';menu.setAttribute('popover','auto');menu.setAttribute('role','menu');menu.hidden=true;document.body.append(menu);
  button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-controls',menu.id);button.setAttribute('aria-expanded','false');
  const refresh=()=>{for(const choice of menu.querySelectorAll('[data-mode]')){const details=getOptionDetails(choice.dataset.mode);choice.querySelector('.mode-option-label').textContent=details?.label||WMOFLanguagePack.text(choice.dataset.labelId);globalThis.WMOFObserverSettingBadge?.render(choice,details?.source);}};
  const close=()=>{if(menu.hidePopover&&!menu.hidden){try{menu.hidePopover();}catch{}}menu.hidden=true;button.setAttribute('aria-expanded','false');};
  const position=()=>{const r=button.getBoundingClientRect();const width=Math.min(280,innerWidth-24);menu.style.width=width+'px';menu.style.left=Math.max(12,Math.min(r.right-width,innerWidth-width-12))+'px';menu.style.top=Math.min(r.bottom+6,Math.max(12,innerHeight-150))+'px';menu.style.maxHeight=Math.max(80,innerHeight-parseFloat(menu.style.top)-12)+'px';};
  const dates=document.createElement('dialog');dates.className='mode-date-dialog';
  const form=document.createElement('form');dates.append(form);document.body.append(dates);
  const heading=document.createElement('h2');heading.textContent=WMOFLanguagePack.text('e86d0474-482b-5969-b67e-52605bae5c98');form.append(heading);
  const dateInputs={};
  for(const [key,id] of [['start','3e20eafe-4133-587f-a31b-2020d5a29f50'],['end','48654946-3e3a-5e4b-8e24-03e0627bc33c']]){const label=document.createElement('label');label.textContent=WMOFLanguagePack.text(id);const input=document.createElement('input');input.type='date';input.required=true;label.append(input);form.append(label);dateInputs[key]=input;}
  dateInputs.start.addEventListener('change',()=>{dateInputs.end.min=dateInputs.start.value;});
  const confirm=document.createElement('button');confirm.type='submit';confirm.dataset.menuIcon='calendar';confirm.textContent=WMOFLanguagePack.text('4878397e-9212-5297-a99a-02a8dee2097a');
  const cancel=document.createElement('button');cancel.type='button';cancel.dataset.menuIcon='logout';cancel.textContent=WMOFLanguagePack.text('5eabb983-6b64-5fe0-8e62-a8c1dd00b356');
  form.append(confirm,cancel);
  form.addEventListener('submit',event=>{event.preventDefault();if(!form.reportValidity()||dateInputs.end.value<dateInputs.start.value)return;dates.close();onSelect('custom',{start:dateInputs.start.value,end:dateInputs.end.value});button.focus();});
  cancel.addEventListener('click',()=>{dates.close();button.focus();});
  const select=value=>{if(value!=='custom'){onSelect(value);button.focus();return;}const current=getDates();dateInputs.start.value=current.start||'';dateInputs.end.value=current.end||'';dateInputs.end.min=dateInputs.start.value;dates.showModal();dateInputs.start.focus();};
  const entries=[...options,...extraOptions].map(([value,id],index)=>{if(index===6||index===7){const line=document.createElement('hr');line.setAttribute('role','separator');menu.append(line);}const choice=document.createElement('button');choice.type='button';choice.dataset.mode=value;choice.setAttribute('role','menuitemradio');if(value==='user')choice.classList.add('mirror-option');choice.dataset.menuIcon=value==='user'?'mirror':index<6?'calendar':value==='auto'?'settings':'clock';const label=document.createElement('span');label.className='mode-option-label';label.textContent=WMOFLanguagePack.text(id);choice.append(label);choice.dataset.labelId=id;choice.addEventListener('click',()=>{close();select(value);});menu.append(choice);return choice;});
  button.addEventListener('click',()=>{if(!menu.hidden){close();return;}refresh();const value=getValue();for(const entry of entries)entry.setAttribute('aria-checked',String(entry.dataset.mode===value));menu.hidden=false;position();menu.showPopover?.();button.setAttribute('aria-expanded','true');(entries.find(e=>e.dataset.mode===value)||entries[0]).focus();});
  menu.addEventListener('keydown',event=>{const index=entries.indexOf(document.activeElement);let next;if(event.key==='ArrowDown')next=(index+1)%entries.length;else if(event.key==='ArrowUp')next=(index-1+entries.length)%entries.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=entries.length-1;else if(event.key==='Escape'){close();button.focus();}else return;event.preventDefault();if(next!==undefined)entries[next].focus();});
  menu.addEventListener('toggle',event=>{if(event.newState==='closed'){menu.hidden=true;button.setAttribute('aria-expanded','false');}});
  document.addEventListener('click',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!button.contains(event.target))close();});
  window.addEventListener('resize',()=>{if(!menu.hidden)position();});return {close,menu,dates,refresh};
 }};
})();
