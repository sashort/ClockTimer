(() => {
    const node = (tag, text, className) => {const el=document.createElement(tag);if(text!==undefined) el.textContent=text;if(className) el.className=className;return el;};
    const clone = value => JSON.parse(JSON.stringify(value));
    const duration = ms => {const s=Math.floor(Math.max(0,Number(ms)||0)/1000);return `${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
    const durationMilliseconds = value =>
        Number.isSafeInteger(value) && value >= 0
            ? value
            : 0;
    const timelineMilliseconds = value => {
        const text=String(value||'').trim(),match=text.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
        if(!match)return 0;
        const hours=Number(match[1]||0),minutes=Number(match[2]),seconds=Number(match[3]),fraction=Number(String(match[4]||'0').padEnd(3,'0'));
        if(![hours,minutes,seconds,fraction].every(Number.isFinite)||minutes>59||seconds>59)return 0;
        return (((hours*60)+minutes)*60+seconds)*1000+fraction;
    };
    const durationOrDash = value =>
        Number.isSafeInteger(value) && value >= 0
            ? duration(value)
            : '---';
    const iso = value => /(?:Z|[+-]\d\d:\d\d)$/.test(value)?value:String(value).replace(' ','T')+'Z';
    const counted = trip => TripAggregates.counted(trip);
    const aggregate = (trips, parent = false) => TripAggregates.calculate({trips,
        includeActiveTrip: !parent || trips.some(trip => trip.running && trip.includeInParentPercent)});
    const percent = (trips, parent = false) => {
        const result = aggregate(trips, parent);
        return result.percent === null ? '—' : `${(result.percent * 100).toFixed(2)}%`;
    };
    const uncertainIcon = () => {
        const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
        icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('class','calculation-uncertain-icon');
        icon.setAttribute('role','img');icon.setAttribute('aria-label',globalThis.WMOFLanguagePack.text("baf1edc1-d8bd-5a5b-af44-391168c48c2c"));
        icon.setAttribute('title',globalThis.WMOFLanguagePack.text("61b7db7e-6491-5aba-8dd6-57a62b525f58"));
        icon.innerHTML='<path d="M6 17H5a4 4 0 0 1-.5-8 6 6 0 0 1 11-3 5 5 0 0 1 3.5 9"/><path d="M10 13a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2"/><circle cx="12.5" cy="20" r=".6" fill="currentColor" stroke="none"/>';
        return icon;
    };
    class TripLog {
        constructor(root,options) {this.root=root;this.options=options;this.expanded=new Map();this.editing=new Set();this.entrySessions=new Map();this.addBefore=new Map();this.newEntries=new Map();this.deleteVisible=new Set();this.editor=null;this.settingsVisible=false;this.outsideEntryPointer=event=>this.handleOutsideEntryPointer(event);document.addEventListener('pointerdown',this.outsideEntryPointer,true);}
        numberPad(options={}) {return this.options.numberPad({cancelTarget:'none',confirmTarget:'none',...options});}
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
            this.trips=trips;this.aggregation=aggregate(trips,true);const fragment=document.createDocumentFragment();
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
            emphasis.append(node('strong',`${trips.length} ${trips.length===1?globalThis.WMOFLanguagePack.text("3b289746-71b2-4ac3-90dd-00a0402ba34f"):globalThis.WMOFLanguagePack.text("1c1bf8a6-f452-4dfa-8d43-ed38d4bcae1f")}`),node('strong',percent(trips,true),'trip-log-actual'));
            if(this.incomplete)emphasis.lastElementChild.append(uncertainIcon());
            const totals=aggregate(trips,true);overview.append(emphasis,node('div',`Standard ${duration(totals.standardTimeMilliseconds)} · Actual ${duration(totals.countedTimeMilliseconds)}`,'trip-log-times'));fragment.append(overview);
            const columns=node('div',undefined,'trip-log-column-header');columns.setAttribute('role','row');for(const label of [globalThis.WMOFLanguagePack.text("5e8f393d-72a7-4b30-ba1e-69bbd765354f"),globalThis.WMOFLanguagePack.text("07613a20-4d6c-4fdf-a16d-6c94d28e5590"),globalThis.WMOFLanguagePack.text("77f1eddd-89b9-4e22-9fe1-aeeb4d060722"),globalThis.WMOFLanguagePack.text("c755d5bf-3277-4630-a938-898b8b6172dd"),'']){const cell=node('span',label);cell.setAttribute('role','columnheader');columns.append(cell);}fragment.append(columns);
            const days=(Date.parse(calendar.endTime)-Date.parse(calendar.startTime))/86400000;
            const levels=days>35?['month','week','day']:days>7?['week','day']:days>1?['day']:[];
            fragment.append(this.groups(trips,levels,calendar));
            } else {
                const message=node('p',data.loginRequired?globalThis.WMOFLanguagePack.text("1b02fb00-aed1-432b-9c06-2cc98704eea2"):data.offline?globalThis.WMOFLanguagePack.text("595de126-bd64-4acc-be0f-a314413c2bd6"):globalThis.WMOFLanguagePack.text("d621fec0-6ca8-42fd-a0cf-1894616fd377"),'trip-log-empty-message');
                message.setAttribute('role','status');fragment.append(message);
            }
            if(reuseSettings){for(const child of [...this.root.children])if(child!==settings)child.remove();this.root.append(fragment);}
            else this.root.replaceChildren(fragment);
            this.setSettingsVisible(this.settingsVisible);
        }
        controls(calendar) {
            const box=node('section',undefined,'trip-log-controls');
            const selectRow=(label,choices,value,handler)=>{const row=node('label');row.append(node('span',label));const select=node('select');for(const [v,text] of choices){const option=node('option',text);option.value=v;select.append(option);}select.value=value;select.addEventListener('change',()=>handler(select.value));row.append(select);box.append(row);};
            selectRow(globalThis.WMOFLanguagePack.text("9931b905-cc82-4afe-8b33-a9d31454146a"),[['all',globalThis.WMOFLanguagePack.text("96f27252-e455-45f0-876c-c6f604ad486b")],['productive',globalThis.WMOFLanguagePack.text("e9a19871-eb83-4f78-85a2-8dcbbc2b3f6d")],['non-productive',globalThis.WMOFLanguagePack.text("c62239f7-fec2-4242-bbb4-ad8759017128")]],this.options.filter(),this.options.onFilter);
            selectRow(globalThis.WMOFLanguagePack.text("2d7078b0-2daf-4ade-b37a-01f6e2ae734f"),[['day',globalThis.WMOFLanguagePack.text("86e12fa9-95ff-4a20-84bd-8d6744217a01")],['week',globalThis.WMOFLanguagePack.text("0589fe2c-5781-433b-855b-a30cbc304c15")],['pay-period',globalThis.WMOFLanguagePack.text("ff8216fc-6cdb-4cbb-a433-1d2bae1e8232")],['month',globalThis.WMOFLanguagePack.text("ed109a97-8e31-4c93-85cb-6dfb4480c0f7")],['year',globalThis.WMOFLanguagePack.text("c9de230e-c958-41be-ad35-70174a864a3f")],['custom',globalThis.WMOFLanguagePack.text("9e063c44-5f74-4196-bbab-3a49a72be041")]],this.options.range(),this.options.onRange);
            const dates=node('div',undefined,'trip-log-date-controls');const values=window.CalendarRange.dates(calendar);
            for(const [label,key] of [[globalThis.WMOFLanguagePack.text("c62f534c-5d7b-459f-bdc8-f14a3d2cbecf"),'start'],[globalThis.WMOFLanguagePack.text("4c0b0ee5-ddac-4e6a-b2b5-48f438f0cd92"),'end']]) {
                const input=node('input');input.type='date';input.value=values[key];input.disabled=this.options.range()!=='custom';input.setAttribute('aria-label',key==='start'?globalThis.WMOFLanguagePack.text("6bd07958-dfbb-5e40-ab3c-c1347e5eac1c"):globalThis.WMOFLanguagePack.text("dcc024f5-cfbf-56cb-b10b-33c5367aed8b"));
                input.addEventListener('change',()=>this.options.onDate(key,input.value));dates.append(node('span',label),input);
            }
            box.append(dates);const include=node('label',undefined,'trip-log-include-current');const check=node('input');check.type='checkbox';check.dataset.includeCurrent='true';check.checked=Boolean(this.options.includeCurrent?.());check.addEventListener('change',()=>this.options.onIncludeCurrent?.(check.checked));include.append(node('span',globalThis.WMOFLanguagePack.text("d3df5443-5f50-4a22-b8e6-bdd43caf0d89")),check);box.append(include);return box;
        }
        civil(trip) {
            const parts=new Intl.DateTimeFormat('en-CA',{timeZone:this.calendar.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso(trip.startTime)));
            const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));let day=`${p.year}-${p.month}-${p.day}`;
            if(`${p.hour}:${p.minute}:${p.second}`<(this.calendar.rules?.cutoffTime||'00:00:00')) {const d=new Date(day+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-1);day=d.toISOString().slice(0,10);}
            return day;
        }
        key(trip,level) {
            const day=this.civil(trip);if(level==='month') return day.slice(0,7);if(level==='day') return day;
            const d=new Date(day+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-(d.getUTCDay()-(this.calendar.rules?.weekStartDay??6)+7)%7);return d.toISOString().slice(0,10);
        }
        label(key,level) {
            if(level==='month') return new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(key+'-01T12:00:00Z'));
            if(level==='day') return new Intl.DateTimeFormat(undefined,{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(key+"T12:00:00Z"));
            const d=new Date(key+"T12:00:00Z"),end=new Date(d);end.setUTCDate(d.getUTCDate()+6);
            const fmt=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',timeZone:'UTC'});
            return `Week · ${fmt.format(d)}–${fmt.format(end)}`;
        }
        groups(trips,levels,calendar) {
            const fragment=document.createDocumentFragment();if(!levels.length){for(const trip of trips)fragment.append(this.trip(trip));return fragment;}
            const [level,...rest]=levels;const groups=new Map();for(const trip of trips){const key=this.key(trip,level);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(trip);}
            for(const [key,group] of groups){const id=level+key,details=node('details',undefined,'trip-log-group'),active=group.find(trip=>trip.running);details.classList.toggle('has-active-trip',Boolean(active));if(active){details.dataset.activeState=active.activeState||'normal';details.style.setProperty('--trip-log-active-sweep-delay',this.activeSweepDelay);}details.open=this.expanded.get(id)??true;details.addEventListener('toggle',()=>this.expanded.set(id,details.open));
                const summary=node('summary');const heading=node('div',undefined,'trip-log-group-heading');heading.append(node('strong',this.label(key,level)),node('span',`${group.length} trips · ${percent(group,true)}`,'trip-log-actual'));
                if(this.incomplete)heading.lastElementChild.append(uncertainIcon());
                const totals=aggregate(group,true);summary.append(heading,node('div',`Standard ${duration(totals.standardTimeMilliseconds)} · Actual ${duration(totals.countedTimeMilliseconds)}`,'trip-log-times'));details.append(summary,this.groups(group,rest,calendar));fragment.append(details);}
            return fragment;
        }
        trip(trip) {
            const details=node('details',undefined,'trip-log-trip'),id='trip'+trip.id;details.dataset.tripId=String(trip.id);details.classList.toggle('is-active-trip',Boolean(trip.running));if(trip.running){details.dataset.activeState=trip.activeState||'normal';details.style.setProperty('--trip-log-active-sweep-delay',this.activeSweepDelay);}details.open=this.expanded.get(id)??false;details.addEventListener('toggle',()=>this.expanded.set(id,details.open));
            const summary=node('summary');const fmt=new Intl.DateTimeFormat(undefined,{timeZone:this.calendar.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
            summary.append(node('strong',`${trip.running?'● ':''}${fmt.format(new Date(iso(trip.startTime)))}`),node('span',duration(trip.standardTimeMilliseconds)),node('span',duration(counted(trip))),node('strong',percent([trip]),'trip-log-actual'));
            if(trip.buffered)summary.lastElementChild.append(uncertainIcon());
            const menu=node('div',undefined,'trip-log-menu');const toggle=node('button','⋮');toggle.type='button';toggle.setAttribute('aria-label',globalThis.WMOFLanguagePack.text("20d61461-e2f9-5bef-a66c-1effecbc1dab", {value0: (trip.id)}));toggle.setAttribute('aria-expanded','false');
            const actions=node('div',undefined,'trip-log-menu-actions');actions.hidden=true;
            for(const [label,action] of [[globalThis.WMOFLanguagePack.text("e467a304-0e63-42cf-8668-861ce62a7200"),()=>this.openSettings(trip)],[globalThis.WMOFLanguagePack.text("d8e75f94-b2ac-484b-86f3-350c8b90433a"),()=>this.beginEntryEdit(trip)],[globalThis.WMOFLanguagePack.text("4f07c05e-91f4-4cfb-bb2c-f81e58259258"),()=>this.deleteTrip(trip)]]) {
                const button=node('button',label);button.type='button';if(label==='Delete trip')button.className='danger';button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();actions.hidden=true;toggle.setAttribute('aria-expanded','false');Promise.resolve(action()).catch(error=>this.error(error));});actions.append(button);
            }
            toggle.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();actions.hidden=!actions.hidden;toggle.setAttribute('aria-expanded',String(!actions.hidden));});menu.append(toggle,actions);if(!trip.running&&(!this.offline||trip.buffered))summary.append(menu);details.append(summary);
            const entries=node('div',undefined,'trip-log-entries');const header=node('div',undefined,'trip-log-entry-heading');header.append(node('strong',this.editing.has(trip.id)?globalThis.WMOFLanguagePack.text("c2599142-6f20-4b53-b109-bd3aa79985dc"):globalThis.WMOFLanguagePack.text("d54c5628-5a22-4fb4-a3e9-e5674f490f25")));
            if(this.editing.has(trip.id)){const done=node('button',globalThis.WMOFLanguagePack.text("c0534d6d-1102-4592-b5c7-eba1e33d05d5"));done.type='button';done.addEventListener('click',()=>this.finishEntryEdit(trip,done));header.append(done);entries.append(header,node('p',globalThis.WMOFLanguagePack.text("fa5d607f-0793-49d4-9d67-5b02f8263aea")));}else entries.append(header);
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
                    if(event.event==='interval.started'&&String(event.value?.type||'').toLowerCase()==='down'){const approved=node('button',`Approved: ${durationOrDash(this.approvedTime(event,ended,events))}`,'trip-log-entry-approved');approved.type='button';approved.addEventListener('click',()=>this.editApprovedTime(trip,event,ended,entries.querySelector('.trip-log-add')).catch(error=>this.error(error)));row.append(approved);row.classList.add('has-approved-time');}
                    if(event.event==='interval.started'&&String(event.value?.type||'').toLowerCase()==='down'&&this.options.openDownDetails){const info=node('button','📷','trip-log-down-detail-edit');info.type='button';info.setAttribute('aria-label',globalThis.WMOFLanguagePack.text("1d092868-3eea-5b34-a476-e934ca0ee439"));info.addEventListener('click',()=>this.options.openDownDetails(trip,event.value.intervalKey,true));row.append(info);row.classList.add('has-down-detail-edit');}
                    if(adjustment){row.append(node('span',adjustment,'trip-log-entry-approved-value'));row.classList.add('has-approved-time');}
                    const intervalAction=['interval.started','interval.ended'].includes(event.event),tripBoundary=['trip.started','trip.stopped'].includes(event.event),removableAction=intervalAction||tripBoundary,canInsertBefore=event.event!=='trip.started',deleteKey=`${tripKey}:${eventKey}`;
                    if(removableAction&&this.deleteVisible.has(deleteKey)){const remove=node('button','×','trip-log-entry-remove');remove.type='button';const boundaryLabel=event.event==='trip.started'?globalThis.WMOFLanguagePack.text("c96903e5-c357-49cb-940b-7c32d7d75382"):event.event==='trip.stopped'?globalThis.WMOFLanguagePack.text("90664387-af1e-46c3-bbd1-ed9e3c651482"):String(started?.value?.type||globalThis.WMOFLanguagePack.text("f4025c01-0d6e-4b95-8be3-c7a6880370f8"));remove.setAttribute('aria-label',globalThis.WMOFLanguagePack.text("f0d73aec-60fc-5acd-ad39-ebc99255ad7c", {value0: (boundaryLabel)}));remove.addEventListener('click',()=>Promise.resolve(tripBoundary?this.deleteTrip(trip):this.deleteEntry(trip,started)).catch(error=>this.error(error)));row.classList.add('has-entry-remove');row.append(remove);}
                    if(removableAction||canInsertBefore){let gesture,timer;row.addEventListener('pointerdown',pointer=>{if(pointer.target.closest('button,select'))return;pointer.preventDefault();gesture={x:pointer.clientX,y:pointer.clientY};timer=setTimeout(()=>{timer=undefined;suppressClick=true;if(canInsertBefore){this.addBefore.set(tripKey,eventKey);this.newEntries.delete(tripKey);}if(removableAction)this.deleteVisible.add(deleteKey);this.rerender();},550);});row.addEventListener('pointermove',pointer=>{if(gesture&&(Math.abs(pointer.clientX-gesture.x)>10||Math.abs(pointer.clientY-gesture.y)>10)){clearTimeout(timer);timer=undefined;}});row.addEventListener('pointerup',()=>{clearTimeout(timer);timer=undefined;gesture=undefined;});row.addEventListener('pointercancel',()=>{clearTimeout(timer);timer=undefined;gesture=undefined;});row.addEventListener('contextmenu',pointer=>pointer.preventDefault());}
                }else {row.append(node('span',fmt.format(new Date(iso(event.timestamp)))),node('span',displayLabel));if(event.event==='interval.started'&&String(event.value?.type||'').toLowerCase()==='down'){row.append(node('span',`Approved: ${durationOrDash(this.approvedTime(event,ended,events))}`,'trip-log-entry-approved-value'));row.classList.add('has-approved-time');}if(adjustment){row.append(node('span',adjustment,'trip-log-entry-approved-value'));row.classList.add('has-approved-time');}}entries.append(row);
            }
            if(this.editing.has(trip.id)&&!addPlaced){if(draft)entries.append(this.newEntryRows(trip,draft));else entries.append(addButton());}
            if(!this.editing.has(trip.id)&&this.options.openDownDetails){const downs=events.filter(event=>event.event==='interval.started'&&String(event.value?.type||'').toLowerCase()==='down'&&!deleted.has(event.value.intervalKey));if(downs.length){const bar=node('div',undefined,'trip-log-down-details');for(const down of downs){const button=node('button','', 'trip-log-down-detail-button');button.type='button';button.dataset.content='none';button.setAttribute('aria-label',globalThis.WMOFLanguagePack.text("860d924a-0b3e-59f1-aab1-aca819eb4be4", {value0: (fmt.format(new Date(iso(down.timestamp))))}));let timer,long=false;button.addEventListener('pointerdown',event=>{event.preventDefault();long=false;timer=setTimeout(()=>{long=true;for(const row of entries.querySelectorAll('.trip-log-entry.is-down-highlighted'))row.classList.remove('is-down-highlighted');for(const row of entries.querySelectorAll('.trip-log-entry'))if(row.dataset.intervalKey===down.value.intervalKey)row.classList.add('is-down-highlighted');setTimeout(()=>{for(const row of entries.querySelectorAll('.trip-log-entry.is-down-highlighted'))row.classList.remove('is-down-highlighted');},4000);},550);});button.addEventListener('pointerup',()=>{clearTimeout(timer);if(!long)this.options.openDownDetails(trip,down.value.intervalKey,false);});button.addEventListener('pointercancel',()=>clearTimeout(timer));bar.append(button);Promise.resolve(this.options.downDetailsInfo?.(trip.id,down.value.intervalKey)).then(info=>{if(button.isConnected)button.dataset.content=info?.hasImage&&info?.notes?'both':info?.hasImage?'image':info?.notes?'notes':'none';}).catch(()=>{});}entries.append(bar);}}
            details.append(entries);return details;
        }
        entryLabel(event,started,ended,events=[]) {
            if(event.event==='trip.started')return globalThis.WMOFLanguagePack.text("d15209dd-a85c-4361-a2e5-d2271f5ec425");if(event.event==='trip.stopped')return globalThis.WMOFLanguagePack.text("5bf5c47c-e341-46b1-bdf5-a7a2e838b9ef");
            const type=String(started?.value?.type||globalThis.WMOFLanguagePack.text("e9d2ad4d-a32e-4c46-8adf-303391da3e39")).toLowerCase(),title=this.entryKind(started)==='short-break'?globalThis.WMOFLanguagePack.text("5b3c8ec9-b1f8-4d32-a337-2b42ff7ebf5e"):type.charAt(0).toUpperCase()+type.slice(1);
            if(event.event==='interval.started')return `${title} Started`;
            const planned=['break','lunch'].includes(type)?durationMilliseconds(started.value?.length)+durationMilliseconds(started.value?.startBuffer)+durationMilliseconds(started.value?.endBuffer):0;
            const actual=ended&&started?.timestamp?Date.parse(iso(ended.timestamp))-Date.parse(iso(started.timestamp)):NaN;
            const adjustment=value=>{const seconds=Math.floor(Math.abs(value)/1000),hours=Math.floor(seconds/3600);return `${hours?`${hours}:`:''}${String(Math.floor(seconds/60)%60).padStart(hours?2:1,'0')}:${String(seconds%60).padStart(2,'0')}`;};
            if(type==='down'&&Number.isFinite(actual)){const approved=durationMilliseconds(this.approvedTime(started,ended,events)),difference=approved-actual;if(difference!==0)return `${title} Ended · ${adjustment(difference)} Approval ${difference>0?globalThis.WMOFLanguagePack.text("93bc5972-8ee1-4b9b-bac5-c21358221e6b"):globalThis.WMOFLanguagePack.text("ce37f4e8-7850-48f4-890a-0dec1b6a972a")}`;}
            if(planned>0&&Number.isFinite(actual)&&actual!==planned){const value=adjustment(actual-planned);return actual<planned?`${title} Ended Early · ${value} Gained`:`${title} Ended Late · ${value} Lost`;}
            return `${title} Ended`;
        }
        entryKind(event) {const type=String(event?.value?.type||'').toLowerCase();const breakType=String(event?.value?.attributes?.breakType||event?.value?.breakType||'').toLowerCase();return type==='break'&&breakType==='short'?'short-break':type;}
        approvedTime(started,ended,events=[]) {if(String(started?.value?.type||'').toLowerCase()!=='down')return undefined;const approval=[...events].reverse().find(event=>event.event==='interval.approval-changed'&&event.value?.intervalKey===started.value?.intervalKey);if(approval?.value?.state==='unapproved')return 0;if(approval?.value?.state==='approved'&&Number.isSafeInteger(approval.value.value)&&approval.value.value>=0)return approval.value.value;if(Number.isSafeInteger(started.value.approvedTime)&&started.value.approvedTime>=0)return started.value.approvedTime;if(!started.timestamp||!ended?.timestamp)return undefined;const milliseconds=Date.parse(iso(ended.timestamp))-Date.parse(iso(started.timestamp));return Number.isSafeInteger(milliseconds)&&milliseconds>=0?milliseconds:undefined;}
        rerender(){this.render({trips:this.trips,offline:this.offline,incomplete:this.incomplete,loginRequired:this.loginRequired},this.calendar);}
        cancelNewEntry(trip) {const key=String(trip.id);this.newEntries.delete(key);this.addBefore.delete(key);this.rerender();}
        newEntryRows(trip,draft) {
            const pair=node('div',undefined,'trip-log-new-entry-pair'),row=node('div',undefined,'trip-log-entry trip-log-new-entry');
            const time=node('button',draft.start?new Intl.DateTimeFormat(undefined,{timeZone:this.calendar.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(draft.start)):'---','trip-log-entry-time');time.type='button';time.setAttribute('aria-label',globalThis.WMOFLanguagePack.text("a61f7fa8-a2d4-5ded-9d3e-a0a6de8eada3"));
            const type=node('select');type.setAttribute('aria-label',globalThis.WMOFLanguagePack.text("cce87998-e856-5d4d-9ea0-e98ac9fc5847"));
            const prompt=node('option',globalThis.WMOFLanguagePack.text("fa9eab4d-1861-4d6e-9fa4-f6d5676e8f47"));prompt.value='';type.append(prompt);
            for(const [value,label] of [['break',globalThis.WMOFLanguagePack.text("b8acb08f-9510-44a2-9f87-02255b1236d8")],['short-break',globalThis.WMOFLanguagePack.text("db90e2a5-5c43-49e8-bd1b-7579721b1cfc")],['lunch',globalThis.WMOFLanguagePack.text("bc8b0d13-9d3a-438d-a96e-654cab1eb952")],['down',globalThis.WMOFLanguagePack.text("2b4d255e-4426-4612-b951-e9a26c338b8d")]]){const option=node('option',label);option.value=value;type.append(option);}
            type.value=draft.type||'';const cancel=node('button',globalThis.WMOFLanguagePack.text("6aace411-fa42-4646-aa4e-724ebbddbb15"),'trip-log-entry-cancel');cancel.type='button';cancel.addEventListener('click',()=>this.cancelNewEntry(trip));row.classList.add('has-entry-cancel');
            const commit=async()=>{if(!draft.start||!draft.end||!draft.type)return;const key=`draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,effectiveType=draft.type==='short-break'?'break':draft.type,attributes=effectiveType==='break'?{breakType:draft.type==='short-break'?'short':'break'}:{},actualMilliseconds=Date.parse(draft.end)-Date.parse(draft.start),approvedTime=effectiveType==='down'?(Number.isSafeInteger(draft.approvedTime)?draft.approvedTime:actualMilliseconds):undefined;trip.events.push({id:key,event:'interval.started',timestamp:draft.start,value:{type:effectiveType,length:effectiveType==='down'?null:actualMilliseconds,approvedTime,attributes,intervalKey:key},_draft:true},{id:`${key}-end`,event:'interval.ended',timestamp:draft.end,value:{intervalKey:key},_draft:true});this.newEntries.delete(String(trip.id));this.rerender();};
            time.addEventListener('click',async()=>{try{const session=this.entrySessions.get(String(trip.id)),base=this.date(session.settings.creationAnchor||trip.startTime);await this.numberPad({mode:'absolute',source:globalThis.WMOFLanguagePack.text("95a6db6b-b322-40dd-9b1b-f0785356ecad"),initialValue:draft.start?this.clockValue(draft.start,base):undefined,tripDefaults:{creationDate:base},title:globalThis.WMOFLanguagePack.text("5b1c3d96-f62b-520a-962e-049d5045032d"),allowEmpty:true,onConfirm:async value=>{draft.start=value;this.rerender();await commit();}});}catch(error){this.error(error);}});
            type.addEventListener('change',async()=>{draft.type=type.value;this.rerender();await commit();});
            row.append(time,type);if(draft.type==='down'){const approved=node('button',`Approved: ${durationOrDash(draft.approvedTime)}`,'trip-log-entry-approved');approved.type='button';approved.addEventListener('click',()=>this.editDraftApprovedTime(trip,draft));row.append(approved);}row.append(cancel);
            const endRow=node('div',undefined,'trip-log-entry trip-log-new-entry');const endTime=node('button',draft.end?new Intl.DateTimeFormat(undefined,{timeZone:this.calendar.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(draft.end)):'---','trip-log-entry-time');endTime.type='button';endTime.setAttribute('aria-label',globalThis.WMOFLanguagePack.text("60e8e57a-95ba-540a-af27-79987bf1922f"));endTime.addEventListener('click',async()=>{const session=this.entrySessions.get(String(trip.id)),base=this.date(session.settings.creationAnchor||trip.startTime);await this.numberPad({mode:'absolute',source:globalThis.WMOFLanguagePack.text("03e7f032-84af-47d3-a4e6-88e1d6b438e7"),initialValue:draft.end?this.clockValue(draft.end,base):undefined,tripDefaults:{creationDate:base},title:globalThis.WMOFLanguagePack.text("88407183-2ace-5fdd-96f4-aa22b76dd68a"),allowEmpty:true,onConfirm:async value=>{draft.end=value;if(draft.type==='down'&&!draft.approvalOverridden&&draft.start&&value)draft.approvedTime=Date.parse(value)-Date.parse(draft.start);this.rerender();await commit();}});});const draftTitle=draft.type==='short-break'?globalThis.WMOFLanguagePack.text("390e5e97-2037-49fa-8151-10bf69184a6b"):draft.type?draft.type.charAt(0).toUpperCase()+draft.type.slice(1):globalThis.WMOFLanguagePack.text("971971ce-7132-4a6e-a8db-44246b678427");endRow.append(endTime,node('span',`${draftTitle} Ended`,'trip-log-entry-name'));pair.append(row,endRow);return pair;
        }
        async editDraftApprovedTime(trip,draft){await this.numberPad({mode:'duration',source:globalThis.WMOFLanguagePack.text("1edd3076-327d-4742-9eed-e723a4ad597c"),initialValue:draft.approvedTime,title:globalThis.WMOFLanguagePack.text("dbaba9e7-efb7-54b1-bbf0-67f3def0969f"),allowEmpty:true,onConfirm:async milliseconds=>{draft.approvedTime=milliseconds;draft.approvalOverridden=milliseconds!==undefined;this.rerender();}});}
        async beginEntryEdit(trip) {if(trip.running)throw new Error(globalThis.WMOFLanguagePack.text("c1812d2f-3a4d-4108-954f-fdfdb8b0ce80"));if(this.editing.size&&!this.editing.has(trip.id))throw new Error(globalThis.WMOFLanguagePack.text("bb50afda-3925-4e27-875b-9dec8cd3af60"));const data=await this.options.request(trip.id),key=String(trip.id);trip.events=clone(data.events);this.entrySessions.set(key,{revision:data.revision,original:clone(data.events),settings:data.settings});this.editing.add(trip.id);this.expanded.set(`trip${trip.id}`,true);this.rerender();}
        entryChanges(trip) {
            const session=this.entrySessions.get(String(trip.id)),before=session.original,after=trip.events||[],changes=[];
            const end=(events,key)=>events.find(event=>event.event==='interval.ended'&&event.value?.intervalKey===key);
            for(const original of before.filter(event=>['trip.started','trip.stopped','interval.started'].includes(event.event))){const key=original.value?.intervalKey,current=key?after.find(event=>event.event==='interval.started'&&event.value?.intervalKey===key):after.find(event=>String(event.id)===String(original.id));if(!current){if(key)changes.push({operation:'delete-entry',entry:{eventId:original.id,intervalKey:key}});continue;}const originalEnd=key?end(before,key):null,currentEnd=key?end(after,key):null,currentStart=current.timestamp?iso(current.timestamp):'',originalKind=this.entryKind(original),currentKind=this.entryKind(current);if(currentStart!==iso(original.timestamp)||currentKind!==originalKind||current.value?.approvedTime!==original.value?.approvedTime||(originalEnd&&currentEnd&&iso(originalEnd.timestamp)!==iso(currentEnd.timestamp)))changes.push({operation:'entry',entry:{eventId:original.id,intervalKey:key,start:currentStart,type:current.value?.type,breakType:current.value?.attributes?.breakType,length:current.value?.length,approvedTime:current.value?.approvedTime,end:currentEnd?iso(currentEnd.timestamp):undefined}});}
            for(const current of after.filter(event=>event.event==='interval.started'&&event._draft)){const currentEnd=end(after,current.value.intervalKey);changes.push({operation:'add-entry',entry:{start:iso(current.timestamp),end:iso(currentEnd.timestamp),type:current.value.type,breakType:current.value?.attributes?.breakType,length:current.value.length,approvedTime:current.value.approvedTime}});}
            return changes;
        }
        async finishEntryEdit(trip,button) {const key=String(trip.id),session=this.entrySessions.get(key);button.disabled=true;try{const changes=this.entryChanges(trip);if(changes.length)await this.options.request(trip.id,{operation:'entries',revision:session.revision,changes});this.editing.delete(trip.id);this.entrySessions.delete(key);this.addBefore.delete(key);this.newEntries.delete(key);this.root.querySelector(':scope>.trip-log-error')?.remove();await this.options.refresh();this.rerender();}catch(error){trip.events=clone(session.original);this.editing.delete(trip.id);this.entrySessions.delete(key);this.addBefore.delete(key);this.newEntries.delete(key);this.rerender();this.error(error);}finally{button.disabled=false;}}
        handleOutsideEntryPointer(event) {for(const actions of this.root.querySelectorAll('.trip-log-menu-actions:not([hidden])')){if(actions.parentElement?.contains(event.target))continue;actions.hidden=true;actions.previousElementSibling?.setAttribute('aria-expanded','false');}if(!this.editing.size||event.target.closest('dialog'))return;const tripId=[...this.editing][0],key=String(tripId),entries=event.target.closest('.trip-log-entries'),container=entries?.closest('.trip-log-trip');if(container?.dataset.tripId===key)return;const trip=this.trips?.find(candidate=>String(candidate.id)===key),session=this.entrySessions.get(key);if(!trip||!session)return;const changed=this.entryChanges(trip).length>0||this.newEntries.has(key);if(changed&&!window.confirm(globalThis.WMOFLanguagePack.text("a28e06f9-b324-482c-abc3-205cbe1b93bb"))){event.preventDefault();event.stopImmediatePropagation();return;}event.preventDefault();event.stopImmediatePropagation();trip.events=clone(session.original);this.editing.delete(tripId);this.entrySessions.delete(key);this.addBefore.delete(key);this.newEntries.delete(key);for(const value of [...this.deleteVisible])if(value.startsWith(`${key}:`))this.deleteVisible.delete(value);this.expanded.set(`trip${tripId}`,false);this.rerender();}
        error(error) {if(this.editor){const msg=this.editor.querySelector('[role="alert"]');msg.textContent=error.message||String(error);}else {this.root.querySelector(':scope>.trip-log-error')?.remove();const msg=node('p',error.message||String(error),'trip-log-error');msg.setAttribute('role','alert');this.root.prepend(msg);}}
        modal(title) {
            this.editor?.remove();const dialog=node('dialog',undefined,'app-dialog trip-log-editor');const form=node('form');const heading=node('header',undefined,'dialog-header');heading.append(node('h2',title));const close=node('button','×');close.type='button';close.setAttribute('aria-label',globalThis.WMOFLanguagePack.text("2db71c87-d3a0-5fa0-9144-6c0d21ad47c0"));close.addEventListener('click',()=>dialog.close());heading.append(close);form.append(heading);dialog.append(form);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();if(this.editor===dialog)this.editor=null;});this.editor=dialog;dialog.showModal();return {dialog,form};
        }
        timeField(form,label,value,mode,onChange,base) {
            const button=node('button',undefined,'trip-log-edit-field');button.type='button';const text=node('span',label),display=node('strong');const draw=()=>display.textContent=mode===globalThis.WMOFLanguagePack.text("62a3f2f9-2396-5a32-a7ed-60753ee0d33d")?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'medium'}).format(new Date(value)):mode===globalThis.WMOFLanguagePack.text("b834c74a-2fe5-56a5-b855-6db1d6248065")?durationOrDash(value):value;draw();button.append(text,display);
            button.addEventListener('click',async()=>{try{await this.numberPad({mode,source:label,initialValue:mode==='absolute'?this.clockValue(value,base):value,tripDefaults:{creationDate:base||this.date(value)},title:label,
                onConfirm:async next=>{value=next;onChange(next);draw();}});}catch(e){this.error(e);}});button.setValue=next=>{value=next;draw();};form.append(button);return button;
        }
        date(value) {const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
        clockValue(value,base) {const d=new Date(value),anchor=new Date((base||this.date(value))+"T00:00:00");return duration(d-anchor);}
        footer(form,save,remove) {
            const error=node('p',undefined,'trip-log-error');error.setAttribute('role','alert');form.append(error);const actions=node('div',undefined,'dialog-actions two-actions');const cancel=node('button',globalThis.WMOFLanguagePack.text("8272b19f-0479-46fd-b1f8-13105354ce43"));cancel.type='button';cancel.addEventListener('click',()=>this.editor?.close());const submit=node('button',globalThis.WMOFLanguagePack.text("51fbcc20-278a-403f-891f-6312b48c1d42"));submit.type='submit';submit.className='primary-action';actions.append(cancel,submit);form.append(actions);
            if(remove){const del=node('button',globalThis.WMOFLanguagePack.text("522ad51e-f2b7-4203-8e4e-7e8139ae5473"),'danger');del.type='button';del.addEventListener('click',async()=>{if(!confirm(globalThis.WMOFLanguagePack.text("67216178-6d68-4008-9be1-a7b68fc086b5")))return;try{del.disabled=true;submit.disabled=true;await remove();this.editor?.close();await this.options.refresh();}catch(e){this.error(e);}finally{del.disabled=false;submit.disabled=false;}});form.append(del);}
            form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;try{await save();this.editor?.close();await this.options.refresh();}catch(e){this.error(e);}finally{submit.disabled=false;}});
        }
        async editEntryTime(trip,event,ended,addButton) {
            this.root.querySelector(':scope>.trip-log-error')?.remove();
            if(addButton)addButton.hidden=true;
            try{const session=this.entrySessions.get(String(trip.id)),current=trip.events.find(candidate=>String(candidate.id)===String(event.id));
                if(!current)throw new Error(globalThis.WMOFLanguagePack.text("62ac5c38-2fae-45c2-bae1-e21018bb48ea"));
                const base=this.date(session.settings.creationAnchor||current.timestamp);
                await this.numberPad({mode:'absolute',source:globalThis.WMOFLanguagePack.text("567a43c1-00f8-4e8b-80cf-b40702eb25cc"),initialValue:current.timestamp?this.clockValue(iso(current.timestamp),base):undefined,tripDefaults:{creationDate:base},title:globalThis.WMOFLanguagePack.text("5b688ed9-0cd2-5317-b65a-d3c1db1f844b"),allowEmpty:true,onCancel:()=>{this.addBefore.delete(String(trip.id));this.rerender();},
                    onConfirm:async value=>{current.timestamp=value||'';const key=current.value?.intervalKey,started=current.event==='interval.started'?current:trip.events.find(candidate=>candidate.event==='interval.started'&&candidate.value?.intervalKey===key),finished=current.event==='interval.ended'?current:trip.events.find(candidate=>candidate.event==='interval.ended'&&candidate.value?.intervalKey===key);if(started&&finished&&String(started.value?.type||'').toLowerCase()==='down'&&!started.value.approvalOverridden&&started.timestamp&&finished.timestamp)started.value.approvedTime=Date.parse(iso(finished.timestamp))-Date.parse(iso(started.timestamp));this.addBefore.delete(String(trip.id));this.root.querySelector(':scope>.trip-log-error')?.remove();this.rerender();}});
            }catch(error){if(addButton?.isConnected)addButton.hidden=false;throw error;}
        }
        async editEntryName(trip,event,ended,button,addButton) {
            this.root.querySelector(':scope>.trip-log-error')?.remove();
            if(button.parentElement?.querySelector('select'))return;
            if(addButton)addButton.hidden=true;
            const select=node('select');select.setAttribute('aria-label',globalThis.WMOFLanguagePack.text("d4f60d13-9cab-5e1f-ab87-69baad47c0b8"));
            const currentType=event.event==='interval.started'?this.entryKind(event):event.event;
            const choices=event.event==='interval.started'?['break','short-break','lunch','down']: [currentType];
            for(const value of choices){const option=node('option',value==='trip.started'?globalThis.WMOFLanguagePack.text("616197f7-881e-47fc-8c97-bb2478be7173"):value==='trip.stopped'?globalThis.WMOFLanguagePack.text("9e6c2b91-8fa1-48f6-a367-7a2807478028"):value.replace(/(^|-)(\w)/g,(_,dash,letter)=>`${dash?' ':''}${letter.toUpperCase()}`));option.value=value;select.append(option);}
            select.value=currentType;button.replaceWith(select);const cancel=node('button',globalThis.WMOFLanguagePack.text("40d9da58-d7c9-4c96-b18a-0f17e0f63255"),'trip-log-entry-cancel');cancel.type='button';select.parentElement.classList.add('has-entry-cancel');select.parentElement.append(cancel);select.focus();
            const restore=()=>{this.addBefore.delete(String(trip.id));if(select.isConnected){select.replaceWith(button);cancel.remove();button.parentElement.classList.remove('has-entry-cancel');}this.rerender();};cancel.addEventListener('pointerdown',event=>event.preventDefault());cancel.addEventListener('click',restore);
            select.addEventListener('change',async()=>{if(event.event!=='interval.started'){restore();return;}const current=trip.events.find(candidate=>String(candidate.id)===String(event.id));if(!current){restore();this.error(new Error(globalThis.WMOFLanguagePack.text("5da304a7-9321-4056-8a63-f05bc1c994fb")));return;}current.value.type=select.value==='short-break'?'break':select.value;if(current.value.type==='break')current.value.attributes={...(current.value.attributes||{}),breakType:select.value==='short-break'?'short':'break'};else if(current.value.attributes)delete current.value.attributes.breakType;this.root.querySelector(':scope>.trip-log-error')?.remove();restore();});
            select.addEventListener('blur',()=>{if(select.isConnected)restore();},{once:true});
        }
        async deleteEntry(trip,event) {
            this.root.querySelector(':scope>.trip-log-error')?.remove();
            const current=trip.events.find(candidate=>String(candidate.id)===String(event.id));
            if(!current)throw new Error(globalThis.WMOFLanguagePack.text("ef3a33d9-6346-461f-be30-53d63fd87ada"));
            const key=current.value?.intervalKey;trip.events=trip.events.filter(candidate=>candidate.value?.intervalKey!==key);for(const value of [...this.deleteVisible])if(value.startsWith(`${trip.id}:`))this.deleteVisible.delete(value);this.rerender();
        }
        async editApprovedTime(trip,event,ended,addButton){if(addButton)addButton.hidden=true;const current=trip.events.find(candidate=>String(candidate.id)===String(event.id));if(!current)throw new Error(globalThis.WMOFLanguagePack.text("46470b1f-d322-437e-ac59-52c8fefc384b"));const fallback=this.approvedTime(current,ended,trip.events);await this.numberPad({mode:'duration',source:globalThis.WMOFLanguagePack.text("e22b8ca4-3aeb-42de-99cd-44975a5d8485"),initialValue:fallback,title:globalThis.WMOFLanguagePack.text("2a93fe0f-1761-5ef0-afe0-088d856f8371"),allowEmpty:true,onCancel:()=>this.rerender(),onConfirm:async milliseconds=>{current.value.approvedTime=milliseconds===undefined?fallback:milliseconds;current.value.approvalOverridden=milliseconds!==undefined;const approval=[...trip.events].reverse().find(candidate=>candidate.event==='interval.approval-changed'&&candidate.value?.intervalKey===current.value?.intervalKey);if(approval){approval.value.state='approved';approval.value.value=current.value.approvedTime;}this.rerender();}});}
        async openSettings(trip) {
            const data=await this.options.request(trip.id),settings={...data.settings};const {form}=this.modal(globalThis.WMOFLanguagePack.text("e4524a84-e68f-4483-aca4-2fbb677695ff"));
            const original=new Date(settings.creationAnchor||iso(trip.startTime));let base=this.date(original);
            this.timeField(form,globalThis.WMOFLanguagePack.text("c1a768bf-c770-4812-b5ec-6d4257cca7bf"),settings.standardTimeMilliseconds,'duration',v=>settings.standardTimeMilliseconds=v);
            for(const [label,field] of [[globalThis.WMOFLanguagePack.text("b2cbecb7-1cd8-467c-a258-28fb5ed4f0ee"),'scheduledStart'],[globalThis.WMOFLanguagePack.text("5aabfe0a-74db-44f0-ab47-7bbfaadcacd8"),'startTime'],[globalThis.WMOFLanguagePack.text("4f361eb7-3f44-499c-8303-1121a2dde33e"),'creationTime']]) {
                const value=new Date(original.getTime()+timelineMilliseconds(settings[field])).toISOString();
                this.timeField(form,label,value,'absolute',v=>{if(field==='creationTime'){base=this.date(v);settings.creationAnchor=new Date(base+"T00:00:00").toISOString();}settings[field]=this.clockValue(v,base);},base);
            }
            const productive=node('label');const check=node('input');check.type='checkbox';check.checked=!settings.nonProduction;check.addEventListener('change',()=>settings.nonProduction=!check.checked);productive.append(check,document.createTextNode(globalThis.WMOFLanguagePack.text("1a53ccce-2778-593f-8c0c-6ca4af3f94d8")));form.append(productive);
            this.footer(form,()=>this.options.request(trip.id,{operation:'settings',revision:data.revision,settings}));
        }
        async deleteTrip(trip) {if(!confirm(`Delete ${trip.running?'the running trip':'this trip'} and all its entries?`))return;const data=await this.options.request(trip.id);await this.options.request(trip.id,{operation:'delete-trip',revision:data.revision});await this.options.refresh();}
    }
    TripLog.duration=duration;TripLog.percent=percent;TripLog.counted=counted;TripLog.uncertainIcon=uncertainIcon;window.TripLog=TripLog;
})();
