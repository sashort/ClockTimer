(() => {
 'use strict';
 // Owns fitting for the shared Order Filler / Drop-In percentage row.
 // Text is measured at the preferred responsive size; the Sync column never scales.
 class PercentSummaryLayout {
  static instances=new WeakMap();
  static attach(row){
   if(!row || this.instances.has(row))return;
   this.instances.set(row,new this(row));
  }
  constructor(row){
   this.row=row;
   this.context=row.ownerDocument.createElement('canvas').getContext('2d');
   const schedule=()=>{
    if(this.frame)return;
    this.frame=requestAnimationFrame(()=>{this.frame=0;this.fit();});
   };
   this.resize=new ResizeObserver(schedule);
   this.resize.observe(row);
   this.reference=row.closest('.app')?.querySelector('.scope-connection-button');
   if(this.reference)this.resize.observe(this.reference);
   this.mutations=new MutationObserver(records=>{
    if(records.some(record=>!(record.target.closest?.('.goal-bar-svg') || record.target.parentElement?.closest?.('.goal-bar-svg'))))schedule();
   });
   this.mutations.observe(row,{childList:true,characterData:true,attributes:true,attributeFilter:['hidden'],subtree:true});
   row.ownerDocument.fonts?.ready.then(schedule);
   schedule();
  }
  fit(){
   const row=this.row,box=row.getBoundingClientRect();
   if(!box.width || !this.context)return;
   const visible=!row.querySelector('.goal-sync-button')?.hidden;
   const badgeWidth=visible?40:0;
   const reference=this.reference?.getBoundingClientRect();
   // Fit against the destination inset, not its animated intermediate value.
   const inset=!visible?0:reference?.width
    ?Math.max(0,box.right-(reference.left+reference.width/2)-20):6;
   row.style.setProperty('--summary-sync-inset',`${inset}px`);
   const style=getComputedStyle(row),base=parseFloat(style.fontSize);
   const cells=[row.querySelector('#currentPercentValue'),row.querySelector(':scope > span'),row.querySelector('#goalPercentValue')];
   if(cells.some(cell=>!cell))return;
   if(row.dataset.percentageDisplay==='bar'){
    row.style.gridTemplateColumns=`minmax(0, 1fr) ${badgeWidth}px`;
    GoalBar.instances.get(row)?.schedule();return;
   }
   const widths=cells.map(cell=>{
    const textStyle=getComputedStyle(cell);
    this.context.font=`${textStyle.fontStyle} ${textStyle.fontWeight} ${base}px ${textStyle.fontFamily}`;
    const spacing=parseFloat(textStyle.letterSpacing)||0;
    return Math.max(1,this.context.measureText(cell.textContent).width+spacing*cell.textContent.length);
   });
   const gap=parseFloat(style.getPropertyValue('--summary-text-gap'))||12;
   // Reserve only the real Sync track plus its cloud-aligned right inset.
   // Two equal flexible spaces center the entire expression before that track.
   const available=Math.max(1,row.clientWidth-inset-badgeWidth-4*gap-3);
   const scale=Math.min(1,available/widths.reduce((sum,width)=>sum+width,0));
   row.style.setProperty('--summary-percent-font-size',`${base*scale}px`);
   row.style.gridTemplateColumns=`minmax(0, 1fr) ${widths[0]*scale+1}px ${widths[1]*scale+1+2*gap}px ${widths[2]*scale+1}px minmax(0, 1fr) ${badgeWidth}px`;
  }
 }
 const svgNS='http://www.w3.org/2000/svg';
 const svgElement=(name,attributes={})=>{const e=document.createElementNS(svgNS,name);for(const [key,value] of Object.entries(attributes))e.setAttribute(key,value);return e;};
 class GoalBar {
  static instances=new WeakMap();
  static attach(row){if(!this.instances.has(row))this.instances.set(row,new this(row));return this.instances.get(row);}
  constructor(row){
   this.row=row;this.nodes=new Map();this.previous=new Map();this.motion=new Map();
   this.svg=svgElement('svg',{class:'goal-bar-svg',role:'button',tabindex:0,'aria-label':'Goal bar · Edit goals',viewBox:'0 0 300 112'});
   this.track=svgElement('rect',{rx:7,y:51,height:14,class:'goal-bar-track'});
   this.fill=svgElement('rect',{rx:7,y:51,height:14,class:'goal-bar-fill'});
   this.segment=svgElement('rect',{y:51,height:14,class:'goal-bar-segment'});
   this.ticks=svgElement('g',{'aria-hidden':'true'});this.layer=svgElement('g');
   this.leftCompression=svgElement('path',{class:'goal-bar-compression goal-bar-compression-left',fill:'#c6def5','aria-hidden':'true'});
   this.rightCompression=svgElement('g',{class:'goal-bar-compression goal-bar-compression-right','aria-hidden':'true'});
   this.rightCompression.append(svgElement('rect',{x:-12,y:-20,width:24,height:40,fill:'transparent'}),svgElement('path',{d:'M -6 -7 L 7 0 L -6 7 Z',fill:'#c6def5'}));
   const activate=()=>{
    const mode=this.state?.goal_type;
    const choices=mode==='trip'?['trip']:mode==='total'?['total']:['trip','total'];
    this.row.dispatchEvent(new CustomEvent('goal-bar-edit',{bubbles:true,detail:{choices}}));
   };
   this.svg.addEventListener('click',activate);
   this.svg.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();activate();}});
   this.svg.append(this.track,this.fill,this.segment,this.ticks,this.layer,this.leftCompression,this.rightCompression);row.append(this.svg);
   this.resize=new ResizeObserver(()=>this.schedule());this.resize.observe(this.svg);
  }
  reset(){for(const animation of this.motion.values())animation.cancel();this.motion.clear();this.layer.replaceChildren();this.nodes.clear();this.previous.clear();this.initial=true;}
  update(state){const key=state?.trip_start_component?.value??null;if(key!==this.key){this.reset();this.key=key;}this.state=state;this.schedule();}
  schedule(){if(this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=null;this.draw();});}
  move(element,id,x,y,{arc=0,exit=false}={}){
   const next=`translate(${x}px, ${y}px)`;
   if(element.style.transform===next)return Promise.resolve();
   const old=getComputedStyle(element).transform;this.motion.get(id)?.cancel();
   element.style.transform=next;
   if(this.initial||matchMedia('(prefers-reduced-motion: reduce)').matches||old==='none')return Promise.resolve();
   const frames=[{transform:old},...(arc?[{transform:`translate(${x}px, ${y-arc}px)`,offset:.65}]:[]),{transform:next}];
   const animation=element.animate(frames,{duration:exit?350:300,easing:'ease-in-out'});this.motion.set(id,animation);
   return animation.finished.catch(()=>{}).then(()=>{if(this.motion.get(id)===animation)this.motion.delete(id);});
  }
  node(id){
   if(this.nodes.has(id))return this.nodes.get(id);
   const group=svgElement('g',{class:'goal-bar-node','data-node-id':id});
   const circle=svgElement('circle',{r:10,cx:0,cy:0});
   const glyph=svgElement('text',{y:4,'text-anchor':'middle',class:'goal-bar-glyph'});
   const time=svgElement('text',{y:-22,'text-anchor':'middle',class:'goal-bar-time'});
   const percent=svgElement('text',{y:27,'text-anchor':'middle',class:'goal-bar-percent'});
   const label=svgElement('text',{y:44,'text-anchor':'middle',class:'goal-bar-label'});
   const caption=svgElement('text',{y:-39,'text-anchor':'middle',class:'goal-bar-caption'});
   const tick=svgElement('path',{class:'goal-bar-tick','data-node-id':id,d:'M 0 15 v 6',opacity:.7,'aria-hidden':'true'});
   const title=svgElement('title');group.append(circle,glyph,caption,time,percent,label,tick,title);this.layer.append(group);
   const value={group,circle,glyph,caption,time,percent,label,tick,title};this.nodes.set(id,value);return value;
  }
  draw(){
   if(this.row.dataset.percentageDisplay!=='bar')return;
   const data=this.state?.goal_bar,width=this.svg.getBoundingClientRect().width;if(!(width>0))return;
   this.svg.setAttribute('viewBox',`0 0 ${width} 112`);
   const goals=(data?.nodes||[]).filter(n=>!n.current&&Number.isFinite(n.percent)&&n.percent>0);
   const current=data?.nodes?.find(n=>n.current),active=data?.active!==false;
   const available=goals.filter(n=>!n.failed);
   const target=available.toSorted((a,b)=>b.percent-a.percent)[0];
   const last=(!available.length&&goals.find(n=>n.id==='standard'))||goals.toSorted((a,b)=>a.percent-b.percent)[0];
   const displayed=data?.available?[...available,...(!available.length&&last?[last]:[]),...(current?[current]:[])]:[];
   const number=value=>Number.isFinite(value)?`${Number(value.toFixed(2))}%`:'—';
   const count=displayed.length||1,font=Math.max(9,Math.min(16,(width-12)/(count*4.8+1)));
   const r=Math.max(7,Math.min(10,font*.65)),left=Math.max(32,r+3,font*2.3),right=Math.max(left,width-left);
   const allFailed=active&&!available.length,min=!active||allFailed?0:Math.min(...available.map(n=>Math.min(150,n.percent)));
   const high=!active?(data?.scale_max||100):allFailed?(last?.percent||100):Math.max(min,Math.min(150,current?.percent??150));
   const position=value=>high===min?right:left+(Math.min(high,Math.max(min,value))-min)/Math.max(1e-9,high-min)*(right-left);
   const ordered=displayed.toSorted((a,b)=>(a.percent??Infinity)-(b.percent??Infinity)||Number(a.current)-Number(b.current));
   // Pack circles independently from labels: colliding circles touch, while
   // labels retain readable horizontal spacing with small leader lines.
   ordered.forEach((node,index)=>{
    node={...node};ordered[index]=node;
    const parts=this.node(node.id);parts.circle.setAttribute('r',r);
    // SVG strokes extend half their width outside the radius on each side.
    node.outerRadius=r+(parseFloat(getComputedStyle(parts.circle).strokeWidth)||2)/2;
    node.trueX=node.current&&!allFailed?right:position(node.percent??high);
    const previous=ordered[index-1];
    node.x=Math.max(node.trueX,previous?previous.x+previous.outerRadius+node.outerRadius:left);
   });
   const excess=Math.max(0,(ordered.at(-1)?.x||right)-right);ordered.forEach(n=>n.x-=excess);
   const labelDistance=font*4.5+4;
   ordered.forEach((node,index)=>{node.labelX=Math.max(node.x,index?ordered[index-1].labelX+labelDistance:left);});
   const labelExcess=Math.max(0,(ordered.at(-1)?.labelX||right)-right);ordered.forEach(n=>n.labelX-=labelExcess);
   const appearance=getComputedStyle(this.row.closest('.app')||this.row),color=key=>appearance.getPropertyValue(key).trim();
   const trip=color('--timer-trip-color')||'#0053e2',overtime=color('--timer-overtime-color')||'#ff5c5c';
   const phase=data?.all_failed||data?.phase==='overtime'?overtime:data?.phase==='b-game'?color('--timer-tolerance-color')||'#2e7d32':trip;
   const segment=data?.down?color('--timer-down-color')||'#5f6772':phase;
   this.track.setAttribute('x',left);this.track.setAttribute('width',Math.max(0,right-left));
   const currentX=active?(ordered.find(n=>n.current)?.x??left):right;
   this.fill.setAttribute('x',data?.all_failed?currentX:left);this.fill.setAttribute('width',Math.max(0,data?.all_failed?right-currentX:currentX-left));this.fill.style.fill=data?.all_failed?(data?.down?color('--timer-down-color')||'#5f6772':overtime):trip;
   const targetX=ordered.find(n=>n.id===target?.id)?.x??right;
   this.segment.setAttribute('x',targetX);this.segment.setAttribute('width',Math.max(0,currentX-targetX));this.segment.style.fill=segment;
   this.ticks.replaceChildren();if((!active||allFailed)&&data?.available){const zero=svgElement('text',{x:left,y:84,'text-anchor':'middle',class:'goal-bar-zero'});zero.textContent='0%';this.ticks.append(zero);}
   const leftCompressed=Boolean(data?.available&&active&&min>0&&!allFailed);
   const rightCompressed=Boolean(data?.available&&active&&goals.some(node=>node.failed));
   this.svg.dataset.compressedLeft=String(leftCompressed);this.svg.dataset.compressedRight=String(rightCompressed);
   this.leftCompression.style.display=leftCompressed?'':'none';
   this.leftCompression.setAttribute('d',`M ${left-17} 51 L ${left-30} 58 L ${left-17} 65 Z`);
   this.rightCompression.style.display=rightCompressed?'':'none';
   this.rightCompression.setAttribute('aria-hidden','true');
   this.rightCompression.style.transform=`translate(${right+24}px, 58px)`;
   const showing=new Set(ordered.map(n=>n.id));
   for(const [id,parts] of this.nodes){if(showing.has(id))continue;const old=this.previous.get(id),latest=data?.nodes?.find(n=>n.id===id),exiting=latest?.failed&&!old?.failed&&!this.initial;parts.time.style.opacity='0';parts.percent.style.opacity='0';parts.group.setAttribute('aria-hidden','true');parts.group.setAttribute('tabindex','-1');parts.group.style.pointerEvents='none';
    parts.group.classList.toggle('is-failed',Boolean(latest?.failed));if(exiting)parts.glyph.textContent='×';
    this.move(parts.group,id,width+40,58,{arc:exiting?32:0,exit:true}).then(()=>{if(!this.displaying?.has(id)){parts.group.remove();if(this.nodes.get(id)===parts)this.nodes.delete(id);}});
   }
   this.displaying=showing;
   ordered.forEach((node,index)=>{
    const parts=this.node(node.id),old=this.previous.get(node.id);parts.group.removeAttribute('aria-hidden');parts.group.style.pointerEvents='';
    parts.group.classList.toggle('is-current',Boolean(node.current));parts.group.classList.toggle('is-failed',Boolean(node.failed));
    const label=node.id==='total'?(this.state?.goal_bar_total_label||node.label):node.label;
    parts.caption.style.fontSize=`${Math.min(10,font*.625)}px`;
    const detailed=Boolean(node.current||node.id===target?.id||(allFailed&&node.id==='standard'));
    parts.group.dataset.details=String(detailed);
    parts.caption.textContent=active&&detailed?({'elapsed':'Time Elapsed','remaining':'Time Remaining','calculated-end':'End Time'}[data.time_mode]||''):'';
    parts.time.textContent=!active||!detailed?'':node.time||'—';parts.percent.textContent=detailed?number(node.percent):'';parts.label.textContent=node.failed?`${label} ×`:label;
    parts.time.style.opacity=!active||!detailed?'0':'1';parts.percent.style.opacity=detailed?'1':'0';parts.time.style.fontSize=parts.percent.style.fontSize=`${font}px`;
    const labelOffset=node.labelX-node.x;
    for(const text of [parts.caption,parts.time,parts.percent,parts.label])text.setAttribute('x',labelOffset);
    if(Math.abs(labelOffset)>1&&!node.failed){
     if(active&&detailed)this.ticks.append(svgElement('path',{d:`M ${node.x} ${58-r} L ${node.labelX} 40`,fill:'none',stroke:'#c6def5',opacity:.65}));
     this.ticks.append(svgElement('path',{d:`M ${node.x} ${58+r} L ${node.labelX} 76`,fill:'none',stroke:'#c6def5',opacity:.65}));
    }
    parts.circle.setAttribute('r',r);parts.glyph.textContent=node.current?'●':node.failed?'×':node.id==='standard'?'S':node.id==='trip'?'T':label?.[0]||'G';
    const stroke=node.id==='total'?'#55d5fb':node.id==='trip'?'#ffc220':'#fff';parts.group.style.setProperty('--goal-node-color',stroke);
    const description=[label,node.time,number(node.percent),node.failed?'Missed':''].filter(Boolean).join(' · ');parts.title.textContent=description;parts.group.setAttribute('aria-label',description);
    const previousIndex=this.order?.indexOf(node.id),arc=previousIndex>=0&&previousIndex!==index?28+index*22:0;
    this.move(parts.group,node.id,node.x,58,{arc});
    if(!this.initial&&old&&!old.failed&&node.failed&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
     const stroke=(node.outerRadius-r)*2;
     // Grow the miss pulse inward so its outer edge never invades a neighbor.
     parts.circle.animate([{r:`${r}px`,strokeWidth:stroke},{r:`${Math.max(0,r-2)}px`,strokeWidth:stroke+4},{r:`${r}px`,strokeWidth:stroke}],{duration:450});
    }
    parts.tick.setAttribute('stroke',stroke);
   });
   this.svg.setAttribute('aria-label',[data?.available?'Goal bar · Edit goals · '+(data.time_mode||''):'Goal bar · Edit goals',leftCompressed?'Scale compressed on left':'',rightCompressed?'Missed goals compressed on right':''].filter(Boolean).join(' · '));
   this.order=ordered.map(n=>n.id);this.previous=new Map((data?.nodes||[]).map(n=>[n.id,n]));this.initial=false;
  }
 }
 const goalDetailObservers=new WeakMap();
 function fitGoalDetails(host){
  if(!host.isConnected)return;
  const style=getComputedStyle(host),available=host.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  for(const line of host.querySelectorAll('.goal-details > div:not([hidden])')){
   line.style.fontSize='';const size=parseFloat(getComputedStyle(line).fontSize),range=document.createRange();range.selectNodeContents(line);
   const width=range.getBoundingClientRect().width;if(width>available&&available>0)line.style.fontSize=`${Math.floor(size*available/width*10)/10}px`;
  }
 }
 function displayApp(root){return root.matches?.('.app')?root:root.querySelector('.app')||root.querySelector('.percent-summary')?.closest('.app');}
 globalThis.WMOFTimerSummaryView={renderGoalDetails(host,details){
  if(!host)return;
  let box=host.querySelector(':scope > .goal-details');
  if(!box){box=document.createElement('div');box.className='goal-details';host.append(box);}
  box.hidden=!details;if(!details)return;
  const format=value=>Number.isFinite(value)?`${Number(value.toFixed(2))}%`:'---';
  const option=host.matches('.auto-goal-option'),pad=host.id==='numberPadContext';
  if(pad)for(const node of [...host.childNodes])if(node.nodeType===Node.TEXT_NODE)node.remove();
  const heading=option&&host.querySelector(':scope > span');if(heading)heading.hidden=true;
  box.replaceChildren(...[['actual','67ef1f5b-6dc4-49ad-a50e-f98a170a3e12',details.actual_percent],['inferred','f5fe1d41-f859-4869-ac1e-e361598373fc',details.inferred_percent]].map(([key,id,value])=>{const line=document.createElement('div');line.dataset.goalDetail=key;line.textContent=(option||pad)&&key==='actual'?WMOFLanguagePack.text('a63d5a6f-a680-487d-8fdd-6822b629d3eb',{scope:details.scope_label,value:format(value)}):WMOFLanguagePack.text(id,{value:format(value)});line.hidden=key==='inferred'&&(option||pad)&&(details.scope==='trip'||!details.trip_active);return line;}));
  if(option||pad){if(!goalDetailObservers.has(host)){const observer=new ResizeObserver(()=>requestAnimationFrame(()=>fitGoalDetails(host)));observer.observe(host);goalDetailObservers.set(host,observer);}requestAnimationFrame(()=>fitGoalDetails(host));}
 },setMode(root,mode){
  const app=displayApp(root),row=root.querySelector('.percent-summary');if(!app||!row)return;
  const normalized=mode==='bar'?'bar':'classic';if(row.dataset.percentageDisplay!==normalized)GoalBar.instances.get(row)?.reset();
  app.dataset.percentageDisplay=normalized;row.dataset.percentageDisplay=normalized;
  row.classList.toggle('is-goal-bar',normalized==='bar');PercentSummaryLayout.instances.get(row)?.fit();
 },render(root,state){
  const row=root.querySelector('.percent-summary');
  if(state && Object.hasOwn(state,'effective_goal_type')){
   const sync=row?.querySelector('.goal-sync-button');
   if(sync)sync.hidden=state.effective_goal_type!=='trip';
  }
  const syncButton=row?.querySelector('.goal-sync-button');
  if(syncButton){
   let badge=syncButton.querySelector(':scope > .sync-override-badge');
   if(!badge){badge=syncButton.ownerDocument.createElement('span');badge.className='sync-override-badge';badge.setAttribute('aria-hidden','true');syncButton.append(badge);}
   const usingOverride=state?.sync_override_in_use===true;
   badge.hidden=!usingOverride;
   syncButton.classList.toggle('sync-override-in-use',usingOverride);
  }
  if(row){
   const mode=displayApp(root)?.dataset.percentageDisplay||'classic';
   row.dataset.percentageDisplay=mode;row.classList.toggle('is-goal-bar',mode==='bar');
   if(mode==='bar')GoalBar.attach(row).update(state);
  }
  PercentSummaryLayout.attach(row);
  for(const [id,text] of [['standardTimeValue',state?.standard_time_component?.text],['renderedTimeValue',state?.time_component?.text],['currentPercentValue',state?.current_percent_component?.text],['goalPercentValue',state?.goal_component?.text]]){const e=root.querySelector('#'+id);if(e)e.textContent=text||'-';}
  for(const [id,key] of [['standardTimeLabel','standard_time_header_text'],['renderedTimeLabel','time_header_text']]){const e=root.querySelector('#'+id);if(e&&state?.[key])e.textContent=state[key];}
 }};
})();
