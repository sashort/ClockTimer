(() => {
    'use strict';
    // Fullscreen, rotation and the software keyboard can settle on separate
    // frames. Measure again after layout, then refresh dependent surfaces.
    class ViewportLayout {
        #view; #refresh; #frame; #listeners=[]; #settleTimers=[];
        static measure(view=globalThis) {
            const viewport=view.visualViewport,document=view.document;
            const editable=document.activeElement?.matches?.('textarea,[contenteditable="true"],input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"])');
            const fullscreen=document.fullscreenElement&&!editable&&!(viewport?.scale>1);
            return {width:fullscreen?view.innerWidth:(viewport?.width||view.innerWidth),
                height:fullscreen?view.innerHeight:(viewport?.height||view.innerHeight),top:fullscreen?0:(viewport?.offsetTop||0)};
        }
        constructor({view=globalThis,refresh=()=>{}}={}) {
            this.#view=view;this.#refresh=refresh;
            for(const [target,events] of [[view,['resize','orientationchange']],
                [view.document,['fullscreenchange','focusin','focusout']],[view.visualViewport,['resize','scroll']]]) {
                for(const event of events) {
                    target?.addEventListener(event,this.schedule);
                    this.#listeners.push(()=>target?.removeEventListener(event,this.schedule));
                }
            }
            this.schedule();
        }
        schedule=()=>{
            this.#queueMeasure();
            for(const timer of this.#settleTimers)this.#view.clearTimeout(timer);
            this.#settleTimers=[100,300,650,1200].map(delay=>this.#view.setTimeout(()=>this.#queueMeasure(),delay));
        };
        #queueMeasure=()=>{
            if(this.#frame!==undefined)return;
            this.#frame=this.#view.requestAnimationFrame(()=>{
                this.#frame=this.#view.requestAnimationFrame(()=>{
                    this.#frame=undefined;
                    const view=this.#view,{width,height}=ViewportLayout.measure(view);
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
            for(const timer of this.#settleTimers)this.#view.clearTimeout(timer);this.#settleTimers=[];
            if(this.#frame!==undefined)this.#view.cancelAnimationFrame(this.#frame);this.#frame=undefined;}
    }
    globalThis.ViewportLayout=ViewportLayout;
})();
