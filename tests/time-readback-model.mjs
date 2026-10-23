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
    timer.configure({trip_goal:'125%',total_goal:'120%',goal_type:'trip'});
    await timer.start({standardTimeMilliseconds:60000});
    const base=window.__testTime;
    for(const elapsed of [2500,12750,48500,49500]) {
        window.__testTime=base+elapsed;
        const now=new window.Date();
        const numeric=timer.getTimeRemainingMilliseconds(now);
        const text=timer.getRenderedTime('remaining',now);
        const parsed=text.match(/^(-)?(?:(\d+):)?(\d+):(\d+)$/);
        assert(parsed,text);
        const displayed=(Number(parsed[2]||0)*3600+Number(parsed[3])*60+Number(parsed[4]))*(parsed[1]?-1000:1000);
        assert.equal((Math.ceil(numeric/1000)*1000)||0,displayed,'continuous balance matches the displayed current goal at its tick cadence');
        assert.equal(Math.round(numeric),48000-elapsed,'125% uses 48 seconds, not the 60-second standard');
    }
    assert.throws(()=>timer.getTimeRemainingMilliseconds(new window.Date(NaN)),/valid Date/);
    assert.equal(timer.getUIState().current_percent_component.available,true,'actual percentage exists during the running trip');
    await timer.stop();await timer.clear();await timer.start({standardTimeMilliseconds:600000});
    await timer.startInterval('break',10000,{breakType:'short'});
    const paused=timer.getTimeRemainingMilliseconds(new window.Date());window.__testTime+=2500;
    assert.equal(timer.getTimeRemainingMilliseconds(new window.Date()),paused,'a break freezes the same remaining balance');
    console.log('PASS goal-based remaining query, future projection, overtime rounding, actual percent and paused balance');
} finally {timer.remove();await window.happyDOM.abort();}
