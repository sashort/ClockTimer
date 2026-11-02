/* Compact is a presentation of the existing controls, not a second action path. */
(() => {
    const views = new WeakMap();
    const ids = ['newTripButton','idleBreakButton','endTripButton','breakDownButton','breakButton','downButton','downResumeButton','downBreakButton','downCancelButton','downDetailsButton','tripLogButton'];
    const iconPaths={
        play:'<path d="M7 4 21 12 7 20Z" fill="currentColor" stroke="none"/>',
        pause:'<path d="M6 4h4v16H6zM15 4h4v16h-4z" fill="currentColor" stroke="none"/>',
        down:'<path d="M5 3h14M5 21h14M7 3v3c0 3 3 4 5 6-2 2-5 3-5 6v3M17 3v3c0 3-3 4-5 6 2 2 5 3 5 6v3"/>',
        cancel:'<path d="m5 5 14 14M19 5 5 19"/>',
        details:'<path d="M3 7h5l2-3h5l2 3h4v14H3Z"/><circle cx="12" cy="14" r="4"/>',
        log:'<path d="M4 5h5v3H4zM12 5h8v3h-8zM4 11h5v3H4zM12 11h8v3h-8zM4 17h5v3H4zM12 17h8v3h-8z" fill="currentColor" stroke="none"/>',
        finish:'<path d="M4 22V3M4 3h16v12H4Z"/><path d="M4 3h4v4H4zM12 3h4v4h-4zM8 7h4v4H8zM16 7h4v4h-4zM4 11h4v4H4zM12 11h4v4h-4z" fill="currentColor" stroke="none"/>'
    };
    const icons={newTripButton:'play',idleBreakButton:'pause',endTripButton:'finish',breakDownButton:'down',breakButton:'pause',downButton:'down',downResumeButton:'play',downBreakButton:'pause',downCancelButton:'cancel',downDetailsButton:'details',tripLogButton:'log'};
    function renderIcon(button,kind){
        let icon=button.querySelector(':scope > .compact-action-icon');
        if(!icon){icon=document.createElement('span');icon.className='compact-action-icon';icon.setAttribute('aria-hidden','true');button.append(icon);}
        if(icon.dataset.icon!==kind){icon.dataset.icon=kind;icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+iconPaths[kind]+'</svg>';}
    }
    function fitFullBreakText(host){
        if(host.id!=='endTripButton'||host.closest('.app')?.dataset.actionDisplay==='compact'||!host.querySelector(':scope > .break-action-label'))return;
        host.style.removeProperty('--break-action-font-size');
        const labels=[...host.querySelectorAll(':scope > .break-action-label,:scope > .break-action-clock')],style=getComputedStyle(host),font=parseFloat(style.fontSize),boxes=labels.map(e=>e.getBoundingClientRect());
        const reserve=host.dataset.bufferCounting==='true'?Math.min(96,host.clientWidth*.28):0,available=Math.max(1,host.clientWidth-20-reserve),width=boxes.reduce((sum,r)=>sum+r.width,0),height=Math.max(...boxes.map(r=>r.height));
        host.style.setProperty('--break-action-font-size',Math.max(10,font*Math.min(1,available/Math.max(1,width),Math.max(1,host.clientHeight-8)/Math.max(1,height)))+'px');
    }
    // A single paint-only frame follows the timer, and both full buffer tracks.
    const attentionLayouts=new WeakMap(),bufferLayouts=new WeakMap(),wingMotions=new WeakMap();
    const svgNS='http://www.w3.org/2000/svg';let attentionId=0;
    function timerLabels(host){
        return [...host.children].filter(e=>e.matches('.break-action-label,.break-action-clock,output')||host.classList.contains('compact-interval-timer')&&e.localName==='span'&&!e.classList.contains('break-buffer-side'));
    }
    function roundedOutline(points,radius=6){
        const near=(a,b)=>{const length=Math.hypot(b[0]-a[0],b[1]-a[1]),t=length?Math.min(radius/length,.5):0;return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];};
        const corners=points.map((v,i)=>({v,a:near(v,points[(i+points.length-1)%points.length]),b:near(v,points[(i+1)%points.length])}));
        return'M '+corners[0].a.join(' ')+' '+corners.map(c=>'L '+c.a.join(' ')+' Q '+c.v.join(' ')+' '+c.b.join(' ')).join(' ')+' Z';
    }
    function attentionFrame(){
        const frame=document.createElement('i'),svg=document.createElementNS(svgNS,'svg'),id='timer-attention-'+(++attentionId);
        frame.className='timer-attention-frame';frame.setAttribute('aria-hidden','true');frame.hidden=true;
        svg.innerHTML='<defs><mask id="'+id+'" maskUnits="userSpaceOnUse" x="0" y="0"><path class="timer-attention-outline" fill="none" stroke="#fff" stroke-width="3"/></mask></defs><path class="timer-attention-surface"/><foreignObject x="0" y="0" mask="url(#'+id+')"></foreignObject>';
        const gradient=document.createElement('div');gradient.className='timer-attention-gradient';svg.querySelector('foreignObject').append(gradient);frame.append(svg);return frame;
    }
    function fitAttention(host){
        const frame=host.querySelector(':scope > .timer-attention-frame');if(!frame||!host.isConnected)return;
        const labels=timerLabels(host).map(e=>e.getBoundingClientRect());
        if(!labels.length||!host.getBoundingClientRect().height){frame.hidden=true;return;}
        const box=host.getBoundingClientRect(),group={left:Math.min(...labels.map(r=>r.left)),right:Math.max(...labels.map(r=>r.right)),top:Math.min(...labels.map(r=>r.top)),bottom:Math.max(...labels.map(r=>r.bottom))};
        const full=host.id==='endTripButton',padX=Math.min(9,Math.max(0,(host.clientWidth-(group.right-group.left))/2-1)),padY=full?Math.min(7,Math.max(0,(host.clientHeight-(group.bottom-group.top))/2-1)):7;
        const sides=[...host.querySelectorAll(':scope > .break-buffer-side')].map(e=>e.getBoundingClientRect()),buffered=sides.length===2;
        const app=host.closest('.app'),area=app.getBoundingClientRect(),style=getComputedStyle(app),split=full&&box.width<area.width*.75,left=buffered?Math.max(area.left+(parseFloat(style.paddingLeft)||0),split?box.left:-Infinity):group.left-padX,right=buffered?Math.min(area.right-(parseFloat(style.paddingRight)||0),split?box.right:Infinity):group.right+padX,top=group.top-padY,bottom=group.bottom+padY,width=right-left,height=bottom-top;
        if(!(width>3&&height>3)){frame.hidden=true;return;}
        for(const [key,value] of Object.entries({left:left-box.left-host.clientLeft,top:top-box.top-host.clientTop,width,height})){const text=value+'px';if(frame.style[key]!==text)frame.style[key]=text;}
        const x1=1.5,x2=width-1.5,y1=1.5,y2=height-1.5,panelLeft=group.left-padX-left,panelRight=group.right+padX-left,armTop=Math.max(y1,Math.min(...sides.map(r=>r.top))-4-top),armBottom=Math.min(y2,Math.max(...sides.map(r=>r.bottom))+4-top);
        const progress=Number(host.style.getPropertyValue('--buffer-wing-open'))||0,wingLeft=panelLeft+(x1-panelLeft)*progress,wingRight=panelRight+(x2-panelRight)*progress;
        const points=buffered&&progress>0?[[wingLeft,armTop],[panelLeft,armTop],[panelLeft,y1],[panelRight,y1],[panelRight,armTop],[wingRight,armTop],[wingRight,armBottom],[panelRight,armBottom],[panelRight,y2],[panelLeft,y2],[panelLeft,armBottom],[wingLeft,armBottom]]:buffered?[[panelLeft,y1],[panelRight,y1],[panelRight,y2],[panelLeft,y2]]:[[x1,y1],[x2,y1],[x2,y2],[x1,y2]],d=roundedOutline(points);
        frame.dataset.shape=buffered&&progress>0?'buffered':'timer';
        const svg=frame.firstElementChild;svg.setAttribute('viewBox','0 0 '+width+' '+height);
        for(const element of [svg.querySelector('mask'),svg.querySelector('foreignObject')]){element.setAttribute('width',width);element.setAttribute('height',height);}
        for(const path of svg.querySelectorAll('path'))if(path.getAttribute('d')!==d)path.setAttribute('d',d);
        frame.hidden=false;
    }
    function renderAttention(host,kind){
        if(!host)return;let frame=host.querySelector(':scope > .timer-attention-frame');
        if(!kind){frame?.remove();delete host.dataset.timerAttention;return;}
        if(host.dataset.timerAttention!==kind){frame?.remove();frame=null;}host.dataset.timerAttention=kind;
        if(!frame){frame=attentionFrame();host.append(frame);}
        if(!attentionLayouts.has(host)){
            let pending=false;const observer=new ResizeObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;fitBuffers(host);fitAttention(host);});});
            observer.observe(host);if(host.closest('.app'))observer.observe(host.closest('.app'));for(const label of timerLabels(host))observer.observe(label);attentionLayouts.set(host,observer);
        }
        fitBuffers(host);fitAttention(host);
    }
    function fitBuffers(host){
        if(!host.isConnected)return;fitFullBreakText(host);const sides=[...host.querySelectorAll(':scope > .break-buffer-side')];if(!sides.length)return;
        const labels=timerLabels(host).map(e=>e.getBoundingClientRect());if(!labels.length)return;
        const box=host.getBoundingClientRect(),app=host.closest('.app'),a=(app||host).getBoundingClientRect(),style=getComputedStyle(app||host),paddingLeft=parseFloat(style.paddingLeft)||0,paddingRight=parseFloat(style.paddingRight)||0;
        const split=host.id==='endTripButton'&&box.width<a.width*.75;
        const group={left:Math.min(...labels.map(r=>r.left)),right:Math.max(...labels.map(r=>r.right)),top:Math.min(...labels.map(r=>r.top)),bottom:Math.max(...labels.map(r=>r.bottom))},left=Math.max(a.left+paddingLeft+4,split?box.left+4:-Infinity),right=Math.min(a.right-paddingRight-4,split?box.right-4:Infinity),height=(group.bottom-group.top)/3;
        for(const side of sides){const isLeft=side.classList.contains('left'),start=isLeft?left:group.right+paddingRight,end=isLeft?group.left-paddingLeft:right;side.style.left=(start-box.left-host.clientLeft)+'px';side.style.width=Math.max(0,end-start)+'px';side.style.height=height+'px';side.style.top=((group.top+group.bottom)/2-box.top-host.clientTop)+'px';}
        fitAttention(host);
    }
    function renderBuffers(host,buffer){
        if(!host)return;host.dataset.bufferCounting=String(Boolean(buffer&&!buffer.preview&&buffer.remainingMilliseconds>0));
        let sides=[...host.querySelectorAll(':scope > .break-buffer-side')];
        if(!buffer){const motion=wingMotions.get(host);if(motion){clearTimeout(motion.timer);cancelAnimationFrame(motion.frame);wingMotions.delete(host);}host.dataset.bufferActive='false';host.style.removeProperty('--buffer-wing-open');for(const side of sides)side.remove();fitFullBreakText(host);fitAttention(host);return;}
        if(!sides.length)for(const direction of ['left','right']){const side=document.createElement('span');side.className='break-buffer-side '+direction;side.setAttribute('aria-hidden','true');side.innerHTML='<span class="break-buffer-track"><i></i></span>';host.append(side);sides.push(side);}
        for(const side of sides){side.querySelector('i').style.transform='scaleX('+Math.max(0,Math.min(1,buffer.remainingMilliseconds/buffer.durationMilliseconds))+')';side.dataset.phase=buffer.phase;}
        animateWings(host,buffer);
        if(!bufferLayouts.has(host)){let pending=false;const observer=new ResizeObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;fitBuffers(host);});});observer.observe(host);if(host.closest('.app'))observer.observe(host.closest('.app'));for(const label of timerLabels(host))observer.observe(label);bufferLayouts.set(host,observer);}
        fitBuffers(host);
    }
    function animateWings(host,buffer){
        const boundary=Date.parse(buffer.motionEndTime||buffer.endTime),collapse=buffer.phase==='start-buffer',preview=buffer.preview===true;
        const key=[buffer.phase,boundary,preview].join(':');let motion=wingMotions.get(host);
        if(motion?.key===key){motion.paint();return;}
        if(motion){clearTimeout(motion.timer);cancelAnimationFrame(motion.frame);}
        motion={key};wingMotions.set(host,motion);
        const end=boundary,start=end-Math.min(1000,collapse?buffer.durationMilliseconds:1000),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
        const paint=()=>{
            if(wingMotions.get(host)!==motion||!host.isConnected)return;
            const now=Date.now(),fraction=Number.isFinite(end)?Math.max(0,Math.min(1,(now-start)/(end-start||1))):1;
            const eased=fraction*fraction*(3-2*fraction);
            const open=reduced?(preview&&now<end?0:collapse&&now>=end?0:1):collapse?1-eased:preview?eased:1;
            host.style.setProperty('--buffer-wing-open',String(open));host.dataset.bufferActive=String(open>0);
            fitBuffers(host);
        };
        motion.paint=paint;
        const step=()=>{paint();if(Date.now()<end)motion.frame=requestAnimationFrame(step);};
        paint();
        if(Number.isFinite(end)&&Date.now()<end){if(Date.now()<start)motion.timer=setTimeout(step,start-Date.now());else motion.frame=requestAnimationFrame(step);}
    }
    function visibleBuffer(state){
        const interval=state?.clock?.interval_state;if(interval?.buffer)return interval.buffer;
        if(["break","lunch"].includes(interval?.intervalType)&&["break","lunch"].includes(interval.phase)&&interval.endBufferMilliseconds>0&&interval.breakRemainingMilliseconds>0)
            return{phase:'end-buffer',durationMilliseconds:interval.endBufferMilliseconds,remainingMilliseconds:interval.endBufferMilliseconds,preview:true,motionEndTime:interval.breakBoundaryTime};
        if(["break","lunch"].includes(interval?.intervalType)&&interval.endBufferMilliseconds>0&&interval.remainingMilliseconds<=0)
            return{phase:'end-buffer',durationMilliseconds:interval.endBufferMilliseconds,remainingMilliseconds:0,retained:true};
        return null;
    }
    function breakCaption(state){
        const kind=String(state?.tripStatus||'break').replaceAll('_','-'),ids={break:'02ed5f1f-4450-5830-bd59-d8a504774d62',lunch:'d2580406-52e9-59b4-bbd2-e3bb470a35dc','short-break':'b0525b2e-e64d-5c4c-97ac-45f51d84f9fb'},name=WMOFLanguagePack.text(ids[kind]||ids.break),phase=state?.clock?.interval_state?.buffer?.phase;
        return phase==='start-buffer'?WMOFLanguagePack.text('f5a64f28-3d2b-5b65-9eca-172821913a61',{break:name}):phase==='end-buffer'?WMOFLanguagePack.text('84a45b7c-824a-56ee-bf20-586308afc432',{break:name}):name;
    }
    function init(app) {
        const buttons = new Map(ids.map(id => {
            const button = document.getElementById(id), anchor = document.createComment('Full action: '+id);
            button.before(anchor);return [id,{button,anchor,ownedLabel:false}];
        }));
        const left = document.createElement('div'), right = document.createElement('div'), timer = document.createElement('div');
        left.className='compact-action-rail compact-action-left';right.className='compact-action-rail compact-action-right';
        timer.className='compact-interval-timer';timer.innerHTML='<span></span><output></output>';
        app.append(left,right);app.querySelector('.trip-summary').append(timer);
        const view={buttons,left,right,timer,state:null};views.set(app,view);return view;
    }
    function render(app, state, {totalLabel}={}) {
        const buffer=visibleBuffer(state);
        const primary=document.getElementById('endTripButton');
        if(state?.controls?.breakLabel&&primary.querySelector('.break-action-label'))primary.querySelector('.break-action-label').textContent=breakCaption(state);
        renderBuffers(primary,app.dataset.actionDisplay==='compact'?null:buffer);
        renderAttention(primary,app.dataset.actionDisplay!=='compact'&&state?.controls?.breakLabel?String(state.tripStatus||'break').replaceAll('_','-'):null);
        let view=views.get(app);
        if(!view && app.dataset.actionDisplay!=='compact'&&!(app.dataset.percentageDisplay==='bar'&&state?.clock?.goal_bar?.active))return;
        view ||= init(app);
        // Interval handoffs may briefly publish Running while the old interval
        // is ended. Keep its controls until the new interval or settled result.
        if(app.dataset.actionDisplay==='compact' && state?.controls?.busy &&
            (view.state?.controls?.downVisiblePanel || view.state?.controls?.breakLabel) &&
            !state.controls.downVisiblePanel && !state.controls.breakLabel && state.controls.activeTripVisible)return;
        if(state)view.state=state;if(totalLabel)view.totalLabel=totalLabel;
        const {buttons,left,right,timer}=view, compact=app.dataset.actionDisplay==='compact';
        const controls=view.state?.controls;if(!controls)return;
        const active=controls.activeTripVisible, down=controls.downVisiblePanel, paused=Boolean(controls.breakLabel);
        const nextGoal=app.dataset.percentageDisplay==='bar'&&active&&!down&&!paused?view.state?.clock?.goal_bar?.next_goal:null;
        app.dataset.goalCountdown=String(Boolean(nextGoal));
        timer.hidden=!(nextGoal||compact&&(down||paused));
        if(nextGoal){timer.dataset.kind='goal';timer.querySelector('span').textContent=nextGoal.ids.length===1&&nextGoal.ids[0]==='standard'?WMOFLanguagePack.text('4f163c6a-3526-4504-92af-9c7f0e91a223'):WMOFLanguagePack.text('4b7e5e4c-8c49-4d50-9313-2a7436e4ac12',{goals:nextGoal.ids.map(id=>id==='total'&&view.totalLabel?view.totalLabel:view.state.clock.goal_bar.nodes.find(node=>node.id===id)?.label).filter(Boolean).reverse().join('/')});timer.querySelector('output').textContent=nextGoal.clock;renderBuffers(timer,null);}
        else if(compact){
            const kind=down?'down':String(view.state.tripStatus||'break').replaceAll('_','-');timer.dataset.kind=kind;
            const labelIds={"down": "ba94b593-7fb0-4360-8150-891bd4e56e6f", "break": "556c70ac-c40c-4976-b080-459c3d8e18f1", "short-break": "be9051c0-6763-43eb-8007-ef3c630bf924", "lunch": "9c9e46b8-a798-423f-a09f-bb5e477cd0a5"};
            timer.querySelector('span').textContent=down?WMOFLanguagePack.text(labelIds.down):breakCaption(view.state);
            timer.querySelector('output').textContent=down?document.getElementById('downElapsedValue').textContent:controls.breakClock;
            renderBuffers(timer,paused?buffer:null);
        }else renderBuffers(timer,null);
        renderAttention(timer,timer.hidden?null:timer.dataset.kind);
        if(!compact) {
            for(const {button,anchor,ownedLabel} of buttons.values()) {
                if(button.closest('dialog[open]'))continue;
                // Re-inserting an already-restored button resets its CSS animations.
                if(anchor.nextSibling!==button)anchor.after(button);button.querySelector(':scope > .compact-action-icon')?.remove();delete button.dataset.compactVisible;
                if(ownedLabel&&!(button===primary&&controls.breakLabel))button.removeAttribute('aria-label');
            }
            delete app.dataset.compactTimed;return;
        }
        const actions=down?['downResumeButton','downBreakButton','downCancelButton']:!active?['newTripButton','idleBreakButton']:paused?['endTripButton',...(controls.breakDownVisible?['breakDownButton']:[])]:[...(controls.primaryVisible!==false?['endTripButton']:[]),...(controls.breakVisible?['breakButton']:[]),...(controls.downVisible?['downButton']:[])];
        const information=[...(down?['downDetailsButton']:[]),...(app.dataset.tripLogPinned!=='false'?['tripLogButton']:[])];
        app.dataset.compactTimed=String(down||paused||Boolean(nextGoal));
        for(const [id,record] of buttons) {
            const {button}=record;if(button.closest('dialog[open]'))continue;
            const rail=['downDetailsButton','tripLogButton'].includes(id)?right:left, visible=(rail===left?actions:information), index=visible.indexOf(id);
            button.dataset.compactVisible=String(index>=0);
            if(button.parentElement!==rail)rail.append(button);
            button.style.setProperty('--compact-offset', index>=0?index-(visible.length-1)/2:0);
            renderIcon(button,id==='endTripButton'&&paused?'play':icons[id]);
            if(!button.hasAttribute('aria-label')||record.ownedLabel){button.setAttribute('aria-label',button.textContent.trim()||button.title||id);record.ownedLabel=true;}
            button.title=button.getAttribute('aria-label');
        }

    }
    let layoutQueue=Promise.resolve(),pendingLayouts=0,busyOverlay,busyApp,previousBusy;
    function showLayoutBusy(app){
        if(!busyOverlay){busyOverlay=document.createElement('div');busyOverlay.className='layout-switch-overlay';busyOverlay.setAttribute('popover','manual');busyOverlay.setAttribute('role','status');busyOverlay.setAttribute('aria-live','polite');const label=document.createElement('span');label.textContent=WMOFLanguagePack.text('ade066c7-66ca-502f-99ef-888d87a5b61d');busyOverlay.append(label);document.body.append(busyOverlay);}
        if(!pendingLayouts){busyApp=app;previousBusy=app.getAttribute('aria-busy');app.setAttribute('aria-busy','true');}busyOverlay.hidden=false;if(!busyOverlay.matches(':popover-open'))busyOverlay.showPopover();
    }
    function hideLayoutBusy(){if(--pendingLayouts>0)return;busyOverlay.hidePopover();busyOverlay.hidden=true;if(previousBusy===null)busyApp.removeAttribute('aria-busy');else busyApp.setAttribute('aria-busy',previousBusy);}
    globalThis.WMOFLayoutMotion=Object.freeze({whenSettled(){return layoutQueue;},change(app,apply){
        showLayoutBusy(app);pendingLayouts++;
        const run=async()=>{
          try{
            await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            if(matchMedia('(prefers-reduced-motion: reduce)').matches){apply();globalThis.WMOFTimerSummaryView?.refreshLayout(document);return;}
            for(const id of ['clockTimer',...ids]){const element=document.getElementById(id);if(element)element.style.viewTransitionName='wmof-'+id;}
            const percent=app.querySelector('.percent-summary');if(percent)percent.style.viewTransitionName='wmof-percentage';
            document.documentElement.dataset.layoutTransition='true';
            const update=async()=>{
                app.classList.add('layout-switch-snap');apply();globalThis.WMOFTimerSummaryView?.refreshLayout(document);
                await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
                globalThis.WMOFTimerSummaryView?.refreshLayout(document);document.getElementById('clockTimer')?.refreshLayout?.();
            };
            try{
                if(typeof document.startViewTransition==='function'){
                    const transition=document.startViewTransition(update);
                    // A skipped snapshot rejects ready even when the update and finished succeed.
                    transition.ready.catch(()=>{});await transition.finished;
                }
                else{await update();const clock=document.getElementById('clockTimer');await clock?.animate?.([{opacity:.6},{opacity:1}],{duration:300,easing:'ease-in-out'})?.finished;}
            }finally{app.classList.remove('layout-switch-snap');delete document.documentElement.dataset.layoutTransition;}
          }finally{hideLayoutBusy();}
        };
        layoutQueue=layoutQueue.catch(()=>{}).then(run);return layoutQueue;
    }});
    globalThis.WMOFCompactActions=Object.freeze({render});
})();
