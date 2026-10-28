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
   const app=row.closest('.app'),clock=app?.querySelector('clock-timer');
   if(clock)this.resize.observe(clock);
   if(app){const keys=['data-speech-active','data-trip-log-pinned','data-action-display','data-percentage-display','data-compact-timed','data-interval-state'],snapshot=()=>keys.map(k=>app.getAttribute(k)).join('|');this.layoutKey=snapshot();this.layoutChanges=new MutationObserver(()=>{const key=snapshot();if(key!==this.layoutKey){this.layoutKey=key;this.watchBalance();}});this.layoutChanges.observe(app,{attributes:true,attributeFilter:keys});}
   row.ownerDocument.fonts?.ready.then(schedule);
   schedule();
  }
  watchBalance(){
   this.balanceUntil=performance.now()+1100;if(this.balanceFrame)return;
   const step=()=>{this.balance();if(performance.now()<this.balanceUntil)this.balanceFrame=requestAnimationFrame(step);else this.balanceFrame=0;};this.balanceFrame=requestAnimationFrame(step);
  }
  balance(){
   const row=this.row,app=row.closest('.app'),clock=app?.querySelector('clock-timer');if(!clock||app.clientHeight<300)return;
   const visible=e=>e&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';
   const timer=app.querySelector('.compact-interval-timer'),topElements=visible(timer)&&!timer.hidden?[...timer.children]:[...app.querySelectorAll('#standardTimeLabel,#standardTimeValue,#renderedTimeLabel,#renderedTimeValue')];
   const top=Math.max(...topElements.filter(visible).map(e=>e.getBoundingClientRect().bottom));
   const controls=app.querySelector('.trip-action-controls');let bottom;
   if(app.dataset.actionDisplay!=='compact'&&visible(controls)&&controls.getBoundingClientRect().height>0)bottom=controls.getBoundingClientRect().top;
   else if(visible(clock)){
    const rect=clock.getBoundingClientRect(),insets=[...clock.children].filter(e=>e.localName==='ring-container'&&parseFloat(e.renderedWidth)>0).map(e=>parseFloat(e.renderedInset)).filter(Number.isFinite);
    bottom=rect.top+(insets.length?Math.min(...insets):0);
   }
   if(!Number.isFinite(top)||!Number.isFinite(bottom))return;
   let barTop,barBottom;
   if(row.dataset.percentageDisplay==='bar'){
    const svg=row.querySelector('.goal-bar-svg');if(!svg||!svg.dataset.visibleTop)return;const rect=svg.getBoundingClientRect();barTop=rect.top+Number(svg.dataset.visibleTop);barBottom=rect.top+Number(svg.dataset.visibleBottom);
   }else{
    const boxes=[...row.querySelectorAll(':scope > strong,:scope > span,:scope > .percent-value-button')].filter(visible).map(e=>e.getBoundingClientRect());if(!boxes.length)return;barTop=Math.min(...boxes.map(b=>b.top));barBottom=Math.max(...boxes.map(b=>b.bottom));
   }
   const old=Number(row.dataset.verticalBalance)||0,height=barBottom-barTop;if(bottom-top<height+8)return;
   const shift=(barTop+barBottom)/2+old-(top+bottom)/2;
   if(Math.abs(shift-old)>.15){row.dataset.verticalBalance=String(shift);row.style.translate=`0 ${-shift}px`;}
   row.dataset.topGap=String(barTop+old-shift-top);row.dataset.bottomGap=String(bottom-barBottom-old+shift);
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
   row.style.gridTemplateColumns=`minmax(0, 1fr) ${widths[0]*scale+1}px ${widths[1]*scale+1+2*gap}px ${widths[2]*scale+1}px minmax(0, 1fr) ${badgeWidth}px`;this.balance();
  }
 }
 const svgNS='http://www.w3.org/2000/svg';
 const svgElement=(name,attributes={})=>{const e=document.createElementNS(svgNS,name);for(const [key,value] of Object.entries(attributes))e.setAttribute(key,value);return e;};
 function goalFont(parts,size){parts.time.style.fontSize=parts.percent.style.fontSize=size+'px';for(const text of parts.ghost?.children||[])text.style.fontSize=size+'px';}
 const near=(a,b)=>Math.abs(a-b)<1e-6;
 // Eight cubic segments in both forms: the facing curves become the corridor.
 function goalShape(radius,merged=false){
  const f=n=>Number(n.toFixed(4));let values=[];
  if(!merged){
   const step=Math.PI/4,k=4/3*Math.tan(step/4);values=[0,-radius];
   for(let i=0;i<8;i++){const a=-Math.PI/2+i*step,b=a+step;values.push(radius*(Math.cos(a)-k*Math.sin(a)),radius*(Math.sin(a)+k*Math.cos(a)),radius*(Math.cos(b)+k*Math.sin(b)),radius*(Math.sin(b)-k*Math.cos(b)),radius*Math.cos(b),radius*Math.sin(b));}
  }else{
   const r=radius,h=r*.45,gap=4,c=Math.sqrt(r*r-h*h)+gap/2,k=.55228475*r;
   values=[0,-h,gap/2,-h,c-r*.8,-r,c,-r,c+k,-r,c+r,-k,c+r,0,c+r,k,c+k,r,c,r,c-r*.8,r,gap/2,h,0,h,-gap/2,h,-c+r*.8,r,-c,r,-c-k,r,-c-r,k,-c-r,0,-c-r,-k,-c-k,-r,-c,-r,-c+r*.8,-r,-gap/2,-h,0,-h];
  }
  return `M ${values.slice(0,2).map(f).join(' ')} `+Array.from({length:8},(_,i)=>'C '+values.slice(2+i*6,8+i*6).map(f).join(' ')).join(' ')+' Z';
 }
 class TimerSpaceLayout{
  static views=new WeakMap();
  static attach(app){if(!app?.querySelector('.clock-region')||this.views.has(app))return;this.views.set(app,new this(app));}
  constructor(app){this.app=app;const schedule=()=>{if(this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=0;this.fit();});};this.resize=new ResizeObserver(schedule);this.resize.observe(app);this.mutations=new MutationObserver(schedule);this.mutations.observe(app,{attributes:true,attributeFilter:['data-percentage-display','data-action-display','data-trip-state','data-interval-state','data-speech-active','data-trip-log-pinned','data-compact-timed']});schedule();}
  fit(){
   const app=this.app;if(app.dataset.percentageDisplay!=='bar'||app.clientHeight<300)return;
   const style=getComputedStyle(app),px=name=>parseFloat(style.getPropertyValue(name))||0;
   const compact=app.dataset.actionDisplay==='compact',down=app.dataset.intervalState==='down';
   const header=app.querySelector('.app-header')?.getBoundingClientRect().height||42,summary=px('--timer-summary-header-height')||78;
   const footer=px('--trip-log-row-height')+px('--speech-command-row-height')+px('--speech-mic-row-height');
   const rails=compact?(app.clientHeight<=650?104:132):0;
   const contentWidth=app.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),contentHeight=app.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
   const clock=down&&!compact?0:compact?Math.max(0,contentWidth-rails):contentWidth*.8;
   const controls=compact?0:down?(app.clientHeight<=650?156:230):app.querySelector('.trip-action-controls')?.getBoundingClientRect().height||0;
   const reserve=compact&&app.dataset.compactTimed==='true'?(app.clientHeight<=650?64:76):0;
   const minimum=down?164:140;const spare=contentHeight-header-summary-footer-controls-reserve-clock-24-minimum;
   const height=Math.round(Math.max(minimum,Math.min(200,minimum+Math.max(0,spare)*.5)));
   if(app.style.getPropertyValue('--goal-bar-height')!==height+'px')app.style.setProperty('--goal-bar-height',height+'px');
   const space=contentHeight-header-summary-footer-controls-reserve;const diameter=Math.max(0,Math.min(clock,space-height-16)),leading=down&&!compact?0:Math.max(0,(space-height-diameter-16)/2);
   for(const [name,value] of [['--goal-bar-leading-space',leading],['--clock-stage-diameter',diameter]])if(app.style.getPropertyValue(name)!==value+'px')app.style.setProperty(name,value+'px');
  }
 }
 class GoalBar{
  static instances=new WeakMap();static sequence=0;
  static attach(row){if(!this.instances.has(row))this.instances.set(row,new this(row));return this.instances.get(row);}
  constructor(row){
   this.row=row;this.nodes=new Map();this.previous=new Map();this.units=[];this.motion=new Map();this.prefix='goal-shape-'+(++GoalBar.sequence);
   this.svg=svgElement('svg',{class:'goal-bar-svg',role:'button',tabindex:0,'aria-label':'Goal bar · Edit goals',viewBox:'0 0 300 112'});
   this.track=svgElement('rect',{class:'goal-bar-track'});this.outline=svgElement('rect',{class:'goal-bar-outline','aria-hidden':'true'});this.fill=svgElement('rect',{class:'goal-bar-fill'});this.segment=svgElement('rect',{class:'goal-bar-segment'});
   this.connectors=svgElement('g',{class:'goal-bar-connectors','aria-hidden':'true'});this.layer=svgElement('g');
   this.leftCompression=svgElement('path',{class:'goal-bar-compression goal-bar-compression-left',fill:'#c6def5','aria-hidden':'true'});
   this.rightCompression=svgElement('g',{class:'goal-bar-compression goal-bar-compression-right','aria-hidden':'true'});this.rightCompression.append(svgElement('rect',{x:-12,y:-20,width:24,height:40,fill:'transparent'}),svgElement('path',{d:'M -6 -7 L 7 0 L -6 7 Z',fill:'#c6def5'}));
   const activate=()=>{const mode=this.state?.goal_type,choices=mode==='trip'?['trip']:mode==='total'?['total']:['trip','total'];this.row.dispatchEvent(new CustomEvent('goal-bar-edit',{bubbles:true,detail:{choices}}));};
   this.svg.addEventListener('click',event=>{if(event.target.closest?.('.goal-bar-track,.goal-bar-fill,.goal-bar-segment,.goal-bar-outline,.goal-bar-node,.goal-bar-compression'))activate();});this.svg.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();activate();}});
   this.svg.append(this.track,this.fill,this.segment,this.outline,this.connectors,this.layer,this.leftCompression,this.rightCompression);row.append(this.svg);this.avatar=globalThis.WMOFGoalBarAvatar?.create(this.svg,row);
   this.probe=svgElement('text',{'aria-hidden':'true',visibility:'hidden'});this.probe.style.pointerEvents='none';this.svg.append(this.probe);this.widthDigits=new Map();
   this.resize=new ResizeObserver(()=>this.schedule());this.resize.observe(this.svg);TimerSpaceLayout.attach(row.closest('.app'));
  }
  reduced(){return this.initial||matchMedia('(prefers-reduced-motion: reduce)').matches;}
  reset(){for(const animation of this.motion.values())animation.cancel();this.motion.clear();this.layer.replaceChildren();this.nodes.clear();this.units=[];this.previous.clear();this.initial=true;}
  update(state){this.avatar?.update(state,this.row.dataset.percentageDisplay==='bar');const key=state?.trip_start_component?.value??null;if(key!==this.key){this.reset();this.key=key;}this.state=state;this.schedule();}
  schedule(){if(this.frame)return;this.frame=requestAnimationFrame(()=>{this.frame=0;this.draw();});}
  tween(element,key,from,to,{duration=360,force=false,frames}={}){
   if(!force&&Object.entries(to).every(([k,v])=>element.style[k]===v))return Promise.resolve();
   this.motion.get(key)?.cancel();for(const [k,v] of Object.entries(to))element.style[k]=v;
   if(this.reduced())return Promise.resolve();
   const animation=element.animate(frames||[from,to],{duration,easing:'ease-in-out'});this.motion.set(key,animation);
   return animation.finished.catch(()=>{}).then(()=>{if(this.motion.get(key)===animation)this.motion.delete(key);});
  }
  move(element,key,x,y,{bounds}={}){
   // CSS serializes translations at limited precision. Comparing its string to
   // an unrounded coordinate restarted the same tween on every resize/render.
   if(element.style.transform){const destination=new DOMMatrix(element.style.transform);if(Math.abs(destination.m41-x)<.01&&Math.abs(destination.m42-y)<.01)return Promise.resolve();}
   let from=getComputedStyle(element).transform;if(from==='none')from=`translate(${x}px, ${y}px)`;
   if(bounds){const matrix=new DOMMatrix(from);from=`translate(${Math.max(bounds[0],Math.min(bounds[1],matrix.m41))}px, ${y}px)`;}
   return this.tween(element,key,{transform:from},{transform:`translate(${x}px, ${y}px)`});
  }
  node(id){
   if(this.nodes.has(id))return this.nodes.get(id);
   const group=svgElement('g',{class:'goal-bar-node','data-node-id':id}),markerGroup=svgElement('g'),stack=svgElement('g',{class:'goal-bar-value-stack'});
   const marker=svgElement('path',{class:'goal-bar-marker'}),glyph=svgElement('text',{'text-anchor':'middle',class:'goal-bar-glyph'}),glyph2=svgElement('text',{'text-anchor':'middle',class:'goal-bar-glyph'});
   const targetFrame=svgElement('rect',{class:'goal-bar-target-frame',rx:5,fill:'none','stroke-width':1.5});
   const time=svgElement('text',{'text-anchor':'middle',class:'goal-bar-time'}),percent=svgElement('text',{'text-anchor':'middle',class:'goal-bar-percent'}),title=svgElement('title');
   const defs=svgElement('defs'),gradient=svgElement('linearGradient',{id:this.prefix+'-'+id,x1:'0%',x2:'100%'});gradient.append(svgElement('stop',{offset:'30%','stop-color':'#ffc220'}),svgElement('stop',{offset:'70%','stop-color':'#55d5fb'}));defs.append(gradient);
   markerGroup.append(marker,glyph,glyph2);
   stack.append(targetFrame,time,percent);group.append(defs,markerGroup,stack,title);this.layer.append(group);
   const parts={group,markerGroup,stack,marker,glyph,glyph2,targetFrame,time,percent,title,fresh:true};this.nodes.set(id,parts);return parts;
  }
  makeUnits(data){
   const raw=(data.nodes||[]).map(n=>n.current&&n.unbounded?{...n,percent:Math.max(150,...(data.nodes||[]).filter(g=>!g.current&&Number.isFinite(g.percent)).map(g=>g.percent)),percentText:"\u2014"}:n).filter(n=>Number.isFinite(n.percent)&&(n.current||n.percent>0)),goals=raw.filter(n=>!n.current),available=goals.filter(n=>!n.failed),allFailed=data.active!==false&&!available.length;
   const visible=raw.filter(n=>n.current||!n.failed||n.id==='standard'||near(n.percent,100));
   const units=[],goalsToGroup=visible.filter(n=>!n.current&&n.id!=='standard');
   for(const goal of goalsToGroup){let unit=units.find(u=>near(u.percent,goal.percent));if(!unit){unit={...goal,members:[]};units.push(unit);}unit.members.push(goal.id);unit.failed=unit.failed&&goal.failed;}
   for(const unit of units){
    unit.members.sort((a,b)=>({trip:0,total:1}[a]??0)-({trip:0,total:1}[b]??0));
    const unchanged=unit.members.find(id=>near(this.previous.get(id)?.percent??NaN,unit.percent));
    const previousOwner=this.units.find(u=>near(u.percent,unit.percent)&&unit.members.includes(u.id));
    unit.id=previousOwner?.id||unchanged||unit.members[0];unit.merged=unit.members.length>1;
   }
   for(const node of visible.filter(n=>n.current||n.id==='standard'))units.push({...node,members:[node.id]});
   units.sort((a,b)=>a.percent-b.percent||Number(a.current)-Number(b.current)||(a.id==='standard'?-1:b.id==='standard'?1:0));
   return {raw,goals,available,allFailed,units};
  }
  currentPercentWidth(unit,parts){
   const style=getComputedStyle(parts.percent),fields=['fontFamily','fontSize','fontWeight','fontStyle','fontStretch','fontVariantNumeric','fontFeatureSettings','letterSpacing'],key=fields.map(name=>style[name]).join('|');
   for(const name of fields)this.probe.style[name]=style[name];
   let digit=this.widthDigits.get(key);
   if(digit===undefined){let widest=-1;for(const value of '0123456789'){this.probe.textContent=value;const width=this.probe.getComputedTextLength();if(width>widest){widest=width;digit=value;}}if(this.widthDigits.size>64)this.widthDigits.clear();this.widthDigits.set(key,digit);}
   const rounded=Number(Math.abs(unit.percent).toFixed(2)),digits=Math.max(1,String(Math.floor(rounded)).length);
   this.probe.textContent=digit.repeat(digits)+'.'+digit.repeat(2)+'%';
   parts.group.dataset.percentDigits=String(digits);
   const width=this.probe.getComputedTextLength();parts.group.dataset.reservedPercentWidth=String(width);return width;
  }
  draw(){
   if(this.row.dataset.percentageDisplay!=='bar')return;
   const data=this.state?.goal_bar||{},width=this.svg.getBoundingClientRect().width,height=this.svg.getBoundingClientRect().height;if(!(width>0&&height>0))return;
   this.svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
   const {raw,goals,available,allFailed,units}=this.makeUnits(data),active=data.active!==false,oldUnits=this.units;
   const avatarSpace=this.avatar?.topSpace(this.state)||0;const count=units.length||1,r=Math.max(9,Math.min(25,height*.11)),preferred=Math.max(9,Math.min(28,height*.17,(width-12)/(count*4.1+1),(height-2*(r+5)-avatarSpace-12)/(active?2.6:1.15)));
   const at100=units.find(u=>u.id!=='standard'&&!u.current&&near(u.percent,100)),standard=units.find(u=>u.id==='standard');
   const labelUnits=units.filter(u=>u.id!=='standard'&&(u.current||!u.failed||allFailed&&near(u.percent,100))),padding=6,gap=7;
   const target=(!active&&this.state?.goal_type==="auto"?null:available.find(n=>n.id===this.state?.effective_goal_type))||available.toSorted((a,b)=>b.percent-a.percent)[0];let labelTarget=units.find(u=>u.members.includes(target?.id));if(labelTarget===standard&&at100)labelTarget=at100;
   for(const unit of units){const p=this.node(unit.id);unit.detailed=labelUnits.includes(unit);
    const prior=oldUnits.find(u=>u.members.includes(unit.id));
    if(prior&&!unit.current&&!prior.merged&&!unit.merged&&!near(prior.percent,unit.percent)&&p.percent.textContent&&!this.reduced()){
     p.ghost?.remove();const ghost=p.ghost=svgElement('g',{class:'goal-bar-value-ghost','aria-hidden':'true'});ghost.append(p.time.cloneNode(true),p.percent.cloneNode(true));p.stack.append(ghost);
     p.widthRatio=Math.max(...[...ghost.children].map(e=>e.getComputedTextLength()))/Math.max(1,parseFloat(getComputedStyle(p.time).fontSize));
     this.tween(ghost,unit.id+'-old-values',{opacity:'1'},{opacity:'0'},{force:true,duration:140}).then(()=>{if(p.ghost===ghost){ghost.remove();p.ghost=null;p.widthRatio=0;this.schedule();}});
     this.tween(p.time,unit.id+'-new-time',{opacity:'0'},{opacity:'1'},{force:true});this.tween(p.percent,unit.id+'-new-percent',{opacity:'0'},{opacity:'1'},{force:true});
    }
p.time.textContent=active&&unit.detailed?(unit.time||'—'):'';p.percent.textContent=unit.detailed?(unit.percentText??`${Number(unit.percent.toFixed(2))}%`):'';goalFont(p,preferred);}
   const measure=u=>{const p=this.node(u.id);return Math.max(p.time.getComputedTextLength(),u.current&&!u.percentText?this.currentPercentWidth(u,p):p.percent.getComputedTextLength(),(p.widthRatio||0)*parseFloat(p.time.style.fontSize));};
   const total=labelUnits.reduce((n,u)=>n+measure(u),0),fontScale=Math.min(1,Math.max(1,width-padding*2-gap*Math.max(0,labelUnits.length-1)-(labelUnits.includes(labelTarget)?10:0))/Math.max(1,total));
   let font=preferred*fontScale;for(const unit of labelUnits){const p=this.node(unit.id);goalFont(p,font);unit.half=measure(unit)/2+(unit===labelTarget?5:0);}
   const pin=labelUnits.includes(at100)?at100:undefined,wide=units.some(u=>u.merged)?Math.sqrt(r*r-(r*.45)**2)+2+r+1:0;
   const margin=Math.max(30,(pin?.half||0)+padding+3,wide+(at100?.merged&&active?30:6));let left=margin,right=Math.max(left,width-margin);
   const low=!active||allFailed?0:Math.min(...available.map(n=>Math.min(150,n.percent))),high=!active?(data.scale_max||100):allFailed?100:Math.max(low,Math.min(150,raw.find(n=>n.current)?.percent??150),units.some(u=>!u.current&&u.failed&&near(u.percent,100))?100:0);
   const position=value=>high===low?right:left+(Math.min(high,Math.max(low,value))-low)/Math.max(1e-9,high-low)*(right-left);
   for(let i=0;i<units.length;i++){
    const unit=units[i],previous=units[i-1];unit.radius=unit.id==='standard'?1:unit.current?4:unit.merged?Math.sqrt(r*r-(r*.45)**2)+2+r+1:r+1;
    unit.x=position(unit.percent);
    if(previous&&!(near(unit.percent,100)&&previous.id==='standard'))unit.x=Math.max(unit.x,previous.x+previous.radius+unit.radius);
   }
   // Resolve crowding from the right without dragging an unrelated left goal
   // back and forth as Current approaches the 100% marker.
   for(let i=units.length-1;i>=0;i--){const unit=units[i],next=units[i+1];unit.x=Math.min(unit.x,next?(unit.id==='standard'&&near(next.percent,100)?next.x:next.x-next.radius-unit.radius):right);}
   if(at100&&standard)standard.x=at100.x;
   // Labels stay within the actual track/marker extent, rather than using the
   // SVG viewport as extra space. Preserve the centered 100% anchor by letting
   // the track include its stack, then center that complete extent once.
   if(pin&&standard)left=Math.min(left,standard.x-pin.half-.75);
   const visualLeft=Math.min(left,...units.map(u=>u.x-u.radius)),visualRight=Math.max(right,...units.map(u=>u.x+u.radius));
   const lc=Boolean(data.available&&active&&low>0&&!allFailed),rc=Boolean(data.available&&active&&goals.some(n=>n.failed));
   const firstNodeEdge=units.length?Math.min(...units.map(u=>u.x-u.radius)):left,lastNodeEdge=units.length?Math.max(...units.map(u=>u.x+u.radius)):right;
   const outerLeft=Math.min(visualLeft,lc?firstNodeEdge-21:visualLeft),outerRight=Math.max(visualRight,rc?lastNodeEdge+25:visualRight);
   const centerShift=width/2-(outerLeft+outerRight)/2;
   left+=centerShift;right+=centerShift;for(const unit of units)unit.x+=centerShift;
   // Boxes, including their border, may use space beneath a continuation
   // arrow when present; otherwise track/node endpoints remain the limit.
   const labelLeft=Math.max(padding,outerLeft+centerShift)+.75,labelRight=Math.min(width-padding,outerRight+centerShift)-.75;
   const labelNeed=labelUnits.reduce((sum,u)=>sum+u.half*2,0)+gap*Math.max(0,labelUnits.length-1);
   if(labelNeed>labelRight-labelLeft){font*=Math.max(.01,(labelRight-labelLeft-gap*Math.max(0,labelUnits.length-1)-(labelUnits.includes(labelTarget)?10:0))/Math.max(1,labelNeed-gap*Math.max(0,labelUnits.length-1)-(labelUnits.includes(labelTarget)?10:0)));for(const unit of labelUnits){const p=this.node(unit.id);goalFont(p,font);unit.half=measure(unit)/2+(unit===labelTarget?5:0);}}
   // Keep the 100% stack centered on Standard and fit other stacks on its side.
   if(pin){
    const i=labelUnits.indexOf(pin),before=labelUnits.slice(0,i),after=labelUnits.slice(i+1);
    const leftNeed=before.reduce((n,u)=>n+u.half*2,0)+(pin.half||0)+gap*before.length,rightNeed=after.reduce((n,u)=>n+u.half*2,0)+(pin.half||0)+gap*after.length;
    // Keep the 100% label centered on Standard, but reserve readable room on
    // both sides. Approaching Current must not squeeze every font toward zero.
    pin.labelX=Math.max(labelLeft+leftNeed,Math.min(labelRight-rightNeed,pin.x));
    pin.x=pin.labelX;if(standard)standard.x=pin.x;
    let edge=pin.labelX-pin.half-gap;for(let j=before.length-1;j>=0;j--){const u=before[j];u.labelX=Math.min(u.x,edge-u.half);edge=u.labelX-u.half-gap;}
    let edgeRight=pin.labelX+pin.half+gap;for(const u of after){u.labelX=Math.max(u.x,edgeRight+u.half);edgeRight=u.labelX+u.half+gap;}
    edge=labelRight;for(let j=after.length-1;j>=0;j--){const u=after[j];u.labelX=Math.min(u.labelX,edge-u.half);edge=u.labelX-u.half-gap;}
   }
   if(!pin&&labelUnits.length){
    let edge=labelLeft;for(const unit of labelUnits){unit.labelX=Math.max(unit.x,edge+unit.half);edge=unit.labelX+unit.half+gap;}
    edge=labelRight;for(let i=labelUnits.length-1;i>=0;i--){const unit=labelUnits[i];unit.labelX=Math.min(unit.labelX,edge-unit.half);edge=unit.labelX-unit.half-gap;}
   }
   for(const unit of units)unit.labelX??=unit.x;
   const halfLine=r+5,timeOffset=halfLine+7+font,percentOffset=active?timeOffset+font*1.25:halfLine+5+font*.8;
   const y=Math.max(halfLine+avatarSpace+2,height-percentOffset-font*.3-6),thickness=Math.max(14,r*1.3);
   this.row.style.setProperty('--goal-bar-sync-offset',(y-height+20)+'px');this.svg.dataset.barY=String(y);this.svg.dataset.markerRadius=String(r);this.svg.dataset.labelLeft=String(labelLeft);this.svg.dataset.labelRight=String(labelRight);this.svg.dataset.visibleTop=String(y-halfLine-avatarSpace-1);this.svg.dataset.visibleBottom=String(y+percentOffset+font*.35+4);
   const appearance=getComputedStyle(this.row.closest('.app')||this.row),color=key=>appearance.getPropertyValue(key).trim(),trip=color('--timer-trip-color')||'#0053e2',overtime=color('--timer-overtime-color')||'#ff5c5c';
   const phase=data.all_failed||data.phase==='overtime'?overtime:data.phase==='b-game'?color('--timer-tolerance-color')||'#2e7d32':trip,segment=data.down?color('--timer-down-color')||'#5f6772':phase;
   const current=units.find(u=>u.current),currentX=active?current?.x??left:right,targetUnit=units.find(u=>u.members.includes(target?.id)),targetX=targetUnit?.x??right;
   for(const element of [this.track,this.fill,this.segment,this.outline]){element.setAttribute('y',y-thickness/2);element.setAttribute('height',thickness);element.setAttribute('rx',thickness/2);}
   this.track.setAttribute('x',left);this.track.setAttribute('width',Math.max(0,right-left));this.outline.setAttribute('x',left);this.outline.setAttribute('width',Math.max(0,right-left));
   this.fill.setAttribute('x',allFailed?currentX:left);this.fill.setAttribute('width',Math.max(0,allFailed?right-currentX:currentX-left));this.fill.style.fill=allFailed?(data.down?color('--timer-down-color')||'#5f6772':overtime):trip;
   this.segment.setAttribute('x',targetX);this.segment.setAttribute('width',Math.max(0,currentX-targetX));this.segment.style.fill=segment;
   this.connectors.replaceChildren();if((!active||allFailed)&&data.available){const zero=svgElement('text',{x:left,y:y+percentOffset,'text-anchor':'middle',class:'goal-bar-zero'});zero.textContent='0%';this.connectors.append(zero);}
   this.svg.dataset.compressedLeft=String(lc);this.svg.dataset.compressedRight=String(rc);
   this.leftCompression.style.display=lc?'':'none';const firstEdge=units.length?Math.min(...units.map(u=>u.x-u.radius)):left,lastEdge=units.length?Math.max(...units.map(u=>u.x+u.radius)):right;this.leftCompression.setAttribute('d',`M ${firstEdge-8} ${y-7} L ${firstEdge-21} ${y} L ${firstEdge-8} ${y+7} Z`);this.rightCompression.style.display=rc?'':'none';this.rightCompression.style.transform=`translate(${lastEdge+18}px, ${y}px)`;
   this.displaying=new Set(units.map(u=>u.id));
   for(const [id,parts] of this.nodes){
    if(this.displaying.has(id))continue;if(parts.exiting)continue;parts.exiting=true;parts.group.setAttribute('aria-hidden','true');parts.group.style.pointerEvents='none';
    const mergedInto=units.find(u=>u.members.includes(id)),old=oldUnits.find(u=>u.id===id);
    let finished;
    if(mergedInto){
     this.move(parts.markerGroup,id,mergedInto.x,y);this.move(parts.stack,id+'-values',mergedInto.labelX,y);
     this.tween(parts.stack,id+'-fade',{opacity:getComputedStyle(parts.stack).opacity},{opacity:'0'});
     finished=this.tween(parts.markerGroup,id+'-marker-fade',{opacity:getComputedStyle(parts.markerGroup).opacity},{opacity:'0'});
    }else{
     const final=`translate(${width-(old?.x||0)+40}px, 0px)`;const animation=parts.group.animate([{transform:'translate(0px,0px)',opacity:1},{transform:`translate(${width-(old?.x||0)+10}px,-${r*2}px)`,opacity:.5},{transform:final,opacity:0}],{duration:this.reduced()?0:360,easing:'ease-in-out'});finished=animation.finished.catch(()=>{});this.motion.set(id+'-exit',animation);
    }
    finished.then(()=>{if(!this.displaying.has(id)){parts.group.remove();if(this.nodes.get(id)===parts)this.nodes.delete(id);}});
   }
   for(const unit of units){
    const parts=this.node(unit.id),source=oldUnits.find(u=>u.members.includes(unit.id)),changed=source&&!near(source.percent,unit.percent),split=source?.merged&&!unit.merged;
    if(parts.exiting){for(const key of [unit.id+'-exit',unit.id+'-marker-fade',unit.id+'-fade'])this.motion.get(key)?.cancel();parts.exiting=false;parts.group.style.transform='';parts.group.style.opacity='1';}
    if(source&&(parts.fresh||source.id!==unit.id)){
     parts.markerGroup.style.transform=`translate(${source.x}px, ${y}px)`;parts.stack.style.transform=`translate(${source.labelX}px, ${y}px)`;
     if(!unit.current&&unit.id!=='standard')parts.marker.setAttribute('d',goalShape(source.radiusValue||r,source.merged&&!changed));
     if(source.merged&&changed){const c=Math.sqrt(r*r-(r*.45)**2)+2;parts.markerGroup.style.transform=`translate(${source.x+(source.members.indexOf(unit.id)===0?-c:c)}px, ${y}px)`;parts.markerGroup.style.opacity='0';}
    }
    parts.group.removeAttribute('aria-hidden');parts.group.style.pointerEvents='';parts.group.dataset.members=unit.members.join(' ');parts.group.dataset.details=String(unit.detailed);parts.group.dataset.merged=String(Boolean(unit.merged));
    parts.group.classList.toggle('is-current',Boolean(unit.current));parts.group.classList.toggle('is-failed',Boolean(unit.failed));
    const members=unit.members.map(id=>raw.find(n=>n.id===id)).filter(Boolean),label=n=>n.id==='total'?(this.state.goal_bar_total_label||n.label):n.label;
    parts.title.textContent=[members.map(label).join(' + '),unit.time,(unit.percentText??`${Number(unit.percent.toFixed(2))}%`),unit.failed?'Missed':''].filter(Boolean).join(' · ');parts.group.setAttribute('aria-label',parts.title.textContent);
    const stroke=unit.id==='total'?'#55d5fb':unit.id==='trip'?'#ffc220':'#fff';parts.marker.style.fill=unit.id==='standard'||unit.current?'none':'#001e60';parts.marker.style.stroke=unit.merged?`url(#${this.prefix}-${unit.id})`:stroke;parts.group.style.setProperty('--goal-node-color',stroke);
    if(unit.id==='standard'||unit.current){parts.marker.setAttribute('d',unit.current?`M -3 -${halfLine} V ${halfLine} M 3 -${halfLine} V ${halfLine}`:`M 0 -${halfLine} V ${halfLine}`);parts.marker.setAttribute('stroke-dasharray',unit.id==='standard'?'3 3':'none');parts.glyph.textContent=parts.glyph2.textContent='';}
    else{
     const d=goalShape(r,unit.merged),oldD=getComputedStyle(parts.marker).d;parts.marker.setAttribute('stroke-dasharray','none');
     if(parts.marker.getAttribute('d')!==d){parts.marker.setAttribute('d',d);if(oldD!=='none')this.tween(parts.marker,unit.id+'-shape',{d:oldD},{d:`path("${d}")`},{force:true});}
     const center=Math.sqrt(r*r-(r*.45)**2)+2;
     parts.glyph.textContent=parts.glyph2.textContent='';delete parts.glyph.dataset.goalId;delete parts.glyph2.dataset.goalId;
     for(const [index,member] of members.entries()){
      const text=member.id==='trip'?parts.glyph:parts.glyph2;
      if(unit.merged&&!source?.merged){const prior=oldUnits.find(u=>u.members.includes(member.id));if(prior)text.style.transform=`translateX(${prior.x-unit.x}px)`;}
      else if(split&&!changed)text.style.transform=`translateX(${source.members.indexOf(unit.id)===0?-center:center}px)`;
      text.dataset.goalId=member.id;text.textContent=member.id==='trip'?'T':label(member)?.[0]||'G';text.style.fill=member.id==='trip'?'#ffc220':'#55d5fb';text.style.fontSize=r*1.15+'px';text.setAttribute('y',r*.4);
      this.tween(text,unit.id+'-glyph-'+member.id,{transform:getComputedStyle(text).transform==='none'?'translateX(0px)':getComputedStyle(text).transform},{transform:`translateX(${unit.merged?(index===0?-center:center):0}px)`});
     }
     if(unit.merged){const gradient=parts.group.querySelector('linearGradient');gradient.children[0].setAttribute('stop-color',members[0].id==='trip'?'#ffc220':'#55d5fb');gradient.children[1].setAttribute('stop-color',members[1].id==='trip'?'#ffc220':'#55d5fb');}
    }
    parts.time.setAttribute('y',timeOffset);parts.percent.setAttribute('y',percentOffset);
    parts.group.dataset.target=String(unit===labelTarget);if(unit===labelTarget){parts.targetFrame.setAttribute('x',-(unit.half||0));const percentBox=parts.percent.getBBox(),timeBox=parts.time.getBBox(),top=active&&parts.time.textContent?Math.min(timeBox.y,percentBox.y):percentBox.y,bottom=percentBox.y+percentBox.height;parts.targetFrame.setAttribute('y',top-4);parts.targetFrame.setAttribute('width',(unit.half||0)*2);parts.targetFrame.setAttribute('height',bottom-top+8);parts.targetFrame.style.stroke=unit.merged?`url(#${this.prefix}-${unit.id})`:stroke;}this.tween(parts.targetFrame,unit.id+'-target-border',{opacity:parts.targetFrame.style.opacity||'0'},{opacity:unit===labelTarget?'1':'0'});
    const crossing=changed&&oldUnits.some(other=>other.detailed&&other.id!==source.id&&units.some(next=>next.id===other.id&&(source.labelX-other.labelX)*(unit.labelX-next.labelX)<0));
    if(crossing&&parts.ghost){this.layer.append(parts.ghost);parts.ghost.style.transform=`translate(${source.labelX}px, ${y}px)`;}
    if(split&&changed)parts.stack.style.opacity='0';
    if(unit.detailed&&!(split&&changed))parts.stack.style.opacity='1';
    this.move(parts.markerGroup,unit.id,unit.x,y);
    const bounds=[labelLeft+(unit.half||0),labelRight-(unit.half||0)];
    if(unit===at100&&standard){const line=this.node('standard');const matrix=getComputedStyle(line.markerGroup).transform;if(matrix!=='none'&&parts.fresh)parts.stack.style.transform=`translate(${new DOMMatrix(matrix).m41}px, ${y}px)`;}
    this.move(parts.stack,unit.id+'-values',unit.labelX,y,{bounds});
    this.tween(parts.stack,unit.id+'-fade',{opacity:getComputedStyle(parts.stack).opacity},{opacity:unit.detailed?'1':'0'},{force:split&&changed||crossing,frames:crossing?[{opacity:'0'},{opacity:'0',offset:.7},{opacity:unit.detailed?'1':'0'}]:undefined});this.tween(parts.markerGroup,unit.id+'-marker-fade',{opacity:getComputedStyle(parts.markerGroup).opacity},{opacity:'1'});
    if(active&&unit.detailed&&!near(unit.percent,100))this.connectors.append(svgElement('path',{class:'goal-bar-connector','data-node-id':unit.id,d:`M ${unit.x} ${y+halfLine} L ${unit.labelX} ${y+timeOffset-font}`,fill:'none',stroke:'#c6def5',opacity:.65}));
    parts.fresh=false;unit.radiusValue=r;
   }
   this.avatar?.place({left,right,x:currentX,y,halfLine});
   this.units=units.map(u=>({...u,members:[...u.members]}));this.previous=new Map(raw.map(n=>[n.id,{...n}]));this.initial=false;
   this.svg.setAttribute('aria-label','Goal bar · Edit goals · '+(data.time_mode||''));PercentSummaryLayout.instances.get(this.row)?.balance();
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
 globalThis.WMOFTimerSummaryView={goalOrder(state){return (state?.goal_bar?.nodes||[]).filter(n=>!n.current).toSorted((a,b)=>a.percent-b.percent||(a.id==='standard'?-1:b.id==='standard'?1:0)||(({trip:0,total:1}[a.id]??0)-({trip:0,total:1}[b.id]??0))).map(n=>n.id);},refreshLayout(root=document){const app=displayApp(root);TimerSpaceLayout.views.get(app)?.fit();const row=root.querySelector('.percent-summary');PercentSummaryLayout.instances.get(row)?.fit();GoalBar.instances.get(row)?.draw();},renderGoalDetails(host,details){
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
  app.dataset.percentageDisplay=normalized;row.dataset.percentageDisplay=normalized;const bar=GoalBar.instances.get(row);if(bar?.state)bar.avatar?.update(bar.state,normalized==='bar');
  row.classList.toggle('is-goal-bar',normalized==='bar');PercentSummaryLayout.instances.get(row)?.fit();
 },render(root,state){
  const row=root.querySelector('.percent-summary'),app=displayApp(root);
  if(app){const interval=state?.interval_state?.intervalType||state?.active_interval_type;app.dataset.timeReadoutPaused=String(state?.trip_active&&!state?.break_only&&['down','break','lunch','short-break'].includes(interval)&&state?.rendered_time_type!=='calculated_end_time');}
  if(state && Object.hasOwn(state,'effective_goal_type')){
   const sync=row?.querySelector('.goal-sync-button');
   if(sync)sync.hidden=(state.goal_type??state.effective_goal_type)!=='trip';
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
   if(mode==='bar')GoalBar.attach(row).update(state);else GoalBar.instances.get(row)?.update(state);
  }
  PercentSummaryLayout.attach(row);
  for(const [id,text] of [['standardTimeValue',state?.standard_time_component?.text],['renderedTimeValue',state?.time_component?.text],['currentPercentValue',state?.current_percent_component?.text],['goalPercentValue',state?.goal_component?.text]]){const e=root.querySelector('#'+id);if(e)e.textContent=text||'-';}
  for(const [id,key] of [['standardTimeLabel','standard_time_header_text'],['renderedTimeLabel','time_header_text']]){const e=root.querySelector('#'+id);if(e&&state?.[key])e.textContent=state[key];}
 }};
})();
