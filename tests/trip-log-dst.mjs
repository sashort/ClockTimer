import fs from 'node:fs';import assert from 'node:assert/strict';import {Window} from './LanguageWindow.mjs';
process.env.TZ='America/New_York';
const w=new Window();try{
 w.eval(fs.readFileSync(new URL('../TripLog.js',import.meta.url),'utf8'));
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 const section=(a,b)=>app.slice(app.indexOf('    function '+a+'('),app.indexOf('    function '+b+'('));
 w.eval(`const clockTimer={getAttribute:()=> 'true'};function parseDateInput(value){return new Date(value+'T00:00:00');}function getTripBaseDate(){throw Error('Exact instants do not borrow another trip date');}function formatDateInput(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}${section('parseTimelineTime','splitTimeDigits')}${section('absoluteDigits','absoluteDigitsValid')}${section('getAbsolutePadInitial','absoluteHour24')}`);
 for(const [instant,digits,date] of [['2026-11-01T10:11:34.125Z','51134','2026-11-01'],['2026-11-02T05:00:00.000Z','00000','2026-11-02'],['2027-03-15T04:00:00.000Z','00000','2027-03-15'],['2026-11-01T06:30:00.500Z','13000','2026-11-01']]){
  let pad;const form=w.document.createElement('form'),view={numberPad:async options=>{pad=options;},date:w.TripLog.prototype.date,error:e=>{throw e;}};
  w.TripLog.prototype.timeField.call(view,form,'Time',instant,'absolute',()=>{},date).click();
  assert.equal(pad.initialValue,instant,'Trip Log passes the exact saved instant');
  const initial=w.getAbsolutePadInitial(pad.initialValue,pad.tripDefaults.creationDate);
  assert.equal(initial.digits,digits);assert.equal(initial.date,date);assert.equal(initial.milliseconds,new Date(instant).getMilliseconds());
 }
 const civil=w.getAbsolutePadInitial('5:11:34.125','2026-11-01');assert.equal(civil.digits,'51134');assert.equal(civil.milliseconds,125,'same-day clock inputs remain civil times on DST dates');
 const instants={creationTime:'2026-11-01T23:10:00.000Z',scheduledStart:'2026-11-02T00:10:00.000Z',startTime:'2026-11-01T23:40:00.125Z'},fields=[];let submit,submitted;
 const view={options:{request:async(id,change)=>{if(change)submitted=change;return{settings:{standardTimeMilliseconds:3600000,instants},revision:'test'};}},modal:()=>({form:w.document.createElement('form')}),date:w.TripLog.prototype.date,timeField:(form,label,value,mode)=>fields.push({value,mode}),footer:(form,callback)=>{submit=callback;}};
 await w.TripLog.prototype.openSettings.call(view,{id:1,startTime:instants.startTime});
 assert.deepEqual(fields.filter(f=>f.mode==='absolute').map(f=>f.value),[instants.scheduledStart,instants.creationTime]);await submit();
 assert.equal(JSON.stringify(submitted.settings.instants),JSON.stringify(instants));assert(!('creationAnchor' in submitted.settings),'editor never sends a legacy midnight anchor');
 console.log('PASS exact Trip Log/Numberpad instants and canonical editor settings without legacy anchors');
}finally{await w.happyDOM.close();}
