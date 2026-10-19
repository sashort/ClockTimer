const TEMPLATE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Order Filler + ClockTimer state inventory</title>
<style>
:root{color-scheme:dark;font:16px/1.5 system-ui;background:#111720;color:#e6edf6}body{margin:0}main{max-width:1500px;margin:auto;padding:24px}h1{font-size:1.7rem;margin:0 0 12px}p{max-width:100ch;color:#bac8da}a{color:#83c8ff}code{overflow-wrap:anywhere;color:#b6deff}label{display:grid;gap:5px}input,select{font:inherit;padding:10px;border:1px solid #53657d;border-radius:5px;background:#1b2839;color:inherit}.tools{display:grid;grid-template-columns:minmax(230px,1fr) minmax(180px,280px);gap:15px;margin:20px 0}.cards{display:flex;flex-wrap:wrap;gap:12px}.cards p{background:#1b2839;padding:12px 18px;border-radius:6px;margin:0}.cards strong{display:block;color:white;font-size:1.5rem}.table{overflow:auto;border:1px solid #405169;max-height:70vh}table{width:100%;border-collapse:collapse;font-size:.9rem}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #304158;vertical-align:top}th{position:sticky;top:0;background:#223149}td:first-child{min-width:250px}small{display:block;color:#a8b8cc}.debug{color:#ffd88f}details{margin:20px 0}li{margin:7px 0}@media(max-width:650px){main{padding:14px}.tools{grid-template-columns:1fr}}@media print{.table{max-height:none;overflow:visible}th{position:static}.tools{display:none}}
</style></head><body><main>
<h1>Order Filler + ClockTimer: current state map</h1>
<p>Shared component states and Debug-only workflows. App mode is transition-policy metadata, not a separate copy of each shared state. Server-assigned trips are excluded. Runtime enumeration/FSM changes are reserved for the future <code>test</code> branch after Debug is stable.</p>
<div class="cards" id="counts"></div>
<p>These counts are vocabulary entries, not the number of unique reachable application states. A full state combines regions, per-surface/per-owner state, and ordered focus/return paths. Payload values remain attached. Constraints and actual transition tests determine which combinations are valid.</p>
<div class="tools"><label>Search states<input id="search" type="search" placeholder="B-game, overtime, PIN, break, summary…"></label><label>Show<select id="kind"><option value="all">All entries</option><option value="shared region">Shared regions</option><option value="shared surface">Shared surfaces</option><option value="shared alias">Named combinations</option><option value="debug-only">Debug-only workflows</option></select></label></div>
<p id="resultCount" role="status" aria-live="polite"></p>
<div class="table"><table><thead><tr><th>Identifier</th><th>Region / workflow</th><th>Value and meaning</th><th>Source</th></tr></thead><tbody id="rows"></tbody></table></div>
<h2>Commands and announcements by scenario</h2>
<p>These are independent runtime test expectations, not a saved pass report. Required/forbidden command checks are partial; exclusive lists check the whole set. Ordered audio checks are complete for that action; announcement checks alone are partial. Unreviewed means no assertion yet. State references identify checked regions, not full coverage of every combination.</p>
<label>Search behavior cases<input id="behaviorSearch" type="search" placeholder="sleeping, ready, break, summary, time..."></label><p id="behaviorCount" role="status"></p>
<div class="table"><table><thead><tr><th>Scenario / input</th><th>Checked states</th><th>Available voice commands</th><th>Announcements and chimes</th></tr></thead><tbody id="behaviorRows"></tbody></table></div>
<details><summary>Combination constraints</summary><ul id="constraints"></ul></details>
<details><summary>Observed gaps to address on the test branch</summary><ul id="gaps"></ul></details>
<p><a href="application-state-inventory.json">Machine-readable inventory</a> · <a href="clock-timer-fsm.md">Behavioral contract and test coverage</a></p>
</main><script id="state-inventory" type="application/json">INVENTORY_DATA</script>
<script id="behavior-contract" type="application/json">BEHAVIOR_DATA</script>
<script>
'use strict';
const inventory=JSON.parse(document.querySelector('#state-inventory').textContent);
const contract=JSON.parse(document.querySelector('#behavior-contract').textContent);
function references(state){return Object.entries(contract.inventoryBindings).flatMap(([path,regionId])=>{if(!Object.hasOwn(state,path))return [];const region=inventory.regions.find(r=>r.id===regionId),value=region?.values.find(v=>v.value===state[path]);if(!value)throw Error('Unmapped behavioral state '+path);return [value.id];});}
const commandText=e=>!e?'Unreviewed':e.only?'Exclusive: '+e.only.join(', '):'Required: '+(e.required||[]).join(', ')+'; forbidden: '+(e.forbidden||[]).join(', ');
function audioText(e){if(e.audio)return 'Complete ordered sequence: '+(e.audio.length?e.audio.map(v=>v.kind+': '+(v.text||v.name||v.format)+(v.scheduled===undefined?'':v.scheduled?' (scheduled)':' (immediate)')).join(' -> '):'silence');if(e.announcements)return 'Partial speech checks: '+JSON.stringify(e.announcements);return 'Unreviewed';}
const behavior=contract.cases.map(test=>{const before={...contract.stateFamilies[test.givenFamily]?.match,...test.given},after={...contract.stateFamilies[test.expect.family]?.match,...test.expect.state};return [test.id+' -- '+JSON.stringify(test.input)+'; '+(test.announcementCategory||'category unreviewed'),'Before: '+references(before).join(', ')+'; after: '+references(after).join(', ')+'; snapshot predicates: '+JSON.stringify({before,after}),'Before: '+commandText(test.commands)+'; after: '+commandText(test.expect.commands),audioText(test.expect)];});
function drawBehavior(){const query=document.querySelector('#behaviorSearch').value.toLowerCase().trim(),visible=behavior.filter(row=>row.join(' ').toLowerCase().includes(query)),body=document.querySelector('#behaviorRows');body.replaceChildren();for(const row of visible){const tr=document.createElement('tr');for(const text of row){const cell=document.createElement('td');cell.textContent=text;tr.append(cell);}body.append(tr);}document.querySelector('#behaviorCount').textContent=visible.length+' of '+behavior.length+' behavioral cases shown; run runtime tests to verify.';}
document.querySelector('#behaviorSearch').addEventListener('input',drawBehavior);drawBehavior();

const rows=[...inventory.regions.flatMap(region=>region.values.map(value=>({id:value.id,group:region.id,kind:'shared region',value:value.value,meaning:value.meaning,notes:region.notes||'',source:region.source.file}))),...inventory.surfaces.flatMap(surface=>surface.states.map(value=>({id:surface.stateIdPrefix+'__'+value.toUpperCase(),group:surface.id,kind:'shared surface',value,meaning:surface.selector||surface.id,notes:surface.kind,source:surface.source}))),...inventory.sharedAliases.map(alias=>({id:alias.id,group:'named combinations',kind:'shared alias',value:JSON.stringify(alias.when),meaning:alias.meaning,source:'application-state-inventory.json'})),...inventory.debugWorkflows.map(state=>({id:state.id,group:'manual trip workflow',kind:'debug-only',value:JSON.stringify(state.when),meaning:state.meaning,notes:state.notes,source:state.source}))];
for(const [number,label] of [[inventory.regions.length,'shared regions'],[inventory.regions.reduce((n,r)=>n+r.values.length,0),'region values'],[inventory.surfaces.length,'surface types'],[inventory.debugWorkflows.length,'Debug-only workflow entries']]){const card=document.createElement('p'),count=document.createElement('strong');count.textContent=number;card.append(count,document.createTextNode(label));document.querySelector('#counts').append(card);}
function draw(){const query=document.querySelector('#search').value.toLowerCase().trim(),kind=document.querySelector('#kind').value;const visible=rows.filter(row=>(kind==='all'||row.kind===kind)&&Object.values(row).join(' ').toLowerCase().includes(query));const body=document.querySelector('#rows');body.replaceChildren();for(const row of visible){const tr=document.createElement('tr'),id=document.createElement('td'),code=document.createElement('code');code.textContent=row.id;id.append(code);const tag=document.createElement('small');tag.textContent=row.kind;if(row.kind==='debug-only')tag.className='debug';id.append(tag);const evidence=document.createElement('small');const cases=behavior.filter(test=>test[1].includes(row.id));evidence.textContent=cases.length?cases.length+' scenario references (partial checks)':'No mapped behavioral checks';id.append(evidence);tr.append(id);for(const text of [row.group,row.value+' — '+row.meaning+(row.notes?' '+row.notes:''),row.source]){const cell=document.createElement('td');cell.textContent=text;tr.append(cell);}body.append(tr);}document.querySelector('#resultCount').textContent=visible.length+' of '+rows.length+' entries shown';}
for(const [selector,values] of [['#constraints',inventory.constraints.map(rule=>rule.id+': '+rule.requirement)],['#gaps',inventory.observabilityGaps]])for(const value of values){const li=document.createElement('li');li.textContent=value;document.querySelector(selector).append(li);}
document.querySelector('#search').addEventListener('input',draw);document.querySelector('#kind').addEventListener('change',draw);draw();
</script></body></html>
`;
const fs = require('node:fs');
const path = require('node:path');

function sharedRows(inventory) {
    return [
        ...inventory.regions.flatMap(region => region.values.map(value => ({
            id: value.id, group: region.id, kind: 'shared region', value: value.value,
            meaning: value.meaning, notes: region.notes || '', source: region.source.file
        }))),
        ...inventory.surfaces.flatMap(surface => surface.states.map(value => ({
            id: surface.stateIdPrefix + '__' + value.toUpperCase(), group: surface.id,
            kind: 'shared surface', value, meaning: surface.selector || surface.id,
            notes: surface.kind, source: surface.source
        }))),
        ...inventory.sharedAliases.map(alias => ({id: alias.id, group: 'named combinations',
            kind: 'shared alias', value: JSON.stringify(alias.when), meaning: alias.meaning,
            source: 'application-state-inventory.json'}))
    ];
}

function rowsForMode(inventory, mode) {
    if (!inventory.appModes.includes(mode)) throw new RangeError('An explicit known app-mode is required.');
    return {
        shared: sharedRows(inventory),
        exclusive: inventory.debugWorkflows.filter(state => state.appliesTo.includes(mode)),
        transitionImplementation: mode === 'debug' ? 'current' : 'outside-current-map'
    };
}

function render(inventory) {
    const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/order-filler-state-contract.json'), 'utf8'));
    const encode = value => JSON.stringify(value).replaceAll('<', '\\u003c');
    return TEMPLATE.replace('INVENTORY_DATA', () => encode(inventory))
        .replace('BEHAVIOR_DATA', () => encode(contract));
}

module.exports = {sharedRows, rowsForMode, render};
if (require.main === module) {
    const root = path.resolve(__dirname, '..');
    const inventory = JSON.parse(fs.readFileSync(path.join(root, 'docs/application-state-inventory.json'), 'utf8'));
    const target = path.join(root, 'docs/application-state-inventory.html');
    const html = render(inventory);
    if (process.argv.includes('--check')) {
        if (fs.readFileSync(target, 'utf8') !== html) throw new Error('Rebuild the state inventory view.');
    } else fs.writeFileSync(target, html);
    console.log('PASS shared state inventory view ' + (process.argv.includes('--check') ? 'parity' : 'build'));
}
