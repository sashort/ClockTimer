const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
module.exports=function goalEditorSVG(model){
 for(const id of ['GOAL-SELECT','GOAL-PERCENT','TS'])if(!model.states[id])throw Error('Missing goal editor state '+id);
 const box=(id,x,y,title,lines,width=330,height=100)=>`<g${id?` data-state-id="${id}"`:''}><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="14" fill="#fff" stroke="#446880" stroke-width="2"/><text x="${x+width/2}" y="${y+30}" text-anchor="middle" class="node-title">${esc(title)}</text>${lines.map((s,i)=>`<text x="${x+width/2}" y="${y+56+i*21}" text-anchor="middle" class="node-line">${esc(s)}</text>`).join('')}</g>`;
 const edge=(d,label,x,y)=>`<path d="${d}" fill="none" stroke="#446880" stroke-width="2" marker-end="url(#arrow)"/>${label?`<text x="${x}" y="${y}" text-anchor="middle" class="edge-label">${esc(label)}</text>`:''}`;
 return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1320" height="1100" viewBox="0 0 1320 1100" role="img" aria-labelledby="title desc"><title id="title">Current goal and Standard Time editor routing</title><desc id="desc">27 October 2026 local working FSM projection. Nodes and labels share one scoped action. One failed goal edits directly, several use a configurable selector. Proposed lifecycle animations are not implemented.</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#446880"/></marker><style>text{font-family:Arial,sans-serif;fill:#17334b}.node-title{font-size:19px;font-weight:700}.node-line{font-size:15px}.edge-label{font-size:15px;paint-order:stroke;stroke:#f5f8fb;stroke-width:6;stroke-linejoin:round}.note{font-size:15px}</style></defs><rect width="1320" height="1100" fill="#f5f8fb"/><text x="50" y="42" font-size="27" font-weight="700">Goal / Standard Time editors · current working contract</text><text x="50" y="70" font-size="16">27 October 2026 · action routing preserves trip phase and mode · no deployment claim</text>
 ${box('',50,115,'Right-pointing triangle',['Appears when at least one goal fails'])}
 ${box('',495,115,'Classic Auto goal label',['Normal configured goal choices'])}
 ${box('',940,115,'Bar node or any label',['Circle, time, percentage, name', 'Standard Time header also enters here'],330,110)}
 ${box('',50,285,'How many failed nodes?',['Use current failed-goal list'])}
 ${box('',50,465,'Exactly one',['Use that goal’s existing action'])}
 ${box('GOAL-SELECT',495,465,model.states['GOAL-SELECT'].title,['Configure choices for this opening','No entry-origin history'])}
 ${box('',495,655,'Resolve scope',['Standard, Trip, aggregate or Current'])}
 ${box('TS',50,825,'Standard Time settings',['Edits trip duration in every scope','Idle bar uses New Trip duration entry'],330,110)}
 ${box('GOAL-PERCENT',495,825,model.states['GOAL-PERCENT'].title,['Edits configured Trip / aggregate %','Never edits the inferred display value'],330,110)}
 ${box('',940,825,'Time-display action',['Current node keeps existing behavior'],330,110)}
 ${edge('M 215 215 V 285','',0,0)}
 ${edge('M 215 385 V 465','one',240,430)}
 ${edge('M 380 335 H 440 V 515 H 495','several',440,420)}
 ${edge('M 660 215 V 465','Trip + selected aggregate',660,350)}
 ${edge('M 215 565 V 705 H 495','direct',350,694)}
 ${edge('M 660 565 V 655','choose',700,613)}
 ${edge('M 1105 225 V 705 H 825','shared action',1105,460)}
 ${edge('M 550 755 V 785 H 215 V 825','Standard',365,776)}
 ${edge('M 660 755 V 825','Trip / aggregate',733,799)}
 ${edge('M 770 755 V 785 H 1105 V 825','Current',950,776)}
 <text x="50" y="982" class="note">Main display: trip-only Standard Time. Aggregate accounting remains separate. Standalone breaks have no standard.</text>
 <text x="50" y="1009" class="note">Goal entry &gt;150% becomes 150% before feedback. The passive notice never takes command focus.</text>
 <text x="50" y="1036" class="note">Drop-In retains its existing permissions; publisher Standard Time is read-only.</text>
 <text x="50" y="1063" class="note">Cold-load/start/end animation choreography remains proposed. Sources: mainline-fsm-draft.json and goal-bar.md.</text></svg>`;
};
