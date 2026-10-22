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
   this.mutations.observe(row,{childList:true,characterData:true,subtree:true});
   row.ownerDocument.fonts?.ready.then(schedule);
   schedule();
  }
  fit(){
   const row=this.row,box=row.getBoundingClientRect();
   if(!box.width || !this.context)return;
   const reference=this.reference?.getBoundingClientRect();
   if(reference?.width){
    // The badge is a real grid cell, aligned by reserving the inset to the cloud.
    const inset=Math.max(0,box.right-(reference.left+reference.width/2)-20);
    row.style.setProperty('--summary-sync-inset',`${inset}px`);
   }
   const style=getComputedStyle(row),base=parseFloat(style.fontSize);
   const cells=[row.querySelector('#currentPercentValue'),row.querySelector(':scope > span'),row.querySelector('#goalPercentValue')];
   if(cells.some(cell=>!cell))return;
   const widths=cells.map(cell=>{
    const textStyle=getComputedStyle(cell);
    this.context.font=`${textStyle.fontStyle} ${textStyle.fontWeight} ${base}px ${textStyle.fontFamily}`;
    const spacing=parseFloat(textStyle.letterSpacing)||0;
    return Math.max(1,this.context.measureText(cell.textContent).width+spacing*cell.textContent.length);
   });
   const available=Math.max(1,row.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-40-3*parseFloat(style.columnGap));
   // Leave a pixel per text cell for browser glyph rounding.
   const scale=Math.min(1,Math.max(1,available-3)/widths.reduce((a,b)=>a+b,0));
   row.style.setProperty('--summary-percent-font-size',`${base*scale}px`);
   row.style.gridTemplateColumns=`minmax(0, ${widths[0]}fr) ${widths[1]*scale+1}px minmax(0, ${widths[2]}fr) 40px`;
  }
 }
 globalThis.WMOFTimerSummaryView={render(root,state){
  PercentSummaryLayout.attach(root.querySelector('.percent-summary'));
  for(const [id,text] of [['standardTimeValue',state?.standard_time_component?.text],['renderedTimeValue',state?.time_component?.text],['currentPercentValue',state?.current_percent_component?.text],['goalPercentValue',state?.goal_component?.text]]){const e=root.querySelector('#'+id);if(e)e.textContent=text||'-';}
  for(const [id,key] of [['standardTimeLabel','standard_time_header_text'],['renderedTimeLabel','time_header_text']]){const e=root.querySelector('#'+id);if(e&&state?.[key])e.textContent=state[key];}
 }};
})();
