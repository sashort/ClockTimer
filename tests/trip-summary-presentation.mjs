import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {englishLanguage} from './announcement-language-fixture.mjs';
const language=await englishLanguage(),context=vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../TripSummary.js',import.meta.url),'utf8'),context);
const build=options=>context.TripSummary.build({scope:'day',scopeLabel:'Day',text:(key,args)=>language.text('messages.tripSummary.'+key,args),
 duration:ms=>ms+' ms',percent:(_value,formatted)=>formatted+'%',spokenDuration:ms=>ms+' milliseconds',spokenPercent:(_value,formatted)=>formatted+' percent',...options});
const totals={tripCount:2,standardTimeMilliseconds:900000,countedTimeMilliseconds:600000,percent:1.5};
const trips=[{id:1,startTime:'2026-10-17T10:00:00Z',standardTimeMilliseconds:600000,countedTimeMilliseconds:400000},
 {id:2,startTime:'2026-10-17T11:00:00Z',standardTimeMilliseconds:300000,countedTimeMilliseconds:200000,actualTimeMilliseconds:999999}];
const result=build({trips,totals});
assert.deepEqual(Array.from(result.rows,r=>r.label),['Day','Last trip']);
assert.equal(result.rows[1].actual,'200000 ms');
assert.equal(result.speech,'Actual time for your last trip was 200000 milliseconds. Your performance was 150.0 percent, and your day performance is 150.0 percent.');
const assigned=build({trips,totals,activeTrip:{id:3,standardTimeMilliseconds:600000}});
assert.deepEqual(Array.from(assigned.rows,r=>r.label),['Day','Last trip','Active trip']);
assert.equal(assigned.rows[2].actual,'---');assert.equal(assigned.rows[2].percent,'---');
assert.equal(assigned.speech,result.speech+' Standard time for this trip is 600000 milliseconds.');
const missing=build({trips:[],totals:{tripCount:0,percent:null}});
assert(missing.rows.every(row=>row.standard==='---'&&row.actual==='---'&&row.percent==='---'));assert.equal(missing.speech,'No trip data available.');
const unknown=build({trips:[{id:4,startTime:'2026-10-17T12:00:00Z',actualTimeMilliseconds:999}],totals});
assert.equal(unknown.rows[1].actual,'---','wall elapsed cannot substitute for missing counted actual');
assert(!unknown.speech.includes('Actual time for your last trip'));
const excluded=build({trips:[...trips,{id:3,startTime:'2026-10-17T12:00:00Z',standardTimeMilliseconds:999,countedTimeMilliseconds:999}],totals,activeTrip:{id:3}});
assert.equal(excluded.lastTrip.id,2,'active assignment cannot become last trip');
const mixed=build({trips:[{...trips[0],startTime:'2026-10-17 11:00:00'},{...trips[1],startTime:'2026-10-17T12:00:00Z'}],totals});
assert.equal(mixed.lastTrip.id,2,'database UTC and ISO times select the same last trip in every local timezone');
assert(Object.isFrozen(result)&&Object.isFrozen(result.rows));
console.log('PASS exact trip-summary announcement, last/active selection, counted actual, conditional standard sentence and missing data');

for(const [scope,scopeLabel] of [['day','Day'],['week','Week'],['pay-period','Money'],['month','Month'],['year','Year']]) {
 const scoped=build({trips,totals,scope,scopeLabel});
 assert.equal(scoped.rows[0].label,scopeLabel,'summary labels its selected aggregate scope');
}

for(const [ratio,expected] of [[1.23499,"123.4"],[1.001,"100.1"],[1.999999,"199.9"],[0,"0.0"]]) {
 const truncated=build({totals:{tripCount:1,standardTimeMilliseconds:ratio*100000,countedTimeMilliseconds:100000,percent:ratio},
  trips:[{id:1,standardTimeMilliseconds:ratio*100000,countedTimeMilliseconds:100000}],activeTrip:{id:2,standardTimeMilliseconds:ratio*100000,countedTimeMilliseconds:100000}});
 assert(truncated.rows.every(row=>row.percent===expected+"%"),"every summary row truncates: "+ratio);
 assert(truncated.speech.includes("Your performance was "+expected+" percent, and your day performance is "+expected+" percent."),"speech matches displayed precision");
}
