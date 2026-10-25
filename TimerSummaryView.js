(() => {
 'use strict';
 // Owns fitting for the shared Order Filler / Drop-In percentage row.
 // Text is measured at the preferred responsive size; the Sync column never scales.
 class PercentSummaryLayout {
  static instances=new WeakMap();
  static attach(row){
   if(!row || this.instances.has(row))return;
   this.instances.set(row,new this(row));
  }
  constructor(row){
   this.row=row;
   this.context=row.ownerDocument.createElement('canvas').getContext('2d');
   const schedule=()=>{
    if(this.frame)return;
    this.frame=requestAnimationFrame(()=>{this.frame=0;this.fit();});
   };
   this.resize=new ResizeObserver(schedule);
   this.resize.observe(row);
   this.reference=row.closest('.app')?.querySelector('.scope-connection-button');
   if(this.reference)this.resize.observe(this.reference);
   this.mutations=new MutationObserver(schedule);
   this.mutations.observe(row,{childList:true,characterData:true,attributes:true,attributeFilter:['hidden'],subtree:true});
   row.ownerDocument.fonts?.ready.then(schedule);
   schedule();
  }
  fit(){
   const row=this.row,box=row.getBoundingClientRect();
   if(!box.width || !this.context)return;
   const visible=!row.querySelector('.goal-sync-button')?.hidden;
   const badgeWidth=visible?40:0;
   const reference=this.reference?.getBoundingClientRect();
   // Fit against the destination inset, not its animated intermediate value.
   const inset=!visible?0:reference?.width
    ?Math.max(0,box.right-(reference.left+reference.width/2)-20):6;
   row.style.setProperty('--summary-sync-inset',`${inset}px`);
   const style=getComputedStyle(row),base=parseFloat(style.fontSize);
   const cells=[row.querySelector('#currentPercentValue'),row.querySelector(':scope > span'),row.querySelector('#goalPercentValue')];
   if(cells.some(cell=>!cell))return;
   const widths=cells.map(cell=>{
    const textStyle=getComputedStyle(cell);
    this.context.font=`${textStyle.fontStyle} ${textStyle.fontWeight} ${base}px ${textStyle.fontFamily}`;
    const spacing=parseFloat(textStyle.letterSpacing)||0;
    return Math.max(1,this.context.measureText(cell.textContent).width+spacing*cell.textContent.length);
   });
   const gap=parseFloat(style.getPropertyValue('--summary-text-gap'))||12;
   // Reserve only the real Sync track plus its cloud-aligned right inset.
   // Two equal flexible spaces center the entire expression before that track.
   const available=Math.max(1,row.clientWidth-inset-badgeWidth-4*gap-3);
   const scale=Math.min(1,available/widths.reduce((sum,width)=>sum+width,0));
   row.style.setProperty('--summary-percent-font-size',`${base*scale}px`);
   row.style.gridTemplateColumns=`minmax(0, 1fr) ${widths[0]*scale+1}px ${widths[1]*scale+1+2*gap}px ${widths[2]*scale+1}px minmax(0, 1fr) ${badgeWidth}px`;
  }
 }
 globalThis.WMOFTimerSummaryView={render(root,state){
  const row=root.querySelector('.percent-summary');
  if(state && Object.hasOwn(state,'effective_goal_type')){
   const sync=row?.querySelector('.goal-sync-button');
   if(sync)sync.hidden=state.effective_goal_type!=='trip';
  }
  PercentSummaryLayout.attach(row);
  for(const [id,text] of [['standardTimeValue',state?.standard_time_component?.text],['renderedTimeValue',state?.time_component?.text],['currentPercentValue',state?.current_percent_component?.text],['goalPercentValue',state?.goal_component?.text]]){const e=root.querySelector('#'+id);if(e)e.textContent=text||'-';}
  for(const [id,key] of [['standardTimeLabel','standard_time_header_text'],['renderedTimeLabel','time_header_text']]){const e=root.querySelector('#'+id);if(e&&state?.[key])e.textContent=state[key];}
 }};
})();
