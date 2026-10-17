(() => {
    'use strict';
    // Fullscreen, rotation and the software keyboard can settle on separate
    // frames. Measure again after layout, then refresh dependent surfaces.
    class ViewportLayout {
        #view; #refresh; #frame; #listeners=[];
        constructor({view=globalThis,refresh=()=>{}}={}) {
            this.#view=view;this.#refresh=refresh;
            for(const [target,events] of [[view,['resize','orientationchange']],
                [view.document,['fullscreenchange']],[view.visualViewport,['resize','scroll']]]) {
                for(const event of events) {
                    target?.addEventListener(event,this.schedule);
                    this.#listeners.push(()=>target?.removeEventListener(event,this.schedule));
                }
            }
            this.schedule();
        }
        schedule=()=>{
            if(this.#frame!==undefined)return;
            this.#frame=this.#view.requestAnimationFrame(()=>{
                this.#frame=this.#view.requestAnimationFrame(()=>{
                    this.#frame=undefined;
                    const view=this.#view,viewport=view.visualViewport;
                    const width=viewport?.width||view.innerWidth,height=viewport?.height||view.innerHeight;
                    if(width>0&&height>0){
                        const style=view.document.documentElement.style;
                        style.setProperty('--app-viewport-width',width+'px');
                        style.setProperty('--app-viewport-height',height+'px');
                    }
                    this.#refresh();
                });
            });
        };
        disconnect(){for(const remove of this.#listeners)remove();this.#listeners=[];
            if(this.#frame!==undefined)this.#view.cancelAnimationFrame(this.#frame);this.#frame=undefined;}
    }
    globalThis.ViewportLayout=ViewportLayout;
})();
