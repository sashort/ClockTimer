const contract=require('../docs/order-filler-state-contract.json');
const journeyCheckpoints=27;
function commands(method){
 const cases=contract.cases.filter(c=>c.group!=='time' && (c.input.method==='automatic'||c.input.method===(method==='voice'?'voice':'pointer')));
 return [
  ...cases.map(c=>({id:c.id,args:['tests/app-state-transactions.mjs','--state-contract','--case='+c.id,'--voice-feedback']})),
  ...(['application-state-inventory','clock-state-contract','trip-log','trip-summary','async-persistence','diagnostics-reporter'].map(name=>({id:name,args:['tests/'+name+'.mjs']}))),
  ...['goal-cascade','goal-failure-batch','sync-availability','range-permissions'].map(flag=>({id:flag,args:['tests/app-state-transactions.mjs','--'+flag,'--voice-feedback']})),
  ...(method==='touch'?['main-page-browser','order-filler-status-browser','order-filler-deployed-browser','graphical-settings-browser','hamburger-menu-coverage-browser','break-only-log-browser','trip-log-downtime-browser']:['speech-continuation-browser']).map(name=>({id:name,args:['tests/'+name+'.cjs']})),
  ...(method==='voice'?[{id:'speech-response-chain-browser',args:['tests/speech-response-chain-browser.mjs']}]:[])
 ];
}
const rates={fast:240,medium:160,slow:90};
module.exports={commands,journeyCheckpoints,rates};
