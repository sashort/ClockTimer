(() => {
 const locale=document.querySelector('#locale').value, deliveries=['press','fast','medium','slow'];
 const url=(suite,language,status=false)=>{const u=new URL('/api/diagnostics/order-filler/',location.origin);u.searchParams.set('suite',suite);u.searchParams.set('locale',language);if(status)u.searchParams.set('status','1');return u;};
 const text=(parent,tag,value,cls)=>{const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;parent.append(e);return e;};
 async function last(suite,language){const r=await fetch(url(suite,language,true),{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw Error('Status request failed ('+r.status+'). Sign in again if the session expired.');return (await r.json()).last;}
 async function refresh(){
  try {
   const summary=await last('summary',locale),languages=summary?.languages||[locale.toLowerCase()];
   const logs=Object.fromEntries(await Promise.all(languages.map(async language=>[language,await last('order-filler',language)])));
   const table=document.querySelector('#summary-rows');table.replaceChildren();
   const results=summary?.results||{};let completed=0,failed=0,active;
   for(const language of languages){
    const row=document.createElement('tr');text(row,'td',language);
    for(const delivery of deliveries){
     const cell=document.createElement('td'),status=results[language]?.[delivery]||'queued';
     text(cell,'span',status,'pill '+(status==='passed'?'pass':status==='failed'?'fail':status==='running'?'running':'queued'));
     const record=logs[language];
     if(['passed','failed','skipped'].includes(status)){completed++;if(record?.deliveryTotals?.[delivery])text(cell,'small','Test '+record.deliveryCounts[delivery]+' / '+record.deliveryTotals[delivery]);}
     if(status==='failed')failed++;
     if(status==='running'&&record){text(cell,'small','Test '+(record.deliveryNumber||record.completed)+' / '+(record.deliveryTotal||record.total));active=record;}
     row.append(cell);
    }
    table.append(row);
   }
   document.querySelector('#language-count').textContent=languages.length;
   document.querySelector('#completed-count').textContent=completed+' / '+languages.length*4;
   document.querySelector('#failed-count').textContent=failed;
   document.querySelector('#run-status').textContent=summary?.runStatus||'No run';
   document.querySelector('#summary-log').href=url('summary',locale);
   document.querySelector('#build').textContent='Latest test runs'+(summary?.build?.version?' · build '+summary.build.version:'');
   active ||= logs[locale.toLowerCase()] || Object.values(logs).filter(Boolean).at(-1);
   if(active){
    document.querySelector('#live-label').textContent=active.locale+' · '+(active.delivery||active.runStatus);
    const host=document.querySelector('#live-progress');host.replaceChildren();text(host,'strong',(active.deliveryTotal?'test '+active.deliveryNumber+'/'+active.deliveryTotal:active.progress)+' — '+(active.label||active.type));
    const progress=document.createElement('progress');progress.max=active.total;progress.value=active.completed;host.append(progress);
    const age=Math.max(0,Math.floor((Date.now()-Date.parse(active.at))/1000));text(host,'small','Updated '+age+'s ago'+(active.runStatus==='running'&&age>120?' — stale; run may have stopped':''),'muted');
    document.querySelector('#live-record').textContent=JSON.stringify(active,null,2);
   }
   const numeric=document.querySelector('#numeric-rows');numeric.replaceChildren();
   for(const suite of ['time','duration']){
    const record=await last(suite,locale),row=document.createElement('tr'),name=text(row,'td',suite==='time'?'Clock times':'Durations → 1:59:59');
    const link=text(name,'a',suite+'-'+locale.toLowerCase()+'.log','link');link.href=url(suite,locale);
    const result=text(row,'td',record?.runStatus||'No run');if(record)text(result,'small',record.progress);numeric.append(row);
   }
   document.querySelector('#folders').textContent='summary.log\nlanguage-tests/\n'+languages.map(language=>'  '+language+'/\n    order-filler-'+language+'.log\n    time-'+language+'.log\n    duration-'+language+'.log').join('\n');
   document.querySelector('#error').textContent='';
  }catch(error){document.querySelector('#error').textContent=error.message;}
  setTimeout(refresh,2000);
 }
 refresh();
})();
