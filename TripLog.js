(() => {
    const node = (tag, text, className) => {const el=document.createElement(tag);if(text!==undefined) el.textContent=text;if(className) el.className=className;return el;};
    const duration = ms => {const s=Math.floor(Math.max(0,Number(ms)||0)/1000);return `${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
    const milliseconds = value => String(value||'').split(':').reduce((total,part)=>total*60+Number(part),0)*1000;
    const iso = value => /(?:Z|[+-]\d\d:\d\d)$/.test(value)?value:String(value).replace(' ','T')+'Z';
    const percent = trips => {const standard=trips.reduce((a,t)=>a+t.standardTimeMilliseconds,0),actual=trips.reduce((a,t)=>a+t.actualTimeMilliseconds,0);if(actual<=0)return '—';const value=standard/actual*100;return `${(trips.some(t=>t.running)&&value>=100?100:value).toFixed(1)}%`;};
    const total = (trips,key) => trips.reduce((a,t)=>a+(Number(t[key])||0),0);
    const uncertainIcon = () => {
        const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
        icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('class','calculation-uncertain-icon');
        icon.setAttribute('role','img');icon.setAttribute('aria-label','May be incomplete until synced');
        icon.setAttribute('title','May be incomplete until synced');
        icon.innerHTML='<path d="M6 17H5a4 4 0 0 1-.5-8 6 6 0 0 1 11-3 5 5 0 0 1 3.5 9"/><path d="M10 13a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2"/><circle cx="12.5" cy="20" r=".6" fill="currentColor" stroke="none"/>';
        return icon;
    };
    class TripLog {
        constructor(root,options) {this.root=root;this.options=options;this.expanded=new Map();this.editing=new Set();this.editor=null;this.settingsVisible=false;}
        setSettingsVisible(visible) {this.settingsVisible=Boolean(visible);const box=this.root.querySelector('.trip-log-settings');if(box){box.classList.toggle('is-open',this.settingsVisible);box.firstElementChild.inert=!this.settingsVisible;box.setAttribute('aria-hidden',String(!this.settingsVisible));}}
        render(data,calendar) {
            this.calendar=calendar;
            this.activeSweepDelay=`-${Math.round(performance.now()%4200)}ms`;
            this.incomplete=Boolean(data.incomplete);this.offline=Boolean(data.offline);this.loginRequired=Boolean(data.loginRequired);
            const trips=data.loginRequired?[]:[...data.trips];const live=data.loginRequired?null:this.options.liveTrip?.();
            if(live && Date.parse(live.startTime)>=Date.parse(calendar.startTime) && Date.parse(live.startTime)<Date.parse(calendar.endTime)) {
                const index=trips.findIndex(t=>String(t.id)===String(live.id));
                const filter=this.options.filter();
                if(filter==='all'||(filter==='productive'&&!live.nonProduction)||(filter==='non-productive'&&live.nonProduction)) {
                    if(index>=0) trips[index]={...trips[index],...live};else trips.push(live);
                } else if(index>=0) trips.splice(index,1);
            }
            trips.sort((a,b)=>Date.parse(iso(b.startTime))-Date.parse(iso(a.startTime))||b.id-a.id);
            this.trips=trips;const fragment=document.createDocumentFragment();
            if(!trips.length)this.settingsVisible=true;
            let settings=this.root.querySelector('.trip-log-settings');
            const reuseSettings=Boolean(settings);
            if(!settings){settings=node('section',undefined,'trip-log-settings');settings.id='tripLogSettings';
                const contents=node('div',undefined,'trip-log-settings-content');contents.append(this.controls(calendar),node('hr',undefined,'trip-log-settings-divider'));settings.append(contents);
            } else {
                const selects=settings.querySelectorAll('select');selects[0].value=this.options.filter();selects[1].value=this.options.range();
                const dates=window.CalendarRange.dates(calendar),inputs=settings.querySelectorAll('input[type=date]');
                inputs.forEach((input,i)=>{input.value=dates[i===0?'start':'end'];input.disabled=this.options.range()!=='custom';});
            }
            if(!reuseSettings)fragment.append(settings);
            this.root.classList.toggle('trip-log-empty',trips.length===0);
            if(trips.length) {
            const overview=node('section',undefined,'trip-log-overview');const emphasis=node('div',undefined,'trip-log-emphasis');
            emphasis.append(node('strong',`${trips.length} ${trips.length===1?'Trip':'Trips'}`),node('strong',percent(trips),'trip-log-actual'));
            if(this.incomplete)emphasis.lastElementChild.append(uncertainIcon());
            overview.append(emphasis,node('div',`Standard ${duration(total(trips,'standardTimeMilliseconds'))} · Actual ${duration(total(trips,'actualTimeMilliseconds'))}`,'trip-log-times'));fragment.append(overview);
            const days=(Date.parse(calendar.endTime)-Date.parse(calendar.startTime))/86400000;
            const levels=days>35?['month','week','day']:days>7?['week','day']:days>1?['day']:[];
            fragment.append(this.groups(trips,levels,calendar));
            } else {
                const message=node('p',data.loginRequired?'Log in to view saved trips.':data.offline?'No local trips in this range. Connect to load saved trips.':'No trips in this range.','trip-log-empty-message');
                message.setAttribute('role','status');fragment.append(message);
            }
            if(reuseSettings){for(const child of [...this.root.children])if(child!==settings)child.remove();this.root.append(fragment);}
            else this.root.replaceChildren(fragment);
            this.setSettingsVisible(this.settingsVisible);
        }
        controls(calendar) {
            const box=node('section',undefined,'trip-log-controls');
            const selectRow=(label,choices,value,handler)=>{const row=node('label');row.append(node('span',label));const select=node('select');for(const [v,text] of choices){const option=node('option',text);option.value=v;select.append(option);}select.value=value;select.addEventListener('change',()=>handler(select.value));row.append(select);box.append(row);};
            selectRow('Trip Filter',[['all','All Trips'],['productive','Productive'],['non-productive','Non-productive']],this.options.filter(),this.options.onFilter);
            selectRow('Trip Log Range',[['day','Day'],['week','Week'],['pay-period','Pay Period'],['month','Month'],['year','Year'],['custom','Custom']],this.options.range(),this.options.onRange);
            const dates=node('div',undefined,'trip-log-date-controls');const values=window.CalendarRange.dates(calendar);
            for(const [label,key] of [['Start:','start'],['End:','end']]) {
                const input=node('input');input.type='date';input.value=values[key];input.disabled=this.options.range()!=='custom';input.setAttribute('aria-label',label==='Start:'?'Trip Log start date':'Trip Log end date');
                input.addEventListener('change',()=>this.options.onDate(key,input.value));dates.append(node('span',label),input);
            }
            box.append(dates);return box;
        }
        civil(trip) {
            const parts=new Intl.DateTimeFormat('en-CA',{timeZone:this.calendar.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso(trip.startTime)));
            const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));let day=`${p.year}-${p.month}-${p.day}`;
            if(`${p.hour}:${p.minute}:${p.second}`<(this.calendar.rules?.cutoffTime||'00:00:00')) {const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);day=d.toISOString().slice(0,10);}
            return day;
        }
        key(trip,level) {
            const day=this.civil(trip);if(level==='month') return day.slice(0,7);if(level==='day') return day;
            const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()-(this.calendar.rules?.weekStartDay??6)+7)%7);return d.toISOString().slice(0,10);
        }
        label(key,level) {
            if(level==='month') return new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(key+'-01T12:00:00Z'));
            if(level==='day') return new Intl.DateTimeFormat(undefined,{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(key+'T12:00:00Z'));
            const d=new Date(key+'T12:00:00Z'),end=new Date(d);end.setUTCDate(d.getUTCDate()+6);
            const fmt=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',timeZone:'UTC'});
            return `Week · ${fmt.format(d)}–${fmt.format(end)}`;
        }
        groups(trips,levels,calendar) {
            const fragment=document.createDocumentFragment();if(!levels.length){for(const trip of trips)fragment.append(this.trip(trip));return fragment;}
            const [level,...rest]=levels;const groups=new Map();for(const trip of trips){const key=this.key(trip,level);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(trip);}
            for(const [key,group] of groups){const id=level+key,details=node('details',undefined,'trip-log-group'),active=group.find(trip=>trip.running);details.classList.toggle('has-active-trip',Boolean(active));if(active){details.dataset.activeState=active.activeState||'normal';details.style.setProperty('--trip-log-active-sweep-delay',this.activeSweepDelay);}details.open=this.expanded.get(id)??true;details.addEventListener('toggle',()=>this.expanded.set(id,details.open));
                const summary=node('summary');const heading=node('div',undefined,'trip-log-group-heading');heading.append(node('strong',this.label(key,level)),node('span',`${group.length} trips · ${percent(group)}`,'trip-log-actual'));
                if(this.incomplete)heading.lastElementChild.append(uncertainIcon());
                summary.append(heading,node('div',`Standard ${duration(total(group,'standardTimeMilliseconds'))} · Actual ${duration(total(group,'actualTimeMilliseconds'))}`,'trip-log-times'));details.append(summary,this.groups(group,rest,calendar));fragment.append(details);}
            return fragment;
        }
        trip(trip) {
            const details=node('details',undefined,'trip-log-trip'),id='trip'+trip.id;details.classList.toggle('is-active-trip',Boolean(trip.running));if(trip.running){details.dataset.activeState=trip.activeState||'normal';details.style.setProperty('--trip-log-active-sweep-delay',this.activeSweepDelay);}details.open=this.expanded.get(id)??false;details.addEventListener('toggle',()=>this.expanded.set(id,details.open));
            const summary=node('summary');const fmt=new Intl.DateTimeFormat(undefined,{timeZone:this.calendar.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
            summary.append(node('strong',`${trip.running?'● ':''}${fmt.format(new Date(iso(trip.startTime)))}`),node('span',duration(trip.standardTimeMilliseconds)),node('span',duration(trip.actualTimeMilliseconds)),node('strong',percent([trip]),'trip-log-actual'));
            if(trip.buffered)summary.lastElementChild.append(uncertainIcon());
            const menu=node('div',undefined,'trip-log-menu');const toggle=node('button','⋮');toggle.type='button';toggle.setAttribute('aria-label',`Trip ${trip.id} actions`);toggle.setAttribute('aria-expanded','false');
            const actions=node('div',undefined,'trip-log-menu-actions');actions.hidden=true;
            for(const [label,action] of [['Edit trip settings',()=>this.openSettings(trip)],['Edit entries',()=>{this.editing.add(trip.id);this.render({trips:this.trips},this.calendar);}],['Delete trip',()=>this.deleteTrip(trip)]]) {
                const button=node('button',label);button.type='button';if(label==='Delete trip')button.className='danger';button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();actions.hidden=true;toggle.setAttribute('aria-expanded','false');Promise.resolve(action()).catch(error=>this.error(error));});actions.append(button);
            }
            toggle.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();actions.hidden=!actions.hidden;toggle.setAttribute('aria-expanded',String(!actions.hidden));});menu.append(toggle,actions);if(!this.offline||trip.buffered)summary.append(menu);details.append(summary);
            const entries=node('div',undefined,'trip-log-entries');const header=node('div',undefined,'trip-log-entry-heading');header.append(node('strong',this.editing.has(trip.id)?'Editing entries':'Trip entries'));
            if(this.editing.has(trip.id)){const done=node('button','Done');done.type='button';done.addEventListener('click',()=>{this.editing.delete(trip.id);this.render({trips:this.trips},this.calendar);});header.append(done);entries.append(header,node('p','Select an entry to edit or remove it.'));}else entries.append(header);
            const events=trip.events||[];const deleted=new Set(events.filter(e=>e.event==='interval.deleted').map(e=>e.value.intervalKey));
            const intervalEntries=events.filter(e=>e.event==='interval.started'&&!deleted.has(e.value.intervalKey));
            const visible=events.filter(e=>['trip.started','trip.stopped'].includes(e.event)).concat(intervalEntries).sort((a,b)=>Date.parse(iso(a.timestamp))-Date.parse(iso(b.timestamp)));
            for(const event of visible){const ended=event.event==='interval.started'?events.find(e=>e.event==='interval.ended'&&e.value.intervalKey===event.value.intervalKey):null;
                const label=event.event==='trip.started'?'Trip started':event.event==='trip.stopped'?'Trip ended':`${event.value.type} · ${ended?duration(Date.parse(iso(ended.timestamp))-Date.parse(iso(event.timestamp))):'Still running'}`;
                const row=node(this.editing.has(trip.id)?'button':'div',undefined,'trip-log-entry');row.append(node('span',fmt.format(new Date(iso(event.timestamp)))),node('span',label));if(row.tagName==='BUTTON'){row.type='button';row.addEventListener('click',()=>this.openEntry(trip,event,ended).catch(e=>this.error(e)));}entries.append(row);
            }
            if(this.editing.has(trip.id)){const add=node('button','+ Add entry','trip-log-add');add.type='button';add.addEventListener('click',()=>this.openEntry(trip).catch(e=>this.error(e)));entries.append(add);}
            details.append(entries);return details;
        }
        error(error) {if(this.editor){const msg=this.editor.querySelector('[role="alert"]');msg.textContent=error.message||String(error);}else {const msg=node('p',error.message||String(error),'trip-log-error');msg.setAttribute('role','alert');this.root.prepend(msg);}}
        modal(title) {
            this.editor?.remove();const dialog=node('dialog',undefined,'app-dialog trip-log-editor');const form=node('form');const heading=node('header',undefined,'dialog-header');heading.append(node('h2',title));const close=node('button','×');close.type='button';close.setAttribute('aria-label','Close editor');close.addEventListener('click',()=>dialog.close());heading.append(close);form.append(heading);dialog.append(form);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();if(this.editor===dialog)this.editor=null;});this.editor=dialog;dialog.showModal();return {dialog,form};
        }
        timeField(form,label,value,mode,onChange,base) {
            const button=node('button',undefined,'trip-log-edit-field');button.type='button';const text=node('span',label),display=node('strong');const draw=()=>display.textContent=mode==='absolute'?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'medium'}).format(new Date(value)):value;draw();button.append(text,display);
            button.addEventListener('click',async()=>{try{await this.options.numberPad({mode,source:label,initialValue:mode==='absolute'?this.clockValue(value,base):value,tripDefaults:{creationDate:base||this.date(value)},title:label,
                onConfirm:async next=>{value=next;onChange(next);draw();}});}catch(e){this.error(e);}});button.setValue=next=>{value=next;draw();};form.append(button);return button;
        }
        date(value) {const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
        clockValue(value,base) {const d=new Date(value),anchor=new Date((base||this.date(value))+'T00:00:00');return duration(d-anchor);}
        footer(form,save,remove) {
            const error=node('p',undefined,'trip-log-error');error.setAttribute('role','alert');form.append(error);const actions=node('div',undefined,'dialog-actions two-actions');const cancel=node('button','Cancel');cancel.type='button';cancel.addEventListener('click',()=>this.editor?.close());const submit=node('button','Save');submit.type='submit';submit.className='primary-action';actions.append(cancel,submit);form.append(actions);
            if(remove){const del=node('button','Remove entry','danger');del.type='button';del.addEventListener('click',async()=>{if(!confirm('Remove this entry?'))return;try{del.disabled=true;submit.disabled=true;await remove();this.editor?.close();await this.options.refresh();}catch(e){this.error(e);}finally{del.disabled=false;submit.disabled=false;}});form.append(del);}
            form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;try{await save();this.editor?.close();await this.options.refresh();}catch(e){this.error(e);}finally{submit.disabled=false;}});
        }
        async openEntry(trip,event,ended) {
            const data=await this.options.request(trip.id);const adding=!event;
            const current=event?data.events.find(e=>Number(e.id)===Number(event.id)):null;
            if(event&&!current)throw new Error('Entry changed. Reopen the trip.');
            event=current||event;
            ended=event?.event==='interval.started'?data.events.find(e=>e.event==='interval.ended'&&e.value.intervalKey===event.value.intervalKey):null;
            const start=adding?iso(trip.startTime):iso(event.timestamp),entry={eventId:event?.id,intervalKey:event?.value.intervalKey,start,end:ended?iso(ended.timestamp):adding?new Date(Math.min(Date.parse(iso(trip.endTime)),Date.parse(start)+60000)).toISOString():undefined,type:event?.value.type||'break',length:event?.value.length??(adding?'0:01:00':undefined)};
            const {form}=this.modal(adding?'Add entry':'Edit entry');const base=this.date(data.settings.creationAnchor||start);
            let endField,durationField;
            const refreshDuration=()=>{if(entry.end)durationField?.setValue(duration(Date.parse(entry.end)-Date.parse(entry.start)));};
            this.timeField(form,'Start time',entry.start,'absolute',v=>{entry.start=v;refreshDuration();},base);
            if(adding||event.event==='interval.started'){
                const type=node('label','Type');const select=node('select');for(const t of ['break','down','latency','trip','overtime','earlystart']){const option=node('option',t);option.value=t;select.append(option);}select.value=entry.type;select.addEventListener('change',()=>entry.type=select.value);type.append(select);form.append(type);
                if(entry.end)endField=this.timeField(form,'End time',entry.end,'absolute',v=>{entry.end=v;refreshDuration();},base);else form.append(node('p','Still running'));
                durationField=this.timeField(form,'Duration',entry.end?duration(Date.parse(entry.end)-Date.parse(entry.start)):entry.length||duration(Date.now()-Date.parse(entry.start)),'duration',v=>{entry.length=duration(milliseconds(v));if(entry.end){entry.end=new Date(Date.parse(entry.start)+milliseconds(v)).toISOString();endField.setValue(entry.end);}});
            }
            this.footer(form,()=>this.options.request(trip.id,{operation:adding?'add-entry':'entry',revision:data.revision,entry}),event?.event==='interval.started'?()=>this.options.request(trip.id,{operation:'delete-entry',revision:data.revision,entry}):null);
        }
        async openSettings(trip) {
            const data=await this.options.request(trip.id),settings={...data.settings};const {form}=this.modal('Edit Trip Settings');
            const original=new Date(settings.creationAnchor||iso(trip.startTime));let base=this.date(original);
            this.timeField(form,'Standard time',settings.standardTime,'duration',v=>settings.standardTime=duration(milliseconds(v)));
            for(const [label,field] of [['Scheduled start','scheduledStart'],['Actual start','startTime'],['Creation time','creationTime']]) {
                const value=new Date(original.getTime()+milliseconds(settings[field])).toISOString();
                this.timeField(form,label,value,'absolute',v=>{if(field==='creationTime'){base=this.date(v);settings.creationAnchor=new Date(base+'T00:00:00').toISOString();}settings[field]=this.clockValue(v,base);},base);
            }
            const productive=node('label');const check=node('input');check.type='checkbox';check.checked=!settings.nonProduction;check.addEventListener('change',()=>settings.nonProduction=!check.checked);productive.append(check,document.createTextNode(' Productive'));form.append(productive);
            this.footer(form,()=>this.options.request(trip.id,{operation:'settings',revision:data.revision,settings}));
        }
        async deleteTrip(trip) {if(!confirm(`Delete ${trip.running?'the running trip':'this trip'} and all its entries?`))return;const data=await this.options.request(trip.id);await this.options.request(trip.id,{operation:'delete-trip',revision:data.revision});await this.options.refresh();}
    }
    TripLog.duration=duration;TripLog.percent=percent;TripLog.uncertainIcon=uncertainIcon;window.TripLog=TripLog;
})();
