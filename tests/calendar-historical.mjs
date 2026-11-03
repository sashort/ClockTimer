import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const ctx=vm.createContext({Date,Intl,URL,URLSearchParams,location:{origin:'https://clock.example/'}});vm.runInContext(fs.readFileSync(new URL('../CalendarRange.js',import.meta.url),'utf8'),ctx);
const Range=ctx.CalendarRange,client=new Range({databaseOnly:true});
const rules={weekStartDay:6,cutoffTime:'04:00:00',payPeriodDays:14,payPeriodAnchorDate:'2026-01-31',payPeriodAnchorBasis:'fiscal-year-start',recurring:true,effectiveFrom:'1970-01-01',effectiveThrough:null};
client.setDatabaseRecords([2025,2026].map(year=>({profile:'walmart-us',searchedYear:year,timezone:'America/New_York',rules:{...rules,payPeriodAnchorDate:year===2025?'2025-02-01':'2026-01-31'}})));
for(const [range,date,start,end] of [['day','2026-10-14','2026-10-14T08:00:00.000Z','2026-10-15T08:00:00.000Z'],['week','2026-10-14','2026-10-10T08:00:00.000Z','2026-10-17T08:00:00.000Z'],['pay-period','2026-10-14','2026-10-10T08:00:00.000Z','2026-10-24T08:00:00.000Z'],['year','2025-08-14','2025-01-01T09:00:00.000Z','2026-01-01T09:00:00.000Z']]){
 const result=await client.resolve({range,date});assert.equal(result.startTime,start);assert.equal(result.endTime,end);assert.equal(Range.containsNow(result,'2026-11-03T17:00:00Z'),false);console.log('PASS selected date aligns '+range+' boundaries');
}
const fold=await client.resolve({range:'day',date:'2026-10-31'});assert.equal(Date.parse(fold.endTime)-Date.parse(fold.startTime),25*3600000,'cutoff preserves a 25-hour DST day');
const current=await client.resolve({range:'week',at:'2026-11-03T17:00:00Z'});assert(Range.containsNow(current,'2026-11-03T17:00:00Z'));assert.equal(Range.containsNow(current,current.endTime),false,'end boundary belongs to next period');
await assert.rejects(client.resolve({range:'week',date:'2026-02-30'}),/Invalid calendar/);
console.log('PASS current return, DST duration, exclusive boundary and invalid date handling');
