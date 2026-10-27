const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
module.exports=function(model){
 for(const id of ['GOAL-SELECT','GOAL-PERCENT','TS'])if(!model.states[id])throw Error('Missing '+id);
 const box=(id,x,y,title,lines)=>`<g${id?` data-state-id="${id}"`:''}><rect x="${x}" y="${y}" width="360" height="110" rx="14" fill="white" stroke="#446880" stroke-width="2"/><text x="${x+180}" y="${y+30}" text-anchor="middle" font-size="19" font-weight="bold">${esc(title)}</text>${lines.map((t,i)=>`<text x="${x+180}" y="${y+57+i*21}" text-anchor="middle" font-size="15">${esc(t)}</text>`).join('')}</g>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="900" viewBox="0 0 1000 900" role="img" aria-label="Whole bar goal selector and separate Standard Time editor"><rect width="1000" height="900" fill="#f5f8fb"/><g font-family="Arial,sans-serif" fill="#17334b"><text x="40" y="45" font-size="27" font-weight="bold">Goal editing · current shared contract</text><text x="40" y="75" font-size="16">27 October 2026 · Classic and Bar share actual / inferred goal details</text>
 ${box('',50,120,'Whole bar',['Nodes, labels, track and triangles','Touch / click / Enter / Space'])}
 ${box('',590,120,'Main Standard Time header',['Separate existing control','Never offered by the bar'])}
 ${box('GOAL-SELECT',50,330,model.states['GOAL-SELECT'].title,['Trip: Trip · Aggregate: that goal','Auto: Trip + aggregate; even if failed'])}
 ${box('TS',590,330,model.states.TS.title,['Existing trip Standard Time editor','Available in every active scope'])}
 ${box('GOAL-PERCENT',50,560,model.states['GOAL-PERCENT'].title,['Edit actual configured percentage','Inferred trip requirement is a preview'])}
 <g stroke="#446880" stroke-width="3"><path d="M230 230V330 M770 230V330 M230 440V560"/></g>
 <text x="50" y="730" font-size="16">Example: Day actual goal 110% → inferred trip requirement 125%.</text><text x="50" y="760" font-size="16">No Standard edit, Current time-mode change or failed-only selector from the bar.</text><text x="50" y="790" font-size="16">Drop-In retains existing permission gates; Classic uses the same goal details.</text><text x="50" y="820" font-size="16">Counted-time motion / pause-resume keyframes remain a proposal.</text></g></svg>`;
};
