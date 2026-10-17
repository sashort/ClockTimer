(() => {
    'use strict';
    class SharedModal extends HTMLElement {
        #surface;
        #announcement;
        attachSurface(surface){this.#surface=surface;}
        get modalSurface(){return this.#surface || this.querySelector(':scope > dialog') || this;}
        get modalHost(){return this.ownerDocument.querySelector('shared-modal-host');}
        showModal(){const surface=this.modalSurface;if(surface!==this)return surface.showModal();return this.showPopover();}
        close(value){const surface=this.modalSurface;if(surface!==this)return surface.close(value);return this.hidePopover();}
        get open(){const surface=this.modalSurface;return surface!==this?surface.open:this.matches(':popover-open');}
        announce(text,{audio=globalThis.WMOFAudio,after=Promise.resolve()}={}){
            this.cancelAnnouncement();const entry={};this.#announcement=entry;
            Promise.resolve(after).catch(()=>{}).then(()=>{
                if(this.#announcement!==entry||!this.open)return;
                const handle=audio?.speak?.(text);entry.stop=typeof handle?.stop==='function'?()=>handle.stop():undefined;
            });
            return ()=>{if(this.#announcement===entry)this.cancelAnnouncement();};
        }
        cancelAnnouncement(){this.#announcement?.stop?.();this.#announcement=undefined;}
    }
    class TripLogModal extends SharedModal {}
    class SharedModalHost extends HTMLElement {
        #dialogs=new Map(); #controls=new Map(); #open=[]; #background=new Map(); #observer;
        connectedCallback(){
            if(this.#observer)return;
            this.setAttribute('popover','manual');
            this.setAttribute('role','dialog');this.setAttribute('aria-modal','true');
            this.setAttribute('aria-label','Open dialogs');
            this.#observer=new MutationObserver(()=>{
                for(const dialog of [...this.#open])if(!dialog.open||!dialog.isConnected)this.#restore(dialog);
                this.#scan();this.#sync();
            });
            this.#observer.observe(this.ownerDocument.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
            this.ownerDocument.addEventListener('keydown',this.#keyDown,true);
            this.ownerDocument.addEventListener('fullscreenchange',this.#promote);
            this.#scan();
        }
        #scan(){for(const dialog of this.ownerDocument.querySelectorAll('dialog'))this.register(dialog);}
        register(dialog){
            if(this.#dialogs.has(dialog))return;
            let owner=dialog.parentElement;
            if(!(owner instanceof SharedModal)){
                owner=this.ownerDocument.createElement(dialog.id==='tripLogDialog'?'trip-log-modal':'shared-modal');
                dialog.replaceWith(owner);owner.append(dialog);
            }
            owner.attachSurface(dialog);
            const home={parent:dialog.parentNode,next:dialog.nextSibling,showModal:dialog.showModal,close:dialog.close,inert:dialog.inert};
            this.#dialogs.set(dialog,home);
            // Keep existing call sites and native open/close events. Each child
            // is nonmodal inside this single, explicitly managed modal region.
            dialog.showModal=()=>this.open(dialog);
            dialog.close=value=>this.close(dialog,value);
            dialog.addEventListener('close',()=>{if(!dialog.open)this.#restore(dialog);});
        }
        registerControl(control){
            if(this.#controls.has(control))return;
            const parent=control.parentElement;
            this.#controls.set(control,{parent,next:control.nextSibling});
            control.addEventListener("speech-surface-boundary-change",()=>this.#measure());
            if(parent.id)control.dataset.layoutHost=parent.id;
            this.#sync();
        }
        get openDialogs(){return Object.freeze([...this.#open]);}
        ownerOf(surface){return this.#controls.has(surface)?surface:this.#dialogs.get(surface)?.parent;}
        open(dialog){
            this.register(dialog);
            if(dialog.open){if(this.#open.includes(dialog))return;throw new DOMException('The dialog is already open.','InvalidStateError');}
            this.#dialogs.get(dialog).focus=this.ownerDocument.activeElement;
            this.#open.push(dialog);
            this.append(dialog);dialog.inert=false;
            dialog.style.setProperty('--shared-modal-order',String(this.#open.length));
            this.#sync();
            try{dialog.show();}catch(error){this.#restore(dialog);throw error;}
            this.#promote();
            const focus=dialog.querySelector('[autofocus],input:not([disabled]):not([type="hidden"]),button:not([disabled]),[tabindex="0"]');
            if(focus && !focus.closest('[hidden]'))focus.focus({preventScroll:true});
        }
        close(dialog,value){
            const home=this.#dialogs.get(dialog);
            if(!home)return;
            home.parent.cancelAnnouncement?.();
            home.close.call(dialog,value);
            if(!dialog.open)this.#restore(dialog);
        }
        #restore(dialog){
            if(!this.#open.includes(dialog))return;
            const home=this.#dialogs.get(dialog);
            this.#open=this.#open.filter(item=>item!==dialog);
            if(!dialog.isConnected && dialog.open)home?.close.call(dialog);
            if(home){dialog.inert=home.inert;if(dialog.parentNode===this)this.#place(dialog,home);}
            this.#sync();
            if(home?.focus?.isConnected && !home.focus.closest('[inert]'))home.focus.focus({preventScroll:true});
            else this.#open.at(-1)?.querySelector('button:not([disabled]),input:not([disabled]),[tabindex="0"]')?.focus({preventScroll:true});
        }
        #place(element,{parent,next}){
            if(next?.parentNode===parent)parent.insertBefore(element,next);else parent.append(element);
        }
        #sync(){
            // Opening calls sync before show() so keep newly enrolled children;
            // native close events remove entries through #restore instead.
            const active=this.#open.length>0;
            for(const [control,home] of this.#controls){
                const host=active?this:home.parent;
                if(control.parentNode===host)continue;
                const style=this.ownerDocument.defaultView.getComputedStyle(home.parent);
                for(const name of ['--trip-log-layout-duration','--speech-bar-height','--speech-options-header-height']){
                    const value=style.getPropertyValue(name);if(value)control.style.setProperty(name,value);
                }
                if(active)this.append(control);else this.#place(control,home);
                control.promoteTopLayer?.();control.refreshLayout?.();
            }
            if(active){
                for(const element of this.ownerDocument.body.children){
                    if(element===this||element.matches('script,style,link'))continue;
                    if(!this.#background.has(element))this.#background.set(element,element.inert);
                    element.inert=true;
                }
                this.#promote();
            }else{
                if(this.matches(':popover-open'))this.hidePopover();
                for(const [element,inert] of this.#background)element.inert=inert;
                this.#background.clear();
            }
        }
        #measure(){
            const viewport=this.ownerDocument.defaultView.visualViewport;
            const top=viewport?.offsetTop || 0;
            let bottom=top+(viewport?.height || this.ownerDocument.defaultView.innerHeight);
            for(const control of this.#controls.keys())if(!control.hidden && control.matches(':popover-open')){
                const safe=Number(control.getSafeTop?.());if(Number.isFinite(safe))bottom=Math.min(bottom,safe);
            }
            this.style.setProperty('--shared-modal-safe-height',Math.max(0,bottom-top)+'px');
        }
        #promote=()=>{this.#measure();if(this.#open.length && !this.matches(':popover-open'))this.showPopover();};
        #keyDown=event=>{
            if(event.key!=='Escape'||!this.#open.length)return;
            const focused=event.target.closest?.('dialog[open]');
            const dialog=this.#open.includes(focused)?focused:this.#open.at(-1);
            event.preventDefault();event.stopImmediatePropagation();
            if(dialog.dispatchEvent(new Event('cancel',{cancelable:true})))this.close(dialog);
        };
    }
    const owners=new WeakMap(),nativeShowModal=HTMLDialogElement.prototype.showModal;
    const connect=SharedModalHost.prototype.connectedCallback;
    SharedModalHost.prototype.connectedCallback=function(){owners.set(this.ownerDocument,this);return connect.call(this);};
    HTMLDialogElement.prototype.showModal=function(){const host=owners.get(this.ownerDocument);return host?host.open(this):nativeShowModal.call(this);};
    globalThis.SharedModal=SharedModal;
    globalThis.SharedModalHost=SharedModalHost;
    globalThis.TripLogModal=TripLogModal;
    customElements.define('shared-modal',SharedModal);
    customElements.define('trip-log-modal',TripLogModal);
    customElements.define('shared-modal-host',SharedModalHost);
})();
