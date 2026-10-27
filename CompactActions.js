/* Compact is a presentation of the existing controls, not a second action path. */
(() => {
    const views = new WeakMap();
    const ids = ['newTripButton','idleBreakButton','endTripButton','breakDownButton','breakButton','downButton','downResumeButton','downBreakButton','downCancelButton','downDetailsButton','tripLogButton'];
    const glyphs = {newTripButton:'▶',idleBreakButton:'Ⅱ',endTripButton:'⚑',breakDownButton:'⌛',breakButton:'Ⅱ',downButton:'⌛',downResumeButton:'▶',downBreakButton:'Ⅱ',downCancelButton:'×',tripLogButton:'☷'};
    function init(app) {
        const buttons = new Map(ids.map(id => {
            const button = document.getElementById(id), anchor = document.createComment('Full action: '+id);
            button.before(anchor);return [id,{button,anchor,ownedLabel:false}];
        }));
        const left = document.createElement('div'), right = document.createElement('div'), timer = document.createElement('div');
        left.className='compact-action-rail compact-action-left';right.className='compact-action-rail compact-action-right';
        timer.className='compact-interval-timer';timer.innerHTML='<span></span><output></output>';
        app.append(left,right,timer);
        const view={buttons,left,right,timer,state:null};views.set(app,view);return view;
    }
    function render(app, state) {
        let view=views.get(app);
        if(!view && app.dataset.actionDisplay!=='compact')return;
        view ||= init(app);if(state)view.state=state;
        const {buttons,left,right,timer}=view, compact=app.dataset.actionDisplay==='compact';
        if(!compact) {
            for(const {button,anchor,ownedLabel} of buttons.values()) {
                if(button.closest('dialog[open]'))continue;
                anchor.after(button);delete button.dataset.compactVisible;
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
            button.dataset.compactGlyph=id==='endTripButton'&&paused?'▶':glyphs[id]||'';
            if(!button.hasAttribute('aria-label')||record.ownedLabel){button.setAttribute('aria-label',button.textContent.trim()||button.title||id);record.ownedLabel=true;}
            button.title=button.getAttribute('aria-label');
        }
        timer.hidden=!(down||paused);
        timer.querySelector('span').textContent=down?document.querySelector('.down-elapsed-panel > span').textContent:WMOFLanguagePack.text('672c73e3-0abd-428d-bf2d-0c87500fa495');
        timer.querySelector('output').textContent=down?document.getElementById('downElapsedValue').textContent:controls.breakClock;
    }
    globalThis.WMOFCompactActions=Object.freeze({render});
})();
