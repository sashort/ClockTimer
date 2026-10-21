(() => {
 const locale=document.querySelector('#locale').value, deliveries=['press','fast','medium','slow'];
 const url=(suite,language,status=false)=>{const u=new URL('/api/diagnostics/order-filler/',location.origin);u.searchParams.set('suite',suite);u.searchParams.set('locale',language);if(status)u.searchParams.set('status','1');return u;};
 const setText=(element,value)=>{value=String(value);if(element.textContent!==value)element.textContent=value;};
 const text=(parent,tag,value='',cls)=>{const e=document.createElement(tag);setText(e,value);if(cls)e.className=cls;parent.append(e);return e;};
 const summaryRows=new Map(),numericRows=new Map();
 const live=document.querySelector('#live-progress');
 const liveTitle=text(live,'strong'),liveProgress=document.createElement('progress'),liveAge=text(live,'small','','muted');
 live.insertBefore(liveProgress,liveAge);liveProgress.hidden=true;
 function preserveScroll(update){
  // Capture after the fetches settle, so scrolling during a request is respected.
  const x=scrollX,y=scrollY,panels=[...document.querySelectorAll('.panel')].map(element=>({element,x:element.scrollLeft,y:element.scrollTop}));
  update();
  for(const panel of panels)panel.element.scrollTo({left:panel.x,top:panel.y,behavior:'instant'});
  window.scrollTo({left:x,top:y,behavior:'instant'});
 }
 function detail(cell,value){
  const small=cell.querySelector('small')||text(cell,'small');
  small.hidden=!value;setText(small,value||'');
 }
 function render(summary,languages,logs,numericLogs){
  const table=document.querySelector('#summary-rows'),results=summary?.results||{};
  let completed=0,failed=0,active;
  for(const [index,language] of languages.entries()){
   let row=summaryRows.get(language);
   if(!row){row=document.createElement('tr');text(row,'td',language);for(const delivery of deliveries){const cell=text(row,'td');text(cell,'span','','pill');}summaryRows.set(language,row);}
   if(table.children[index]!==row)table.insertBefore(row,table.children[index]||null);
   for(const [index,delivery] of deliveries.entries()){
    const cell=row.children[index+1],status=results[language]?.[delivery]||'queued',record=logs[language];
    const pill=cell.querySelector('span'),cls='pill '+(status==='passed'?'pass':status==='failed'?'fail':status==='running'?'running':'queued');
    setText(pill,status);if(pill.className!==cls)pill.className=cls;
    let progress='';
    if(['passed','failed','skipped'].includes(status)){completed++;if(record?.deliveryTotals?.[delivery])progress='Test '+record.deliveryCounts[delivery]+' / '+record.deliveryTotals[delivery];}
    if(status==='failed')failed++;
    if(status==='running'&&record){progress='Test '+(record.deliveryNumber||record.completed)+' / '+(record.deliveryTotal||record.total);active=record;}
    detail(cell,progress);
   }
  }
  for(const [language,row] of summaryRows)if(!languages.includes(language)){row.remove();summaryRows.delete(language);}
  setText(document.querySelector('#language-count'),languages.length);
  setText(document.querySelector('#completed-count'),completed+' / '+languages.length*4);
  setText(document.querySelector('#failed-count'),failed);
  setText(document.querySelector('#run-status'),summary?.runStatus||'No run');
  document.querySelector('#summary-log').href=url('summary',locale);
  setText(document.querySelector('#build'),'Latest test runs'+(summary?.build?.version?' · build '+summary.build.version:''));
  active ||= logs[locale.toLowerCase()] || Object.values(logs).filter(Boolean).at(-1);
  if(active){
   setText(document.querySelector('#live-label'),active.locale+' · '+(active.delivery||active.runStatus));
   setText(liveTitle,(active.deliveryTotal?'test '+active.deliveryNumber+'/'+active.deliveryTotal:active.progress)+' — '+(active.label||active.type));
   liveProgress.hidden=false;liveProgress.max=active.total;liveProgress.value=active.completed;
   const age=Math.max(0,Math.floor((Date.now()-Date.parse(active.at))/1000));
   setText(liveAge,'Updated '+age+'s ago'+(active.runStatus==='running'&&age>120?' — stale; run may have stopped':''));
   setText(document.querySelector('#live-record'),JSON.stringify(active,null,2));
  }
  const numeric=document.querySelector('#numeric-rows');
  for(const suite of ['time','duration']){
   let row=numericRows.get(suite);
   if(!row){
    row=document.createElement('tr');const name=text(row,'td',suite==='time'?'Clock times':'Durations → 1:59:59');
    text(name,'a',suite+'-'+locale.toLowerCase()+'.log','link').href=url(suite,locale);
    text(text(row,'td'),'span');numericRows.set(suite,row);numeric.append(row);
   }
   const record=numericLogs[suite],result=row.children[1];
   setText(result.querySelector('span'),record?.runStatus||'No run');detail(result,record?.progress);
  }
  setText(document.querySelector('#folders'),'summary.log\nlanguage-tests/\n'+languages.map(language=>'  '+language+'/\n    order-filler-'+language+'.log\n    time-'+language+'.log\n    duration-'+language+'.log').join('\n'));
  setText(document.querySelector('#error'),'');
 }
 async function last(suite,language){const r=await fetch(url(suite,language,true),{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw Error('Status request failed ('+r.status+'). Sign in again if the session expired.');return (await r.json()).last;}
 async function refresh(){
  try{
   const summary=await last('summary',locale),languages=summary?.languages||[locale.toLowerCase()];
   // Fetch the complete snapshot before touching layout; never clear visible rows between requests.
   const [logs,numericLogs]=await Promise.all([
    Promise.all(languages.map(async language=>[language,await last('order-filler',language)])).then(Object.fromEntries),
    Promise.all(['time','duration'].map(async suite=>[suite,await last(suite,locale)])).then(Object.fromEntries)
   ]);
   preserveScroll(()=>render(summary,languages,logs,numericLogs));
  }catch(error){preserveScroll(()=>setText(document.querySelector('#error'),error.message));}
  setTimeout(refresh,2000);
 }
 refresh();
})();
