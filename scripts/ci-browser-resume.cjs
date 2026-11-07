// Reuse successful browser commands only across identical application/setup trees.
// A changed standalone test reruns; a shared fixture or application change reruns all.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const workflow='.github/workflows/deploy-lightsail.yml';
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8'}).trim();
function normalizeWorkflow(text){return text.replace(/\r\n/g,'\n').replace(/^ *# browser-resume:start\n[\s\S]*?^ *# browser-resume:end\n/gm,'').replaceAll('node scripts/ci-browser-resume.cjs ','');}
function commands(text){const section=normalizeWorkflow(text).split('  settings-browser:\n')[1]?.split('  break-session-backend:\n')[0]||'';return [...section.matchAll(/^      - run: ((?:node|php) tests\/[^\s]+)$/gm)].map(m=>m[1]);}
function reusable({before,after,changed,referenced=()=>false}){
 if(normalizeWorkflow(before)!==normalizeWorkflow(after))return [];
 const list=commands(after),entries=new Set(list.map(c=>c.split(' ')[1]));
 const infrastructure=new Set([workflow,'scripts/ci-browser-resume.cjs','tests/ci-browser-resume.cjs']);
 if(changed.some(f=>!infrastructure.has(f)&&(!entries.has(f)||referenced(f))))return [];
 return list.filter(c=>!changed.includes(c.split(' ')[1]));
}
module.exports={normalizeWorkflow,commands,reusable};
async function plan(){
 const target=path.join(process.env.RUNNER_TEMP||require('node:os').tmpdir(),'clocktimer-browser-pass.json');
 fs.writeFileSync(target,'[]');
 try{
  const repo=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN;
  if(!repo||!token){console.log('No Actions credentials; running every browser check.');return;}
  const api=async endpoint=>{const r=await fetch(`https://api.github.com/repos/${repo}/actions/${endpoint}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Actions API returned ${r.status}`);return r.json();};
  const after=fs.readFileSync(workflow,'utf8'),list=commands(after);
  const runs=await api(`workflows/deploy-lightsail.yml/runs?branch=${encodeURIComponent(process.env.GITHUB_REF_NAME)}&per_page=10`);
  for(const run of runs.workflow_runs){
   if(String(run.id)===process.env.GITHUB_RUN_ID||run.status!=='completed')continue;
   const source=run.head_sha;
   try{git('merge-base','--is-ancestor',source,'HEAD');}catch{continue;}
   const before=git('show',`${source}:${workflow}`)+'\n';
   const changed=git('diff','--name-only',source,'HEAD').split('\n').filter(Boolean);
   const testFiles=git('ls-files','tests').split('\n').filter(Boolean);
   const referenced=file=>testFiles.some(other=>other!==file&&fs.existsSync(other)&&fs.statSync(other).isFile()&&fs.readFileSync(other,'utf8').includes(path.basename(file)));
   const eligible=new Set(reusable({before,after,changed,referenced}));
   if(!eligible.size)continue;
   const {jobs}=await api(`runs/${run.id}/jobs?per_page=100`);
   const job=jobs.find(j=>j.name==='settings-browser'&&j.status==='completed');if(!job)continue;
   const passed=job.steps.filter(s=>s.status==='completed'&&s.conclusion==='success').map(s=>s.name.replace(/^Run /,'').replace(/^node scripts\/ci-browser-resume.cjs /,'')).filter(c=>eligible.has(c));
   // Use one coherent prior job; never combine unrelated partial runs.
   if(!passed.length)continue;
   fs.writeFileSync(target,JSON.stringify(passed));
   const message=`Reusing ${passed.length}/${list.length} unchanged browser checks from ${run.html_url}; failed, changed and unrun checks will execute.`;
   console.log(message);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,message+'\n');return;
  }
  console.log('No compatible passing results; running every browser check.');
 }catch(error){console.log(`Resume unavailable (${error.message}); running every browser check.`);}
}
if(require.main===module){
 if(process.argv[2]==='--plan')plan().catch(e=>{console.error(e);process.exitCode=1;});
 else{
  const args=process.argv.slice(2),command=args.join(' '),target=path.join(process.env.RUNNER_TEMP||require('node:os').tmpdir(),'clocktimer-browser-pass.json');
  let passed=[];try{passed=JSON.parse(fs.readFileSync(target,'utf8'));}catch{}
  if(passed.includes(command))console.log('PASS (verified unchanged prior run): '+command);
  else{const result=cp.spawnSync(args[0],args.slice(1),{stdio:'inherit',shell:false});if(result.error)console.error(result.error);process.exitCode=result.status??1;}
 }
}
