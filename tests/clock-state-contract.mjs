import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {installAsyncStorage} from './async-storage-fixture.mjs';
const window=new Window({url:'https://clock.example/'});installAsyncStorage(window);
window.__testTime=Date.parse('2026-10-07T12:00:00Z');
window.eval(`const BaseDate=Date;window.Date=class extends BaseDate {constructor(...args){super(...(args.length?args:[window.__testTime]));}static now(){return window.__testTime;}};`);
const css=window.CSS;css.registerProperty=()=>{};Object.defineProperty(window,'CSS',{value:css});
Object.defineProperty(window,'AbortController',{value:globalThis.AbortController});Object.defineProperty(window,'AbortSignal',{value:globalThis.AbortSignal});
window.Element.prototype.animate=()=>({finished:Promise.resolve(),cancel(){},finish(){},effect:{getComputedTiming(){return{progress:1};}}});
for(const name of ['TemporalFormat','RingContainer','TimeRangeModel','TimeRangeElement','ClockTimer'])window.eval(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8'));
const timer=window.document.createElement('clock-timer');window.document.body.append(timer);
try {
    timer.configure({trip_goal:'140%',total_goal:'120%',goal_type:'trip'});
    assert.equal(timer.getUIState().auto_goal_order.join('_'),'total_trip_standard','equal/unavailable targets retain aggregate-first priority outside Auto');
    await timer.start({standardTimeMilliseconds:1000});
    window.__testTime+=2000;
    assert.equal(timer.getUIState().clock_phase,'overtime','overtime comes from the timer model');
    await timer.stop();await timer.clear();await timer.start({standardTimeMilliseconds:3600000});
    await timer.startInterval('break',600000,{breakType:'short'},150000,150000);
    const opening=timer.getUIState();
    assert.equal(opening.clock_phase,'opening-buffer');assert.equal(opening.active_break_type,'short');
    assert.equal(opening.interval_state.intervalType,'break','owning interval remains represented throughout the buffer');
    window.__testTime+=160000;
    assert.equal(timer.getUIState().clock_phase,'break');
    window.__testTime+=600000;
    assert.equal(timer.getUIState().clock_phase,'closing-buffer');
    assert(Object.isFrozen(timer.getUIState().interval_state));
    assert(Object.isFrozen(timer.getUIState().dispatch_state));
    await timer.endInterval();await timer.stop();await timer.clear();
    await timer.startBreakSession('break',600000,{breakType:'break'},15000,15000);
    window.__testTime+=60000;
    for(const mode of ['remaining','elapsed']){timer.renderedTimeMode=mode;const view=timer.getUIState();assert.equal(view.break_only,true);assert(!/[⁺⁻]$/.test(view.time_component.text),'standalone '+mode+' has no timing-gain/loss suffix');}
    let breakEnd;timer.addEventListener('breakEndedEarly',event=>breakEnd=event.detail,{once:true});
    await timer.endInterval();assert.equal(breakEnd.breakOnly,true,'completion captures break-only ownership before later cleanup');
    console.log('PASS full clock state, overtime, opening/closing buffers, owning interval and always-ready goal sequence');
} finally {timer.remove();await window.happyDOM.abort();}
