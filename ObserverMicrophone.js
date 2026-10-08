(() => {
    class ObserverMicrophone {
        constructor({button,stream,onFailure,timeout=10000}) {
            Object.assign(this,{button,stream,onFailure,timeout});this.target=null;this.actual=null;this.pending=null;
            const style=document.createElement('style');
            style.textContent=WMOFMicrophoneControl.css
                .replaceAll(':host([state="muted"]) #mic', '#dropInMicrophoneButton[data-muted="true"]')
                .replaceAll(':host([state="muted"])\n                #mic', '#dropInMicrophoneButton[data-muted="true"]')
                .replaceAll(':host([state="listening"]) #mic', '#dropInMicrophoneButton[data-muted="false"]')
                .replaceAll(':host([state="utterance"]) #mic', '#dropInMicrophoneButton[data-muted="false"]')
                .replaceAll('#mic','#dropInMicrophoneButton').replace('z-index: 2147483647','z-index: 1');
            document.head.append(style);
            button.addEventListener('click',()=>void this.toggle());this.paint();
        }
        reset(target=null) {
            if(this.pending)clearTimeout(this.pending.timer);
            this.pending=null;this.actual=null;this.target=target;this.paint();
        }
        update(target,state) {
            if(Number(target)!==Number(this.target))this.reset(target);
            this.actual=state && typeof state.started==='boolean' && typeof state.muted==='boolean' ? {...state}:null;
            this.paint();
        }
        paint() {
            const state=this.pending ? {started:true,muted:!this.pending.enabled}:this.actual;
            this.button.dataset.muted=String(!state?.started || Boolean(state.muted));
            this.button.setAttribute('aria-pressed',String(Boolean(state?.started && !state.muted)));
            this.button.setAttribute('aria-busy',String(Boolean(this.pending)));
            this.button.setAttribute('aria-label',WMOFLanguagePack.text(state?.started&&!state.muted?'a3a8c454-03e4-5197-84f5-de0a68cff168':'634f965d-1ea9-5ac4-807b-fb3caeef2046'));
            this.button.disabled=Boolean(this.pending)||!this.stream.viewing||!state?.started;
        }
        finish(commandId,result) {
            if(!this.pending||this.pending.commandId!==commandId)return;
            clearTimeout(this.pending.timer);this.pending=null;
            if(result && typeof result.started==='boolean' && typeof result.muted==='boolean')this.actual={started:result.started,muted:result.muted};
            this.paint();if(!result?.accepted)this.onFailure?.();
        }
        async toggle() {
            if(this.button.disabled||this.pending||!this.actual?.started)return;
            const commandId=crypto.randomUUID(),enabled=this.actual.muted,target=this.target;
            this.pending={commandId,enabled,timer:setTimeout(()=>this.finish(commandId,null),this.timeout)};this.paint();
            try {await this.stream.sendToPublisher('trainer.microphone',{enabled,commandId});}
            catch {if(this.target===target)this.finish(commandId,null);}
        }
    }
    globalThis.WMOFObserverMicrophone=ObserverMicrophone;
})();
