import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context=vm.createContext({Date,Intl,URL,URLSearchParams,location:{origin:'https://clock.example'},localStorage:{},fetch:()=>{throw Error('Must not fetch')}});
vm.runInContext(fs.readFileSync(new URL('../CalendarRange.js',import.meta.url),'utf8'),context);
const client=new context.CalendarRange({databaseOnly:true,fetcher:()=>{throw Error('Must not fetch')}});
const rules={weekStartDay:6,cutoffTime:'00:00:00',payPeriodDays:14,payPeriodAnchorDate:'2026-01-31',payPeriodAnchorBasis:'fiscal-year-start',recurring:true,effectiveFrom:'1970-01-01',effectiveThrough:null};
client.setDatabaseRecords([{profile:'walmart-us',searchedYear:2026,timezone:'America/New_York',rules,provenance:'manual'}]);
for(const range of ['day','week','pay-period','month','year']){
 const result=await client.resolve({range,at:'2026-09-18T16:00:00Z'});
 assert(Date.parse(result.startTime)<Date.parse(result.endTime));assert.equal(result.provenance,'manual');
 console.log('PASS login database rules calculate '+range+' without network');
}
for(const [at,week,period,start] of [['2026-01-31T05:00:00Z',1,1,'2026-01-31T05:00:00.000Z'],['2026-02-07T05:00:00Z',2,1,'2026-01-31T05:00:00.000Z'],['2026-02-14T05:00:00Z',1,2,'2026-02-14T05:00:00.000Z']]){
 const result=await client.resolve({range:'pay-period',at});assert.equal(result.payWeek,week);assert.equal(result.payPeriodNumber,period);assert.equal(result.startTime,start);
 console.log('PASS fiscal anchor pay week '+week+' in period '+period);
}
await assert.rejects(client.resolve({range:'pay-period',at:'2026-01-30T17:00:00Z'}),/No stored/);
console.log('PASS missing prior fiscal-year anchor is not guessed');
client.setDatabaseRecords([]);
await assert.rejects(client.resolve({range:'week'}),/No stored/);
console.log('PASS missing login rules never cause discovery or calendar fetch');
