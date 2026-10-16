import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
const read=file=>fs.readFileSync(new URL(file,root),'utf8');
const model=JSON.parse(read('docs/mainline-fsm-draft.json'));
const html=read('docs/mainline-fsm-draft.html');
const embedded=JSON.parse(html.match(/<script id="fsm-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
assert.deepEqual(embedded,model,'Interactive graph must embed the exact machine-readable reference');
const ids=new Set();
for(const edge of model.transitions){
 assert(!ids.has(edge.id),'Stable transition IDs are unique: '+edge.id);ids.add(edge.id);
 assert(model.states[edge.source]&&model.states[edge.target],edge.id+' endpoints exist');
 if(edge.audio)assert(model.audio[edge.audio],edge.id+' audio sequence exists');
 if(edge.v2_contract)assert(model.v2_contracts[edge.v2_contract],edge.id+' has a structured contract');
 assert(['valid','invalid','rollback'].includes(edge.outcome),edge.id+' has an explicit path outcome independent of test status');
 assert(['pointer','voice','automatic','failure'].includes(edge.mode),edge.id+' is visible through a supported input filter');
 if(edge.mode==='failure')assert.equal(edge.outcome,'rollback');
}
for(const contract of Object.values(model.v2_contracts)){
 for(const field of ['scope','preconditions','inputs','postconditions','controls','audio','forbidden','evidence'])assert(contract[field],contract.id+' needs '+field);
 for(const command of contract.evidence){const file=command.match(/node\s+(\S+\.\w+)/)?.[1];if(file)assert(fs.existsSync(new URL(file,root)),command+' points to an existing scenario');}
}
const audit=model.implementation_audit;
const expected=execFileSync('git',['rev-list','--reverse',audit.last_working_reference_commit+'..'+audit.through_commit],{cwd:root,encoding:'utf8'}).trim().split('\n');
assert.deepEqual(audit.commits.map(change=>change.commit),expected,'Every commit since the last working FSM is inventoried, including reversions and test-only changes');
for(const change of audit.commits){assert(change.areas.length,change.commit+' has an explicit review area');if(!change.files.length)assert(change.areas.includes('history-integration'),'A merge/history-only commit is identified explicitly');}
assert.equal(model.states['LOGIN-REVIEW'].binding['login.phase'],'pin-review');
for(const id of ['LOGIN-CHECK','LOGIN-CHECK-P']){const edge=model.transitions.find(edge=>edge.id===id);assert.equal(edge.target,'LOGIN-REVIEW');assert.equal(edge.persist,false,'PIN group OK never authenticates');}
for(const id of ['LOGIN-FINAL-OK','LOGIN-FINAL-POK']){const edge=model.transitions.find(edge=>edge.id===id);assert.equal(edge.source,'LOGIN-REVIEW');assert.equal(edge.target,'LOGIN-WAIT');assert.equal(edge.persist,true);}
assert(model.known_issues.some(issue=>issue.id==='KNOWN-V2-PENDING'),'Unverified user reports remain distinct from verified implementation changes');
for(const state of ['LOGIN-ID','LOGIN-PIN'])for(const mode of ['pointer','voice']){
 const edge=model.transitions.find(e=>e.id===state+'-INVALID-'+mode.toUpperCase());
 assert.equal(edge.mode,mode);assert.equal(edge.outcome,'invalid');assert.equal(edge.source,edge.target);
 assert.equal(edge.persist,false);assert(edge.contract.discard);assert.equal(edge.contract.loopback_feedback.classification,'rejection');
 assert.equal(edge.test.status,'untested','Valid/invalid does not assert a test passed');
}
const positions=JSON.parse(html.match(/const positions=(\{[^\n]+\});/)[1]);
for(const state of Object.values(model.states))assert(positions[state.id],state.id+' has a position in the interactive graph');
assert(html.includes('data-test-status='),'Separate test badges must be rendered');
assert.deepEqual(model.v2_test_vectors,JSON.parse(read('docs/fsm-v2-cases.json')));
const cases=new Set();
for(const scenario of model.v2_test_vectors.cases){assert(!cases.has(scenario.id));cases.add(scenario.id);assert(model.v2_contracts[scenario.contract]);for(const key of ['given','when','expect'])assert(Object.keys(scenario[key]||{}).length,scenario.id+' requires '+key);}
for(const id of Object.keys(model.v2_contracts))assert(model.v2_test_vectors.cases.some(scenario=>scenario.contract===id),id+' needs an implementation-independent scenario');
console.log('PASS FSM reference parity, stable edges, '+audit.commits.length+' audited commits, structured version 2 contracts and two-step login oracle');
