(() => {
 'use strict';
 const ns='http://www.w3.org/2000/svg',assets=globalThis.WMOFGoalBarAvatarAssets;
 if(!assets)return;
 const svg=(tag,attrs={})=>{const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;};
 const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);},lerp=(a,b,t)=>a+(b-a)*t;
 const subtract=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0),norm=a=>Math.hypot(...a),unit=a=>a.map(v=>v/norm(a));
 function breakGeometry({sit:s,turn}){
  const theta=turn*Math.PI/2,hipsX=4*s,hipY=lerp(-2,2,s),project=([x,y,z])=>[hipsX+x*Math.cos(theta)+z*Math.sin(theta),y];
  const legs=[-1,1].map(side=>{
   const hip=[0,hipY,0],foot=[side*lerp(7.5,0,s),12,-7*Math.sin(theta)*(1-s)-9*s],delta=subtract(foot,hip),distance=norm(delta),direction=unit(delta);
   const along=(81-100+distance*distance)/(2*distance),forward=[0,0,-1],projection=dot(forward,direction),bend=unit(forward.map((x,i)=>x-direction[i]*projection));
   const height=Math.sqrt(Math.max(0,81-along*along)),knee=hip.map((x,i)=>x+direction[i]*along+bend[i]*height),toe=project(foot);toe[0]+=lerp(side*3,-4.5,Math.sin(theta));
   return{hip,knee,foot,screen:[project(hip),project(knee),project(foot),toe]};
  });
  const arms=[-1,1].map(side=>[project([0,hipY-10,0]),project([side*lerp(5,2.2,s),hipY-5,-5*s]),project([side*lerp(7,2.2,s),hipY-lerp(0,5,s),-8*s])]);
  return{legs,arms,spine:[[hipsX,hipY],[hipsX,hipY-10]],head:[hipsX-1.5*Math.sin(theta),hipY-16]};
 }
 const path=points=>points.map(([x,y],i)=>(i?'L ':'M ')+x.toFixed(4)+' '+y.toFixed(4)).join(' ');
 function armGeometry(progress){
  const upper=(150-45*progress)*Math.PI/180,fore=(-105-150*progress)*Math.PI/180,ex=-1+(9-2*progress)*Math.cos(upper),ey=-12+(9-2*progress)*Math.sin(upper);
  return{upper:path([[-1,-12],[ex,ey]]),fore:path([[ex,ey],[ex+(10.5-4.5*progress)*Math.cos(fore),ey+(10.5-4.5*progress)*Math.sin(fore)]])};
 }
 function targetMode(state){
  const interval=state?.interval_state?.intervalType||state?.active_interval_type;
  if(state?.break_only)return 'break';
  if(!state?.trip_active&&state?.goal_bar?.active!==true)return 'idle';
  if(['break','short-break','lunch'].includes(interval)&&state?.paused!==false)return 'break';
  if(interval==='down'||state?.goal_bar?.down)return 'down';
  return state?.trip_active||state?.goal_bar?.active===true?'running':'idle';
 }
 function installStyle(){
  if(document.getElementById('goal-bar-avatar-style'))return;
  const style=document.createElement('style');style.id='goal-bar-avatar-style';style.textContent=assets.css+'\n'+`
.goal-bar-avatar {color:#fff;fill:none;stroke:#fff;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;pointer-events:none;}
.goal-bar-avatar .rig-body {stroke:#fff;}
.goal-bar-avatar.is-arm-transition .fist path {animation:none;}
.goal-bar-avatar .bubble {transition:opacity 200ms;}
.goal-bar-confetti {position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4;}
@media(prefers-reduced-motion:reduce){.goal-bar-avatar * {animation:none!important;transition:none!important;}}
`;document.head.append(style);
 }
 class Avatar{
  constructor(svgRoot,row){
   installStyle();this.svg=svgRoot;this.row=row;this.root=svg('g',{class:'goal-bar-avatar','aria-hidden':'true'});this.pose=svg('g');this.root.append(this.pose);svgRoot.append(this.root);
   this.canvas=document.createElement('canvas');this.canvas.className='goal-bar-confetti';this.canvas.setAttribute('aria-hidden','true');row.append(this.canvas);
   this.mode=null;this.visiblePose=null;this.session=null;this.initialized=false;this.enabled=false;this.sequence=0;this.animations=new Set();this.waiters=new Map();this.completed=new Set();this.burstTimers=[];this.context=null;this.rig=null;
   this.motionPreference=matchMedia('(prefers-reduced-motion: reduce)');this.visibility=()=>{if(document.hidden){this.cancel();this.root.hidden=true;this.root.style.display='none';}else if(this.enabled){this.root.style.display='';this.change(this.mode,{entryOnly:true});}};
   document.addEventListener('visibilitychange',this.visibility);this.preferenceChanged=()=>{if(this.enabled)this.change(this.mode,{entryOnly:true});};this.motionPreference.addEventListener?.('change',this.preferenceChanged);
  }
  reduced(){return this.motionPreference.matches;}
  topSpace(state){return targetMode(state)==='down'?68:48;}
  cancel(){
   ++this.sequence;for(const animation of this.animations)animation.cancel();this.animations.clear();
   for(const [timer,resolve] of this.waiters){clearTimeout(timer);resolve(false);}this.waiters.clear();
   if(this.rigMotion){this.rigMotion.resolve(false);this.rigMotion=null;}if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;
   this.walk?.cancel();this.turn?.cancel();this.walk=this.turn=null;this.walkKey=null;
   this.burstTimers.forEach(clearTimeout);this.burstTimers=[];this.fire?.reset();this.root.classList.remove('is-arm-transition');
  }
  wait(ms){if(this.reduced())return Promise.resolve(true);return new Promise(resolve=>{const timer=setTimeout(()=>{this.waiters.delete(timer);resolve(true);},ms);this.waiters.set(timer,resolve);});}
  animate(element,frames,options={}){
   if(this.reduced()){const last=frames.at(-1);for(const [key,value] of Object.entries(last))if(!['offset','easing'].includes(key))element.style[key]=value;return Promise.resolve(true);}
   const animation=element.animate(frames,{duration:300,easing:'ease-in-out',fill:'forwards',...options});this.animations.add(animation);
   return animation.finished.then(()=>{animation.commitStyles?.();animation.cancel();this.animations.delete(animation);return true;},()=>{this.animations.delete(animation);return false;});
  }
  setPose(name){
   this.visiblePose=name;this.pose.style.opacity='';this.root.dataset.pose=name;this.pose.innerHTML=assets.poses[name];this.root.classList.remove('is-arm-transition');
   this.rig=name==='break'?{sit:0,turn:0,chair:34}:null;
   if(this.reduced())this.pose.querySelectorAll('animate').forEach(e=>e.remove());
   if(this.rig)this.drawRig();this.position();
  }
  drawRig(){
   const root=this.pose.querySelector('.break-rig');if(!root||!this.rig)return;const g=breakGeometry(this.rig);
   root.querySelector('.rig-chair').setAttribute('transform','translate('+this.rig.chair.toFixed(4)+' 0)');
   root.querySelector('.rig-body').style.opacity='1';root.querySelector('.rig-spine').setAttribute('d',path(g.spine));
   const head=root.querySelector('.rig-head');head.setAttribute('cx',g.head[0]);head.setAttribute('cy',g.head[1]);
   for(let i=0;i<2;i++){root.querySelector('.rig-leg-'+i).setAttribute('d',path(g.legs[i].screen));root.querySelector('.rig-arm-'+i).setAttribute('d',path(g.arms[i]));}
  }
  rigTo(to,duration){
   if(this.reduced()){this.rig={...to};this.drawRig();return Promise.resolve(true);}
   const from={...this.rig};return new Promise(resolve=>{this.rigMotion={from,to,duration,start:performance.now(),resolve};const tick=now=>{
    const motion=this.rigMotion;if(!motion)return;const t=clamp((now-motion.start)/motion.duration),e=smooth(t);this.rig=Object.fromEntries(Object.keys(to).map(key=>[key,lerp(from[key],to[key],e)]));this.drawRig();
    if(t<1)this.frame=requestAnimationFrame(tick);else{this.frame=0;this.rigMotion=null;resolve(true);}
   };this.frame=requestAnimationFrame(tick);});
  }
  async armTo(lowering){
   const upper=this.pose.querySelector('.gesture-upper'),fore=this.pose.querySelector('.fist path');if(!upper||!fore)return true;
   this.root.classList.add('is-arm-transition');const bubble=this.pose.querySelector('.bubble');if(bubble)bubble.style.opacity='0';
   const frames=Array.from({length:65},(_,i)=>armGeometry(lowering?smooth(i/64):1-smooth(i/64)));
   const result=await Promise.all([this.animate(upper,frames.map(p=>({d:'path("'+p.upper+'")'})),{duration:400,easing:'linear'}),this.animate(fore,frames.map(p=>({d:'path("'+p.fore+'")'})),{duration:400,easing:'linear'})]);
   return result.every(Boolean);
  }
  async exit(){
   if(this.visiblePose==='break'&&this.rig)return this.rigTo({sit:0,turn:0,chair:34},700);
   if(this.visiblePose==='down')return this.armTo(true);
   return true;
  }
  update(state,enabled){
   const nextMode=targetMode(state),active=nextMode!=='idle',session=active?String(state?.trip_start_component?.value??(state?.break_only?'break-only':'active-trip')):null;
   if(!active&&this.session&&state?.transition_phase==='active')return;
   const finished=this.state?.break_only!==true&&this.initialized&&this.session!==null&&session===null&&!this.completed.has(this.session),finishKey=this.session;
   this.state=state;this.session=session;const wasEnabled=this.enabled;this.enabled=enabled;
   if(!enabled){this.cancel();this.root.style.display='none';this.canvas.hidden=true;this.mode=nextMode;this.initialized=true;return;}
   this.root.style.display='';this.canvas.hidden=false;
   if(finished&&wasEnabled){this.completed.add(finishKey);if(this.completed.size>16)this.completed.delete(this.completed.values().next().value);this.finishX=this.context?.x;this.mode='idle';this.initialized=true;this.change('finish');return;}
   const entering=!this.initialized||!wasEnabled;this.initialized=true;
   if(entering||nextMode!==this.mode){this.mode=nextMode;this.change(nextMode,{entryOnly:entering});}
  }
  async change(mode,{entryOnly=false}={}){
   const previous=this.visiblePose;this.cancel();const token=this.sequence;this.root.dataset.mode=mode;this.root.dataset.transition=entryOnly?'entry':'changing';
   if(!entryOnly&&previous&&previous!==mode){if(!await this.exit()||token!==this.sequence)return;}
   if(token!==this.sequence)return;
   this.setPose(mode);this.root.style.opacity='1';
   if(mode==='break'){
    if(!await this.rigTo({sit:0,turn:1,chair:0},600)||token!==this.sequence)return;
    if(!await this.rigTo({sit:1,turn:1,chair:0},450)||token!==this.sequence)return;
   }else if(mode==='down'){
    if(!await this.armTo(false)||token!==this.sequence)return;
    for(const a of [...this.animations])a.cancel();this.animations.clear();
    this.root.classList.remove('is-arm-transition');const bubble=this.pose.querySelector('.bubble');if(bubble)bubble.style.opacity='1';
   }else if(mode==='finish'){
    this.root.dataset.completion='playing';this.confetti();
    if(!await this.wait(1900)||token!==this.sequence)return;
    if(!await this.animate(this.pose,[{opacity:1},{opacity:0}],{duration:240})||token!==this.sequence)return;
    this.pose.style.opacity='';this.root.dataset.completion='done';this.setPose('idle');this.root.dataset.mode='idle';
   }
   if(token!==this.sequence)return;this.root.dataset.transition='settled';this.position();
  }
  place(context){this.context=context;this.position();}
  position(){
   if(!this.context||!this.visiblePose||!this.enabled)return;const {left,right,x,y,halfLine}=this.context,top=y-halfLine-24;
   if(this.visiblePose==='idle'){
    if(this.reduced()){this.root.style.transform=`translate(${right}px,${top}px)`;return;}
    const key=[left,right,top].map(n=>n.toFixed(2)).join('|');if(this.walkKey===key)return;
    const time=this.walk?.currentTime||0;this.walk?.cancel();this.turn?.cancel();this.walkKey=key;
    this.walk=this.root.animate([{transform:`translate(${left}px,${top}px)`,offset:0},{transform:`translate(${right}px,${top}px)`,offset:.44},{transform:`translate(${right}px,${top}px)`,offset:.5},{transform:`translate(${left}px,${top}px)`,offset:.94},{transform:`translate(${left}px,${top}px)`,offset:1}],{duration:20000,iterations:Infinity,easing:'linear'});
    this.pose.style.transformOrigin='0px -3px';this.turn=this.pose.animate([{transform:'rotateY(180deg)',offset:0},{transform:'rotateY(180deg)',offset:.44,easing:'cubic-bezier(.4,0,.2,1)'},{transform:'rotateY(0deg)',offset:.5},{transform:'rotateY(0deg)',offset:.94,easing:'cubic-bezier(.4,0,.2,1)'},{transform:'rotateY(180deg)',offset:1}],{duration:20000,iterations:Infinity});this.walk.currentTime=this.turn.currentTime=time;
   }else{
    this.walk?.cancel();this.turn?.cancel();this.walk=this.turn=null;this.walkKey=null;this.pose.style.transform='';
    const px=this.visiblePose==='finish'?Math.max(left,Math.min(right,this.finishX??x)):x;this.root.style.transform=`translate(${px}px,${top}px)`;
    const bubble=this.pose.querySelector('.bubble');if(bubble){const wrapper=bubble.parentElement,text=bubble.querySelector('text'),rightSide=px<78&&this.svg.getBoundingClientRect().width-px>78;wrapper.setAttribute('transform',rightSide?'translate(82 0) scale(-1 1)':'translate(-82 0)');text?.setAttribute('transform',rightSide?'translate(74 0) scale(-1 1)':'');}
   }
  }
  confetti(){
   if(this.reduced()||!globalThis.confetti||!this.context)return;
   this.fire ||= globalThis.confetti.create(this.canvas,{resize:true,useWorker:false});this.fire.reset();
   const rect=this.canvas.getBoundingClientRect(),box=this.svg.getBoundingClientRect(),c=this.context,range=(a,b)=>a+Math.random()*(b-a),originX=(box.left+(c.left+c.right)/2-rect.left)/Math.max(1,rect.width),originY=clamp((box.top+c.y-c.halfLine-24-12-rect.top)/Math.max(1,rect.height));
   for(const delay of [0,range(45,100),range(115,185)])this.burstTimers.push(setTimeout(()=>this.fire({particleCount:Math.round(range(8,13)),angle:range(82,98),spread:range(65,95),startVelocity:range(12,18),decay:range(.9,.94),gravity:range(.85,1.15),drift:range(-.15,.15),ticks:Math.round(range(85,120)),scalar:range(.4,.65),colors:['#ffd6e7','#fff2b3','#c9f2df','#d5e2ff','#e7d5ff','#ffdcc4'],shapes:['square','circle'],origin:{x:originX,y:originY},disableForReducedMotion:true}),delay));
  }
  dispose(){this.cancel();document.removeEventListener('visibilitychange',this.visibility);this.motionPreference.removeEventListener?.('change',this.preferenceChanged);this.root.remove();this.canvas.remove();this.enabled=false;}
 }
 globalThis.WMOFGoalBarAvatar=Object.freeze({create:(svg,row)=>new Avatar(svg,row),modeFor:targetMode,breakGeometry,armGeometry});
})();
