(() => {
    const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
    const copy=value=>JSON.parse(JSON.stringify(value));
    const iso=value=>/(?:Z|[+-]\d\d:\d\d)$/.test(value)?value:String(value).replace(' ','T')+'Z';
    const time=value=>value&&Number.isFinite(Date.parse(iso(value)))?Date.parse(iso(value)):NaN;
    const order=event=>Number.isFinite(event._editorSortTime)?event._editorSortTime:Number.isFinite(time(event.timestamp))?time(event.timestamp):Infinity;
    const camera='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h4l2-3h6l2 3h4v15H3z"/><circle cx="12" cy="13" r="4"/></svg>';
    class TripEditor {
        static async open(trip,options,calendar){
            const data=await options.request(trip.id);const editor=new TripEditor(trip,data,options,calendar);editor.show();return editor;
        }
        constructor(trip,data,options,calendar){
            this.trip=copy(trip);this.original=copy(data.events);this.events=copy(data.events);this.settings=copy(data.settings);this.offline=data.offline===true;
            if(!this.settings.instants&&this.settings.creationAnchor){const base=time(this.settings.creationAnchor),duration=value=>{const [h,m,s]=String(value||'0:00:00').split(':').map(Number);return(h*3600+m*60+s)*1000;};this.settings.instants=Object.fromEntries(['creationTime','scheduledStart','startTime'].map(field=>[field,new Date(base+duration(this.settings[field])).toISOString()]));}
            this.originalSettings=copy(this.settings);this.revision=data.revision;this.options=options;this.calendar=calendar;this.official=[];this.previewTrip=trip;this.generation=0;this.dirty=false;
            for(const event of this.events)event._editorSortTime=time(event.timestamp);
        }
        button(text,action,cls){const b=el('button',text,cls);if(typeof text==='string'&&(cls?.includes('trip-log-entry-time')||cls==='trip-editor-approval'))this.decorateTime(b,text);b.type='button';b.addEventListener('click',()=>Promise.resolve(action()).catch(e=>this.error(e)));return b;}
        decorateTime(target,text){const match=String(text).match(/^(.*)(\.\d{3})$/);if(!match){target.textContent=text;return;}target.replaceChildren(document.createTextNode(match[1]),el('small',match[2],'trip-editor-time-fraction'));}
        durationText(value){const milliseconds=Math.max(0,Math.round(Number(value)||0));return TripLog.duration(milliseconds)+'.'+String(milliseconds%1000).padStart(3,'0');}
        show(){
            const dialog=this.dialog=el('dialog',undefined,'app-dialog trip-log-editor dedicated-trip-editor');dialog.setAttribute('aria-label','Edit Trip');
            const header=el('header',undefined,'dialog-header');header.append(el('h2','Edit Trip'),this.button('×',()=>this.close(),'dialog-close'));dialog.append(header);
            this.subtitle=el('p',undefined,'trip-editor-subtitle');this.summary=el('section',undefined,'trip-editor-summary');dialog.append(this.subtitle,this.summary);
            this.controls=el('section',undefined,'trip-editor-controls');dialog.append(this.controls);
            this.body=el('section',undefined,'trip-editor-body');this.body.setAttribute('aria-label','Trip timeline');dialog.append(this.body);
            this.alert=el('p',undefined,'trip-log-error');this.alert.setAttribute('role','alert');dialog.append(this.alert);
            const footer=el('footer',undefined,'trip-editor-footer');footer.append(el('small','Preview your edits, then save all changes.'));
            const actions=el('div',undefined,'dialog-actions two-actions');this.saveButton=this.button('Save Changes',()=>this.save(),'primary-action');actions.append(this.button('Cancel',()=>this.close()),this.saveButton);footer.append(actions);dialog.append(footer);
            dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});dialog.addEventListener('close',()=>{clearTimeout(this.previewTimer);this.generation++;dialog.remove();this.options.onEditorClosed?.();},{once:true});
            document.body.append(dialog);document.querySelector('shared-modal-host')?.register(dialog);dialog.showModal();this.render();this.preview();
        }
        close(){if(this.saving)return;if(this.dirty&&!confirm('Discard changes to this trip?'))return;this.dialog.close();}
        error(error){this.alert.textContent=error.message||String(error);}
        format(value){if(!Number.isFinite(time(value)))return 'Set time';return new Intl.DateTimeFormat(undefined,{timeZone:this.calendar.timezone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(time(value)))+'.'+String(new Date(time(value)).getUTCMilliseconds()).padStart(3,'0');}
        async pad(options){return this.options.numberPad({cancelTarget:'none',confirmTarget:'none',...options});}
        changed(){this.dirty=true;this.alert.textContent='';for(const event of this.intervals())if(!Object.values(this.invalid(event)).some(Boolean))event._editorSortTime=time(event.timestamp);this.render();clearTimeout(this.previewTimer);this.previewTimer=setTimeout(()=>this.preview(),200);}
        sorted(){return [...this.events].filter(e=>['trip.started','trip.stopped','interval.started'].includes(e.event)).sort((a,b)=>order(a)-order(b));}
        deleted(){return new Set(this.events.filter(e=>e.event==='interval.deleted').map(e=>e.value?.intervalKey));}
        intervals(){const deleted=this.deleted();return this.sorted().filter(e=>e.event==='interval.started'&&!deleted.has(e.value?.intervalKey));}
        end(event){return this.events.find(e=>e.event==='interval.ended'&&e.value?.intervalKey===event.value?.intervalKey);}
        invalid(event){
            const begin=time(this.events.find(e=>e.event==='trip.started')?.timestamp),finish=time(this.events.find(e=>e.event==='trip.stopped')?.timestamp)||Date.now(),start=time(event.timestamp),end=this.end(event),right=end?time(end.timestamp):finish;
            const result={start:!Number.isFinite(start)||start<begin||start>finish||(Boolean(end)&&Number.isFinite(right)&&start>=right),end:Boolean(end)&&(!Number.isFinite(right)||right<=start||right>finish)};
            for(const other of this.intervals()){if(other===event)continue;const left=time(other.timestamp),stop=time(this.end(other)?.timestamp)||finish;if(Number.isFinite(start)&&Number.isFinite(right)&&start<stop&&right>left){result.start=true;if(end)result.end=true;}}
            return result;
        }
        boundaryInvalid(event){const value=time(event.timestamp),start=time(this.events.find(e=>e.event==='trip.started')?.timestamp),stop=time(this.events.find(e=>e.event==='trip.stopped')?.timestamp);if(!Number.isFinite(value))return true;if(event.event==='trip.started')return (Number.isFinite(stop)&&value>stop)||this.intervals().some(e=>Number.isFinite(time(e.timestamp))&&value>time(e.timestamp));return value<start||this.intervals().some(e=>{const end=this.end(e);return end&&Number.isFinite(time(end.timestamp))&&value<time(end.timestamp);});}
        validationMessage(){
            const problems=[];
            if(!Number.isFinite(time(this.settings.instants?.scheduledStart)))problems.push('set a valid Scheduled start');
            if(!this.settings.breakOnly&&!(Number.isSafeInteger(this.settings.standardTimeMilliseconds)&&this.settings.standardTimeMilliseconds>0&&this.settings.standardTimeMilliseconds<=31536000000))problems.push('set Standard Time between one millisecond and one year');
            if(this.events.filter(e=>['trip.started','trip.stopped'].includes(e.event)).some(e=>this.boundaryInvalid(e)))problems.push('correct the highlighted trip start or end time');
            if(this.intervals().some(e=>Object.values(this.invalid(e)).some(Boolean)))problems.push('correct incomplete, overlapping, or out-of-trip interval times');
            return problems.length?'Cannot save: '+problems.join('; ')+'.':'';
        }
        hasInvalid(){return Boolean(this.validationMessage());}
        showValidation(){const message=this.validationMessage();if(message){this.error(message);const field=this.dialog.querySelector('[aria-invalid="true"]');field?.scrollIntoView({block:'nearest'});field?.focus();}return Boolean(message);}

        render(){
            const scroll=this.body.scrollTop;this.body.replaceChildren();
            const start=this.events.find(e=>e.event==='trip.started'),stop=this.events.find(e=>e.event==='trip.stopped');this.subtitle.textContent=`${start?.timestamp?new Intl.DateTimeFormat(undefined,{timeZone:this.calendar.timezone,dateStyle:'medium'}).format(new Date(iso(start.timestamp))):''} · ${this.trip.running?'Active trip':'Completed trip'}`;
            this.drawSummary();this.drawControls();this.drawTimeline();this.drawActions();this.body.scrollTop=scroll;
            this.saveButton.disabled=Boolean(this.saving);const message=this.validationMessage();if(message)this.error(message);
        }
        drawSummary(){
            const trip=this.previewTrip,official=trip.officialCorrection;this.summary.replaceChildren();
            const values=[['Actual',TripLog.duration(trip.productiveTimeMilliseconds??trip.countedTimeMilliseconds)],['Percentage',TripLog.percent([trip])]];
            for(const [label,value] of values){const box=el('div');box.append(el('small',label));if(label==='Percentage'&&!this.trip.running&&!this.settings.breakOnly&&!this.offline){const b=this.button(value,()=>this.editOfficial(),'trip-editor-percent'+(official?' is-official-percent':''));box.append(b);if(official)box.append(el('small','OFFICIAL','trip-log-official-badge'));}else box.append(el('strong',this.settings.breakOnly?'—':value));this.summary.append(box);}
        }
        timeButton(event,field='timestamp',invalid=false){
            const b=this.button(this.format(event[field]),()=>this.pad({mode:'absolute',source:'trip-entry-time',title:'Entry Time',initialValue:event[field]?iso(event[field]):undefined,tripDefaults:{creationDate:this.settings.instants?.scheduledStart?.slice(0,10)||this.trip.startTime.slice(0,10)},onConfirm:value=>{event[field]=value||'';this.changed();}}),'trip-log-entry-time');
            b.setAttribute('aria-invalid',String(invalid));b.dataset.eventId=event.id;return b;
        }
        drawTimeline(){
            const toolbar=el('div',undefined,'trip-editor-toolbar');toolbar.append(this.button('+ Add Entry',()=>this.add(),'trip-log-add'));this.body.append(toolbar);
            const timeline=el('div',undefined,'trip-editor-timeline');this.body.append(timeline);
            const rows=this.sorted().filter(e=>e.event!=='interval.started'||!this.deleted().has(e.value.intervalKey));
            rows.push({id:'scheduled-start',event:'trip.scheduled-start',timestamp:this.settings.instants?.scheduledStart,value:{}});
            const officialStart=this.previewTrip.officialCorrection?.startTime;if(officialStart)rows.push({id:'official-start',event:'trip.official-start',timestamp:officialStart,value:{}});
            rows.sort((a,b)=>order(a)-order(b));
            for(const event of rows){
                const card=el('section',undefined,'trip-editor-card');card.dataset.eventId=event.id;if(event._draft)card.classList.add('is-new-entry');
                if(event.event==='trip.scheduled-start'){
                    card.classList.add('trip-editor-boundary','trip-editor-scheduled');card.append(el('strong','Scheduled start'),this.button(this.format(event.timestamp),()=>this.pad({mode:'absolute',source:'Scheduled start',title:'Scheduled start',initialValue:event.timestamp,onConfirm:value=>{this.settings.instants.scheduledStart=value;this.changed();}}),'trip-log-entry-time'));card.querySelector('button').setAttribute('aria-invalid',String(!Number.isFinite(time(event.timestamp))));timeline.append(card);continue;
                }
                if(event.event==='trip.official-start'){
                    card.append(el('strong','Official Start'),this.button(this.format(event.timestamp),()=>this.pad({mode:'absolute',source:'official-start-time',title:'Official Start',initialValue:event.timestamp,onConfirm:value=>{this.official=this.official.filter(e=>e.operation!=='official-start-time');this.official.push({operation:'official-start-time',startTime:iso(value)});this.changed();}}),'trip-log-entry-time'),this.button('Delete',()=>this.clearOfficial(),'danger'));timeline.append(card);continue;
                }
                if(event.event!=='interval.started'){card.classList.add('trip-editor-boundary');card.append(el('strong',event.event==='trip.started'?'Trip started':'Trip ended'),this.timeButton(event,'timestamp',this.boundaryInvalid(event)));timeline.append(card);continue;}
                const header=el('div',undefined,'trip-editor-card-header'),type=el('select');type.setAttribute('aria-label','Entry type');
                for(const [value,label] of [['break','Break'],['short-break','Short Break'],['lunch','Lunch'],...(!this.settings.breakOnly?[['down','Down']]:[])]){const option=el('option',label);option.value=value;type.append(option);}type.value=event.value.type==='break'&&event.value.attributes?.breakType==='short'?'short-break':event.value.type;
                type.addEventListener('change',()=>{event.value.type=type.value==='short-break'?'break':type.value;event.value.attributes={...(event.value.attributes||{}),breakType:type.value==='short-break'?'short':'break'};if(event.value.type==='down'){event.value.approvedTime=null;event.value.approvalState='pending';}this.changed();});header.append(type);
                if(event.value.type==='down'){
                    const photo=this.button(undefined,()=>this.options.openDownDetails?.(this.trip,event.value.intervalKey,true),'trip-editor-camera');photo.innerHTML=camera;photo.setAttribute('aria-label','Down Details: picture and description');photo.disabled=Boolean(event._draft)||this.offline||!this.options.openDownDetails;photo.title=event._draft?'Save this entry before adding its picture and description':this.offline?'Connect to view or edit the picture and description':'Picture and description';header.append(photo);
                }
                header.append(this.button('Delete',()=>{this.events=this.events.filter(e=>e.value?.intervalKey!==event.value.intervalKey);this.changed();},'danger'));card.append(header);
                const errors=this.invalid(event),times=el('div',undefined,'trip-editor-times'),end=this.end(event);const left=el('label');left.append(el('small','Start'),this.timeButton(event,'timestamp',errors.start));times.append(left);const right=el('label');right.append(el('small','End'),end?this.timeButton(end,'timestamp',errors.end):el('strong','In progress'));times.append(right);card.append(times);
                if(errors.start||errors.end)card.append(el('small','Choose times inside the trip without overlapping another entry.','trip-editor-invalid'));
                if(event.value.type==='down'){
                    const approval=this.events.findLast(e=>e.event==='interval.approval-changed'&&e.value?.intervalKey===event.value.intervalKey),state=approval?.value?.state??event.value.approvalState??(Number.isSafeInteger(event.value.approvedTime)?'approved':'pending');
                    card.append(this.downAccounting(event,state,approval));
                    card.append(el('small','Tap the camera to view or edit the picture and description.','trip-editor-note'));
                }else{
                    const planned=event.value.length;card.append(this.button(`Break length: ${Number.isSafeInteger(planned)?this.durationText(planned):'Set duration'}`,()=>this.pad({mode:'duration',source:'entry-length',title:'Break length',initialValue:planned,onConfirm:value=>{event.value.length=value;this.changed();}}),'trip-editor-approval'));
                }
                timeline.append(card);
            }
            const downSummary=this.downSummary();if(downSummary)this.body.append(downSummary);
        }
        drawControls(){
            this.controls.replaceChildren();
            if(this.settings.breakOnly){this.controls.append(el('p','Break-only trip'));return;}
            const standard=this.button(undefined,()=>this.pad({mode:'duration',source:'Standard Time',title:'Standard Time',initialValue:this.settings.standardTimeMilliseconds,onConfirm:value=>{this.settings.standardTimeMilliseconds=value;this.changed();}}),'trip-log-edit-field trip-editor-standard'),readout=el('strong');
            standard.setAttribute('aria-invalid',String(!(Number.isSafeInteger(this.settings.standardTimeMilliseconds)&&this.settings.standardTimeMilliseconds>0&&this.settings.standardTimeMilliseconds<=31536000000)));this.decorateTime(readout,this.durationText(this.settings.standardTimeMilliseconds));standard.append(el('span','Standard Time'),readout);
            const productive=el('label',undefined,'trip-editor-production'),check=el('input');check.type='checkbox';check.checked=!this.settings.nonProduction;check.addEventListener('change',()=>{this.settings.nonProduction=!check.checked;this.changed();});productive.append(check,el('span','Productive'));this.controls.append(standard,productive);
        }
        drawActions(){
            if(this.previewTrip.officialCorrection)this.body.append(el('p','The official percentage is preserved when trip details change. Select the percentage above to change or clear it.','trip-editor-note'));
            this.body.append(this.button('Delete trip',async()=>{if(!confirm('Delete this trip and all its entries?'))return;await this.options.request(this.trip.id,{operation:'delete-trip',revision:this.revision});this.dirty=false;this.dialog.close();await this.options.refresh();},'danger'));
        }
        add(){const key='editor-'+crypto.randomUUID();this.events.push({id:key+'-start',event:'interval.started',timestamp:'',_draft:true,value:{intervalKey:key,type:this.settings.breakOnly?'break':'down',approvalState:'pending',approvedTime:null,attributes:{}}},{id:key+'-end',event:'interval.ended',timestamp:'',_draft:true,value:{intervalKey:key}});this.changed();this.body.querySelector('.is-new-entry')?.scrollIntoView({block:'nearest'});}
        async choice(title,choices){
            const dialog=el('dialog',undefined,'app-dialog trip-editor-choice');dialog.append(el('h2',title));const actions=el('div',undefined,'dialog-actions');dialog.append(actions);document.body.append(dialog);document.querySelector('shared-modal-host')?.register(dialog);
            return new Promise(resolve=>{for(const [label,value] of choices)actions.append(this.button(label,()=>{resolve(value);dialog.close();}));dialog.addEventListener('close',()=>{resolve(undefined);dialog.remove();},{once:true});dialog.showModal();});
        }
        downAccounting(event,state,approval){
            const recorded=Math.max(0,(time(this.end(event)?.timestamp)||Date.now())-time(event.timestamp)),approved=state==='approved'?Number(approval?.value?.value??event.value.approvedTime??0):0;
            const strip=el('div',undefined,'trip-editor-down-accounting');strip.dataset.approvalState=state;
            const cell=(label,value,editable=false,signed=false)=>strip.append(this.downAmountCell(label,value,editable?()=>this.editApproval(event,state):undefined,signed));
            cell('Recorded',recorded);
            if(state==='pending')cell('Pending',recorded,true);
            else{cell('Approved',approved,true);cell('Unapproved',Math.max(0,recorded-approved));cell('Net',approved-recorded,false,true);}
            return strip;
        }
        downAmountCell(label,value,edit,signed=false){
            const node=edit?this.button(undefined,edit,'trip-editor-approval trip-editor-accounting-cell'):el('span',undefined,'trip-editor-accounting-cell');
            const magnitude=Math.round(Math.abs(value)),whole=TripLog.duration(magnitude).replace(/^0:/,''),readout=el('strong');if(Number.isFinite(value))readout.append(document.createTextNode((signed?(value<0?'−':value>0?'+':''):'')+whole),el('small','.'+String(magnitude%1000).padStart(3,'0'),'trip-editor-accounting-fraction'));else readout.textContent='—';
            node.append(el('small',label),readout);node.dataset.downAmount=label.toLowerCase();if(signed){node.title='Approved − Recorded';if(value<0)node.classList.add('is-deficit');}return node;
        }
        downSummary(){
            const downs=this.intervals().filter(e=>e.value.type==='down');if(downs.length<2)return;
            const states=downs.map(e=>TripDowntimeSummary.approvalState(e,this.events)),reviewed=states.some(state=>state==='approved'||state==='unapproved');
            const totals=TripDowntimeSummary.breakdown([{...this.trip,events:this.events}]),incomplete=downs.some(e=>Object.values(this.invalid(e)).some(Boolean));
            const values=[['Recorded',totals.loggedMilliseconds]];if(states.includes('pending'))values.push(['Pending',totals.pendingMilliseconds]);
            if(reviewed)values.push(['Approved',totals.approvedMilliseconds],['Unapproved',totals.unapprovedMilliseconds],['Net',totals.approvedMilliseconds-totals.loggedMilliseconds]);
            const section=el('section',undefined,'trip-editor-down-summary');section.append(el('h3','Down Time'));const strip=el('div',undefined,'trip-editor-down-accounting');strip.style.setProperty('--down-columns',String(values.length));
            for(const [label,value] of values)strip.append(this.downAmountCell(label,incomplete?NaN:value,undefined,label==='Net'));section.append(strip);return section;
        }
        async editApproval(event,state){await this.pad({mode:'duration',source:'approved-down-time',title:'Approved Down Time',allowEmpty:true,initialValue:state==='approved'?(this.events.findLast(e=>e.event==='interval.approval-changed'&&e.value?.intervalKey===event.value.intervalKey)?.value.value??event.value.approvedTime):undefined,onConfirm:async value=>{const next=value===undefined?await this.choice('Down Time status',[['Unapproved','unapproved'],['Pending','pending']]):'approved';if(!next)return;event.value.approvedTime=value??null;event.value.approvalState=next;for(const approval of this.events.filter(e=>e.event==='interval.approval-changed'&&e.value?.intervalKey===event.value.intervalKey)){approval.value.state=next;approval.value.value=value??0;}this.changed();}});}
        async editOfficial(){
            const official=this.previewTrip.officialCorrection,initial=official?.percent??Number((TripAggregates.performance(this.previewTrip)*100).toFixed(1));
            await this.pad({mode:'percent',source:'official-percent',title:'Official Percentage',anchorDigit:.1,confirmUnchanged:true,initialValue:initial,
                previewOfficial:()=>({text:'The official percentage will be applied when you save.',clearText:'Clear Official Percentage'}),
                onClearOfficial:official?async()=>this.clearOfficial():undefined,
                onConfirm:async value=>{if(!Number.isFinite(value)||value<0)return false;const show=await this.choice('Add a calculated Official Start?',[['No',false],['Yes',true]]);if(show===undefined)return false;this.official=[{operation:'official-percent',percentTenths:Math.round(value*10),showOfficialStart:show}];this.changed();return true;}});
        }
        clearOfficial(){this.official=TripTimeBank.project(this.trip)?.officialCorrection?[{operation:'official-percent-clear'}]:[];this.changed();}
        payload(){
            const changes=[];
            for(const before of this.original.filter(e=>['trip.started','trip.stopped','interval.started'].includes(e.event))){const key=before.value?.intervalKey,after=this.events.find(e=>e.id===before.id);if(!after){if(key)changes.push({operation:'delete-entry',entry:{eventId:before.id,intervalKey:key}});continue;}const priorEnd=this.original.find(e=>e.event==='interval.ended'&&e.value?.intervalKey===key),afterEnd=key?this.end(after):null;
                if(after.timestamp!==before.timestamp||JSON.stringify(after.value)!==JSON.stringify(before.value)||afterEnd?.timestamp!==priorEnd?.timestamp)changes.push({operation:'entry',entry:{eventId:after.id,intervalKey:key,start:iso(after.timestamp),end:afterEnd?iso(afterEnd.timestamp):undefined,type:after.value.type,breakType:after.value.attributes?.breakType,length:after.value.length,approvedTime:after.value.approvedTime,approvalState:after.value.approvalState}});
            }
            for(const event of this.intervals().filter(e=>e._draft)){const end=this.end(event);changes.push({operation:'add-entry',entry:{start:iso(event.timestamp),end:iso(end?.timestamp),type:event.value.type,breakType:event.value.attributes?.breakType,length:event.value.length,approvedTime:event.value.approvedTime,approvalState:event.value.approvalState}});}
            const settingsChanged=JSON.stringify(this.settings)!==JSON.stringify(this.originalSettings);
            return {operation:'editor',revision:this.revision,changes,official:this.official,...(settingsChanged?{settings:this.settings}:{})};
        }
        async preview(){
            if(!this.dialog.open||this.hasInvalid())return;
            const generation=++this.generation;try{const result=await this.options.request(this.trip.id,{...this.payload(),operation:'editor-preview',includePendingDownTime:this.options.showPendingDownTime?.()??true});if(generation!==this.generation||!this.dialog.open)return;const previousStart=this.previewTrip.officialCorrection?.startTime;this.previewTrip=result.trip;this.drawSummary();if(previousStart!==this.previewTrip.officialCorrection?.startTime)this.render();}catch(error){if(generation===this.generation&&this.dialog.open)this.error(error);}
        }
        async save(){
            if(this.saving||this.showValidation())return;this.saving=true;this.saveButton.disabled=true;this.saveButton.textContent='Saving�';this.generation++;clearTimeout(this.previewTimer);
            try{await this.options.request(this.trip.id,this.payload());this.dirty=false;this.dialog.close();await this.options.refresh();}catch(error){this.error(error);}finally{this.saving=false;if(this.dialog.open){this.saveButton.disabled=false;this.saveButton.textContent='Save Changes';}}
        }
    }
    globalThis.TripEditor=TripEditor;
})();
