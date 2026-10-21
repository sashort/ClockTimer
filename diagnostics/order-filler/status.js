(() => {
 const $=selector=>document.querySelector(selector),deliveries=['press','fast','medium','slow'];
 const names={press:'Press',fast:'Fast voice · 240 wpm',medium:'Medium voice · 160 wpm',slow:'Slow voice · 90 wpm',time:'Clock times',duration:'Durations → 1:59:59'};
 const locale=$('#locale').value;
 const setText=(e,v)=>{v=String(v);if(e.textContent!==v)e.textContent=v;};
 const element=(parent,tag,value='',cls='')=>{const e=document.createElement(tag);e.textContent=value;e.className=cls;parent.append(e);return e;};
 const url=(suite,language,parameters={})=>{const u=new URL('/api/diagnostics/order-filler/',location.origin);for(const [k,v] of Object.entries({suite,locale:language,...parameters}))u.searchParams.set(k,v);return u;};
 const count=value=>Number(value)>0?String(value):'---';
 const title=value=>value?value[0].toUpperCase()+value.slice(1):'No run';
 let category='press',language=locale.toLowerCase(),cursor=0,history=[],nextCursor=0,runId='',hasMore=false,csrf='',jobInfo={},generation=0,busy=false,pending=false,timer;
 const summaryRows=new Map(),numericRows=new Map(),resultRows=new Map();let snapshots={};
 const live=$('#live-progress'),liveTitle=element(live,'strong'),progress=element(live,'progress'),liveAge=element(live,'small','','muted');progress.hidden=true;
 function preserveScroll(update){const x=scrollX,y=scrollY,panels=[...document.querySelectorAll('.panel,.results-wrap')].map(e=>({e,x:e.scrollLeft,y:e.scrollTop}));update();for(const p of panels)p.e.scrollTo({left:p.x,top:p.y,behavior:'instant'});window.scrollTo({left:x,top:y,behavior:'instant'});}
 async function request(target,body){const r=await fetch(target,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{},body:body?JSON.stringify(body):undefined,cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(30000)});const data=await r.json();if(!r.ok)throw Error(typeof data.error==='string'?data.error:data.error?.message||'Diagnostics request failed ('+r.status+').');if(data.csrfToken)csrf=data.csrfToken;return data;}
 function selectedJob(suite,lang){const j=jobInfo.job;return j?.suite===suite&&j.locale.toLowerCase()===lang.toLowerCase()?j:null;}
 function snapshot(suite,lang){
  const own=snapshots[lang]?.[suite],legacy=snapshots[lang]?.['order-filler'];
  const newer=own?.last&&(!legacy?.last||Date.parse(own.statistics?.startedAt||own.last.at)>=Date.parse(legacy.statistics?.startedAt||legacy.last.at));
  return deliveries.includes(suite)&&!newer?{...legacy,source:'order-filler'}:{...own,source:suite};
 }
 function stats(suite,lang,summary){
  const value=snapshot(suite,lang),state=value.statistics,record=value.last,workflow=deliveries.includes(suite);
  let status=workflow&&value.source==='order-filler'?summary?.results?.[lang]?.[suite]||'queued':record?.runStatus||'queued';
  const total=workflow?state?.deliveryTotals?.[suite]||record?.deliveryTotals?.[suite]||0:state?.totalTests||record?.total||0;
  const completed=workflow?state?.deliveryCounts?.[suite]||record?.deliveryCounts?.[suite]||0:state?.tests||record?.completed||0;
  const counts=workflow?state?.deliveryStats?.[suite]||record?.deliveryStats?.[suite]||{}:state||record||{};
  if(workflow&&value.source==='order-filler'&&record?.runStatus==='aborted'&&status==='running')status='aborted';
  const job=selectedJob(suite,lang);if(job&&['queued','running','stopping','stopped','aborting'].includes(job.status))status=job.status;
  return {status,total,completed,passed:counts.passed||0,failed:counts.failed||0,record,source:value.source};
 }
 function makeCategory(parent,suite,lang){
  const button=element(parent,'button','','category');button.type='button';button.dataset.category=suite;button.dataset.locale=lang;button.setAttribute('aria-label','View '+names[suite]+' results for '+lang);button.setAttribute('aria-pressed','false');
  const status=element(button,'span','','category-status'),counts=element(button,'span','','counts');
  for(const label of ['Remaining','Passed','Failed']){element(counts,'span',label);element(counts,'b','---',label.toLowerCase());}
  button.addEventListener('click',()=>choose(suite,lang));return {button,status,counts};
 }
 function renderCategory(view,data,suite,lang){
  const selected=category===suite&&language.toLowerCase()===lang.toLowerCase();
  view.button.setAttribute('aria-pressed',String(selected));view.button.className='category '+data.status;
  setText(view.status,['running','stopping','stopped','aborting'].includes(data.status)?'● '+title(data.status):title(data.status));
  const terminal=['passed','failed','incomplete','aborted'].includes(data.status);
  setText(view.counts.children[1],terminal?'---':count(Math.max(0,data.total-data.completed)));
  setText(view.counts.children[3],count(data.passed));setText(view.counts.children[5],count(data.failed));
 }
 function renderControls(){
  const job=jobInfo.job,mine=selectedJob(category,language),active=jobInfo.busy,own=!!mine&&jobInfo.canAbort;
  $('#start-tests').disabled=!!active||!jobInfo.ready||!csrf;
  $('#stop-tests').disabled=!own||!['running','queued'].includes(job.status);
  $('#resume-tests').disabled=!own||!['stopping','stopped'].includes(job.status);
  $('#abort-tests').disabled=!own||job.status==='aborting';
  $('#run-category').value=category;
  setText($('#job-note'),active?names[job.suite]+' · '+job.locale+' · '+title(job.status)+(job.status==='stopping'?' — finishing the current test':''):jobInfo.ready?'Select a category to view results or start a new run.':'Diagnostics runner is offline. Existing results remain available.');
 }
 function render(summary,languages){
  const table=$('#summary-rows');let completed=0,failed=0;
  for(const [index,lang] of languages.entries()){
   let row=summaryRows.get(lang);
   if(!row){const tr=document.createElement('tr');element(tr,'td',lang);const views=deliveries.map(suite=>makeCategory(element(tr,'td'),suite,lang));row={tr,views};summaryRows.set(lang,row);}
   if(table.children[index]!==row.tr)table.insertBefore(row.tr,table.children[index]||null);
   deliveries.forEach((suite,i)=>{const data=stats(suite,lang,summary);renderCategory(row.views[i],data,suite,lang);if(['passed','failed','incomplete','aborted'].includes(data.status))completed++;if(data.status==='failed')failed++;});
  }
  for(const [lang,row] of summaryRows)if(!languages.includes(lang)){row.tr.remove();summaryRows.delete(lang);}
  setText($('#language-count'),count(languages.length));setText($('#completed-count'),completed+' / '+languages.length*4);setText($('#failed-count'),count(failed));
  const state=jobInfo.busy?jobInfo.job.status:completed===languages.length*4?(failed?'failed':'passed'):summary?.runStatus||'No run';setText($('#run-status'),title(state));$('#run-status').className=['running','stopping','stopped'].includes(state)?'running':'';
  setText($('#build'),'Latest test runs'+(summary?.build?.version?' · build '+summary.build.version:''));$('#summary-log').href=url('summary',locale);
  for(const suite of ['time','duration']){
   let row=numericRows.get(suite);
   if(!row){const tr=document.createElement('tr');tr.style.cursor='pointer';tr.addEventListener('click',event=>{if(!event.target.closest('button'))choose(suite,locale);});element(tr,'td',names[suite]);const view=makeCategory(element(tr,'td'),suite,locale.toLowerCase());row={tr,view};numericRows.set(suite,row);$('#numeric-rows').append(tr);}
   renderCategory(row.view,stats(suite,locale.toLowerCase(),summary),suite,locale.toLowerCase());
  }
  const current=stats(category,language,summary),record=current.record;
  setText($('#live-label'),language+' · '+names[category]);
  setText(liveTitle,title(current.status)+(record?' · '+(record.progress||'')+' — '+(record.label||record.type):' · No results yet'));liveTitle.className=['running','stopping','stopped'].includes(current.status)?'running':'';
  progress.hidden=!record;if(record){progress.max=record.total||1;progress.value=record.completed||0;const age=Math.max(0,Math.floor((Date.now()-Date.parse(record.at))/1000));setText(liveAge,'Updated '+age+'s ago'+(current.status==='running'&&age>120?' — no recent results':''));}else setText(liveAge,'');
  setText($('#folders'),'summary.log\nlanguage-tests/\n'+languages.map(lang=>'  '+lang+'/\n    press-'+lang+'.log\n    fast-'+lang+'.log\n    medium-'+lang+'.log\n    slow-'+lang+'.log\n    time-'+lang+'.log\n    duration-'+lang+'.log').join('\n'));
  renderControls();
 }
 function renderResults(data){
  if(data.reset){cursor=0;history=[];}
  runId=data.runId||'';nextCursor=data.nextCursor||0;hasMore=!!data.hasMore;
  const body=$('#result-rows'),keys=new Set();
  for(const [index,record] of data.rows.entries()){
   const key=runId+':'+record.number;keys.add(key);let tr=resultRows.get(key);
   if(!tr){tr=document.createElement('tr');for(let i=0;i<6;i++)element(tr,'td');resultRows.set(key,tr);}
   if(body.children[index]!==tr)body.insertBefore(tr,body.children[index]||null);
   const cells=tr.children;setText(cells[0],record.number+' / '+record.total);setText(cells[1],record.locale);setText(cells[2],record.delivery?title(record.delivery):'Voice / keypad');
   let label=cells[3].querySelector('span');if(!label)label=element(cells[3],'span');setText(label,record.label);
   let message=cells[3].querySelector('small');if(record.message){if(!message)message=element(cells[3],'small');setText(message,record.message);}else message?.remove();
   setText(cells[4],title(record.status));cells[4].className=record.status==='passed'?'pass':record.status==='failed'?'fail':'queued';tr.className=record.status;
   setText(cells[5],Number(record.elapsedMs)>0?(record.elapsedMs>=1000?(record.elapsedMs/1000).toFixed(1)+' s':Math.round(record.elapsedMs)+' ms'):'---');
  }
  for(const [key,tr] of resultRows)if(!keys.has(key)){tr.remove();resultRows.delete(key);}
  setText($('#page-label'),data.rows.length+' results on this page · '+(data.completed||0)+' / '+(data.total||0)+' reported'+(!data.rows.length&&hasMore?' · More records to search':''));
  $('#previous-results').disabled=!history.length;$('#next-results').disabled=!hasMore;
 }
 function choose(suite,lang=locale){category=suite;language=lang.toLowerCase();cursor=0;history=[];runId='';generation++;$('#run-category').value=suite;renderControls();refresh();}
 $('#run-category').addEventListener('change',event=>choose(event.target.value));
 $('#result-filter').addEventListener('change',()=>{cursor=0;history=[];generation++;refresh();});
 $('#next-results').addEventListener('click',()=>{if(!hasMore)return;history.push(cursor);cursor=nextCursor;generation++;refresh();});
 $('#previous-results').addEventListener('click',()=>{if(!history.length)return;cursor=history.pop();generation++;refresh();});
 for(const [id,action] of [['start-tests','job-start'],['stop-tests','job-stop'],['resume-tests','job-resume'],['abort-tests','job-abort']])$( '#'+id).addEventListener('click',async()=>{
  const button=$('#'+id);button.disabled=true;
  try{jobInfo=await request(url(category,language),{action,suite:category,locale:language,jobId:jobInfo.job?.id});preserveScroll(renderControls);await refresh();}
  catch(error){setText($('#error'),error.message);renderControls();}
 });
 async function refresh(){
  clearTimeout(timer);if(busy){pending=true;return;}busy=true;const version=generation;
  try{
   const [summaryResponse,jobs]=await Promise.all([request(url('summary',locale,{status:1})),request(url(category,language,{job:1}))]);
   const summary=summaryResponse.last,languages=[...new Set([...(summary?.languages||[]),locale.toLowerCase()])];
   const entries=await Promise.all(languages.map(async lang=>[lang,Object.fromEntries(await Promise.all(['order-filler',...deliveries,'time','duration'].map(async suite=>[suite,await request(url(suite,lang,{status:1}))])))]));
   if(version!==generation){pending=true;return;}
   snapshots=Object.fromEntries(entries);jobInfo=jobs;
   const current=snapshot(category,language),data=await request(url(current.source||category,language,{results:1,cursor,runId,delivery:current.source==='order-filler'?category:'',failures:$('#result-filter').value==='failed'?1:0}));
   if(version!==generation){pending=true;return;}
   preserveScroll(()=>{render(summary,languages);renderResults(data);setText($('#error'),'');});
  }catch(error){preserveScroll(()=>setText($('#error'),error.message));}
  finally{busy=false;if(pending){pending=false;timer=setTimeout(refresh,0);}else timer=setTimeout(refresh,2000);}
 }
 refresh();
})();
