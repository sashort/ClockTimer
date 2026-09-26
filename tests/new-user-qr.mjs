import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';

const adminSource=fs.readFileSync(
    new URL('../api/admin/new-user/index.php',import.meta.url),
    'utf8'
);
const profileSource=fs.readFileSync(
    new URL('../api/new-user/index.php',import.meta.url),
    'utf8'
);

assert.match(adminSource,/name="permissions\[\]"/);
assert.match(adminSource,/name="multi_use"/);
assert.match(adminSource,/Multi use/);
assert.match(adminSource,/expires in 1 hour/i);

assert.match(profileSource,/id="newUserGradient"/);
assert.match(profileSource,/animateTransform/);
assert.match(profileSource,/id="newUserMask"/);
assert.match(profileSource,/circle cx="9" cy="8" r="4"/);
assert.match(profileSource,/M2 21c0-4 3\.1-7 7-7/);
assert.match(profileSource,/session_regenerate_id\(true\)/);
assert.match(profileSource,/location\.replace\(data\.redirect\|\|'\/'\)/);

const window=new Window({
    url:'https://clock.example/api/admin/new-user/'
});
window.eval(
    fs.readFileSync(
        new URL('../api/vendor/qrcode.min.js',import.meta.url),
        'utf8'
    )
);

const target=window.document.createElement('div');
window.document.body.append(target);
new window.QRCode(target,{
    text:'https://clock.example/api/new-user/?token=wmof_'+ 'a'.repeat(43),
    width:256,
    height:256,
    correctLevel:window.QRCode.CorrectLevel.M
});

assert(target.querySelector('svg,canvas,table'));
console.log(
    'PASS new-user QR controls, animated icon, auto-login redirect, and local QR rendering'
);
window.happyDOM.abort();
