(() => {
    const node = (tag, text, className) => {const el=document.createElement(tag);if(text!==undefined) el.textContent=text;if(className) el.className=className;return el;};
    const clone = value => JSON.parse(JSON.stringify(value));
    const duration = ms => {const s=Math.floor(Math.max(0,Number(ms)||0)/1000);return `${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
    const durationMilliseconds = value =>
        Number.isSafeInteger(value) && value >= 0
            ? value
            : 0;
    const durationOrDash = value =>
        Number.isSafeInteger(value) && value >= 0
            ? duration(value)
            : '---';
    const iso = value => /(?:Z|[+-]\d\d:\d\d)$/.test(value)?value:String(value).replace(' ','T')+'Z';
    const breakOnly = trip => Boolean(trip.breakOnly || trip.events?.some(event => event.event === 'trip.started' && event.value?.breakOnly === true));
    const counted = trip => TripAggregates.counted(trip);
    const productive = trip => TripTimeBank.project(trip)?.productiveTimeMilliseconds ?? counted(trip);
    const aggregate = (trips, parent = false, now = Date.now()) => TripAggregates.calculate({trips, now,
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
        constructor(root,options) {this.root=root;this.options=options;this.expanded=new Map();this.editor=null;this.settingsVisible=false;this.downTimeExpanded=true;this.downTimeOnly=false;this.adjustedOnly=false;this.showPending=true;for(const key of ['downTimeExpanded','downTimeOnly','adjustedOnly','showPending'])if(typeof options.viewSettings?.()?.[key]==='boolean')this[key]=options.viewSettings()[key];}
        downtimeSummary(summary, overview=false) {
            if(!summary?.hasDowntime)return undefined;
            const box=node('div',undefined,'trip-log-downtime'+(overview?' trip-log-downtime-overview':''));
            const title=globalThis.WMOFLanguagePack.text('e09300d4-7ac5-4678-9f45-f5cc4500ff6d');
            box.setAttribute('role','group');box.setAttribute('aria-label',title);
            box.append(node('strong',title,'trip-log-downtime-title'));
            for(const [label,value,kind] of [[globalThis.WMOFLanguagePack.text('edb1ce75-f212-4577-a1b3-e88dc28bcb78'),summary.loggedMilliseconds,'logged'],[globalThis.WMOFLanguagePack.text('a6d2eeb0-2d5b-4a59-b059-4039e7492e39'),summary.approvedMilliseconds,'approved']]) {
                const cell=node('span',undefined,'trip-log-downtime-'+kind);
                cell.append(node('span',label+' '),node('strong',duration(value)));box.append(cell);
            }
            return box;
        }
        get showPendingPreference() {return this.options.showPendingDownTime?.()??this.options.includePendingDownTime?.()??this.showPending;}
        get showPendingEffective() {return this.downTimeOnlyEnabled||this.showPendingPreference;}
        get downTimeOnlyEnabled() {return Boolean(this.hasVisibleDownTime&&this.downTimeOnly);}
        saveViewSettings() {this.options.onViewSettings?.({downTimeExpanded:this.downTimeExpanded,downTimeOnly:this.downTimeOnly,adjustedOnly:this.adjustedOnly});}
        hasOfficialPercent(trip) {
            const record=trip.events?.findLast(event=>['trip.official-percent-set','trip.official-percent-cleared'].includes(event.event));
            return record?record.event==='trip.official-percent-set':Boolean(trip.officialCorrection);
        }
        downTimeValue(value,stacked=false) {
            const milliseconds=Math.max(0,Math.round(Number(value)||0)),digits=String(milliseconds%1000).padStart(3,'0');
            const result=node('strong',undefined,'trip-log-down-time'+(stacked?' is-stacked':''));
            result.append(node('span',duration(milliseconds),'trip-log-down-whole'),node('small',stacked?`(${digits} ms)`:`.${digits}`,'trip-log-down-milliseconds'));return result;
        }
        downTimeSection(trips) {
            const text=id=>globalThis.WMOFLanguagePack.text(id);
            const totals=TripDowntimeSummary.breakdown(trips,{now:this.downtimeNow});
            if(totals.pendingMilliseconds+totals.approvedMilliseconds+totals.unapprovedMilliseconds===0)return undefined;
            const includePending=this.showPendingEffective;
            const section=node('section',undefined,'trip-log-down-section');
            const details=node('details',undefined,'trip-log-down-breakdown');details.open=this.downTimeExpanded;
            details.addEventListener('toggle',()=>{if(details.isConnected&&this.downTimeExpanded!==details.open){this.downTimeExpanded=details.open;this.saveViewSettings();}});
            const summary=node('summary');summary.append(node('strong',text('e09300d4-7ac5-4678-9f45-f5cc4500ff6d')));
            const total=node('span',undefined,'trip-log-down-effective');
            total.append(node('span',text(includePending?'d7300001-7888-4711-9000-000000000001':'a6d2eeb0-2d5b-4a59-b059-4039e7492e39')),this.downTimeValue(includePending?totals.combinedMilliseconds:totals.approvedMilliseconds));summary.append(total);
            const content=node('div',undefined,'trip-log-down-content'),grid=node('div',undefined,'trip-log-down-grid');
            for(const [id,value,kind] of [['d7300001-7888-4711-9000-000000000002',totals.pendingMilliseconds,'pending'],['a6d2eeb0-2d5b-4a59-b059-4039e7492e39',totals.approvedMilliseconds,'approved'],['d7300001-7888-4711-9000-000000000003',totals.unapprovedMilliseconds,'unapproved']]){
                if(kind==='pending'&&!this.showPendingEffective)continue;
                const cell=node('div',undefined,'trip-log-down-'+kind);cell.append(node('span',text(id)),this.downTimeValue(value,true));grid.append(cell);
            }
            const logged=node('div',undefined,'trip-log-down-logged');logged.append(node('span',text('edb1ce75-f212-4577-a1b3-e88dc28bcb78')),this.downTimeValue(totals.loggedMilliseconds));
            content.append(grid,logged);details.append(summary,content);
            const filter=node('label',undefined,'trip-log-down-filter'),check=node('input');check.type='checkbox';check.dataset.downTimeOnly='true';check.checked=this.downTimeOnlyEnabled;check.disabled=!this.hasVisibleDownTime;
            check.addEventListener('change',()=>{this.downTimeOnly=check.checked;this.saveViewSettings();this.rerender();});filter.append(check,node('span',text('d7300001-7888-4711-9000-000000000004')));
            content.append(filter);section.append(details);return section;
        }
        numberPad(options={}) {return this.options.numberPad({cancelTarget:'none',confirmTarget:'none',...options});}
        setSettingsVisible(visible) {this.settingsVisible=Boolean(visible);const box=this.root.querySelector('.trip-log-settings');if(box){box.classList.toggle('is-open',this.settingsVisible);box.firstElementChild.inert=!this.settingsVisible;box.setAttribute('aria-hidden',String(!this.settingsVisible));const sync=()=>this.root.style.setProperty('--trip-log-settings-height',`${this.settingsVisible?box.getBoundingClientRect().height:0}px`);requestAnimationFrame(sync);box.addEventListener('transitionend',sync,{once:true});}}
        render(data,calendar) {
            this.calendar=calendar;this.downtimeNow=this.options.now?.()??Date.now();
            this.activeSweepDelay=`-${Math.round(performance.now()%4200)}ms`;
            this.incomplete=Boolean(data.incomplete);this.offline=Boolean(data.offline);this.loginRequired=Boolean(data.loginRequired);
            const trips=data.loginRequired?[]:data.trips.map(t=>TripTimeBank.withPendingPolicy({...t},this.showPendingEffective,{now:this.downtimeNow}));const liveSource=data.loginRequired?null:this.options.liveTrip?.();const live=liveSource?TripTimeBank.withPendingPolicy(liveSource,this.showPendingEffective,{now:this.downtimeNow}):null;
            if(live && Date.parse(live.startTime)>=Date.parse(calendar.startTime) && Date.parse(live.startTime)<Date.parse(calendar.endTime)) {
                const index=trips.findIndex(t=>String(t.id)===String(live.id));
                const filter=this.options.filter();
                if(filter==='all'||(filter==='productive'&&!breakOnly(live)&&!live.nonProduction)||(filter==='non-productive'&&!breakOnly(live)&&live.nonProduction)) {
                    if(index>=0) trips[index]={...trips[index],...live};else trips.push(live);
                } else if(index>=0) trips.splice(index,1);
            }
            trips.sort((a,b)=>Date.parse(iso(b.startTime))-Date.parse(iso(a.startTime))||b.id-a.id);
            this.trips=trips;
            const matchingTrips=trips.filter(trip=>!this.adjustedOnly||this.hasOfficialPercent(trip));
            const downTotals=TripDowntimeSummary.breakdown(matchingTrips,{now:this.downtimeNow});
            this.hasVisibleDownTime=downTotals.pendingMilliseconds+downTotals.approvedMilliseconds+downTotals.unapprovedMilliseconds>0;
            const visibleTrips=matchingTrips.filter(trip=>!this.downTimeOnlyEnabled||TripDowntimeSummary.breakdown([trip],{now:this.downtimeNow}).hasDowntime);
            this.aggregation=aggregate(visibleTrips,true,this.downtimeNow);const fragment=document.createDocumentFragment();
            if(!trips.length)this.settingsVisible=true;
            let settings=this.root.querySelector('.trip-log-settings');
            const reuseSettings=Boolean(settings);
            if(!settings){settings=node('section',undefined,'trip-log-settings');settings.id='tripLogSettings';
                const contents=node('div',undefined,'trip-log-settings-content');contents.append(this.controls(calendar),node('hr',undefined,'trip-log-settings-divider'));settings.append(contents);
            } else {
                const selects=settings.querySelectorAll('select');selects[0].value=this.options.filter();selects[1].value=this.options.range();
                const dates=window.CalendarRange.dates(calendar),inputs=settings.querySelectorAll('input[type=date]');
                inputs.forEach((input,i)=>{input.value=dates[i===0?'start':'end'];input.disabled=i===1&&this.options.range()!=='custom';});
                const includeCurrent=settings.querySelector('input[data-include-current]');if(includeCurrent)includeCurrent.checked=Boolean(this.options.includeCurrent?.());
                const pending=settings.querySelector('input[data-show-pending]');if(pending){pending.checked=this.showPendingPreference;pending.disabled=this.downTimeOnlyEnabled;pending.closest('label').classList.toggle('is-unavailable',this.downTimeOnlyEnabled);}
                const fallback=settings.querySelector('[data-down-time-filter-fallback]');if(fallback){fallback.checked=this.downTimeOnly;fallback.disabled=!this.hasVisibleDownTime;fallback.closest('label').hidden=this.hasVisibleDownTime;fallback.closest('label').classList.toggle('is-unavailable',!this.hasVisibleDownTime);}
            }
            if(!reuseSettings)fragment.append(settings);
            if(calendar.historical){
                const status=node('section',undefined,'trip-log-range-status');status.setAttribute('role','status');const dates=CalendarRange.dates(calendar);
                const label=globalThis.WMOFLanguagePack.text('d7300001-7888-4711-9000-000000000009');status.append(node('span',`${label} · ${dates.start} – ${dates.end}`));
                const current=node('button',globalThis.WMOFLanguagePack.text('d7300001-7888-4711-9000-000000000010'));current.type='button';current.dataset.returnCurrentRange='true';current.addEventListener('click',()=>this.options.onCurrent?.());status.append(current);fragment.append(status);
            }
            this.root.classList.toggle('trip-log-empty',visibleTrips.length===0);
            if(visibleTrips.length) {
            const overview=node('section',undefined,'trip-log-overview');const emphasis=node('div',undefined,'trip-log-emphasis');
            emphasis.append(node('strong',`${this.aggregation.tripCount} ${this.aggregation.tripCount===1?globalThis.WMOFLanguagePack.text("3b289746-71b2-4ac3-90dd-00a0402ba34f"):globalThis.WMOFLanguagePack.text("1c1bf8a6-f452-4dfa-8d43-ed38d4bcae1f")}`),node('strong',percent(visibleTrips,true),'trip-log-actual'));
            if(this.incomplete)emphasis.lastElementChild.append(uncertainIcon());
            const totals=aggregate(visibleTrips,true,this.downtimeNow);overview.append(emphasis,node('div',`Standard ${duration(totals.standardTimeMilliseconds)} · Actual ${duration(totals.productiveTimeMilliseconds)}`,'trip-log-times'));fragment.append(overview);const down=this.downTimeSection(trips.filter(trip=>!this.adjustedOnly||this.hasOfficialPercent(trip)));if(down)fragment.append(down);
            const columns=node('div',undefined,'trip-log-column-header');columns.setAttribute('role','row');for(const label of [globalThis.WMOFLanguagePack.text("5e8f393d-72a7-4b30-ba1e-69bbd765354f"),globalThis.WMOFLanguagePack.text("07613a20-4d6c-4fdf-a16d-6c94d28e5590"),globalThis.WMOFLanguagePack.text("77f1eddd-89b9-4e22-9fe1-aeeb4d060722"),globalThis.WMOFLanguagePack.text("c755d5bf-3277-4630-a938-898b8b6172dd"),'']){const cell=node('span',label);cell.setAttribute('role','columnheader');columns.append(cell);}fragment.append(columns);
            const days=(Date.parse(calendar.endTime)-Date.parse(calendar.startTime))/86400000;
            const levels=days>35?['month','week','day']:days>7?['week','day']:days>1?['day']:[];
            fragment.append(this.groups(visibleTrips,levels,calendar));
            } else {
                if(!data.loginRequired){const down=this.downTimeSection(trips.filter(trip=>!this.adjustedOnly||this.hasOfficialPercent(trip)));if(down)fragment.append(down);}
                const message=node('p',data.loginRequired?globalThis.WMOFLanguagePack.text("1b02fb00-aed1-432b-9c06-2cc98704eea2"):data.offline?globalThis.WMOFLanguagePack.text("595de126-bd64-4acc-be0f-a314413c2bd6"):globalThis.WMOFLanguagePack.text("d621fec0-6ca8-42fd-a0cf-1894616fd377"),'trip-log-empty-message');
                message.setAttribute('role','status');fragment.append(message);
            }
            if(reuseSettings){for(const child of [...this.root.children])if(child!==settings)child.remove();this.root.append(fragment);}
            else this.root.replaceChildren(fragment);
            this.setSettingsVisible(this.settingsVisible);
            if(this.pendingOverrideReported!==this.downTimeOnlyEnabled){this.pendingOverrideReported=this.downTimeOnlyEnabled;this.options.onPendingOverride?.(this.downTimeOnlyEnabled);}
        }
        controls(calendar) {
            const box=node('section',undefined,'trip-log-controls');
            const selectRow=(label,choices,value,handler)=>{const row=node('label');row.append(node('span',label));const select=node('select');for(const [v,text] of choices){const option=node('option',text);option.value=v;select.append(option);}select.value=value;select.addEventListener('change',()=>handler(select.value));row.append(select);box.append(row);};
            selectRow(globalThis.WMOFLanguagePack.text("9931b905-cc82-4afe-8b33-a9d31454146a"),[['all',globalThis.WMOFLanguagePack.text("96f27252-e455-45f0-876c-c6f604ad486b")],['productive',globalThis.WMOFLanguagePack.text("e9a19871-eb83-4f78-85a2-8dcbbc2b3f6d")],['non-productive',globalThis.WMOFLanguagePack.text("c62239f7-fec2-4242-bbb4-ad8759017128")]],this.options.filter(),this.options.onFilter);
            selectRow(globalThis.WMOFLanguagePack.text("2d7078b0-2daf-4ade-b37a-01f6e2ae734f"),[['day',globalThis.WMOFLanguagePack.text("86e12fa9-95ff-4a20-84bd-8d6744217a01")],['week',globalThis.WMOFLanguagePack.text("0589fe2c-5781-433b-855b-a30cbc304c15")],['pay-period',globalThis.WMOFLanguagePack.text("ff8216fc-6cdb-4cbb-a433-1d2bae1e8232")],['month',globalThis.WMOFLanguagePack.text("ed109a97-8e31-4c93-85cb-6dfb4480c0f7")],['year',globalThis.WMOFLanguagePack.text("c9de230e-c958-41be-ad35-70174a864a3f")],['custom',globalThis.WMOFLanguagePack.text("9e063c44-5f74-4196-bbab-3a49a72be041")]],this.options.range(),this.options.onRange);
            const dates=node('div',undefined,'trip-log-date-controls');const values=window.CalendarRange.dates(calendar);
            for(const [label,key] of [[globalThis.WMOFLanguagePack.text("c62f534c-5d7b-459f-bdc8-f14a3d2cbecf"),'start'],[globalThis.WMOFLanguagePack.text("4c0b0ee5-ddac-4e6a-b2b5-48f438f0cd92"),'end']]) {
                const input=node('input');input.type='date';input.value=values[key];input.disabled=key==='end'&&this.options.range()!=='custom';input.setAttribute('aria-label',key==='start'?globalThis.WMOFLanguagePack.text("6bd07958-dfbb-5e40-ab3c-c1347e5eac1c"):globalThis.WMOFLanguagePack.text("dcc024f5-cfbf-56cb-b10b-33c5367aed8b"));
                input.addEventListener('change',()=>this.options.onDate(key,input.value));dates.append(node('span',label),input);
            }
            box.append(dates);const include=node('label',undefined,'trip-log-include-current');const check=node('input');check.type='checkbox';check.dataset.includeCurrent='true';check.checked=Boolean(this.options.includeCurrent?.());check.addEventListener('change',()=>this.options.onIncludeCurrent?.(check.checked));include.append(node('span',globalThis.WMOFLanguagePack.text("d3df5443-5f50-4a22-b8e6-bdd43caf0d89")),check);box.append(include);
            const adjusted=node('label',undefined,'trip-log-include-current'),adjustedCheck=node('input');adjustedCheck.type='checkbox';adjustedCheck.dataset.adjustedOnly='true';adjustedCheck.checked=this.adjustedOnly;
            adjustedCheck.addEventListener('change',()=>{this.adjustedOnly=adjustedCheck.checked;this.saveViewSettings();this.rerender();});adjusted.append(node('span',globalThis.WMOFLanguagePack.text('d7300001-7888-4711-9000-000000000005')),adjustedCheck);box.append(adjusted);
            const pending=node('label',undefined,'trip-log-include-current'),pendingCheck=node('input');pendingCheck.type='checkbox';pendingCheck.dataset.showPending='true';pendingCheck.checked=this.showPendingPreference;pendingCheck.disabled=this.downTimeOnlyEnabled;pending.classList.toggle('is-unavailable',this.downTimeOnlyEnabled);
            pendingCheck.addEventListener('change',()=>{if(this.downTimeOnlyEnabled)return;this.showPending=pendingCheck.checked;if(this.options.onShowPendingDownTime)void this.options.onShowPendingDownTime(pendingCheck.checked);else{this.saveViewSettings();this.rerender();}});pending.append(node('span',globalThis.WMOFLanguagePack.text('d7300001-7888-4711-9000-000000000007')),pendingCheck);box.append(pending);
            const fallback=node('label',undefined,'trip-log-include-current'),fallbackCheck=node('input');fallbackCheck.type='checkbox';fallbackCheck.dataset.downTimeFilterFallback='true';fallbackCheck.checked=this.downTimeOnly;fallbackCheck.disabled=!this.hasVisibleDownTime;fallback.hidden=this.hasVisibleDownTime;fallback.classList.toggle('is-unavailable',!this.hasVisibleDownTime);
            fallbackCheck.addEventListener('change',()=>{this.downTimeOnly=fallbackCheck.checked;this.saveViewSettings();this.rerender();});fallback.append(node('span',globalThis.WMOFLanguagePack.text('d7300001-7888-4711-9000-000000000004')),fallbackCheck);box.append(fallback);return box;
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
                const summary=node('summary');const heading=node('div',undefined,'trip-log-group-heading');heading.append(node('strong',this.label(key,level)),node('span',`${aggregate(group,true,this.downtimeNow).tripCount} trips · ${percent(group,true)}`,'trip-log-actual'));
                if(this.incomplete)heading.lastElementChild.append(uncertainIcon());
                const totals=aggregate(group,true,this.downtimeNow);summary.append(heading,node('div',`Standard ${duration(totals.standardTimeMilliseconds)} · Actual ${duration(totals.productiveTimeMilliseconds)}`,'trip-log-times'));const downtime=this.downtimeSummary(totals.downtime);if(downtime)summary.append(downtime);const children=node('div',undefined,'trip-log-group-children');children.append(this.groups(group,rest,calendar));details.append(summary,children);fragment.append(details);}
            return fragment;
        }
        trip(trip) {
            const standalone=breakOnly(trip);const details=node('details',undefined,'trip-log-trip'),id='trip'+trip.id;details.classList.toggle('is-break-only',standalone);details.dataset.tripId=String(trip.id);details.classList.toggle('is-active-trip',Boolean(trip.running));if(trip.running){details.dataset.activeState=trip.activeState||'normal';details.style.setProperty('--trip-log-active-sweep-delay',this.activeSweepDelay);}details.open=this.expanded.get(id)??false;details.addEventListener('toggle',()=>this.expanded.set(id,details.open));
            const summary=node('summary');const fmt=new Intl.DateTimeFormat(undefined,{timeZone:this.calendar.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
            if(standalone) {
                const badge=node('span',globalThis.WMOFLanguagePack.text('418a206a-0686-4503-a9fd-4913490a5999'),'trip-log-break-only-badge');
                const ended=trip.running?this.downtimeNow:Date.parse(iso(trip.endTime));
                summary.append(node('strong',`${trip.running?'● ':''}${fmt.format(new Date(iso(trip.startTime)))}`),badge,
                    node('span',duration(Math.max(0,ended-Date.parse(iso(trip.startTime)))),'trip-log-break-only-duration'));
            } else summary.append(node('strong',`${trip.running?'● ':''}${fmt.format(new Date(iso(trip.startTime)))}`),node('span',duration(trip.standardTimeMilliseconds)),node('span',duration(productive(trip))),node('strong',percent([trip]),'trip-log-actual'));
            const official=TripTimeBank.project(trip)?.officialCorrection;
            if(!standalone){
                const value=summary.lastElementChild;value.classList.toggle('is-official-percent',Boolean(official));
                if(official){const badge=node('small',TripLog.officialText('official'),'trip-log-official-badge');value.append(badge);}
                if(!trip.running&&!this.offline&&!trip.buffered){const button=node('button',undefined,'trip-log-percent-button');button.type='button';button.setAttribute('aria-label',TripLog.officialText('edit'));button.append(...value.childNodes);value.append(button);button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();this.editOfficial(trip).catch(error=>this.error(error));});}
            }
            if(trip.buffered)summary.lastElementChild.append(uncertainIcon());
            const menu=node('div',undefined,'trip-log-menu'),toggle=node('button','⋮');toggle.type='button';toggle.setAttribute('aria-label','Trip actions');toggle.setAttribute('aria-expanded','false');
            const actions=node('div',undefined,'trip-log-menu-actions');actions.hidden=true;
            for(const [label,action] of [['Edit Trip',()=>this.openTripEditor(trip)],['Delete trip',()=>this.deleteTrip(trip)]]){const button=node('button',label);button.type='button';if(label==='Delete trip')button.className='danger';button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();actions.hidden=true;toggle.setAttribute('aria-expanded','false');Promise.resolve(action()).catch(error=>this.error(error));});actions.append(button);}
            toggle.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();actions.hidden=!actions.hidden;toggle.setAttribute('aria-expanded',String(!actions.hidden));});menu.append(toggle,actions);if(!this.offline||trip.buffered)summary.append(menu);
            const downtime=this.downtimeSummary(TripDowntimeSummary.trip(trip,{now:this.downtimeNow}));if(downtime)summary.append(downtime);details.append(summary);
            const entries=node('div',undefined,'trip-log-entries');entries.append(node('strong','Trip entries','trip-log-entry-heading'));
            const events=trip.events||[],deleted=new Set(events.filter(event=>event.event==='interval.deleted').map(event=>event.value?.intervalKey));
            const visible=events.filter(event=>(!standalone&&['trip.started','trip.stopped'].includes(event.event))||(['interval.started','interval.ended'].includes(event.event)&&!deleted.has(event.value?.intervalKey)));
            if(official?.startTime)visible.push({event:'trip.official-start',timestamp:official.startTime,value:{}});
            visible.sort((a,b)=>Date.parse(iso(a.timestamp))-Date.parse(iso(b.timestamp)));
            const activeEntry=trip.running?(visible.find(event=>event.event==='interval.started'&&!events.some(e=>e.event==='interval.ended'&&e.value?.intervalKey===event.value?.intervalKey))||visible.find(event=>event.event==='trip.started')):null;
            for(const event of visible){const started=event.event==='interval.ended'?events.find(e=>e.event==='interval.started'&&e.value?.intervalKey===event.value?.intervalKey):event,ended=started?.event==='interval.started'?events.find(e=>e.event==='interval.ended'&&e.value?.intervalKey===started.value?.intervalKey):null;
                const row=node('div',undefined,'trip-log-entry');if(event.value?.intervalKey)row.dataset.intervalKey=event.value.intervalKey;
                if(event.event==='trip.official-start')row.classList.add('is-official-start');
                if(event===activeEntry){row.classList.add('is-active-entry');row.dataset.activeState=trip.activeState||'trip';row.style.setProperty('--trip-log-active-sweep-delay',this.activeSweepDelay);}
                row.append(node('span',fmt.format(new Date(iso(event.timestamp)))),node('span',event.event==='trip.official-start'?TripLog.officialText('officialStart'):this.entryLabel(event,started,ended,events)));entries.append(row);
            }
            details.append(entries);return details;
        }
        async openTripEditor(trip){
            if(this.tripEditor?.dialog.open){this.tripEditor.dialog.focus();return;}
            this.tripEditor=await globalThis.TripEditor.open(trip,this.options,this.calendar);
        }
        entryLabel(event,started,ended,events=[]) {
            if(event.event==='trip.started')return globalThis.WMOFLanguagePack.text("d15209dd-a85c-4361-a2e5-d2271f5ec425");if(event.event==='trip.stopped')return globalThis.WMOFLanguagePack.text("5bf5c47c-e341-46b1-bdf5-a7a2e838b9ef");
            const type=String(started?.value?.type||globalThis.WMOFLanguagePack.text("e9d2ad4d-a32e-4c46-8adf-303391da3e39")).toLowerCase(),title=this.entryKind(started)==='short-break'?globalThis.WMOFLanguagePack.text("5b3c8ec9-b1f8-4d32-a337-2b42ff7ebf5e"):type.charAt(0).toUpperCase()+type.slice(1);
            if(event.event==='interval.started')return `${title} Started`;
            const planned=['break','lunch'].includes(type)?durationMilliseconds(started.value?.length)+durationMilliseconds(started.value?.startBuffer)+durationMilliseconds(started.value?.endBuffer):0;
            const actual=ended&&started?.timestamp?Date.parse(iso(ended.timestamp))-Date.parse(iso(started.timestamp)):NaN;
            const adjustment=value=>{const seconds=Math.floor(Math.abs(value)/1000),hours=Math.floor(seconds/3600);return `${hours?`${hours}:`:''}${String(Math.floor(seconds/60)%60).padStart(hours?2:1,'0')}:${String(seconds%60).padStart(2,'0')}`;};
            if(type==='down'&&Number.isFinite(actual)){const state=TripDowntimeSummary.approvalState(started,events);if(state!=='approved')return `${title} Ended · ${globalThis.WMOFLanguagePack.text(state==='pending'?'d7300001-7888-4711-9000-000000000002':'d7300001-7888-4711-9000-000000000003')}`;const approved=durationMilliseconds(this.approvedTime(started,ended,events)),difference=approved-actual;if(difference!==0)return `${title} Ended · ${adjustment(difference)} Approval ${difference>0?globalThis.WMOFLanguagePack.text("93bc5972-8ee1-4b9b-bac5-c21358221e6b"):globalThis.WMOFLanguagePack.text("ce37f4e8-7850-48f4-890a-0dec1b6a972a")}`;}
            if(planned>0&&Number.isFinite(actual)&&actual!==planned){const value=adjustment(actual-planned);return actual<planned?`${title} Ended Early · ${value} Gained`:`${title} Ended Late · ${value} Lost`;}
            return `${title} Ended`;
        }
        entryKind(event) {const type=String(event?.value?.type||'').toLowerCase();const breakType=String(event?.value?.attributes?.breakType||event?.value?.breakType||'').toLowerCase();return type==='break'&&breakType==='short'?'short-break':type;}
        approvedTime(started,ended,events=[]) {return TripDowntimeSummary.approved(started,ended,events);}
        promptOfficialStart() {
            const {dialog,form}=this.modal(TripLog.officialText('startPrompt'));dialog.classList.add('official-start-prompt');form.append(node('p',TripLog.officialText('startPromptDescription')));
            return new Promise(resolve=>{const actions=node('div',undefined,'dialog-actions two-actions');for(const [key,value]of [['no',false],['yes',true]]){const button=node('button',TripLog.officialText(key));button.type='button';button.dataset.officialStartChoice=key;button.addEventListener('click',()=>{resolve(value);dialog.close();});actions.append(button);}form.append(actions);dialog.addEventListener('close',()=>resolve(undefined),{once:true});});
        }
        rerender(){this.render({trips:this.trips,offline:this.offline,incomplete:this.incomplete,loginRequired:this.loginRequired},this.calendar);}
        error(error) {if(this.editor){const msg=this.editor.querySelector('[role="alert"]');msg.textContent=error.message||String(error);}else {this.root.querySelector(':scope>.trip-log-error')?.remove();const msg=node('p',error.message||String(error),'trip-log-error');msg.setAttribute('role','alert');this.root.prepend(msg);}}
        modal(title) {
            this.editor?.remove();const dialog=node('dialog',undefined,'app-dialog trip-log-editor');const form=node('form');const heading=node('header',undefined,'dialog-header');heading.append(node('h2',title));const close=node('button','×');close.type='button';close.setAttribute('aria-label',globalThis.WMOFLanguagePack.text("2db71c87-d3a0-5fa0-9144-6c0d21ad47c0"));close.addEventListener('click',()=>dialog.close());heading.append(close);form.append(heading);dialog.append(form);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();if(this.editor===dialog)this.editor=null;});this.editor=dialog;document.querySelector("shared-modal-host")?.register(dialog);dialog.showModal();return {dialog,form};
        }
        async editOfficial(trip){
            if(trip.running||breakOnly(trip))throw new Error(TripLog.officialText('completedOnly'));
            const data=await this.options.request(trip.id),fresh={...trip,events:clone(data.events)},bank=TripTimeBank.project(fresh),productiveTime=bank?.productiveTimeMilliseconds??counted(fresh),baseCredit=bank?.officialCorrection?.baseAllowanceCreditMilliseconds??bank?.allowanceCreditMilliseconds??0;
            if(!(productiveTime>0))throw new Error(TripLog.officialText('completedOnly'));
            const official=bank?.officialCorrection,calculated=100*(fresh.standardTimeMilliseconds+baseCredit)/productiveTime;
            await this.numberPad({mode:'percent',source:'official-percent',title:TripLog.officialText('title'),anchorDigit:.1,confirmUnchanged:true,
                initialValue:official?.percent??Number(calculated.toFixed(1)),
                previewOfficial:value=>({text:`${TripLog.officialText('calculated')}: ${calculated.toFixed(2)}% · ${TripLog.officialText('adjustment')}: ${value===null?'—':TripLog.signedDuration(value/100*productiveTime-fresh.standardTimeMilliseconds-baseCredit)}`,clearText:TripLog.officialText('clear')}),
                onClearOfficial:official?async()=>{await this.options.request(trip.id,{operation:'official-percent-clear',revision:data.revision});await this.options.refresh();}:undefined,
                onConfirm:async value=>{if(!(Number.isFinite(value)&&value>=0))return false;const showOfficialStart=await this.promptOfficialStart();if(showOfficialStart===undefined)return false;if(official?.percent===value&&Boolean(official.startTime)===showOfficialStart)return true;await this.options.request(trip.id,{operation:'official-percent',revision:data.revision,percentTenths:Math.round(value*10),showOfficialStart});await this.options.refresh();return true;}});
        }
        async deleteTrip(trip) {if(!confirm(`Delete ${trip.running?'the running trip':'this trip'} and all its entries?`))return;const data=await this.options.request(trip.id);await this.options.request(trip.id,{operation:'delete-trip',revision:data.revision});await this.options.refresh();}
    }
    TripLog.officialIds={"official": "5ac2a49f-40b1-5037-bf9f-5111fcbcb88c", "edit": "dc01bd88-a3bb-5316-b67e-1ea9d911c42b", "title": "a6d82e93-de2e-5e13-a5e8-ebe46c684f3f", "calculated": "290630bd-1932-5cbd-873f-344f6c5d03d8", "adjustment": "355aa22d-6418-512e-819b-7b696959a7bc", "clear": "d2c8a2d1-708f-5f70-8b5e-293d5cb0b614", "cleared": "008effdd-f693-5e3c-9add-dad7388a7d28", "protected": "028e0529-dfe2-5ede-a55f-187800e89aa2", "superseded": "82dba04f-f42c-5b8c-8bbd-925a7ace0197", "completedOnly": "934af6eb-d600-5932-9c1c-5a95b581a140"};
    Object.assign(TripLog.officialIds,{officialStart:'0f346711-8b90-4f57-ac4a-fc9b968f2190',startPrompt:'cd75d332-a92d-4472-a81d-bf58e1065def',startPromptDescription:'081d34a1-7bdf-49b0-bb44-05f9be74dfb4',yes:'4f6541f4-61d9-4e23-858c-5d2c7ecb37d8',no:'9db027f8-1bd5-4c06-8ef0-235f4587c5f2'});
    TripLog.officialText=key=>globalThis.WMOFLanguagePack.text(TripLog.officialIds[key]);
    TripLog.signedDuration=value=>{const ms=Math.round(Math.abs(value)),hours=Math.floor(ms/3600000);return `${value<0?'−':'+'}${hours}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};
    TripLog.duration=duration;TripLog.percent=percent;TripLog.counted=counted;TripLog.uncertainIcon=uncertainIcon;window.TripLog=TripLog;
})();
