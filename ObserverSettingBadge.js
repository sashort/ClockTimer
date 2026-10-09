(() => {
 'use strict';
 const ids={"badgeDefault": "b59b5d51-a9c8-50c6-8938-1b105de4e22d", "badgeCustom": "36ed2281-60b5-571f-b0d9-a12c26d9cd3c", "badgeUser": "5c7b0850-ae4c-5f12-a82c-43cbca6bc31a", "badgeDefaultUser": "a8186f8b-5985-5631-bc40-255d58b12099", "badgeCustomUser": "68df898b-079f-5dbb-a308-d8e707c16612", "glyphDefault": "9cae1846-4961-53df-a1a5-5e0036801a8f", "glyphCustom": "dc72e554-ac7f-5e9d-be7c-62b90e8209b9", "mirrorValue": "c7e4b9b9-3df5-53d2-9314-f0b3eb6e8f9a", "awaitingSettings": "677452f5-d049-54f5-89a0-7869610bd8e2", "clockFollows": "959b4a75-9553-5f36-a7b2-a5e49f4288d7"};
 const person='<path d="M8 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6M2 15v-2a6 5 0 0 1 12 0v2z" fill="currentColor"/>';
 globalThis.WMOFObserverSettingBadge={
  match(field,value,record,defaults,publisher){
   const same=(a,b)=>a!==undefined&&b!==undefined&&String(a)===String(b);
   const baseline=same(value,defaults[field]);
   const custom=!baseline&&record.sources?.view?.[field]!=='default'&&same(value,record.custom.view[field]);
   const user=same(value,publisher[field]);
   return baseline?(user?'default-user':'default'):custom?(user?'custom-user':'custom'):user?'user':null;
  },
  render(host,source){
   host.querySelector('.observer-source-badge')?.remove();if(!source)return;
   const badge=document.createElement('span');badge.className='observer-source-badge';badge.dataset.source=source;
   const label=WMOFLanguagePack.text(ids[{default:'badgeDefault',custom:'badgeCustom',user:'badgeUser','default-user':'badgeDefaultUser','custom-user':'badgeCustomUser'}[source]]);
   badge.title=label;badge.setAttribute('aria-label',label);badge.setAttribute('role','img');
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 32 32');svg.setAttribute('aria-hidden','true');
   svg.innerHTML='<rect x="1" y="1" width="27" height="27" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>';
   if(source==='user')svg.innerHTML+='<g transform="translate(5 4) scale(1.25)">'+person+'</g>';
   else {const letter=document.createElementNS(svg.namespaceURI,'text');letter.setAttribute('x','14');letter.setAttribute('y','21');letter.setAttribute('text-anchor','middle');letter.setAttribute('fill','currentColor');letter.textContent=WMOFLanguagePack.text(ids[source.startsWith('default')?'glyphDefault':'glyphCustom']);svg.append(letter);if(source.endsWith('-user'))svg.innerHTML+='<rect x="18" y="17" width="14" height="15" rx="3" fill="var(--badge-backdrop,#001e60)"/><g transform="translate(19 17) scale(.8)">'+person+'</g>';}
   badge.append(svg);host.append(badge);
  }
 };
})();
