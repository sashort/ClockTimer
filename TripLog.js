(() => {
    const node = (tag, text, className) => {const el=document.createElement(tag);if(text!==undefined) el.textContent=text;if(className) el.className=className;return el;};
    const clone = value => JSON.parse(JSON.stringify(value));
    const duration = ms => {const s=Math.floor(Math.max(0,Number(ms)||0)/1000);return `${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
    const milliseconds = value => String(value||'').split(':').reduce((total,part)=>total*60+Number(part),0)*1000;
    const iso = value => /(?:Z|[+-]\d\d:\d\d)$/.test(value)?value:String(value).replace(' ','T')+'Z';
    const counted = trip => {
        const wall=Number(trip.actualTimeMilliseconds)||0,stored=Number.isFinite(Number(trip.countedTimeMilliseconds))?Number(trip.countedTimeMilliseconds):wall;
        if(trip.running||!Array.isArray(trip.events)||!Number.isFinite(wall)||wall<=0)return stored;
        const deleted=new Set(trip.events.filter(event=>event.event==='interval.deleted').map(event=>event.value?.intervalKey));
        const planned=trip.events.filter(event=>event.event==='interval.started'&&!deleted.has(event.value?.intervalKey)&&['break','lunch'].includes(String(event.value?.type||'').toLowerCase()))
            .reduce((sum,event)=>sum+milliseconds(event.value?.length)+milliseconds(event.value?.startBuffer)+milliseconds(event.value?.endBuffer),0);
        if(planned<=0)return stored;
        const observedExcluded=Math.max(0,wall-stored);
        return Math.max(0,stored-Math.max(0,planned-observedExcluded));
    };
    const percent = (trips,parent=false) => {const included=parent?trips.filter(t=>!t.running||t.includeInParentPercent):trips;const standard=included.reduce((a,t)=>a+t.standardTimeMilliseconds,0),actual=included.reduce((a,t)=>a+counted(t),0);return actual>0?`${(standard/actual*100).toFixed(1)}%`:'—';};
    const parentTrips = trips => trips.filter(trip=>!trip.running||trip.includeInParentPercent);
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
        constructor(root,options) {this.root=root;this.options=options;this.expanded=new Map();this.editing=new Set();this.entrySessions=new Map();this.addBefore=new Map();this.newEntries=new Map();this.deleteVisible=new Set();this.editor=null;this.settingsVisible=false;this.outsideEntryPointer=event=>this.handleOutsideEntryPointer(event);document.addEventListener('pointerdown',this.outsideEntryPointer,true);}
        setSettingsVisible(visible) {this.settingsVisible=Boolean(visible);const box=this.root.querySelector('.trip-log-settings');if(box){box.classList.toggle('is-open',this.settingsVisible);box.firstElementChild.inert=!this.settingsVisible;box.setAttribute('aria-hidden',String(!this.settingsVisible));const sync=()=>this.root.style.setProperty('--trip-log-settings-height',`${this.settingsVisible?box.getBoundingClientRect().height:0}px`);requestAnimationFrame(sync);box.addEventListener('transitionend',sync,{once:true});}}
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
                const includeCurrent=settings.querySelector('input[data-include-current]');if(includeCurrent)includeCurrent.checked=Boolean(this.options.includeCurrent?.());
            }
            if(!reuseSettings)fragment.append(settings);
            this.root.classList.toggle('trip-log-empty',trips.length===0);
            if(trips.length) {
            const overview=node('section',undefined,'trip-log-overview');const emphasis=node('div',undefined,'trip-log-emphasis');
            emphasis.append(node('strong',`${trips.length} ${trips.length===1?'Trip':'Trips'}`),node('strong',percent(trips,true),'trip-log-actual'));
            if(this.incomplete)emphasis.lastElementChild.append(uncertainIcon());
            const overviewTrips=parentTrips(trips);overview.append(emphasis,node('div',`Standard ${duration(total(overviewTrips,'standardTimeMilliseconds'))} · Actual ${duration(overviewTrips.reduce((sum,trip)=>sum+counted(trip),0))}`,'trip-log-times'));fragment.append(overview);
            const columns=node('div',undefined,'trip-log-column-header');columns.setAttribute('role','row');for(const label of ['Time','Standard','Actual','Percent','']){const cell=node('span',label);cell.setAttribute('role','columnheader');columns.append(cell);}fragment.append(columns);
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
            box.append(dates);const include=node('label',undefined,'trip-log-include-current');const check=node('input');check.type='checkbox';check.dataset.includeCurrent='true';check.checked=Boolean(this.options.includeCurrent?.());check.addEventListener('change',()=>this.options.onIncludeCurrent?.(check.checked));include.append(node('span','Include current trip'),check);box.append(include);return box;
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
                const summary=node('summary');const heading=node('div',undefined,'trip-log-group-heading');heading.append(node('strong',this.label(key,level)),node('span',`${group.length} trips · ${percent(group,true)}`,'trip-log-actual'));
                if(this.incomplete)heading.lastElementChild.append(uncertainIcon());
                const aggregateTrips=parentTrips(group);summary.append(heading,node('div',`Standard ${duration(total(aggregateTrips,'standardTimeMilliseconds'))} · Actual ${duration(aggregateTrips.reduce((sum,trip)=>sum+counted(trip),0))}`,'trip-log-times'));details.append(summary,this.groups(group,rest,calendar));fragment.append(details);}
            return fragment;
        }
        trip(trip) {
            const details=node('details',undefined,'trip-log-trip'),id='trip'+trip.id;details.dataset.tripId=String(trip.id);details.classList.toggle('is-active-trip',Boolean(trip.running));if(trip.running){details.dataset.activeState=trip.activeState||'normal';details.style.setProperty('--trip-log-active-sweep-delay',this.activeSweepDelay);}details.open=this.expanded.get(id)??false;details.addEventListener('toggle',()=>this.expanded.set(id,details.open));
            const summary=node('summary');const fmt=new Intl.DateTimeFormat(undefined,{timeZone:this.calendar.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
            summary.append(node('strong',`${trip.running?'● ':''}${fmt.format(new Date(iso(trip.startTime)))}`),node('span',duration(trip.standardTimeMilliseconds)),node('span',duration(counted(trip))),node('strong',percent([trip]),'trip-log-actual'));
            if(trip.buffered)summary.lastElementChild.append(uncertainIcon());
            const menu=node('div',undefined,'trip-log-menu');const toggle=node('button','⋮');toggle.type='button';toggle.setAttribute('aria-label',`Trip ${trip.id} actions`);toggle.setAttribute('aria-expanded','false');
            const actions=node('div',undefined,'trip-log-menu-actions');actions.hidden=true;
            for(const [label,action] of [['Edit trip settings',()=>this.openSettings(trip)],['Edit entries',()=>this.beginEntryEdit(trip)],['Delete trip',()=>this.deleteTrip(trip)]]) {
                const button=node('button',label);button.type='button';if(label==='Delete trip')button.className='danger';button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();actions.hidden=true;toggle.setAttribute('aria-expanded','false');Promise.resolve(action()).catch(error=>this.error(error));});actions.append(button);
            }
            toggle.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();actions.hidden=!actions.hidden;toggle.setAttribute('aria-expanded',String(!actions.hidden));});menu.append(toggle,actions);if(!trip.running&&(!this.offline||trip.buffered))summary.append(menu);details.append(summary);
            const entries=node('div',undefined,'trip-log-entries');const header=node('div',undefined,'trip-log-entry-heading');header.append(node('strong',this.editing.has(trip.id)?'Editing entries':'Trip entries'));
            if(this.editing.has(trip.id)){const done=node('button','Done');done.type='button';done.addEventListener('click',()=>this.finishEntryEdit(trip,done));header.append(done);entries.append(header,node('p','Tap a time, interval type, or approved time to edit it. Long-press an interval action to show its remove button.'));}else entries.append(header);
            const events=trip.events||[];const deleted=new Set(events.filter(e=>e.event==='interval.deleted').map(e=>e.value.intervalKey));
            const intervalEntries=events.filter(e=>['interval.started','interval.ended'].includes(e.event)&&!deleted.has(e.value.intervalKey));
            const visible=events.filter(e=>['trip.started','trip.stopped'].includes(e.event)).concat(intervalEntries).sort((a,b)=>Date.parse(iso(a.timestamp))-Date.parse(iso(b.timestamp)));
            const activeEntry=trip.running?(visible.find(event=>event.event==='interval.started'&&!events.some(candidate=>candidate.event==='interval.ended'&&candidate.value.intervalKey===event.value.intervalKey))||visible.find(event=>event.event==='trip.started')):null;
            const tripKey=String(trip.id),draft=this.newEntries.get(tripKey),insertBefore=this.addBefore.get(tripKey);let addPlaced=false;
            const addButton=()=>{const add=node('button','+ Add Entry','trip-log-add');add.type='button';add.addEventListener('click',()=>{this.newEntries.set(tripKey,{beforeEventId:this.addBefore.get(tripKey)});this.rerender();});return add;};
            for(const event of visible){const eventKey=String(event.id),started=event.event==='interval.ended'?events.find(e=>e.event==='interval.started'&&e.value.intervalKey===event.value.intervalKey):event,ended=started?.event==='interval.started'?events.find(e=>e.event==='interval.ended'&&e.value.intervalKey===started.value.intervalKey):null;
                if(this.editing.has(trip.id)&&insertBefore===eventKey){if(draft)entries.append(this.newEntryRows(trip,draft));else entries.append(addButton());addPlaced=true;}
                const label=this.entryLabel(event,started,ended,events),separateAdjustment=event.event==='interval.ended'&&String(started?.value?.type||'').toLowerCase()==='down',parts=separateAdjustment?label.split(' · '):[label],displayLabel=parts[0],adjustment=parts.slice(1).join(' · ');
                const row=node('div',undefined,'trip-log-entry');if(event.value?.intervalKey)row.dataset.intervalKey=event.value.intervalKey;if(event===activeEntry){row.classList.add('is-active-entry');row.dataset.activeState=trip.activeState||'trip';row.style.setProperty('--trip-log-active-sweep-delay',this.activeSweepDelay);}
                if(this.editing.has(trip.id)){
                    let suppressClick=false;const time=node('button',event.timestamp?fmt.format(new Date(iso(event.timestamp))):'---','trip-log-entry-time');time.type='button';time.addEventListener('click',()=>{if(suppressClick){suppressClick=false;return;}this.editEntryTime(trip,event,event.event==='interval.started'?ended:null,entries.querySelector('.trip-log-add')).catch(e=>this.error(e));});
                    const editableType=event.event==='interval.started'&&['break','lunch','down'].includes(String(event.value?.type||'').toLowerCase());const name=node(editableType?'button':'span',displayLabel,'trip-log-entry-name');if(editableType){name.type='button';name.addEventListener('click',()=>{if(suppressClick){suppressClick=false;return;}this.editEntryName(trip,event,ended,name,entries.querySelector('.trip-log-add')).catch(e=>this.error(e));});}row.append(time,name);
                    if(event.event==='interval.started'&&String(event.value?.type||'').toLowerCase()==='down'){const approved=node('button',`Approved: ${this.approvedTime(event,ended,events)||'---'}`,'trip-log-entry-approved');approved.type='button';approved.addEventListener('click',()=>this.editApprovedTime(trip,event,ended,entries.querySelector('.trip-log-add')).catch(error=>this.error(error)));row.append(approved);row.classList.add('has-approved-time');}
                    if(event.event==='interval.started'&&String(event.value?.type||'').toLowerCase()==='down'&&this.options.openDownDetails){const info=node('button','📷','trip-log-down-detail-edit');info.type='button';info.setAttribute('aria-label','Edit Down photo and notes');info.addEventListener('click',()=>this.options.openDownDetails(trip,event.value.intervalKey,true));row.append(info);row.classList.add('has-down-detail-edit');}
                    if(adjustment){row.append(node('span',adjustment,'trip-log-entry-approved-value'));row.classList.add('has-approved-time');}
                    const intervalAction=['interval.started','interval.ended'].includes(event.event),canInsertBefore=event.event!=='trip.started',deleteKey=`${tripKey}:${event.value?.intervalKey}`;
                    if(intervalAction&&this.deleteVisible.has(deleteKey)){const remove=node('button','×','trip-log-entry-remove');remove.type='button';remove.setAttribute('aria-label',`Remove ${String(started?.value?.type||'Interval')}`);remove.addEventListener('click',()=>this.deleteEntry(trip,started).catch(error=>this.error(error)));row.classList.add('has-entry-remove');row.append(remove);}
                    if(intervalAction||canInsertBefore){let gesture,timer;row.addEventListener('pointerdown',pointer=>{if(pointer.target.closest('button,select'))return;pointer.preventDefault();gesture={x:pointer.clientX,y:pointer.clientY};timer=setTimeout(()=>{timer=undefined;suppressClick=true;if(canInsertBefore){this.addBefore.set(tripKey,eventKey);this.newEntries.delete(tripKey);}if(intervalAction)this.deleteVisible.add(deleteKey);this.rerender();},550);});row.addEventListener('pointermove',pointer=>{if(gesture&&(Math.abs(pointer.clientX-gesture.x)>10||Math.abs(pointer.clientY-gesture.y)>10)){clearTimeout(timer);timer=undefined;}});row.addEventListener('pointerup',()=>{clearTimeout(timer);timer=undefined;gesture=undefined;});row.addEventListener('pointercancel',()=>{clearTimeout(timer);timer=undefined;gesture=undefined;});row.addEventListener('contextmenu',pointer=>pointer.preventDefault());}
                }else {row.append(node('span',fmt.format(new Date(iso(event.timestamp)))),node('span',displayLabel));if(event.event==='interval.started'&&String(event.value?.type||'').toLowerCase()==='down'){row.append(node('span',`Approved: ${this.approvedTime(event,ended,events)||'---'}`,'trip-log-entry-approved-value'));row.classList.add('has-approved-time');}if(adjustment){row.append(node('span',adjustment,'trip-log-entry-approved-value'));row.classList.add('has-approved-time');}}entries.append(row);
            }
            if(this.editing.has(trip.id)&&!addPlaced){if(draft)entries.append(this.newEntryRows(trip,draft));else entries.append(addButton());}
            if(!this.editing.has(trip.id)&&this.options.openDownDetails){const downs=events.filter(event=>event.event==='interval.started'&&String(event.value?.type||'').toLowerCase()==='down'&&!deleted.has(event.value.intervalKey));if(downs.length){const bar=node('div',undefined,'trip-log-down-details');for(const down of downs){const button=node('button','', 'trip-log-down-detail-button');button.type='button';button.dataset.content='none';button.setAttribute('aria-label',`Down details, ${fmt.format(new Date(iso(down.timestamp)))}`);let timer,long=false;button.addEventListener('pointerdown',event=>{event.preventDefault();long=false;timer=setTimeout(()=>{long=true;for(const row of entries.querySelectorAll('.trip-log-entry.is-down-highlighted'))row.classList.remove('is-down-highlighted');for(const row of entries.querySelectorAll('.trip-log-entry'))if(row.dataset.intervalKey===down.value.intervalKey)row.classList.add('is-down-highlighted');setTimeout(()=>{for(const row of entries.querySelectorAll('.trip-log-entry.is-down-highlighted'))row.classList.remove('is-down-highlighted');},2200);},550);});button.addEventListener('pointerup',()=>{clearTimeout(timer);if(!long)this.options.openDownDetails(trip,down.value.intervalKey,false);});button.addEventListener('pointercancel',()=>clearTimeout(timer));bar.append(button);Promise.resolve(this.options.downDetailsInfo?.(trip.id,down.value.intervalKey)).then(info=>{if(button.isConnected)button.dataset.content=info?.hasImage&&info?.notes?'both':info?.hasImage?'image':info?.notes?'notes':'none';}).catch(()=>{});}entries.append(bar);}}
            details.append(entries);return details;
        }
        entryLabel(event,started,ended,events=[]) {
            if(event.event==='trip.started')return 'Trip Started';if(event.event==='trip.stopped')return 'Trip Ended';
            const type=String(started?.value?.type||'Interval').toLowerCase(),title=type.charAt(0).toUpperCase()+type.slice(1);
            if(event.event==='interval.started')return `${title} Started`;
            const planned=['break','lunch'].includes(type)?milliseconds(started.value?.length)+milliseconds(started.value?.startBuffer)+milliseconds(started.value?.endBuffer):0;
            const actual=ended&&started?.timestamp?Date.parse(iso(ended.timestamp))-Date.parse(iso(started.timestamp)):NaN;
            const adjustment=value=>{const seconds=Math.floor(Math.abs(value)/1000),hours=Math.floor(seconds/3600);return `${hours?`${hours}:`:''}${String(Math.floor(seconds/60)%60).padStart(hours?2:1,'0')}:${String(seconds%60).padStart(2,'0')}`;};
            if(type==='down'&&Number.isFinite(actual)){const approved=milliseconds(this.approvedTime(started,ended,events)),difference=approved-actual;if(difference!==0)return `${title} Ended · ${adjustment(difference)} Approval ${difference>0?'Surplus':'Deficit'}`;}
            if(planned>0&&Number.isFinite(actual)&&actual!==planned){const value=adjustment(actual-planned);return actual<planned?`${title} Ended Early · ${value} Gained`:`${title} Ended Late · ${value} Lost`;}
            return `${title} Ended`;
        }
        approvedTime(started,ended,events=[]) {if(String(started?.value?.type||'').toLowerCase()!=='down')return '';const approval=[...events].reverse().find(event=>event.event==='interval.approval-changed'&&event.value?.intervalKey===started.value?.intervalKey);if(approval?.value?.state==='approved'&&approval.value.value)return approval.value.value;if(started.value.approvedTime)return started.value.approvedTime;if(!started.timestamp||!ended?.timestamp)return '';return duration(Date.parse(iso(ended.timestamp))-Date.parse(iso(started.timestamp)));}
        rerender(){this.render({trips:this.trips,offline:this.offline,incomplete:this.incomplete,loginRequired:this.loginRequired},this.calendar);}
        cancelNewEntry(trip) {const key=String(trip.id);this.newEntries.delete(key);this.addBefore.delete(key);this.rerender();}
        newEntryRows(trip,draft) {
            const pair=node('div',undefined,'trip-log-new-entry-pair'),row=node('div',undefined,'trip-log-entry trip-log-new-entry');
            const time=node('button',draft.start?new Intl.DateTimeFormat(undefined,{timeZone:this.calendar.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(draft.start)):'---','trip-log-entry-time');time.type='button';time.setAttribute('aria-label','New entry date and time');
            const type=node('select');type.setAttribute('aria-label','New entry type');
            const prompt=node('option','Select entry');prompt.value='';type.append(prompt);
            for(const value of ['break','lunch','down']){const option=node('option',value.charAt(0).toUpperCase()+value.slice(1));option.value=value;type.append(option);}
            type.value=draft.type||'';const cancel=node('button','Cancel','trip-log-entry-cancel');cancel.type='button';cancel.addEventListener('click',()=>this.cancelNewEntry(trip));row.classList.add('has-entry-cancel');
            const commit=async()=>{if(!draft.start||!draft.end||!draft.type)return;const key=`draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,approvedTime=draft.type==='down'?(draft.approvedTime||duration(Date.parse(draft.end)-Date.parse(draft.start))):undefined;trip.events.push({id:key,event:'interval.started',timestamp:draft.start,value:{type:draft.type,length:draft.type==='down'?null:duration(Date.parse(draft.end)-Date.parse(draft.start)),approvedTime,intervalKey:key},_draft:true},{id:`${key}-end`,event:'interval.ended',timestamp:draft.end,value:{intervalKey:key},_draft:true});this.newEntries.delete(String(trip.id));this.rerender();};
            time.addEventListener('click',async()=>{try{const session=this.entrySessions.get(String(trip.id)),base=this.date(session.settings.creationAnchor||trip.startTime);await this.options.numberPad({mode:'absolute',source:'Trip Log new entry time',initialValue:draft.start?this.clockValue(draft.start,base):undefined,tripDefaults:{creationDate:base},title:'Entry Time',allowEmpty:true,onConfirm:async value=>{draft.start=value;this.rerender();await commit();}});}catch(error){this.error(error);}});
            type.addEventListener('change',async()=>{draft.type=type.value;this.rerender();await commit();});
            row.append(time,type);if(draft.type==='down'){const approved=node('button',`Approved: ${draft.approvedTime||'---'}`,'trip-log-entry-approved');approved.type='button';approved.addEventListener('click',()=>this.editDraftApprovedTime(trip,draft));row.append(approved);}row.append(cancel);
            const endRow=node('div',undefined,'trip-log-entry trip-log-new-entry');const endTime=node('button',draft.end?new Intl.DateTimeFormat(undefined,{timeZone:this.calendar.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(draft.end)):'---','trip-log-entry-time');endTime.type='button';endTime.setAttribute('aria-label','New entry end date and time');endTime.addEventListener('click',async()=>{const session=this.entrySessions.get(String(trip.id)),base=this.date(session.settings.creationAnchor||trip.startTime);await this.options.numberPad({mode:'absolute',source:'Trip Log new entry end time',initialValue:draft.end?this.clockValue(draft.end,base):undefined,tripDefaults:{creationDate:base},title:'Entry End Time',allowEmpty:true,onConfirm:async value=>{draft.end=value;if(draft.type==='down'&&!draft.approvalOverridden&&draft.start&&value)draft.approvedTime=duration(Date.parse(value)-Date.parse(draft.start));this.rerender();await commit();}});});endRow.append(endTime,node('span',`${draft.type?draft.type.charAt(0).toUpperCase()+draft.type.slice(1):'Interval'} Ended`,'trip-log-entry-name'));pair.append(row,endRow);return pair;
        }
        async editDraftApprovedTime(trip,draft){await this.options.numberPad({mode:'duration',source:'Trip Log approved down time',initialValue:draft.approvedTime,title:'Approved Time',allowEmpty:true,onConfirm:async value=>{draft.approvedTime=value||'';draft.approvalOverridden=Boolean(value);this.rerender();}});}
        async beginEntryEdit(trip) {if(trip.running)throw new Error('End the active trip before editing it.');if(this.editing.size&&!this.editing.has(trip.id))throw new Error('Finish the current entry edits first.');const data=await this.options.request(trip.id),key=String(trip.id);trip.events=clone(data.events);this.entrySessions.set(key,{revision:data.revision,original:clone(data.events),settings:data.settings});this.editing.add(trip.id);this.expanded.set(`trip${trip.id}`,true);this.rerender();}
        entryChanges(trip) {
            const session=this.entrySessions.get(String(trip.id)),before=session.original,after=trip.events||[],changes=[];
            const end=(events,key)=>events.find(event=>event.event==='interval.ended'&&event.value?.intervalKey===key);
            for(const original of before.filter(event=>['trip.started','trip.stopped','interval.started'].includes(event.event))){const key=original.value?.intervalKey,current=key?after.find(event=>event.event==='interval.started'&&event.value?.intervalKey===key):after.find(event=>String(event.id)===String(original.id));if(!current){if(key)changes.push({operation:'delete-entry',entry:{eventId:original.id,intervalKey:key}});continue;}const originalEnd=key?end(before,key):null,currentEnd=key?end(after,key):null,currentStart=current.timestamp?iso(current.timestamp):'';if(currentStart!==iso(original.timestamp)||current.value?.type!==original.value?.type||current.value?.approvedTime!==original.value?.approvedTime||(originalEnd&&currentEnd&&iso(originalEnd.timestamp)!==iso(currentEnd.timestamp)))changes.push({operation:'entry',entry:{eventId:original.id,intervalKey:key,start:currentStart,type:current.value?.type,length:current.value?.length,approvedTime:current.value?.approvedTime,end:currentEnd?iso(currentEnd.timestamp):undefined}});}
            for(const current of after.filter(event=>event.event==='interval.started'&&event._draft)){const currentEnd=end(after,current.value.intervalKey);changes.push({operation:'add-entry',entry:{start:iso(current.timestamp),end:iso(currentEnd.timestamp),type:current.value.type,length:current.value.length,approvedTime:current.value.approvedTime}});}
            return changes;
        }
        async finishEntryEdit(trip,button) {const key=String(trip.id),session=this.entrySessions.get(key);button.disabled=true;try{const changes=this.entryChanges(trip);if(changes.length)await this.options.request(trip.id,{operation:'entries',revision:session.revision,changes});this.editing.delete(trip.id);this.entrySessions.delete(key);this.addBefore.delete(key);this.newEntries.delete(key);this.root.querySelector(':scope>.trip-log-error')?.remove();await this.options.refresh();this.rerender();}catch(error){trip.events=clone(session.original);this.editing.delete(trip.id);this.entrySessions.delete(key);this.addBefore.delete(key);this.newEntries.delete(key);this.rerender();this.error(error);}finally{button.disabled=false;}}
        handleOutsideEntryPointer(event) {for(const actions of this.root.querySelectorAll('.trip-log-menu-actions:not([hidden])')){if(actions.parentElement?.contains(event.target))continue;actions.hidden=true;actions.previousElementSibling?.setAttribute('aria-expanded','false');}if(!this.editing.size||event.target.closest('dialog'))return;const tripId=[...this.editing][0],key=String(tripId),entries=event.target.closest('.trip-log-entries'),container=entries?.closest('.trip-log-trip');if(container?.dataset.tripId===key)return;const trip=this.trips?.find(candidate=>String(candidate.id)===key),session=this.entrySessions.get(key);if(!trip||!session)return;const changed=this.entryChanges(trip).length>0||this.newEntries.has(key);if(changed&&!window.confirm('Discard unsaved entry changes and collapse this trip?')){event.preventDefault();event.stopImmediatePropagation();return;}event.preventDefault();event.stopImmediatePropagation();trip.events=clone(session.original);this.editing.delete(tripId);this.entrySessions.delete(key);this.addBefore.delete(key);this.newEntries.delete(key);for(const value of [...this.deleteVisible])if(value.startsWith(`${key}:`))this.deleteVisible.delete(value);this.expanded.set(`trip${tripId}`,false);this.rerender();}
        error(error) {if(this.editor){const msg=this.editor.querySelector('[role="alert"]');msg.textContent=error.message||String(error);}else {this.root.querySelector(':scope>.trip-log-error')?.remove();const msg=node('p',error.message||String(error),'trip-log-error');msg.setAttribute('role','alert');this.root.prepend(msg);}}
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
        async editEntryTime(trip,event,ended,addButton) {
            this.root.querySelector(':scope>.trip-log-error')?.remove();
            if(addButton)addButton.hidden=true;
            try{const session=this.entrySessions.get(String(trip.id)),current=trip.events.find(candidate=>String(candidate.id)===String(event.id));
                if(!current)throw new Error('Entry changed. Reopen the trip.');
                const base=this.date(session.settings.creationAnchor||current.timestamp);
                await this.options.numberPad({mode:'absolute',source:'Trip Log entry time',initialValue:current.timestamp?this.clockValue(iso(current.timestamp),base):undefined,tripDefaults:{creationDate:base},title:'Entry Time',allowEmpty:true,onCancel:()=>{this.addBefore.delete(String(trip.id));this.rerender();},
                    onConfirm:async value=>{current.timestamp=value||'';const key=current.value?.intervalKey,started=current.event==='interval.started'?current:trip.events.find(candidate=>candidate.event==='interval.started'&&candidate.value?.intervalKey===key),finished=current.event==='interval.ended'?current:trip.events.find(candidate=>candidate.event==='interval.ended'&&candidate.value?.intervalKey===key);if(started&&finished&&String(started.value?.type||'').toLowerCase()==='down'&&!started.value.approvalOverridden&&started.timestamp&&finished.timestamp)started.value.approvedTime=duration(Date.parse(iso(finished.timestamp))-Date.parse(iso(started.timestamp)));this.addBefore.delete(String(trip.id));this.root.querySelector(':scope>.trip-log-error')?.remove();this.rerender();}});
            }catch(error){if(addButton?.isConnected)addButton.hidden=false;throw error;}
        }
        async editEntryName(trip,event,ended,button,addButton) {
            this.root.querySelector(':scope>.trip-log-error')?.remove();
            if(button.parentElement?.querySelector('select'))return;
            if(addButton)addButton.hidden=true;
            const select=node('select');select.setAttribute('aria-label','Entry type');
            const currentType=event.event==='interval.started'?(event.value?.type||'break'):event.event;
            const choices=event.event==='interval.started'?['break','lunch','down']: [currentType];
            for(const value of choices){const option=node('option',value==='trip.started'?'Trip started':value==='trip.stopped'?'Trip ended':value.replace(/(^|-)(\w)/g,(_,dash,letter)=>`${dash?' ':''}${letter.toUpperCase()}`));option.value=value;select.append(option);}
            select.value=currentType;button.replaceWith(select);const cancel=node('button','Cancel','trip-log-entry-cancel');cancel.type='button';select.parentElement.classList.add('has-entry-cancel');select.parentElement.append(cancel);select.focus();
            const restore=()=>{this.addBefore.delete(String(trip.id));if(select.isConnected){select.replaceWith(button);cancel.remove();button.parentElement.classList.remove('has-entry-cancel');}this.rerender();};cancel.addEventListener('pointerdown',event=>event.preventDefault());cancel.addEventListener('click',restore);
            select.addEventListener('change',async()=>{if(event.event!=='interval.started'){restore();return;}const current=trip.events.find(candidate=>String(candidate.id)===String(event.id));if(!current){restore();this.error(new Error('Entry changed. Reopen the trip.'));return;}current.value.type=select.value;this.root.querySelector(':scope>.trip-log-error')?.remove();restore();});
            select.addEventListener('blur',()=>{if(select.isConnected)restore();},{once:true});
        }
        async deleteEntry(trip,event) {
            this.root.querySelector(':scope>.trip-log-error')?.remove();
            const current=trip.events.find(candidate=>String(candidate.id)===String(event.id));
            if(!current)throw new Error('Entry changed. Reopen the trip.');
            const key=current.value?.intervalKey;trip.events=trip.events.filter(candidate=>candidate.value?.intervalKey!==key);this.deleteVisible.delete(`${trip.id}:${key}`);this.rerender();
        }
        async editApprovedTime(trip,event,ended,addButton){if(addButton)addButton.hidden=true;const current=trip.events.find(candidate=>String(candidate.id)===String(event.id));if(!current)throw new Error('Entry changed. Reopen the trip.');const fallback=this.approvedTime(current,ended,trip.events);await this.options.numberPad({mode:'duration',source:'Trip Log approved down time',initialValue:fallback,title:'Approved Time',allowEmpty:true,onCancel:()=>this.rerender(),onConfirm:async value=>{current.value.approvedTime=value||fallback;current.value.approvalOverridden=Boolean(value);const approval=[...trip.events].reverse().find(candidate=>candidate.event==='interval.approval-changed'&&candidate.value?.intervalKey===current.value?.intervalKey);if(approval){approval.value.state='approved';approval.value.value=current.value.approvedTime;}this.rerender();}});}
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
    TripLog.duration=duration;TripLog.percent=percent;TripLog.counted=counted;TripLog.uncertainIcon=uncertainIcon;window.TripLog=TripLog;
})();
