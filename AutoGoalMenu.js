(() => {
 'use strict';
 const text=id=>WMOFLanguagePack.text(id),percent=value=>Number.isFinite(value)?Math.ceil(value-1e-9)+'%':'—';
 const lock='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/></svg>';
 const node=(tag,cls,content)=>{const e=document.createElement(tag);e.className=cls||'';if(content!==undefined)e.textContent=content;return e;};
 globalThis.WMOFAutoGoalMenu={attach({menu,button,position,getState,getRows,commit,edit,customRange,close}){
  let pending=null,revision=0,suspended=false,rootChildren=[],tapTimer=null,tapKind=null;
  const clearTap=()=>{clearTimeout(tapTimer);tapTimer=null;tapKind=null;};
  const discard=()=>{clearTap();pending=null;revision++;menu.classList.remove('is-auto-goals');if(rootChildren.length)menu.replaceChildren(...rootChildren);};
  const restore=()=>{suspended=false;if(!pending)return;menu.hidden=false;menu.showPopover?.({source:button});position();void render();};
  const hide=()=>{clearTap();suspended=true;try{menu.hidePopover?.();}catch{}};
  function pickCustom(){if(!customRange)return;hide();customRange(pending.customDates,dates=>{if(!pending)return;if(dates)pending.customDates=dates;restore();});}
  async function confirm(){clearTap();const state=pending;if(!state||state.committing)return;state.committing=true;try{await commit(state);pending=null;close();discard();}catch(error){state.committing=false;const message=node('p','auto-goal-error',error.message);message.setAttribute('role','alert');menu.append(message);}}
  function toggle(kind){clearTap();if(!pending||pending.committing)return;const identity=kind==='aggregate'?pending.scope:kind;pending.override=pending.override===identity?null:identity;pending.dirty=true;void render();}
  function gesture(kind,event){if(event.target.closest('button,select'))return;event.preventDefault();event.stopPropagation();if(event.type==='keydown'){if(event.key==='Enter')void confirm();else toggle(kind);return;}if(tapTimer&&tapKind===kind){void confirm();return;}clearTap();tapKind=kind;tapTimer=setTimeout(()=>toggle(kind),350);}
  function editGoal(kind){if(!pending||pending.committing)return;const scope=kind==='aggregate'?pending.scope:'trip',value=scope==='trip'?pending.tripGoal:pending.goals[scope];hide();void edit(scope,value??100,goal=>{if(scope==='trip')pending.tripGoal=goal;else pending.goals[scope]=goal;pending.dirty=true;},restore);}
  async function render(){
   if(!pending)return;const version=++revision,current=pending,rows=await getRows({...pending,goals:{...pending.goals}});if(version!==revision||pending!==current)return;
   const previousScroll=menu.classList.contains('is-auto-goals')?menu.scrollTop:0;menu.classList.add('is-auto-goals');menu.replaceChildren();
   const header=node('div','auto-pane-head'),back=node('button','auto-pane-back',text('d7400001-0000-4000-8000-000000000001'));back.type='button';back.addEventListener('click',()=>{discard();position();});header.append(back,node('strong','',text('d7400001-0000-4000-8000-000000000002')));menu.append(header);
   const headings=node('div','auto-column-head auto-target-columns'),symbol=node('span','auto-lock-column');symbol.innerHTML=lock;symbol.title=text('d7400001-0000-4000-8000-000000000003');headings.append(symbol,node('span','auto-column-goal',text('d7400001-0000-4000-8000-000000000004')),node('span','auto-column-target',text('d7400001-0000-4000-8000-000000000006')));menu.append(headings);
   const aggregates=rows.filter(row=>!['trip','standard'].includes(row.id)),targets=node('div','auto-targets');targets.setAttribute('role','radiogroup');targets.setAttribute('aria-label',text('d7400001-0000-4000-8000-000000000003'));menu.append(targets);
   for(const kind of ['aggregate','trip','standard']){
    const row=rows.find(row=>row.id===(kind==='aggregate'?pending.scope:kind));if(!row)continue;const identity=kind==='aggregate'?pending.scope:kind,item=node('div','auto-scope-choice auto-target-choice auto-target-columns');item.dataset.autoTarget=kind;item.dataset.autoScope=row.id;item.classList.toggle('has-target-lock',pending.override===identity);item.setAttribute('role','group');item.setAttribute('aria-label',row.label);item.tabIndex=0;
    const radio=node('input','auto-override-check');radio.type='radio';radio.name=button.id+'AutoTarget';radio.value=kind;radio.checked=pending.override===identity;radio.setAttribute('aria-label',text('d7400001-0000-4000-8000-000000000003')+' '+row.label);
    const goal=kind==='standard'?node('span','auto-goal-empty'):node('button','auto-goal-value');if(kind!=='standard'){goal.type='button';goal.setAttribute('aria-label',text('d7400001-0000-4000-8000-000000000008')+' '+row.label);if(row.adjusted){const triangle=node('span','auto-bounding','▲');triangle.setAttribute('aria-hidden','true');goal.append(triangle);goal.title=text('d7400001-0000-4000-8000-000000000005')+': '+percent(row.raw)+'; '+text('d7400001-0000-4000-8000-000000000006')+': '+percent(row.target);}goal.append(document.createTextNode(percent(kind==='trip'?pending.tripGoal:pending.goals[pending.scope])));goal.addEventListener('click',event=>{event.stopPropagation();editGoal(kind);});}
    let target;if(kind==='aggregate'){target=node('select','auto-aggregate-select');target.setAttribute('aria-label',text('d7800001-0000-4000-8000-000000000001'));for(const choice of aggregates){const option=node('option','',choice.label);option.value=choice.id;target.append(option);}target.value=pending.scope;target.addEventListener('change',()=>{clearTap();const wasLocked=pending.override===pending.scope;pending.scope=target.value;if(wasLocked)pending.override=pending.scope;pending.dirty=true;if(pending.scope==='custom')pickCustom();else void render();});}
    else target=node('span','auto-target-label',row.label);
    item.append(radio,goal,target);item.addEventListener('click',event=>gesture(kind,event));item.addEventListener('keydown',event=>{if(event.target!==item&&event.target!==radio)return;if(['Enter',' '].includes(event.key))gesture(kind,event);});targets.append(item);
   }
   if(pending.dirty){const notice=node('p','auto-confirm-hint auto-pane-confirm',text('d7700001-0000-4000-8000-000000000002'));notice.setAttribute('role','status');menu.append(notice);}position();menu.scrollTop=previousScroll;
  }
  menu.addEventListener('toggle',()=>{if(!menu.matches(':popover-open')&&!suspended&&pending)discard();});
  return {open(){rootChildren=[...menu.childNodes];const state=getState();pending={scope:state.scope,override:state.override,goals:{...state.goals},tripGoal:state.tripGoal??100,dirty:false};void render();},refresh(){if(pending&&!suspended)void render();},isActive:()=>Boolean(pending),discard};
 }};
})();
