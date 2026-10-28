'use strict';
let sequence=0;
// Keep both the operation promise and its observer rooted in the page. Return
// only a completion flag to DevTools, whose awaitPromise uses a weak reference.
module.exports=page=>async function operation(fn,arg){
 const id=++sequence;
 await page.evaluate(({id,source,arg})=>{
  const records=window.__wmofTestOperations||={};const record=records[id]={};
  try {
   record.operation=eval('('+source+')')(arg);
   record.observer=Promise.resolve(record.operation).then(value=>{record.result=value;record.done=true;},error=>{record.error=String(error.stack||error);record.done=true;});
  }catch(error){record.error=String(error.stack||error);record.done=true;}
 },{id,source:fn.toString(),arg});
 await page.waitForFunction(id=>window.__wmofTestOperations[id]?.done,id);
 const result=await page.evaluate(id=>{const record=window.__wmofTestOperations[id];delete window.__wmofTestOperations[id];return{result:record.result,error:record.error};},id);
 if(result.error)throw new Error(result.error);return result.result;
};
