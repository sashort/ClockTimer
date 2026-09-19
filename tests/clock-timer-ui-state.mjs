import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';

const window=new Window({url:'https://clock.example/'});
window.__testTime=Date.parse('2026-09-19T12:00:00Z');
window.eval(`const RealDate=Date;window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[window.__testTime]));}static now(){return window.__testTime;}};`);
const css=window.CSS;css.registerProperty=()=>{};Object.defineProperty(window,'CSS',{value:css});
Object.defineProperty(window,'AbortController',{value:globalThis.AbortController});Object.defineProperty(window,'AbortSignal',{value:globalThis.AbortSignal});
window.Element.prototype.animate=()=>({finished:Promise.resolve(),cancel(){},finish(){},play(){},pause(){},effect:{getComputedTiming(){return {progress:1}}}});
for(const name of ['TemporalFormat','RingContainer','TimeRange','ClockTimer'])window.eval(fs.readFileSync(new URL('../'+name+'.js',import.meta.url),'utf8'));

const timer=window.document.createElement('clock-timer');window.document.body.append(timer);
const states=[];timer.addEventListener('uiStateChanged',event=>states.push(event.detail));
const configured=timer.configure({rendered_time_type:'calculated_end_time',goal_type:'total',auto_goal:false,trip_goal:'105%',total_goal:'110%',external_standard_time:'1:00:00',external_counted_time:3300000});
assert(configured instanceof window.ClockTimerUIState);assert.equal(configured.rendered_time_type,'calculated_end_time');assert.equal(configured.goal_type,'total');assert.equal(timer.getAttribute('trip-goal'),'105%');assert.equal(timer.getAttribute('total-goal'),'110%');
timer.configure({trip_goal:'107%'});assert.equal(timer.getAttribute('trip-goal'),'107%');assert.equal(timer.getAttribute('total-goal'),'110%');assert.equal(timer.renderedTimeMode,'calculated-end');
await timer.start({standardTime:'0:30:00'});
const state=timer.uiState;assert.equal(state.state,'running');assert.equal(state.standard_time_header_text,'Total Standard Time');assert.equal(state.time_header_text,'Total End Time');assert.equal(state.standard_time_component.value,5400000);assert.equal(state.trip_goal_component.text,'107%');assert(state.time_component.date instanceof window.Date);assert(Object.isFrozen(state));
assert(states.some(item=>item.transition==='trip_started'&&item.state==='running'));assert(states.some(item=>item.transition_phase==='active'));await Promise.resolve();assert(states.some(item=>item.transition_phase==='settled'));
window.__testTime+=1000;timer.dispatchEvent(new window.CustomEvent('test'));await new Promise(resolve=>setTimeout(resolve,10));
console.log('PASS configure is partial and UI state describes values, state, and transitions');
timer.remove();window.happyDOM.abort();
