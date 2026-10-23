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
    await timer.start({standardTimeMilliseconds:60000});
    const base=window.__testTime;
    timer.calculateOfflineTripTotals([{id:999,startTime:'2026-10-07T11:00:00Z',endTime:'2026-10-07T11:10:00Z',standardTimeMilliseconds:600000,actualTimeMilliseconds:600000,countedTimeMilliseconds:600000}], '2026-10-01T00:00:00Z','2026-11-01T00:00:00Z');
    for(const mode of ['trip','total']){
        timer.percentMode=mode;
        window.__testTime=base+10000;
        const before=timer.getUIState(new window.Date()).current_percent_component;
        const first=timer.getSummarySnapshot();
        window.__testTime=base+40000;
        const after=timer.getUIState(new window.Date()).current_percent_component;
        const last=timer.getSummarySnapshot();
        console.log(JSON.stringify({mode,before,after,totalBefore:first.total,totalAfter:last.total}));
        assert.notEqual(before.value,after.value,'populated '+mode+' actual percent must advance');
    }
} finally {timer.remove();await window.happyDOM.abort();}
