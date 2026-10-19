import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../TripAggregates.js',import.meta.url),'utf8'),ctx);
const rangeWindow={startTime:'2026-10-07T00:00:00Z',endTime:'2026-10-07T23:59:59.999Z'};
const row=(id,startTime,standard,counted,extra={})=>({id,startTime,standardTimeMilliseconds:standard,actualTimeMilliseconds:counted+100,countedTimeMilliseconds:counted,...extra});
const trips=[row(1,rangeWindow.startTime,1000,800),row(2,rangeWindow.endTime,2000,1200,{nonProduction:true}),row(3,'2026-10-08T00:00:00Z',9000,9000),row(4,'2026-10-06T23:59:59.999Z',9000,9000),row(5,'2026-10-07 12:00:00',9000,9000),row('offline-active','2026-10-07T12:00:00Z',9000,9000,{running:true})];
let result=ctx.TripAggregates.calculate({trips,rangeWindow,currentTripId:5,goalPercent:1.2});
assert.equal(result.tripCount,2);assert.equal(result.standardTimeMilliseconds,3000);assert.equal(result.countedTimeMilliseconds,2000);assert.equal(result.actualTimeMilliseconds,2200);assert.equal(result.percent,1.5);assert.equal(result.bankedTimeMilliseconds,500);assert(Object.isFrozen(result));
result=ctx.TripAggregates.calculate({trips:[...trips,row(1,rangeWindow.startTime,2000,1600)],rangeWindow,currentTripId:'5'});
assert.equal(result.tripCount,2,'numeric/string IDs deduplicate; current trip ID excluded');assert.equal(result.standardTimeMilliseconds,4000,'local completed record replaces server record');
result=ctx.TripAggregates.calculate({trips:[],rangeWindow});assert.equal(result.tripCount,0);assert.equal(result.percent,null);
result=ctx.TripAggregates.calculate({trips:[row(1,rangeWindow.startTime,1000,0)],rangeWindow});assert.equal(result.tripCount,1);assert.equal(result.percent,null,'zero counted time does not create Infinity');
result=ctx.TripAggregates.calculate({trips:[row(1,rangeWindow.startTime,1000,1500)],rangeWindow});assert.equal(result.bankedTimeMilliseconds,-500,'over-goal time retains sign');
assert.throws(()=>ctx.TripAggregates.calculate({trips:[],rangeWindow:{startTime:'invalid',endTime:'invalid'}}),/Invalid/);
console.log('PASS range boundaries, completed/current trips, nonproduction, local deduplication, totals, percent and goal calculations');

const active = row('active',rangeWindow.startTime,2000,1000,{running:true,allottedTimeMilliseconds:1500});
const completed = row('done',rangeWindow.startTime,1000,500);
const excluded=ctx.TripAggregates.calculate({trips:[completed,active],rangeWindow,includeActiveTrip:false});
const included=ctx.TripAggregates.calculate({trips:[completed,active],rangeWindow,includeActiveTrip:true});
assert.equal(excluded.tripCount,1);assert.equal(excluded.percent,2);
assert.equal(included.tripCount,2);assert.equal(included.countedTimeMilliseconds,2000);assert.equal(included.percent,1.5);
assert.equal(included.includeActiveTrip,true);
assert.equal(ctx.TripAggregates.calculate({trips:[{standardTimeMilliseconds:100,actualTimeMilliseconds:100},{standardTimeMilliseconds:100,actualTimeMilliseconds:300}]}).percent,.5,'anonymous rows must not deduplicate');
console.log('PASS shared active-trip inclusion, allotted floor, persisted counted time and fallback');

const downEvents=[
 {event:'interval.started',timestamp:'2026-10-07T10:00:00Z',value:{type:'down',intervalKey:'down-a',approvedTime:300000}},
 {event:'interval.ended',timestamp:'2026-10-07T10:10:00Z',value:{intervalKey:'down-a'}}
];
const downTrip=row('down',rangeWindow.startTime,1800000,1200000,{events:downEvents});
const before=JSON.stringify(downTrip);
let downtime=ctx.TripDowntimeSummary.trip(downTrip);
assert.equal(downtime.loggedMilliseconds,600000);assert.equal(downtime.approvedMilliseconds,300000);
assert.equal(downtime.hasDowntime,true);assert.equal(JSON.stringify(downTrip),before,'summarizing cannot edit events');
const denied={...downTrip,events:[...downEvents,{event:'interval.approval-changed',value:{intervalKey:'down-a',state:'unapproved'}}]};
assert.equal(ctx.TripDowntimeSummary.trip(denied).approvedMilliseconds,0);
const surplus={...denied,events:[...denied.events,{event:'interval.approval-changed',value:{intervalKey:'down-a',state:'approved',value:900000}}]};
assert.equal(ctx.TripDowntimeSummary.trip(surplus).approvedMilliseconds,900000,'latest approval can exceed logged time');
const deleted={...downTrip,events:[...downEvents,{event:'interval.deleted',value:{intervalKey:'down-a'}}]};
assert.equal(ctx.TripDowntimeSummary.trip(deleted).hasDowntime,false);
const defaultApproved={...downTrip,events:downEvents.map(e=>({...e,value:{...e.value,approvedTime:undefined}}))};
assert.equal(ctx.TripDowntimeSummary.trip(defaultApproved).approvedMilliseconds,600000,'preserve existing default approval');
const open={...downTrip,id:'open-down',running:true,events:[downEvents[0]]};
const options={trips:[downTrip,downTrip,open],rangeWindow,now:Date.parse('2026-10-07T10:03:00Z')};
assert.equal(ctx.TripAggregates.calculate(options).downtime.loggedMilliseconds,600000,'deduplicate and exclude active exactly like performance totals');
assert.equal(ctx.TripAggregates.calculate({...options,includeActiveTrip:true}).downtime.loggedMilliseconds,780000);
assert.equal(ctx.TripDowntimeSummary.trip({...downTrip,events:[...downEvents,downEvents[0]]}).intervalCount,1,'duplicate starts cannot double count');
assert.equal(ctx.TripDowntimeSummary.trip({...downTrip,events:downEvents.map(e=>({...e,value:{...e.value,type:'break'}}))}).hasDowntime,false,'breaks are not downtime');
console.log('PASS downtime approval precedence, surplus, deletion, default approval, active inclusion, deduplication and event immutability');
