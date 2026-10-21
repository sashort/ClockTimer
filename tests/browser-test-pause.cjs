/** Freeze the isolated workflow clock only after a completed action has settled. */
module.exports=class BrowserTestPause {
 constructor(page){this.page=page;}
 async stop(){await this.page.clock.pauseAt(await this.page.evaluate(()=>Date.now()+1000));}
 async resume(){await this.page.clock.resume();}
};
