import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {Window} from './LanguageWindow.mjs';
const w=new Window({url:'https://clock.example/'});
w.document.body.innerHTML=readFileSync(new URL('../order-filler.html',import.meta.url),'utf8').match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g,'');
w.eval(readFileSync(new URL('../IdentityContext.js',import.meta.url),'utf8'));
w.eval(readFileSync(new URL('../UserLookup.js',import.meta.url),'utf8'));
const $=id=>w.document.getElementById(id), requests=[];
const profiles={42:{id:42,first_name:'Jane',last_name:'Doe',preferred_name:'J',username:'jane',permissions:0,login_id:'0042'},43:{id:43,first_name:'John',last_name:'Smith',preferred_name:null,username:'john',permissions:0,login_id:'0043'}};
let results=[profiles[42]],rejectSave=false,holdLoad=false,resolveLoad,holdSave=false,resolveSave;
w.fetch=async(url,options={})=>{
 requests.push({url:String(url),...options});const parsed=new URL(url);
 let data,ok=true;
 if(parsed.pathname.includes('user-lookup'))data={identities:results,hasMore:false};
 else if(options.method==='PATCH'){
  if(holdSave)await new Promise(r=>resolveSave=r);
  const input=JSON.parse(options.body);if(rejectSave){ok=false;data={message:'Rejected profile update'};}
  else {const p=profiles[input.userId];for(const [k,c]of Object.entries({firstName:'first_name',lastName:'last_name',preferredName:'preferred_name',username:'username',loginId:'login_id',permissions:'permissions'}))if(k in input)p[c]=input[k];data={user:{...p}};}
 } else if(parsed.searchParams.has('userId')){
  const user={...profiles[Number(parsed.searchParams.get('userId'))]};
  if(holdLoad)await new Promise(r=>resolveLoad=r);
  data={user};
 }else data={csrfToken:'csrf-test'};
 return {ok,json:async()=>data};
};
let saved;const lookup=new w.WMOFUserLookup({baseUrl:w.document.baseURI,canLookup:()=>true,canEdit:()=>true,canAssignPermissions:()=>true,canGrantPermission:bit=>bit===128,onProfileSaved:user=>saved=user});
const settle=()=>new Promise(r=>setTimeout(r,30));
$('userLookupUsername').value='jane';await lookup.search();await settle();
assert.equal(lookup.state.phase,'editing');assert.equal(lookup.state.selectedAccountId,42);assert(lookup.state.canSave);assert.equal($('editProfileAccountId').value,'42');assert($('editProfileAccountId').readOnly);
assert.equal($('editProfileLoginId').value,'0042');assert.equal($('editProfileFirstName').value,'Jane');assert.equal($('editProfilePin').value,'');
assert.equal($('editProfilePermissions').querySelector('input[value="4"]').disabled,true,'ungrantable permission is disabled');
assert.equal($('editProfilePermissions').querySelector('input[value="128"]').disabled,false,'held grantable permission stays enabled');
$('editProfileFirstName').value='Janet';$('editProfilePassword').value='replacement password';$('editProfilePin').value='0073';$('editProfileLoginId').value='0001';$('editProfilePermissions').querySelector('input[value="128"]').checked=true;
$('editProfileAccountId').value='999'; // Script tampering must never change the selected immutable target.
holdSave=true;const saving=lookup.saveProfile();await settle();assert.equal(lookup.state.phase,'saving');assert(!lookup.state.canSave);assert($('profileEditorFields').disabled);assert.equal(profiles[42].first_name,'Jane');resolveSave();await saving;holdSave=false;
const patch=JSON.parse(requests.find(r=>r.method==='PATCH').body);assert.equal(patch.userId,42);assert.equal(patch.loginId,'0001');assert.equal(patch.pin,'0073');assert.equal(patch.permissions,128);assert.equal(patch.password,'replacement password');assert(!('id'in patch));assert.equal(saved.first_name,'Janet');assert.equal($('editProfilePin').value,'');assert.equal($('editProfilePassword').value,'');
requests.length=0;await lookup.saveProfile();const unchanged=JSON.parse(requests.find(r=>r.method==='PATCH').body);assert(!('pin'in unchanged));assert(!('password'in unchanged));assert(!('loginId'in unchanged));
rejectSave=true;$('editProfileLastName').value='Rejected';await lookup.saveProfile();assert.equal($('editProfileStatus').textContent,'Rejected profile update');assert.equal(profiles[42].last_name,'Doe');assert.equal($('editProfileLastName').value,'Rejected');rejectSave=false;
results=[];await lookup.search();await settle();assert($('profileEditor').hidden);assert.equal(lookup.state.phase,'error');assert(!lookup.state.canSave);assert($('userLookupStatus').textContent);
// A slow account response must not repopulate another selected account.
holdLoad=true;w.WMOFIdentityContext.select(profiles[42]);await settle();const finishOld=resolveLoad;holdLoad=false;w.WMOFIdentityContext.select(profiles[43]);await settle();finishOld();await settle();assert.equal($('editProfileAccountId').value,'43');assert.equal($('editProfileUsername').value,'john');
lookup.setMode('lookup');assert($('profileEditor').hidden);assert.equal($('userLookupDialog').querySelector('h2').textContent,'Account Lookup');assert(!await lookup.saveProfile());
console.log('PASS profile search/population, no-result error, immutable target, credential replacement/retention, server-confirmed save, failure, stale response and Drop-In lookup');
await w.happyDOM.close();
