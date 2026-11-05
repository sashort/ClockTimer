import fs from 'node:fs';import assert from 'node:assert/strict';import {Window} from './LanguageWindow.mjs';
const w=new Window({url:'https://clock.example/'});w.eval(fs.readFileSync(new URL('../CalendarRange.js',import.meta.url),'utf8'));w.eval(fs.readFileSync(new URL('../TripAggregates.js',import.meta.url),'utf8'));w.eval(fs.readFileSync(new URL('../TripLog.js',import.meta.url),'utf8'));
const root=w.document.createElement('div');w.document.body.append(root);let criteria='pay-period',filter='all',pad,includeCurrentSetting=false;
const events=[{id:1,event:'trip.started',timestamp:'2026-09-18 12:00:00',value:{}},{id:2,event:'interval.started',timestamp:'2026-09-18 12:05:00',value:{type:'break',length:120000,intervalKey:'b'}},{id:3,event:'interval.ended',timestamp:'2026-09-18 12:07:00',value:{intervalKey:'b'}},{id:4,event:'trip.stopped',timestamp:'2026-09-18 12:20:00',value:{}}];
const settings={creationAnchor:'2026-09-18T00:00:00Z',standardTimeMilliseconds:1200000,creationTime:'11:00:00',scheduledStart:'12:00:00',startTime:'12:00:00',nonProduction:false};
const view=new w.TripLog(root,{range:()=>criteria,filter:()=>filter,includeCurrent:()=>includeCurrentSetting,onIncludeCurrent:value=>{includeCurrentSetting=value;view.rerender();},onFilter:v=>filter=v,onRange:v=>criteria=v,onDate(){},numberPad:async options=>{assert.equal(options.confirmTarget,'none');assert.equal(options.cancelTarget,'none');pad=options;},request:async()=>({events,settings,revision:'test'}),refresh:async()=>{}});
const originalRequest=view.options.request;
const calendar={range:'pay-period',timezone:'UTC',startTime:'2026-09-05T00:00:00Z',endTime:'2026-09-19T00:00:00Z',rules:{weekStartDay:6,cutoffTime:'00:00:00'}};
const trips=[{id:2,startTime:'2026-09-17 09:00:00',endTime:'2026-09-17 09:30:00',standardTimeMilliseconds:1800000,actualTimeMilliseconds:1800000,events:[]},{id:1,startTime:'2026-09-18 12:00:00',endTime:'2026-09-18 12:20:00',standardTimeMilliseconds:1200000,actualTimeMilliseconds:1200000,events}];
view.render({trips},calendar);root.prepend(w.document.createTextNode('Loading trips...'));view.render({trips},calendar);assert(!root.textContent.includes('Loading trips...'),'reusing detached settings removes stale loading text nodes');assert.equal(root.querySelector('.trip-log-trip summary strong').textContent,'12:00');assert(!root.textContent.includes('September 2026'));assert.equal(root.querySelectorAll('.trip-log-overview').length,1);assert(root.textContent.includes('Standard 0:50:00'));assert(root.querySelectorAll('.trip-log-group').length>=3);
assert.deepEqual([...root.querySelectorAll('.trip-log-column-header [role="columnheader"]')].map(cell=>cell.textContent),['Time','Standard','Actual','Percent','']);
assert.equal(w.TripLog.duration(27*3600000+5*60000+9000),'27:05:09');assert.equal(w.TripLog.percent([{standardTimeMilliseconds:100,actualTimeMilliseconds:100},{standardTimeMilliseconds:100,actualTimeMilliseconds:300}]),'50.00%');
assert.equal(w.TripLog.percent([{standardTimeMilliseconds:100,actualTimeMilliseconds:200,countedTimeMilliseconds:100}]),'100.00%');
const numericDurationTrip={
 standardTimeMilliseconds:600000,
 actualTimeMilliseconds:600000,
 countedTimeMilliseconds:600000,
 events:[{event:'interval.started',value:{intervalKey:'numeric',type:'break',length:252000}}]
};
assert.equal(w.TripLog.counted(numericDurationTrip),600000,'Trip Log treats persisted counted milliseconds as authoritative');
const skippedBreakEvents=[
 {event:'interval.started',timestamp:'2026-09-20 17:31:32.751',value:{intervalKey:'skip',type:'break',length:600000,startBuffer:150000,endBuffer:150000}},
 {event:'interval.ended',timestamp:'2026-09-20 17:31:45.017',value:{intervalKey:'skip'}}
];
const skippedBreak={standardTimeMilliseconds:3383000,actualTimeMilliseconds:3665607,countedTimeMilliseconds:3653341,events:skippedBreakEvents};
assert.equal(w.TripLog.counted(skippedBreak),3653341,'Trip Log does not reinterpret persisted counted milliseconds from interval metadata');
assert.equal(w.TripLog.percent([skippedBreak]),'92.60%');
assert.equal(w.TripLog.counted({...skippedBreak,countedTimeMilliseconds:2765607}),2765607,'persisted counted milliseconds remain authoritative');
// Production regression: wall time is 10:03:36, but excluded intervals reduce
// counted time to 9:05:01. The Trip Log must show the counted-time result.
assert.equal(w.TripLog.percent([{
 standardTimeMilliseconds:28421000,
 actualTimeMilliseconds:36216727,
 countedTimeMilliseconds:32701965
}]),'86.91%');
assert.equal(w.TripLog.percent([{running:true,standardTimeMilliseconds:1200000,allottedTimeMilliseconds:1200000,countedTimeMilliseconds:600000}]),'100.00%');
assert.equal(w.TripLog.percent([{running:true,standardTimeMilliseconds:1200000,allottedTimeMilliseconds:1200000,countedTimeMilliseconds:1500000}]),'80.00%');
assert.equal(w.TripLog.percent([{running:true,standardTimeMilliseconds:1200000,allottedTimeMilliseconds:1500000,countedTimeMilliseconds:600000}]),'80.00%');
assert.equal(w.TripLog.percent([{standardTimeMilliseconds:1200000,actualTimeMilliseconds:600000}]),'200.00%');
assert.equal(w.TripLog.percent([{running:true,standardTimeMilliseconds:1800000,allottedTimeMilliseconds:1800000,countedTimeMilliseconds:600000,productiveTimeMilliseconds:1200000,allowanceCreditMilliseconds:600000}]),'133.33%','active trip projection immediately includes unused break allowance');
assert.equal(w.TripLog.percent([{standardTimeMilliseconds:1800000,countedTimeMilliseconds:1500000,productiveTimeMilliseconds:2100000,allowanceCreditMilliseconds:600000}]),'114.29%','completed earned time includes credit once over productive work');
assert.equal(view.entryLabel(events[2],events[1],events[2]),'Break Ended');
assert.equal(view.entryLabel({...events[2],timestamp:'2026-09-18 12:06:00'},events[1],{...events[2],timestamp:'2026-09-18 12:06:00'}),'Break Ended Early · 1:00 Gained');
assert.equal(view.entryLabel({...events[2],timestamp:'2026-09-18 12:08:30'},events[1],{...events[2],timestamp:'2026-09-18 12:08:30'}),'Break Ended Late · 1:30 Lost');
const shortBreakStart={...events[1],value:{...events[1].value,attributes:{breakType:'short'}}};
assert.equal(view.entryLabel(shortBreakStart,shortBreakStart,events[2]),'Short Break Started');
assert.equal(view.entryLabel(events[2],shortBreakStart,events[2]),'Short Break Ended');
const downStart={id:4,event:'interval.started',timestamp:'2026-09-18 12:10:00',value:{type:'down',intervalKey:'down-1',approvedTime:300000}};
const downEnd={id:5,event:'interval.ended',timestamp:'2026-09-18 12:16:30',value:{intervalKey:'down-1'}};
assert.equal(view.entryLabel(downEnd,downStart,downEnd,[downStart,downEnd]),'Down Ended · 1:30 Approval Deficit');
downStart.value.approvedTime=450000;
assert.equal(view.entryLabel(downEnd,downStart,downEnd,[downStart,downEnd]),'Down Ended · 1:00 Approval Surplus');
assert.equal(w.TripLog.percent([{standardTimeMilliseconds:600000,actualTimeMilliseconds:600000},{running:true,standardTimeMilliseconds:1200000,actualTimeMilliseconds:600000}],true),'100.00%');
assert.equal(w.TripLog.percent([{standardTimeMilliseconds:600000,actualTimeMilliseconds:600000},{running:true,includeInParentPercent:true,standardTimeMilliseconds:1200000,actualTimeMilliseconds:600000}],true),'150.00%');
console.log('PASS newest-first, pay-period hierarchy, weighted percentages, and unlimited-hour overview');
const collapsed=root.querySelector('.trip-log-group');collapsed.open=false;collapsed.dispatchEvent(new w.Event('toggle'));
let includeActive=false;
view.options.liveTrip=()=>({...trips[1],running:true,activeState:'break',includeInParentPercent:includeCurrentSetting||includeActive,actualTimeMilliseconds:1200000,countedTimeMilliseconds:1200000,allottedTimeMilliseconds:1200000});
view.render({trips},calendar);
assert.equal(root.querySelector('.trip-log-group').open,false);
assert(root.querySelector('.trip-log-trip.is-active-trip'));
assert(root.querySelectorAll('.trip-log-group.has-active-trip').length>=2);
assert.equal(root.querySelector('.trip-log-trip.is-active-trip').dataset.activeState,'break');
assert(Boolean(root.querySelector('.trip-log-trip.is-active-trip .trip-log-menu')),'active trips expose editing actions');
assert([...root.querySelectorAll('.trip-log-group.has-active-trip')].every(group=>group.dataset.activeState==='break'));
assert.equal(root.querySelector('.trip-log-entry.is-active-entry').dataset.activeState,'break');
assert.equal(root.querySelector('.trip-log-trip.is-active-trip>summary span:nth-of-type(2)').textContent,'0:20:00');
assert.equal(root.querySelector('.trip-log-overview .trip-log-times').textContent,'Standard 0:30:00 · Actual 0:30:00');
includeActive=true;view.render({trips},calendar);
assert.equal(root.querySelector('.trip-log-overview .trip-log-times').textContent,'Standard 0:50:00 · Actual 0:50:00');
includeActive=false;const includeCurrent=w.document.querySelector('[data-include-current]');includeCurrent.checked=true;includeCurrent.dispatchEvent(new w.Event('change'));assert.equal(root.querySelector('.trip-log-overview .trip-log-times').textContent,'Standard 0:50:00 · Actual 0:50:00');
const firstSweepDelay=root.querySelector('.trip-log-trip.is-active-trip').style.getPropertyValue('--trip-log-active-sweep-delay');
assert.match(firstSweepDelay,/^-\d+ms$/);
assert.equal(root.querySelector('.trip-log-group.has-active-trip').style.getPropertyValue('--trip-log-active-sweep-delay'),firstSweepDelay);
view.options.liveTrip=undefined;
console.log('PASS collapsed headers retain state while active trip values and parent activity markers update');
assert.equal(view.settingsDialog.open,false);
assert.equal(view.settingsDialog.open,false);
view.setSettingsVisible(true);
assert(view.settingsDialog.open);
assert.equal(view.settingsDialog.open,true);
assert(w.document.querySelector('.trip-log-settings hr'));
const settingsNode=w.document.querySelector('.trip-log-settings');
const selectNode=w.document.querySelector('.trip-log-settings select');
selectNode.focus();
view.render({trips},calendar);
assert.equal(w.document.querySelector('.trip-log-settings'),settingsNode);
assert.equal(w.document.querySelector('.trip-log-settings select'),selectNode);
assert.equal(w.document.activeElement,selectNode);
assert(view.settingsDialog.open);
view.setSettingsVisible(false);
assert.equal(view.settingsDialog.open,false);
console.log('PASS settings default hidden, toggle with divider, and remain open across data refreshes');
const dates=w.document.querySelectorAll('input[type=date]');assert.equal(dates[0].value,'2026-09-05');assert.equal(dates[1].value,'2026-09-18');assert(!dates[0].disabled,'preset Start date remains editable');assert(dates[1].disabled,'preset End date is derived');
criteria='custom';view.render({trips},calendar);assert(!w.document.querySelector('input[type=date]').disabled);
assert.equal(typeof view.openSettings,'undefined');assert.equal(typeof view.beginEntryEdit,'undefined');
let openedTrip;w.TripEditor={open:async trip=>{openedTrip=trip;return {dialog:{open:false}};}};await view.openTripEditor(trips[1]);assert.equal(openedTrip.id,trips[1].id);
assert(!root.querySelector('.trip-log-entry-time'));assert(!root.querySelector('.trip-log-down-detail-button'));
console.log('PASS shared dates, read-only log and single dedicated editor entry point');
view.render({trips:[]},calendar);
assert.equal(root.querySelector('.trip-log-overview'),null);
assert.equal(root.querySelector('.trip-log-column-header'),null);
assert(root.classList.contains('trip-log-empty'));
assert.equal(root.querySelector('.trip-log-empty-message strong').textContent,'No trips in range');
view.setSettingsVisible(true);
assert(view.settingsDialog.open);
view.render({trips},calendar);
assert(!root.classList.contains('trip-log-empty'));
assert(root.querySelector('.trip-log-overview'));
assert.equal(root.querySelector('.trip-log-empty-message'),null);
view.render({trips:[],loginRequired:true},calendar);
assert.equal(root.querySelector('.trip-log-overview'),null);
assert.equal(root.querySelector('.trip-log-empty-message').textContent,'Log in to view saved trips.');
assert(w.document.querySelector('.trip-log-settings select'));
console.log('PASS empty range replaces overview with centered message and restores summary when trips return');
view.render({trips:[{...trips[0],id:'offline-one',buffered:true},{...trips[1],id:'offline-two',buffered:true}],offline:true,incomplete:true},calendar);
assert.equal(root.querySelectorAll('.trip-log-trip').length,2);
assert(root.querySelector('.trip-log-overview .calculation-uncertain-icon'));
assert.equal(root.querySelectorAll('.trip-log-trip .trip-log-menu').length,2);
const localEvents=events.map((event,index)=>({...event,id:`local-${index}`})),offlineTrip={...trips[1],id:'offline-two',buffered:true,events:localEvents};
const offlineChanges=[];view.options.request=async(id,change)=>{if(change)offlineChanges.push(change);return {events:localEvents,settings,revision:'offline'};};view.options.refresh=async()=>{};
view.render({trips:[offlineTrip],offline:true,incomplete:true},calendar);
assert(root.querySelector('.trip-log-consolidated-interval').textContent.includes('Break:'));assert.equal(root.querySelectorAll('.trip-log-consolidated-interval .trip-log-interval-times>span').length,2,'start/end times remain aligned with their own nodes');
assert.equal(root.querySelectorAll('.trip-log-menu-actions button').length,2);assert.equal(root.querySelector('.trip-log-menu-actions button').textContent,'Edit Trip');
view.options.request=originalRequest;console.log('PASS obsolete inline editor and camera controls are absent');
view.setSettingsVisible(false);
view.render({trips:[],offline:true},calendar);
assert.match(root.querySelector('.trip-log-empty-message').textContent,/Connect to load saved trips/);
assert.equal(view.settingsDialog.open,false);
view.render({trips:[trips[0]]},calendar);view.setSettingsVisible(false);
w.confirm=()=>true;
view.options.refresh=async()=>view.render({trips:[]},calendar);
await view.deleteTrip(trips[0]);
assert.equal(root.querySelector('.trip-log-overview'),null);
assert.equal(view.settingsDialog.open,false);

const appSource = fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
assert.match(appSource,/function getAppContentMetrics\([\s\S]*visualViewport[\s\S]*Math\.max\([\s\S]*viewportLeft[\s\S]*Math\.min\([\s\S]*viewportRight/,'Trip Log geometry is constrained to the visual viewport');
console.log('PASS local offline trips and uncertain totals render, and deleting the only trip reveals filters');

const noDown={...trips[0],id:301,events:[]};
const withDown={...trips[1],id:302,events:[
 {event:'interval.started',timestamp:'2026-09-18T12:05:00Z',value:{type:'down',intervalKey:'summary-down',approvedTime:300000}},
 {event:'interval.ended',timestamp:'2026-09-18T12:13:00Z',value:{intervalKey:'summary-down'}}
]};
view.options.liveTrip=undefined;view.render({trips:[noDown,withDown]},calendar);
assert.equal(root.querySelector('[data-trip-id="301"]>summary .trip-log-downtime'),null,'omit downtime for a trip without Down');
assert.match(root.querySelector('[data-trip-id="302"]>summary .trip-log-downtime').textContent,/0:08:00/);
assert.match(root.querySelector('[data-trip-id="302"]>summary .trip-log-downtime').textContent,/0:05:00/);
assert.equal(root.querySelector('.trip-log-down-section'),null);view.showDownSummary();assert(view.downDialog.querySelector('.trip-log-down-grid'));
assert(root.querySelector('.trip-log-group>summary .trip-log-downtime'));
for(const group of root.querySelectorAll('.trip-log-group'))assert.equal([...group.children].filter(e=>e.classList.contains('trip-log-group-children')).length,1,'one guide-bearing child container per aggregate');
view.render({trips:[noDown]},calendar);
assert.equal(root.querySelector('.trip-log-downtime'),null,'omit zero downtime at every aggregate and trip level');
assert.equal(root.querySelector('.trip-log-down-section'),null,'omit the entire dedicated section when all Down categories are zero');
console.log('PASS logged/approved downtime summaries, zero omission and one grouping guide per aggregate');
const pendingDown={...withDown,id:303,events:withDown.events.map(e=>({...e,value:{...e.value,approvedTime:undefined,approvalState:'pending'}}))};
let showPending=true;view.options.showPendingDownTime=()=>showPending;view.render({trips:[withDown,pendingDown]},calendar);
assert(root.querySelector('.trip-log-group>summary .trip-log-downtime-approved').textContent.includes('Applied 0:13:00'));
assert(root.querySelector('[data-trip-id="303"] .trip-log-downtime-approved').textContent.includes('Applied 0:08:00'));
view.showDownSummary();assert.equal(view.downDialog.querySelector('.trip-log-down-effective>span').textContent,'Applied');
showPending=false;view.rerender();assert(root.querySelector('.trip-log-group>summary .trip-log-downtime-approved').textContent.includes('Approved 0:05:00'));
assert(root.querySelector('[data-trip-id="303"] .trip-log-downtime-approved').textContent.includes('Approved 0:00:00'));
view.downTimeOnly=true;view.rerender();assert(root.querySelector('.trip-log-group>summary .trip-log-downtime-approved').textContent.includes('Approved 0:05:00'),'Down-only does not override the pending calculation preference');
view.downTimeOnly=false;view.options.showPendingDownTime=undefined;
console.log('PASS Applied/Approved ledger labels and values follow the effective Pending setting at trip and aggregate levels');
const standalone={id:910,startTime:'2026-09-18T13:00:00Z',endTime:'2026-09-18T13:15:00Z',breakOnly:true,nonProduction:false,
 standardTimeMilliseconds:null,countedTimeMilliseconds:0,actualTimeMilliseconds:900000,events:[{event:'trip.started',timestamp:'2026-09-18T13:00:00Z',value:{breakOnly:true}}]};
view.render({trips:[...trips,standalone]},calendar);
assert.equal(root.querySelectorAll('.trip-log-trip').length,3,'break-only sessions remain visible');
assert.equal(view.aggregation.tripCount,2,'aggregate trip count excludes break-only');
assert.equal(view.aggregation.standardTimeMilliseconds,3000000);
const breakRow=root.querySelector('[data-trip-id="910"]');
assert(breakRow.classList.contains('is-break-only'));
assert.equal(breakRow.querySelector('.trip-log-break-only-badge').textContent,'Break only');
assert.equal(breakRow.querySelector('.trip-log-break-only-duration').textContent,'0:15:00');
assert.equal(breakRow.querySelector('.trip-log-actual'),null,'no performance on break-only row');
view.options.liveTrip=()=>({...standalone,id:911,running:true,activeState:'break'});
filter='all';view.render({trips},calendar);assert(root.querySelector('[data-trip-id="911"]'));
filter='productive';view.render({trips},calendar);assert(!root.querySelector('[data-trip-id="911"]'));
filter='non-productive';view.render({trips},calendar);assert(!root.querySelector('[data-trip-id="911"]'));
console.log('PASS break-only log visibility, badge, elapsed duration, filter classification and aggregate exclusion');
w.happyDOM.abort();
