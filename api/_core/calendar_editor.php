<?php
declare(strict_types=1);
function render_calendar_editor(string $csrfToken, array $profiles): never
{
    $nonce = base64_encode(random_bytes(18));
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; script-src 'nonce-$nonce'; style-src 'nonce-$nonce'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    $csrf = json_encode($csrfToken, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    ?>
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Calendar rules</title>
<style nonce="<?= htmlspecialchars($nonce, ENT_QUOTES) ?>">
*{box-sizing:border-box}body{margin:0;background:#f4f6f8;color:#18212b;font:16px/1.5 system-ui;padding:24px}main{max-width:800px;margin:auto;background:white;border-radius:12px;padding:28px}h1{margin-top:0}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}label{display:block;font-weight:600}input,select,textarea,button{font:inherit;padding:10px;border:1px solid #aab5c1;border-radius:6px}input,select,textarea{width:100%;margin-top:6px}button{cursor:pointer;background:#235dcc;color:white}button:disabled{opacity:.6}textarea{min-height:80px}.actions{display:flex;gap:12px;margin:20px 0}#status{white-space:pre-wrap}fieldset{border:0;padding:0;margin:20px 0}small{display:block;color:#556270}input[type=checkbox]{width:auto}:focus-visible{outline:3px solid #82aaff;outline-offset:2px}@media(max-width:550px){.grid{grid-template-columns:1fr}}
</style></head><body><main><h1>Calendar rules</h1><p>View or correct the work-week and pay-period rules stored for an employer and year. Saving does not call the discovery service.</p>
<form id="form"><div class="grid"><label>Calendar<select id="profile"><?php foreach ($profiles as $profile): ?><option><?= htmlspecialchars($profile, ENT_QUOTES) ?></option><?php endforeach ?></select></label><label>Calendar year<input id="year" type="number" min="1970" max="9999" value="<?= gmdate('Y') ?>" required></label></div>
<div class="actions"><button id="load" type="button">Load stored rules</button></div><p id="metadata"></p>
<fieldset id="fields" disabled><div class="grid">
<label>Week starts on<select id="weekStartDay" required><option value="">Select a weekday</option><?php foreach (['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] as $i => $day): ?><option value="<?= $i ?>"><?= $day ?></option><?php endforeach ?></select></label>
<label>Daily cutoff time<input id="cutoffTime" type="time" step="1" required><small>Midnight means the start of the named day.</small></label>
<label>Pay-period length (days)<input id="payPeriodDays" type="number" min="1" max="366"><small>Leave both pay-period fields blank if unknown.</small></label>
<label>Pay-period anchor / fiscal week 1 start<input id="payPeriodAnchorDate" type="date"><small>For Walmart, enter the first day of fiscal week 1. The cycle is 14 days.</small></label>
<label>Effective from<input id="effectiveFrom" type="date" required></label><label>Effective through<input id="effectiveThrough" type="date"></label></div>
<label><input id="recurring" type="checkbox"> Rules repeat beyond the effective dates</label>
<label>Correction note<textarea id="note" maxlength="2000" required></textarea></label>
<div class="actions"><button id="save" type="submit">Save calendar rules</button></div></fieldset></form>
<p id="status" role="status" aria-live="polite"></p></main>
<script nonce="<?= htmlspecialchars($nonce, ENT_QUOTES) ?>">
const csrf=<?= $csrf ?>;
const el=id=>document.getElementById(id);let loaded=null;let revision=0;
const keys=['weekStartDay','cutoffTime','payPeriodDays','payPeriodAnchorDate','effectiveFrom','effectiveThrough'];
function invalidate(){revision++;loaded=null;el('fields').disabled=true;el('metadata').textContent='';el('status').textContent='Load the selected calendar and year before editing.';}
for(const id of ['profile','year'])el(id).addEventListener('change',invalidate);
async function request(url,options){const response=await fetch(url,options);const data=await response.json();if(!response.ok)throw Error(data.message||'Calendar request failed.');return data;}
el('load').addEventListener('click',async()=>{const seq=++revision;loaded=null;el('fields').disabled=true;el('load').disabled=true;const profile=el('profile').value;const year=Number(el('year').value);el('status').textContent='Loading…';try{const data=await request('./?'+new URLSearchParams({profile,year}),{headers:{Accept:'application/json'}});if(seq!==revision)return;const rules=data.record?.rules;for(const key of keys)el(key).value=String(rules?.[key]??'');el('recurring').checked=rules?.recurring??false;el('note').value='';loaded={profile,year};el('fields').disabled=false;el('metadata').textContent=data.record?`Stored year: ${data.record.searchedYear}. Origin: ${data.record.provenance}. Last verified: ${new Date(data.record.verifiedAt*1000).toLocaleString()}.`:'';el('status').textContent=rules?'Stored rules loaded.': 'No stored rules. Enter verified values to create this year’s record.';}catch(error){if(seq===revision)el('status').textContent=error.message;}finally{el('load').disabled=false;}});
el('form').addEventListener('submit',async event=>{event.preventDefault();if(!loaded||loaded.profile!==el('profile').value||loaded.year!==Number(el('year').value)){invalidate();return;}const seq=revision;const rules={};for(const key of keys)rules[key]=el(key).value||null;rules.weekStartDay=Number(rules.weekStartDay);rules.payPeriodDays=rules.payPeriodDays===null?null:Number(rules.payPeriodDays);if(rules.cutoffTime?.length===5)rules.cutoffTime+=':00';rules.recurring=el('recurring').checked;el('save').disabled=true;el('load').disabled=true;el('status').textContent='Saving…';try{const data=await request('./',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({...loaded,rules,note:el('note').value})});if(seq!==revision)return;el('metadata').textContent=`Stored year: ${data.record.searchedYear}. Origin: manual. Last verified: ${new Date(data.record.verifiedAt*1000).toLocaleString()}.`;el('note').value='';el('status').textContent='Calendar rules saved. Discovery will not run again for this profile and year.';}catch(error){if(seq===revision)el('status').textContent=error.message;}finally{el('save').disabled=false;el('load').disabled=false;}});
</script></body></html>
<?php
    exit;
}
