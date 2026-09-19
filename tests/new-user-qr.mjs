import fs from 'node:fs';import assert from 'node:assert/strict';import {Window} from 'happy-dom';
const window=new Window({url:'https://clock.example/api/admin/new-user/'});window.eval(fs.readFileSync(new URL('../api/vendor/qrcode.min.js',import.meta.url),'utf8'));
const target=window.document.createElement('div');window.document.body.append(target);new window.QRCode(target,{text:'https://clock.example/api/new-user/?token='+'a'.repeat(64),width:256,height:256,correctLevel:window.QRCode.CorrectLevel.M});
assert(target.querySelector('svg,canvas,table'));console.log('PASS local QR generator renders an invitation without a third-party request');window.happyDOM.abort();
