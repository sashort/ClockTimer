import fs from 'node:fs';import assert from 'node:assert/strict';import {Window} from './LanguageWindow.mjs';
process.env.TZ='America/New_York';
const w=new Window();try{
 w.eval(fs.readFileSync(new URL('../TripLog.js',import.meta.url),'utf8'));
 const clock=(iso,base)=>w.TripLog.prototype.clockValue.call({},iso,base);
 assert.equal(clock('2026-11-01T10:11:34.125Z','2026-11-01'),'5:11:34.125','post-fall editor shows local time, not elapsed hours since midnight');
 assert.equal(clock('2026-11-02T05:00:00Z','2026-11-01'),'24:00:00','a 25-hour day still advances one civil date');
 assert.equal(clock('2027-03-15T04:00:00Z','2027-03-14'),'24:00:00','a 23-hour day still advances one civil date');
 console.log('PASS Trip Log absolute-time inputs use civil labels while storage retains exact instants');
}finally{await w.happyDOM.close();}
