(() => {
 'use strict';
 const text=id=>WMOFLanguagePack.text(id),percent=value=>Number.isFinite(value)?Math.ceil(value-1e-9)+'%':'—';
 const lock='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/></svg>';
 const pencil='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m16 3 5 5L9 20l-6 1 1-6Z"/><path d="m14 5 5 5"/></svg>';
 globalThis.WMOFAutoGoalMenu={attach({menu,button,position,getState,getRows,commit,edit,customRange,close}){
  let pending=null,rows=[],revision=0,suspended=false,rootChildren=[];
  const node=(tag,cls,content)=>{const e=document.createElement(tag);e.className=cls||'';if(content!==undefined)e.textContent=content;return e;};
  const discard=()=>{pending=null;revision++;menu.classList.remove('is-auto-goals');if(rootChildren.length)menu.replaceChildren(...rootChildren);};
  function pickCustom(){if(!customRange)return;suspended=true;menu.hidePopover?.();customRange(pending.customDates,dates=>{suspended=false;if(!pending)return;if(dates)pending.customDates=dates;menu.hidden=false;menu.showPopover?.({source:button});position();void render();});}
  async function render(){
   if(!pending)return;const version=++revision,current=pending;rows=await getRows({...pending,goals:{...pending.goals}});
   if(version!==revision||pending!==current)return;
   menu.classList.add('is-auto-goals');menu.replaceChildren();
   const header=node('div','auto-pane-head'),back=node('button','auto-pane-back',text('d7400001-0000-4000-8000-000000000001'));back.type='button';back.addEventListener('click',()=>{discard();position();});header.append(back,node('strong','',text('d7400001-0000-4000-8000-000000000002')));menu.append(header);
   const headings=node('div','auto-column-head');const symbol=node('span','auto-lock-column');symbol.innerHTML=lock;symbol.title=text('d7400001-0000-4000-8000-000000000003');headings.append(symbol,node('span','auto-column-goal',text('d7400001-0000-4000-8000-000000000004')),node('span','auto-column-fallback',text('d7400001-0000-4000-8000-000000000005')),node('span','auto-column-target',text('d7400001-0000-4000-8000-000000000006')));menu.append(headings);
   for(const row of rows){
    const selected=row.id===pending.scope,standard=row.id==='standard',item=node('div','auto-scope-choice'+(selected?' selected':'')+(standard?' auto-standard-choice':''));item.dataset.autoScope=row.id;item.setAttribute('role','group');item.setAttribute('aria-label',row.label);
    const check=node('input','auto-override-check');check.type='checkbox';check.checked=pending.override===row.id;check.setAttribute('aria-label',text('d7400001-0000-4000-8000-000000000003')+' '+row.label);check.addEventListener('change',()=>{pending.override=check.checked?row.id:null;if(!standard)pending.scope=row.id;pending.dirty=true;if(row.id==='custom')pickCustom();else void render();});
    const name=node('span','auto-goal-name'),copy=node('span','auto-goal-copy'),title=node('span','auto-goal-title',row.label+(selected&&pending.dirty?' - '+percent(row.goal):''));copy.append(title);
    if(selected&&!standard)copy.append(node('span',pending.dirty?'auto-confirm-hint':'auto-aggregate-percent',pending.dirty?text('d7400001-0000-4000-8000-000000000007'):percent(row.goal)));
    name.append(copy);
    if(selected&&!standard){const editButton=node('button','auto-goal-edit');editButton.type='button';editButton.innerHTML=pencil;editButton.setAttribute('aria-label',text('d7400001-0000-4000-8000-000000000008')+' '+row.label);const open=event=>{event.stopPropagation();suspended=true;try{menu.hidePopover();}catch{}void edit(row.id,pending.goals[row.id]??100,value=>{pending.goals[row.id]=value;pending.dirty=true;},()=>{suspended=false;if(!pending)return;menu.hidden=false;menu.showPopover?.({source:button});position();void render();});};editButton.addEventListener('click',open);copy.addEventListener('click',open);name.append(editButton);}
    const fallback=node('span','auto-scope-fallback',row.adjusted?'('+percent(row.raw)+')':''),target=node('span','auto-scope-target');if(row.adjusted){const triangle=node('span','auto-bounding','▲');triangle.setAttribute('aria-hidden','true');target.append(triangle);}target.append(document.createTextNode(percent(row.target)));
    item.append(check,name,fallback,target);const choose=async()=>{if(standard)return;if(selected&&pending.dirty){const state=pending;try{await commit(state);pending=null;close();discard();}catch(error){const message=node('p','auto-goal-error',error.message);message.setAttribute('role','alert');menu.append(message);}return;}pending.scope=row.id;if(pending.override&&pending.override!=='standard')pending.override=null;pending.dirty=true;if(row.id==='custom')pickCustom();else void render();};
    item.addEventListener('click',event=>{if(!event.target.closest('input,button,.auto-goal-copy'))void choose();else if(event.target.closest('.auto-goal-copy')&&!selected)void choose();});item.tabIndex=standard?-1:0;item.addEventListener('keydown',e=>{if(e.target!==item)return;if(['Enter',' '].includes(e.key)){e.preventDefault();void choose();}});menu.append(item);
   }
   position();
  }
  menu.addEventListener('toggle',()=>{if(!menu.matches(':popover-open')&&!suspended&&pending)discard();});
  return {open(){rootChildren=[...menu.childNodes];const state=getState();pending={scope:state.scope,override:state.override,goals:{...state.goals},dirty:false};void render();},refresh(){if(pending&&!suspended)void render();},isActive:()=>Boolean(pending),discard};
 }};
})();
