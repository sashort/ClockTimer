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
    function renderBuffers(host,buffer) {
        if(!host)return;
        host.dataset.bufferActive=String(Boolean(buffer&&buffer.remainingMilliseconds>0));
        let sides=[...host.querySelectorAll(':scope > .break-buffer-side')];
        if(!buffer||buffer.remainingMilliseconds<=0){for(const side of sides)side.remove();return;}
        if(!sides.length)for(const direction of ['left','right']){
            const side=document.createElement('span');side.className='break-buffer-side '+direction;
            side.setAttribute('aria-hidden','true');side.innerHTML='<span class="break-buffer-countdown"></span><span class="break-buffer-track"><i></i></span>';host.append(side);sides.push(side);
        }
        const seconds=Math.ceil(buffer.remainingMilliseconds/1000),text=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
        for(const side of sides){side.querySelector('.break-buffer-countdown').textContent=text;side.querySelector('i').style.transform='scaleX('+Math.max(0,Math.min(1,buffer.remainingMilliseconds/buffer.durationMilliseconds))+')';side.dataset.phase=buffer.phase;}
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
    function render(app, state) {
        const buffer=state?.clock?.interval_state?.buffer;
        renderBuffers(document.getElementById('endTripButton'),app.dataset.actionDisplay==='compact'?null:buffer);
        let view=views.get(app);
        if(!view && app.dataset.actionDisplay!=='compact')return;
        view ||= init(app);if(state)view.state=state;
        const {buttons,left,right,timer}=view, compact=app.dataset.actionDisplay==='compact';
        if(!compact) {
            for(const {button,anchor,ownedLabel} of buttons.values()) {
                if(button.closest('dialog[open]'))continue;
                anchor.after(button);button.querySelector(':scope > .compact-action-icon')?.remove();delete button.dataset.compactVisible;
                if(ownedLabel)button.removeAttribute('aria-label');
            }
            delete app.dataset.compactTimed;return;
        }
        const controls=view.state?.controls;if(!controls)return;
        const active=controls.activeTripVisible, down=controls.downVisiblePanel, paused=Boolean(controls.breakLabel);
        const actions=down?['downResumeButton','downBreakButton','downCancelButton']:!active?['newTripButton','idleBreakButton']:paused?['endTripButton',...(controls.breakDownVisible?['breakDownButton']:[])]:['endTripButton',...(controls.breakVisible?['breakButton']:[]),...(controls.downVisible?['downButton']:[])];
        const information=[...(down?['downDetailsButton']:[]),...(app.dataset.tripLogPinned!=='false'?['tripLogButton']:[])];
        app.dataset.compactTimed=String(down||paused);
        for(const [id,record] of buttons) {
            const {button}=record;if(button.closest('dialog[open]'))continue;
            const rail=['downDetailsButton','tripLogButton'].includes(id)?right:left, visible=(rail===left?actions:information), index=visible.indexOf(id);
            if(button.parentElement!==rail)rail.append(button);
            button.dataset.compactVisible=String(index>=0);
            button.style.setProperty('--compact-offset', index>=0?index-(visible.length-1)/2:0);
            renderIcon(button,id==='endTripButton'&&paused?'play':icons[id]);
            if(!button.hasAttribute('aria-label')||record.ownedLabel){button.setAttribute('aria-label',button.textContent.trim()||button.title||id);record.ownedLabel=true;}
            button.title=button.getAttribute('aria-label');
        }
        timer.hidden=!(down||paused);
        const kind=down?'down':String(view.state.tripStatus||'break').replaceAll('_','-');
        const labelIds={"down": "ba94b593-7fb0-4360-8150-891bd4e56e6f", "break": "556c70ac-c40c-4976-b080-459c3d8e18f1", "short-break": "be9051c0-6763-43eb-8007-ef3c630bf924", "lunch": "9c9e46b8-a798-423f-a09f-bb5e477cd0a5"};
        timer.querySelector('span').textContent=WMOFLanguagePack.text(labelIds[kind]||labelIds.break);
        timer.querySelector('output').textContent=down?document.getElementById('downElapsedValue').textContent:controls.breakClock;
        renderBuffers(timer,paused?buffer:null);
    }
    let layoutQueue=Promise.resolve();
    globalThis.WMOFLayoutMotion=Object.freeze({whenSettled(){return layoutQueue;},change(app,apply){
        const run=async()=>{
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
                if(typeof document.startViewTransition==='function'){const transition=document.startViewTransition(update);await transition.finished;}
                else{await update();const clock=document.getElementById('clockTimer');await clock?.animate?.([{opacity:.6},{opacity:1}],{duration:300,easing:'ease-in-out'})?.finished;}
            }finally{app.classList.remove('layout-switch-snap');delete document.documentElement.dataset.layoutTransition;}
        };
        layoutQueue=layoutQueue.catch(()=>{}).then(run);return layoutQueue;
    }});
    globalThis.WMOFCompactActions=Object.freeze({render});
})();
