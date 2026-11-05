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
        static visualText(key) {return globalThis.WMOFLanguagePack.text({'not-applied':'d7600001-0000-4000-8000-000000000001','totals-only':'d7600001-0000-4000-8000-000000000002',mixed:'d7600001-0000-4000-8000-000000000003',surplus:'d7600001-0000-4000-8000-000000000004',deficit:'d7600001-0000-4000-8000-000000000005',gained:'d7600001-0000-4000-8000-000000000006',lost:'d7600001-0000-4000-8000-000000000007'}[key]);}
        static netRange(value) {return value<0?'approval-deficit':value>0?'approval-surplus':'down';}
        static mutedColor(value) {
            TripLog.colorCache??=new Map();if(TripLog.colorCache.has(value))return TripLog.colorCache.get(value);
            let rgb;if(/^#[0-9a-f]{6}$/i.test(value))rgb=value.slice(1).match(/../g).map(v=>parseInt(v,16));
            else if(/^rgb/.test(value))rgb=value.match(/[\d.]+/g)?.slice(0,3).map(Number);
            if(!rgb)return value;
            const grey=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722,color='#'+rgb.map(v=>Math.round(v*.7+grey*.3).toString(16).padStart(2,'0')).join('');TripLog.colorCache.set(value,color);return color;
        }
        static palette(force=false) {
            if(!force&&TripLog.paletteCache)return TripLog.paletteCache;
            const source=document.querySelector('#clockTimer,clock-timer'),style=getComputedStyle(source||document.documentElement),fallback={trip:'#0053e2',break:'#001e60',lunch:'#ffc220',down:'#5f6772','approval-surplus':'#9c6b30','approval-deficit':'#7a1f3d'};
            return TripLog.paletteCache=Object.fromEntries(Object.entries(fallback).map(([key,value])=>[key,TripLog.mutedColor(style.getPropertyValue('--clock-timer-'+key+'-color').trim()||style.getPropertyValue('--timer-'+key+'-color').trim()||value)]));
        }
        static accent(element,key) {element.dataset.rangeColor=key;element.style.setProperty('--down-accent',TripLog.palette()[key]||TripLog.palette().down);return element;}
        static exclusion(element,status) {
            if(!status)return;element.dataset.exclusion=status;element.classList.add('down-excluded');const badge=node('small',TripLog.visualText(status),'down-exclusion-badge');element.append(badge);return element;
        }
        static dot(target,key) {const dot=node('i',undefined,'down-timeline-dot');dot.setAttribute('aria-hidden','true');dot.dataset.timelineDot='true';TripLog.accent(dot,key);target.append(dot);return dot;}
        static layoutTimeline(timeline) {
            if(!timeline.isConnected)return;timeline.querySelectorAll(':scope>.down-timeline-link').forEach(line=>line.remove());const dots=[...timeline.querySelectorAll('[data-timeline-dot]')],box=timeline.getBoundingClientRect(),scaleX=timeline.offsetWidth?box.width/timeline.offsetWidth:1,scaleY=timeline.offsetHeight?box.height/timeline.offsetHeight:1;
            for(let i=0;i<dots.length-1;i++){const a=dots[i].getBoundingClientRect(),b=dots[i+1].getBoundingClientRect();if(!a.width||b.top<a.top)continue;const line=node('i',undefined,'down-timeline-link');line.setAttribute('aria-hidden','true');line.dataset.fromRange=dots[i].dataset.rangeColor;line.dataset.toRange=dots[i+1].dataset.rangeColor;line.style.left=((a.left+a.width/2-box.left)/scaleX-timeline.clientLeft-1)+'px';line.style.top=((a.top+a.height/2-box.top)/scaleY-timeline.clientTop)+'px';line.style.height=((b.top+b.height/2-a.top-a.height/2)/scaleY)+'px';line.style.background='linear-gradient(to bottom,'+getComputedStyle(dots[i]).getPropertyValue('--down-accent')+','+getComputedStyle(dots[i+1]).getPropertyValue('--down-accent')+')';timeline.append(line);}
        }
        static refreshVisuals() {const palette=TripLog.palette(true);document.querySelectorAll('[data-range-color]').forEach(element=>element.style.setProperty('--down-accent',palette[element.dataset.rangeColor]||palette.down));document.querySelectorAll('.trip-log-timeline,.trip-editor-timeline').forEach(timeline=>TripLog.layoutTimeline(timeline));document.querySelectorAll('.down-accounting-strip').forEach(strip=>TripLog.fitAccounting(strip));}
        static fitAccounting(strip) {
            if(!strip.isConnected)return;const cells=[...strip.querySelectorAll('[data-down-amount]')];for(const cell of cells)for(const child of cell.children)child.style.removeProperty('font-size');
            const factors={label:1,value:1,badge:1};for(const cell of cells){const style=getComputedStyle(cell),available=cell.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);if(available<=0)continue;for(const child of cell.children){const kind=child.classList.contains('down-exclusion-badge')?'badge':child.tagName==='STRONG'?'value':'label',size=child.getBoundingClientRect().width;let width=size;if(child.classList.contains('down-exclusion-badge'))width=Math.max(size,child.scrollWidth+2);if(width>available)factors[kind]=Math.min(factors[kind],available/width);}}
            for(const cell of cells)for(const child of cell.children){const kind=child.classList.contains('down-exclusion-badge')?'badge':child.tagName==='STRONG'?'value':'label';if(factors[kind]<1)child.style.setProperty('font-size',Math.max(5,parseFloat(getComputedStyle(child).fontSize)*factors[kind]-.2)+'px',child.classList.contains('down-exclusion-badge')?'important':'');}
        }
        static scheduleVisuals() {if(TripLog.visualFrame)return;TripLog.visualFrame=requestAnimationFrame(()=>{TripLog.visualFrame=0;TripLog.refreshVisuals();});}
        static watchVisuals() {
            if(TripLog.visualsWatching)return;TripLog.visualsWatching=true;const refresh=()=>TripLog.scheduleVisuals();globalThis.addEventListener('resize',refresh);document.fonts?.addEventListener?.('loadingdone',refresh);
            TripLog.paletteObserver=new MutationObserver(refresh);TripLog.paletteObserver.observe(document.documentElement,{attributes:true,attributeFilter:['style','data-seasonal-theme']});const clock=document.querySelector('#clockTimer,clock-timer');if(clock)TripLog.paletteObserver.observe(clock,{attributes:true,attributeFilter:['style']});
        }
        static accountingStyle(strip,{mode,hasPending,hasFinalized,net=0}) {
            strip.classList.add('down-accounting-strip');const cells=[...strip.children];strip.style.setProperty('--down-columns',cells.length);
            for(const cell of cells){const kind=cell.dataset.downAmount;TripLog.accent(cell,kind==='unapproved'?'approval-deficit':kind==='net'?TripLog.netRange(net):'down');cell.classList.remove('is-not-applied');let status=mode==='ignore-pending'&&kind==='pending'?'not-applied':mode==='pending-only'&&['approved','unapproved','net'].includes(kind)?'totals-only':null;if(kind==='net'&&mode==='pending-only'&&hasPending&&hasFinalized)status='mixed';TripLog.exclusion(cell,status);}
            strip.replaceChildren();for(const rowCells of [cells.filter(cell=>['recorded','pending'].includes(cell.dataset.downAmount)),cells.filter(cell=>!['recorded','pending'].includes(cell.dataset.downAmount))]){
                if(!rowCells.length)continue;const row=node('div',undefined,'down-accounting-row');row.style.setProperty('--row-columns',rowCells.length);strip.append(row);
                for(let i=0;i<rowCells.length;i++){const cell=rowCells[i],normal=!cell.dataset.exclusion,shared=!normal&&['approval-deficit','approval-surplus'].includes(cell.dataset.rangeColor),run=[cell];while(i+1<rowCells.length&&(normal?!rowCells[i+1].dataset.exclusion:shared&&rowCells[i+1].dataset.exclusion&&rowCells[i+1].dataset.rangeColor===cell.dataset.rangeColor))run.push(rowCells[++i]);
                    if(normal||run.length>1){const group=node('div',undefined,normal?'down-accounting-normal':'down-accounting-shared-edge down-excluded');group.style.setProperty('--cell-share',run.length);group.style.setProperty('--group-columns',run.length);if(normal){if(i+1<rowCells.length)group.classList.add('meets-rounded-section');}else{TripLog.accent(group,cell.dataset.rangeColor);group.dataset.exclusion=cell.dataset.exclusion;}run.forEach(item=>group.append(item));row.append(group);}else{cell.style.setProperty('--cell-share',1);row.append(cell);}
                }
            }

        }
        constructor(root,options) {TripLog.watchVisuals();this.root=root;this.options=options;this.trips=[];this.expanded=new Map();this.editor=null;this.settingsVisible=false;this.downTimeExpanded=true;this.downTimeOnly=false;this.adjustedOnly=false;this.showPending=true;for(const key of ['downTimeExpanded','downTimeOnly','adjustedOnly','showPending'])if(typeof options.viewSettings?.()?.[key]==='boolean')this[key]=options.viewSettings()[key];}
        downtimeSummary(summary, overview=false) {
            if(!summary?.hasDowntime)return undefined;
            const box=node('div',undefined,'trip-log-downtime'+(overview?' trip-log-downtime-overview':''));
            const title=globalThis.WMOFLanguagePack.text('e09300d4-7ac5-4678-9f45-f5cc4500ff6d');
            box.setAttribute('role','group');box.setAttribute('aria-label',title);
            const heading=node('strong',undefined,'trip-log-downtime-title'),icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');icon.classList.add('trip-log-downtime-icon');icon.innerHTML='<path d="M9 2h6M12 2v3M18 6l2-2"/><circle cx="12" cy="14" r="8"/><path d="M12 9v5l3 2"/>';heading.append(icon,document.createTextNode(title));box.append(heading);
            const includePending=this.showPendingEffective;
            box.classList.toggle('is-not-applied',!(summary.approvedMilliseconds+(includePending?(summary.pendingMilliseconds||0):0)>0));
            for(const [label,value,kind] of [[globalThis.WMOFLanguagePack.text('edb1ce75-f212-4577-a1b3-e88dc28bcb78'),summary.loggedMilliseconds,'logged'],[globalThis.WMOFLanguagePack.text(includePending?'d7300001-7888-4711-9000-000000000011':'a6d2eeb0-2d5b-4a59-b059-4039e7492e39'),summary.approvedMilliseconds+(includePending?(summary.pendingMilliseconds||0):0),'approved']]) {
                const cell=node('span',undefined,'trip-log-downtime-'+kind);
                if(kind==='approved'){cell.dataset.pendingIncluded=String(includePending);cell.title=includePending?globalThis.WMOFLanguagePack.text('d7300001-7888-4711-9000-000000000001'):label;}
                cell.append(node('span',label+' '),node('strong',duration(value)));box.append(cell);
            }
            TripLog.accent(box,'down');if(!includePending&&summary.pendingMilliseconds>0&&!(summary.approvedMilliseconds>0))TripLog.exclusion(box,'not-applied');return box;
        }
        static normalizePendingMode(value) {return ['pending-only','all','ignore-pending'].includes(value)?value:value===false?'ignore-pending':'all';}
        static nextPendingMode(value) {return {'pending-only':'all',all:'ignore-pending','ignore-pending':'pending-only'}[TripLog.normalizePendingMode(value)];}
        static pendingModeLabel(mode) {return globalThis.WMOFLanguagePack.text({'pending-only':'d7500001-0000-4000-8000-000000000001',all:'d7500001-0000-4000-8000-000000000002','ignore-pending':'d7500001-0000-4000-8000-000000000003'}[TripLog.normalizePendingMode(mode)]);}
        get pendingMode() {return TripLog.normalizePendingMode(this.options.pendingDownTimeMode?.()??this.localPendingMode??this.options.showPendingDownTime?.()??this.options.includePendingDownTime?.()??this.showPending);}
        get showPendingPreference() {return this.pendingMode!=='ignore-pending';}
        get showPendingEffective() {return this.showPendingPreference;}
        syncPendingControl(input) {input.checked=this.pendingMode==='pending-only';input.indeterminate=this.pendingMode==='all';input.setAttribute('aria-checked',input.indeterminate?'mixed':String(input.checked));input.disabled=false;const label=input.closest('label');label?.classList.remove('is-unavailable','is-overridden');if(label)label.querySelector('span').textContent=TripLog.pendingModeLabel(this.pendingMode);}
        async setPendingMode(mode) {this.localPendingMode=TripLog.normalizePendingMode(mode);if(this.options.onPendingDownTimeMode)await this.options.onPendingDownTimeMode(this.localPendingMode);else await this.options.onShowPendingDownTime?.(this.showPendingEffective);this.rerender();}
        pendingPresentationIncludes(trip,mode=this.pendingMode) {const down=TripDowntimeSummary.breakdown([trip],{now:this.downtimeNow});return mode!=='pending-only'||!down.hasDowntime||down.pendingMilliseconds>0;}
        tripPresentationIncludes(trip) {return (!this.downTimeOnlyEnabled||TripDowntimeSummary.breakdown([trip],{now:this.downtimeNow}).hasDowntime)&&this.pendingPresentationIncludes(trip);}
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
        downCategoryButton(kind,label,value,className,stacked=false) {
            const button=node('button',undefined,className+' trip-log-down-category');button.type='button';button.dataset.downCategory=kind;button.disabled=!(value>0);
            button.setAttribute('aria-label',globalThis.WMOFLanguagePack.text('d7400001-0000-4000-8000-000000000024',{category:label}));
            button.append(node('span',label),this.downTimeValue(value,stacked));button.addEventListener('click',()=>void this.applyDownShortcut(kind).catch(error=>this.error(error)));return button;
        }
        closestDownSettings(category,trips=this.downSummaryTrips||[]) {
            const rows=trips.map(trip=>({trip,down:TripDowntimeSummary.breakdown([trip],{now:this.downtimeNow}),adjusted:this.hasOfficialPercent(trip)}));
            const keys={pending:'pendingMilliseconds',approved:'approvedMilliseconds',unapproved:'unapprovedMilliseconds',logged:'loggedMilliseconds',applied:'combinedMilliseconds'},key=keys[category];if(!key)return null;
            const contributing=rows.filter(row=>row.down[key]>0);if(!contributing.length)return null;
            const required=new Set(contributing.map(row=>row.trip)),needsPending=category==='pending'||category==='applied'&&contributing.some(row=>row.down.pendingMilliseconds>0),needsActive=contributing.some(row=>row.trip.running);
            const current={includeCurrent:Boolean(this.options.includeCurrent?.()),pendingMode:this.pendingMode,downTimeOnly:this.downTimeOnly,adjustedOnly:this.adjustedOnly};let best=null;
            const less=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]<b[i];return false;};
            for(const pendingMode of ['pending-only','all','ignore-pending'])for(let mask=0;mask<8;mask++){
                const candidate={includeCurrent:Boolean(mask&1),pendingMode,downTimeOnly:Boolean(mask&2),adjustedOnly:Boolean(mask&4)};
                const matching=rows.filter(row=>!candidate.adjustedOnly||row.adjusted),hasDown=matching.some(row=>row.down.hasDowntime),effectivePending=candidate.pendingMode!=='ignore-pending';
                if(needsPending&&!effectivePending||needsActive&&!candidate.includeCurrent||['approved','unapproved','logged','applied'].includes(category)&&candidate.pendingMode==='pending-only'&&contributing.some(row=>row.down.approvedMilliseconds+row.down.unapprovedMilliseconds>0))continue;
                const visible=matching.filter(row=>(candidate.includeCurrent||!row.trip.running)&&(!candidate.downTimeOnly||!hasDown||row.down.hasDowntime)&&this.pendingPresentationIncludes(row.trip,candidate.pendingMode));if(!contributing.every(row=>visible.includes(row)))continue;
                const changed=Object.keys(current).filter(key=>current[key]!==candidate[key]);
                const extra=visible.filter(row=>!required.has(row.trip)).length,extraActive=candidate.includeCurrent?visible.filter(row=>row.trip.running&&!required.has(row.trip)).length:0,extraPending=effectivePending&&!needsPending?visible.filter(row=>row.down.pendingMilliseconds>0).length:0,score=[extra,extraActive+extraPending,changed.length];
                if(!best||less(score,best.score))best={...candidate,changed,score,contributors:contributing.map(row=>row.trip.id)};
            }
            return best;
        }
        async applyDownShortcut(category) {
            if(this.downShortcutBusy)return false;
            const next=this.closestDownSettings(category);if(!next)return false;
            this.downDialog?.close();if(!next.changed.length)return true;
            this.downShortcutBusy=true;
            try{
                const changed=new Set(next.changed);
                this.downTimeOnly=next.downTimeOnly;this.adjustedOnly=next.adjustedOnly;this.localPendingMode=next.pendingMode;this.saveViewSettings();
                if(changed.has('includeCurrent'))await this.options.onIncludeCurrent?.(next.includeCurrent);
                if(changed.has('pendingMode'))await this.setPendingMode(next.pendingMode);
                this.rerender();
                this.setSettingsVisible(true);
                const selectors={includeCurrent:'[data-include-current]',pendingMode:'[data-show-pending]',downTimeOnly:'[data-down-time-filter-fallback]',adjustedOnly:'[data-adjusted-only]'};
                for(const key of changed)this.settings.querySelector(selectors[key])?.closest('label').classList.add('is-shortcut-updated');
                const notice=node('span',globalThis.WMOFLanguagePack.text('d7400001-0000-4000-8000-000000000025'),'trip-log-shortcut-status');notice.setAttribute('role','status');this.settingsDialog.append(notice);
                await new Promise(resolve=>setTimeout(resolve,1600));
                this.settings.querySelectorAll('.is-shortcut-updated').forEach(label=>label.classList.remove('is-shortcut-updated'));notice.remove();this.setSettingsVisible(false);return true;
            }finally{this.downShortcutBusy=false;}
        }
        downTimeSection(trips) {
            const text=id=>globalThis.WMOFLanguagePack.text(id);
            const totals=TripDowntimeSummary.breakdown(trips,{now:this.downtimeNow});
            if(totals.pendingMilliseconds+totals.approvedMilliseconds+totals.unapprovedMilliseconds===0)return undefined;
            const includePending=this.showPendingEffective;
            const section=node('section',undefined,'trip-log-down-section');
            section.classList.toggle('is-not-applied',!(totals.approvedMilliseconds+(includePending?totals.pendingMilliseconds:0)>0));
            const details=node('section',undefined,'trip-log-down-breakdown');
            const summary=node('header');summary.append(node('strong',text('e09300d4-7ac5-4678-9f45-f5cc4500ff6d')));
            const total=this.downCategoryButton(includePending?'applied':'approved',text(includePending?'d7300001-7888-4711-9000-000000000011':'a6d2eeb0-2d5b-4a59-b059-4039e7492e39'),includePending?totals.combinedMilliseconds:totals.approvedMilliseconds,'trip-log-down-effective');summary.append(total);
            const content=node('div',undefined,'trip-log-down-content'),grid=node('div',undefined,'trip-log-down-grid');
            for(const [id,value,kind] of [['d7300001-7888-4711-9000-000000000002',totals.pendingMilliseconds,'pending'],['a6d2eeb0-2d5b-4a59-b059-4039e7492e39',totals.approvedMilliseconds,'approved'],['d7300001-7888-4711-9000-000000000003',totals.unapprovedMilliseconds,'unapproved']]){

                const cell=this.downCategoryButton(kind,text(id),value,'trip-log-down-'+kind,true);TripLog.accent(cell,kind==='unapproved'?'approval-deficit':'down');if(kind==='pending'&&!includePending)TripLog.exclusion(cell,'not-applied');else if(this.pendingMode==='pending-only'&&kind!=='pending'&&totals.approvedMilliseconds+totals.unapprovedMilliseconds>0)TripLog.exclusion(cell,'totals-only');grid.append(cell);
            }
            const logged=this.downCategoryButton('logged',text('edb1ce75-f212-4577-a1b3-e88dc28bcb78'),totals.loggedMilliseconds,'trip-log-down-logged');
            content.append(grid,logged);details.append(summary,content);
            section.append(details);return section;
        }
        numberPad(options={}) {return this.options.numberPad({cancelTarget:'none',confirmTarget:'none',...options});}
        overlay(kind,title) {
            const key=kind+'Dialog';if(this[key])return this[key];
            const dialog=node('dialog',undefined,'app-dialog trip-log-'+kind+'-dialog'),head=node('header',undefined,'dialog-header'),heading=node('h2',title),close=node('button','×');if(kind==='down'){const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('class','trip-log-downtime-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML='<path d="M9 2h6M12 2v3M18 6l2-2"/><circle cx="12" cy="14" r="8"/><path d="M12 9v5l3 2"/>';heading.prepend(icon);}close.type='button';close.setAttribute('aria-label',globalThis.WMOFLanguagePack.text('2db71c87-d3a0-5fa0-9144-6c0d21ad47c0'));close.addEventListener('click',()=>dialog.close());head.append(heading,close);dialog.append(head,node('div',undefined,'trip-log-overlay-content'));document.body.append(dialog);document.querySelector('shared-modal-host')?.register(dialog);this[key]=dialog;return dialog;
        }
        setSettingsVisible(visible) {
            this.settingsVisible=Boolean(visible);this.root.style.setProperty('--trip-log-settings-height','0px');
            if(!this.settings)return;
            const dialog=this.overlay('settings',globalThis.WMOFLanguagePack.text('d7400001-0000-4000-8000-000000000015'));
            if(!dialog.contains(this.settings))dialog.lastElementChild.append(this.settings);
            this.settings.classList.add('is-open');this.settings.firstElementChild.inert=false;this.settings.removeAttribute('aria-hidden');
            if(visible&&!dialog.open){dialog.showModal();this.options.onSettingsOpened?.();}else if(!visible&&dialog.open)dialog.close();
            if(!dialog.dataset.bound){dialog.dataset.bound='true';dialog.addEventListener('close',()=>{this.settingsVisible=false;this.options.onSettingsClosed?.();});}
        }
        showDownSummary() {
            if(!this.downSummaryTrips?.length)return;
            const section=this.downTimeSection(this.downSummaryTrips);if(!section)return;
            const dialog=this.overlay('down',globalThis.WMOFLanguagePack.text('d7400001-0000-4000-8000-000000000017'));dialog.lastElementChild.replaceChildren(section);
            if(!dialog.open)dialog.showModal();
        }
        updateDownSummary(trips) {
            this.downSummaryTrips=trips;const totals=TripDowntimeSummary.breakdown(trips,{now:this.downtimeNow});
            this.options.onDownAvailable?.(totals.hasDowntime,totals.approvedMilliseconds+(this.showPendingEffective?totals.pendingMilliseconds:0)>0);
            if(this.downDialog?.open){const section=this.downTimeSection(trips);if(section){this.downDialog.lastElementChild.replaceChildren(section);}else this.downDialog.close();}
        }

        render(data,calendar,{liveUpdate=false}={}) {
            const scroll=[...this.root.querySelectorAll('.trip-log-aggregate-pane,.trip-log-trips-pane')].map(e=>[e.className,e.scrollTop,e.scrollLeft]);
            const rootScroll=this.root.scrollTop;
            this.calendar=calendar;this.downtimeNow=this.options.now?.()??Date.now();
            this.activeSweepDelay=`-${Math.round(performance.now()%4200)}ms`;
            this.incomplete=Boolean(data.incomplete);this.offline=Boolean(data.offline);this.loginRequired=Boolean(data.loginRequired);
            const trips=data.loginRequired?[]:data.trips.map(t=>({...t}));const live=data.loginRequired?null:this.options.liveTrip?.();
            if(live && Date.parse(live.startTime)>=Date.parse(calendar.startTime) && Date.parse(live.startTime)<Date.parse(calendar.endTime)) {
                const index=trips.findIndex(t=>String(t.id)===String(live.id));
                const filter=this.options.filter();
                if(filter==='all'||(filter==='productive'&&!breakOnly(live)&&!live.nonProduction)||(filter==='non-productive'&&!breakOnly(live)&&live.nonProduction)) {
                    if(index>=0) trips[index]={...trips[index],...live};else trips.push(live);
                } else if(index>=0) trips.splice(index,1);
            }
            trips.sort((a,b)=>Date.parse(iso(b.startTime))-Date.parse(iso(a.startTime))||b.id-a.id);
            // Project the complete dataset using the shared pending-time accounting policy.
            const rawMatching=trips.filter(trip=>!this.adjustedOnly||this.hasOfficialPercent(trip));
            this.hasVisibleDownTime=TripDowntimeSummary.breakdown(rawMatching,{now:this.downtimeNow}).hasDowntime;
            for(let i=0;i<trips.length;i++)trips[i]=TripTimeBank.withPendingPolicy(trips[i],this.showPendingEffective,{now:this.downtimeNow});
            this.trips=trips;
            const matchingTrips=trips.filter(trip=>!this.adjustedOnly||this.hasOfficialPercent(trip));
            const downTotals=TripDowntimeSummary.breakdown(matchingTrips,{now:this.downtimeNow});
            this.hasVisibleDownTime=downTotals.pendingMilliseconds+downTotals.approvedMilliseconds+downTotals.unapprovedMilliseconds>0;
            // Down-only is a presentation filter; scope counts and totals retain all matching trips.
            const visibleTrips=matchingTrips;
            this.visibleTrips=visibleTrips;this.matchingTrips=matchingTrips;this.aggregation=aggregate(visibleTrips,true,this.downtimeNow);const fragment=document.createDocumentFragment();

            let settings=this.settings||this.root.querySelector('.trip-log-settings');
            const reuseSettings=Boolean(settings);
            if(!settings){settings=node('section',undefined,'trip-log-settings');settings.id='tripLogSettings';
                const contents=node('div',undefined,'trip-log-settings-content');contents.append(this.controls(calendar),node('hr',undefined,'trip-log-settings-divider'));settings.append(contents);this.settings=settings;
            } else {
                const selects=settings.querySelectorAll('select');selects[0].value=this.options.filter();selects[1].value=this.options.range();
                const week=selects[1].querySelector('option[value="week"]');if(week&&this.options.rangeLabelFor)week.textContent=this.options.rangeLabelFor('week');
                const dates=window.CalendarRange.dates(calendar),inputs=settings.querySelectorAll('input[type=date]');
                inputs.forEach((input,i)=>{input.value=dates[i===0?'start':'end'];input.disabled=i===1&&this.options.range()!=='custom';});
                const includeCurrent=settings.querySelector('input[data-include-current]');if(includeCurrent){includeCurrent.checked=Boolean(this.options.includeCurrent?.());includeCurrent.disabled=false;includeCurrent.closest('label').classList.toggle('is-unavailable',!Boolean(this.options.liveTrip?.()||trips.some(t=>t.running)));}
                const pending=settings.querySelector('input[data-show-pending]');if(pending)this.syncPendingControl(pending);
                const fallback=settings.querySelector('[data-down-time-filter-fallback]');if(fallback){fallback.checked=this.downTimeOnly;fallback.disabled=false;fallback.closest('label').hidden=false;fallback.closest('label').classList.toggle('is-unavailable',!this.hasVisibleDownTime);}
            }

            if(calendar.historical){
                const status=node('section',undefined,'trip-log-range-status');status.setAttribute('role','status');const dates=CalendarRange.dates(calendar);
                const label=globalThis.WMOFLanguagePack.text('d7300001-7888-4711-9000-000000000009');status.append(node('span',`${label} · ${dates.start} – ${dates.end}`));
                const current=node('button',globalThis.WMOFLanguagePack.text('d7300001-7888-4711-9000-000000000010'));current.type='button';current.dataset.returnCurrentRange='true';current.addEventListener('click',()=>this.options.onCurrent?.());status.append(current);fragment.append(status);
            }
            TripLog.scheduleVisuals();
            this.root.classList.toggle('trip-log-empty',visibleTrips.length===0);
            if(visibleTrips.length) {
            const days=(Date.parse(calendar.endTime)-Date.parse(calendar.startTime))/86400000;
            const levels=(days>370||this.options.range()==='year')?['year','month','week','day']:days>35?['month','week','day']:days>7?['week','day']:days>1?['day']:[];
            const stamp=[calendar.startTime,calendar.endTime,this.options.range()].join('|');
            if(this.scopeStamp!==stamp){this.selectedScope=null;this.scopeStamp=stamp;}
            this.scopePanels(fragment,visibleTrips,matchingTrips,levels,calendar);

            } else {
                this.updateDownSummary(trips);
                const message=node('p',data.loginRequired?globalThis.WMOFLanguagePack.text("1b02fb00-aed1-432b-9c06-2cc98704eea2"):data.offline?globalThis.WMOFLanguagePack.text("595de126-bd64-4acc-be0f-a314413c2bd6"):globalThis.WMOFLanguagePack.text("d621fec0-6ca8-42fd-a0cf-1894616fd377"),'trip-log-empty-message');
                message.setAttribute('role','status');if(!data.loginRequired&&!data.offline){const range=this.options.range(),labels={day:'86e12fa9-95ff-4a20-84bd-8d6744217a01',week:'0589fe2c-5781-433b-855b-a30cbc304c15','pay-period':'ff8216fc-6cdb-4cbb-a433-1d2bae1e8232',month:'ed109a97-8e31-4c93-85cb-6dfb4480c0f7',year:'c9de230e-c958-41be-ad35-70174a864a3f',custom:'9e063c44-5f74-4196-bbab-3a49a72be041'};let label=this.options.rangeLabel?.()||globalThis.WMOFLanguagePack.text(labels[range]);if(range==='week'&&!this.options.rangeLabel){const number=this.options.weekNumber?.(CalendarRange.dates(calendar).start)??CalendarRange.weekNumber(calendar,CalendarRange.dates(calendar).start);if(number)label+=' '+number;}if(range==='day'&&calendar.historical)label+=' - '+CalendarRange.dates(calendar).start;message.replaceChildren(node('strong',globalThis.WMOFLanguagePack.text('d7400001-0000-4000-8000-000000000016')),node('small',label));}fragment.append(message);
            }
            if(liveUpdate&&reuseSettings&&this.root.querySelector('.trip-log-split')){
                // Preserve animation timelines and scroll containers on tick-only updates.
                const reconcile=(old,fresh)=>{
                    if(old.nodeType!==fresh.nodeType||old.nodeName!==fresh.nodeName){old.replaceWith(fresh);return;}
                    if(old.nodeType===3){if(old.nodeValue!==fresh.nodeValue)old.nodeValue=fresh.nodeValue;return;}
                    if(old.nodeType!==1)return;
                    const identity=e=>[e.dataset.scopeId,e.dataset.tripId,e.dataset.intervalKey,e.dataset.activeState,e.className].join('|');
                    if(identity(old)!==identity(fresh)||old.childNodes.length!==fresh.childNodes.length){old.replaceWith(fresh);return;}
                    for(const attribute of fresh.attributes){if(attribute.name==='style'&&old.style.getPropertyValue('--trip-log-active-sweep-delay'))continue;if(old.getAttribute(attribute.name)!==attribute.value)old.setAttribute(attribute.name,attribute.value);}
                    for(const attribute of [...old.attributes])if(!fresh.hasAttribute(attribute.name))old.removeAttribute(attribute.name);
                    const freshChildren=[...fresh.childNodes];[...old.childNodes].forEach((child,i)=>reconcile(child,freshChildren[i]));
                };
                const old=[...this.root.children].filter(e=>e!==settings),fresh=[...fragment.children];
                if(old.length===fresh.length)old.forEach((e,i)=>reconcile(e,fresh[i]));else{old.forEach(e=>e.remove());this.root.append(fragment);}
            }
            else if(reuseSettings){for(const child of [...this.root.childNodes])if(child!==settings)child.remove();this.root.append(fragment);}
            else this.root.replaceChildren(fragment);
            for(const [name,top,left] of scroll){const pane=[...this.root.querySelectorAll('.trip-log-aggregate-pane,.trip-log-trips-pane')].find(e=>e.className===name);if(pane){pane.scrollTop=top;pane.scrollLeft=left;}}
            this.root.scrollTop=rootScroll;
            const include=settings.querySelector('[data-include-current]'),pending=settings.querySelector('[data-show-pending]'),only=settings.querySelector('[data-down-time-filter-fallback]');
            if(include)this.settingEffect(include,Boolean(include.checked&&(this.options.liveTrip?.()||trips.some(t=>t.running))));
            if(pending)this.syncPendingControl(pending);
            if(only)this.settingEffect(only,this.downTimeOnlyEnabled);
            this.setSettingsVisible(this.settingsVisible);
        }
        settingEffect(input,effective) {
            let control=input.closest('.trip-log-setting-control');if(!control){control=node('span',undefined,'trip-log-setting-control');input.before(control);control.append(input);}control.classList.toggle('is-overridden',input.checked!==effective);input.closest('label').classList.toggle('is-overridden',input.checked!==effective);
        }
        controls(calendar) {
            const box=node('section',undefined,'trip-log-controls');
            const selectRow=(label,choices,value,handler)=>{const row=node('label');row.append(node('span',label));const select=node('select');for(const [v,text] of choices){const option=node('option',v==='week'?(this.options.rangeLabelFor?.('week')||text):text);option.value=v;select.append(option);}select.value=value;select.addEventListener('change',()=>handler(select.value));row.append(select);box.append(row);};
            selectRow(globalThis.WMOFLanguagePack.text("9931b905-cc82-4afe-8b33-a9d31454146a"),[['all',globalThis.WMOFLanguagePack.text("96f27252-e455-45f0-876c-c6f604ad486b")],['productive',globalThis.WMOFLanguagePack.text("e9a19871-eb83-4f78-85a2-8dcbbc2b3f6d")],['non-productive',globalThis.WMOFLanguagePack.text("c62239f7-fec2-4242-bbb4-ad8759017128")]],this.options.filter(),this.options.onFilter);
            selectRow(globalThis.WMOFLanguagePack.text("2d7078b0-2daf-4ade-b37a-01f6e2ae734f"),[['day',globalThis.WMOFLanguagePack.text("86e12fa9-95ff-4a20-84bd-8d6744217a01")],['week',globalThis.WMOFLanguagePack.text("0589fe2c-5781-433b-855b-a30cbc304c15")],['pay-period',globalThis.WMOFLanguagePack.text("ff8216fc-6cdb-4cbb-a433-1d2bae1e8232")],['month',globalThis.WMOFLanguagePack.text("ed109a97-8e31-4c93-85cb-6dfb4480c0f7")],['year',globalThis.WMOFLanguagePack.text("c9de230e-c958-41be-ad35-70174a864a3f")],['custom',globalThis.WMOFLanguagePack.text("9e063c44-5f74-4196-bbab-3a49a72be041")]],this.options.range(),this.options.onRange);
            const dates=node('div',undefined,'trip-log-date-controls');const values=window.CalendarRange.dates(calendar);
            for(const [label,key] of [[globalThis.WMOFLanguagePack.text("c62f534c-5d7b-459f-bdc8-f14a3d2cbecf"),'start'],[globalThis.WMOFLanguagePack.text("4c0b0ee5-ddac-4e6a-b2b5-48f438f0cd92"),'end']]) {
                const input=node('input');input.type='date';input.value=values[key];input.disabled=key==='end'&&this.options.range()!=='custom';input.setAttribute('aria-label',key==='start'?globalThis.WMOFLanguagePack.text("6bd07958-dfbb-5e40-ab3c-c1347e5eac1c"):globalThis.WMOFLanguagePack.text("dcc024f5-cfbf-56cb-b10b-33c5367aed8b"));
                input.addEventListener('change',()=>this.options.onDate(key,input.value));dates.append(node('span',label),input);
            }
            box.append(dates);const include=node('label',undefined,'trip-log-include-current');const check=node('input');check.type='checkbox';check.dataset.includeCurrent='true';check.checked=Boolean(this.options.includeCurrent?.());check.disabled=false;include.classList.toggle('is-unavailable',!Boolean(this.options.liveTrip?.()||this.trips?.some(t=>t.running)));check.addEventListener('change',()=>this.options.onIncludeCurrent?.(check.checked));include.append(node('span',globalThis.WMOFLanguagePack.text("d3df5443-5f50-4a22-b8e6-bdd43caf0d89")),check);box.append(include);
            const adjusted=node('label',undefined,'trip-log-include-current'),adjustedCheck=node('input');adjustedCheck.type='checkbox';adjustedCheck.dataset.adjustedOnly='true';adjustedCheck.checked=this.adjustedOnly;
            adjustedCheck.addEventListener('change',()=>{this.adjustedOnly=adjustedCheck.checked;this.saveViewSettings();this.rerender();});adjusted.append(node('span',globalThis.WMOFLanguagePack.text('d7300001-7888-4711-9000-000000000005')),adjustedCheck);box.append(adjusted);
            const pending=node('label',undefined,'trip-log-include-current'),pendingCheck=node('input');pendingCheck.type='checkbox';pendingCheck.dataset.showPending='true';
            pendingCheck.addEventListener('change',()=>void this.setPendingMode(TripLog.nextPendingMode(this.pendingMode)).catch(error=>this.error(error)));pending.append(node('span'),pendingCheck);this.syncPendingControl(pendingCheck);box.append(pending);
            const fallback=node('label',undefined,'trip-log-include-current'),fallbackCheck=node('input');fallbackCheck.type='checkbox';fallbackCheck.dataset.downTimeFilterFallback='true';fallbackCheck.checked=this.downTimeOnly;fallbackCheck.disabled=false;fallback.hidden=false;fallback.classList.toggle('is-unavailable',!this.hasVisibleDownTime);
            fallbackCheck.addEventListener('change',()=>{this.downTimeOnly=fallbackCheck.checked;this.saveViewSettings();this.rerender();});fallback.append(node('span',globalThis.WMOFLanguagePack.text('d7300001-7888-4711-9000-000000000004')),fallbackCheck);const checks=node('div',undefined,'trip-log-settings-checks');checks.append(adjusted,include,fallback,pending);box.append(checks);const help=node('div',undefined,'trip-log-range-help');const grid=node('div',undefined,'trip-log-range-help-grid');for(const [tag,id] of [['strong',19],['strong',20],['p',21],['p',22]])grid.append(node(tag,globalThis.WMOFLanguagePack.text('d7400001-0000-4000-8000-'+String(id).padStart(12,'0'))));const helpHeading=node('h3');const info=node('span','?','trip-log-range-info');info.setAttribute('aria-hidden','true');const title=node('span',globalThis.WMOFLanguagePack.text('d7400001-0000-4000-8000-000000000023'),'trip-log-range-help-title');title.prepend(info);helpHeading.append(title);help.append(node('hr'),helpHeading,grid);box.append(help);return box;
        }
        civil(trip) {
            const parts=new Intl.DateTimeFormat('en-CA',{timeZone:this.calendar.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso(trip.startTime)));
            const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));let day=`${p.year}-${p.month}-${p.day}`;
            if(`${p.hour}:${p.minute}:${p.second}`<(this.calendar.rules?.cutoffTime||'00:00:00')) {const d=new Date(day+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-1);day=d.toISOString().slice(0,10);}
            return day;
        }
        key(trip,level) {
            const day=this.civil(trip);if(level==='year')return day.slice(0,4);if(level==='month') return day.slice(0,7);if(level==='day') return day;
            const d=new Date(day+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-(d.getUTCDay()-(this.calendar.rules?.weekStartDay??6)+7)%7);return d.toISOString().slice(0,10);
        }
        label(key,level) {
            if(level==='year')return key;
            if(level==='month') return new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(key+'-01T12:00:00Z'));
            if(level==='day') return new Intl.DateTimeFormat(undefined,{weekday:'long',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(key+"T12:00:00Z"));
            const d=new Date(key+"T12:00:00Z"),end=new Date(d);end.setUTCDate(d.getUTCDate()+6);
            const fmt=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',timeZone:'UTC'});
            const number=this.options.weekNumber?.(key)??CalendarRange.weekNumber(this.calendar,key);
            return `${globalThis.WMOFLanguagePack.text('0589fe2c-5781-433b-855b-a30cbc304c15')}${number?' '+number:''} · ${fmt.format(d)}–${fmt.format(end)}`;
        }
        scopePanels(fragment,trips,matchingTrips,levels,calendar) {
            const header=node('div',undefined,'trip-log-scope-header'),split=node('section',undefined,'trip-log-split'),upper=node('nav',undefined,'trip-log-aggregate-pane'),path=node('div',undefined,'trip-log-aggregate-path'),tree=node('div',undefined,'trip-log-aggregate-tree'),lower=node('section',undefined,'trip-log-trips-pane'),separator=node('div',undefined,'trip-log-splitter');
            upper.setAttribute('aria-label','Aggregate scopes');lower.setAttribute('aria-label','Trips in selected scope');lower.tabIndex=0;upper.append(header,path,tree);
            separator.tabIndex=0;separator.setAttribute('role','separator');separator.setAttribute('aria-label','Resize aggregate and trip panes');separator.setAttribute('aria-orientation','horizontal');separator.setAttribute('aria-valuemin','15');separator.setAttribute('aria-valuemax','40');
            const maximumShare=()=>{const height=split.getBoundingClientRect().height;if(!height)return 85;const style=getComputedStyle(upper),padding=(parseFloat(style.paddingTop)||0)+(parseFloat(style.paddingBottom)||0);const content=header.offsetHeight+path.offsetHeight+tree.scrollHeight+padding;const available=height-separator.getBoundingClientRect().height-Math.min(150,height*.45);return Math.max(15,Math.min(available,Math.max(60,content))/height*100);};
            const resize=value=>{const maximum=maximumShare();this.aggregateShare=Math.min(maximum,Math.max(15,value));split.style.setProperty('--trip-log-aggregate-share',`${this.aggregateShare}%`);separator.setAttribute('aria-valuemax',String(Math.round(maximum)));separator.setAttribute('aria-valuenow',String(Math.round(this.aggregateShare)));};resize(this.aggregateShare??32);
            separator.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();resize(e.key==='Home'?15:e.key==='End'?maximumShare():this.aggregateShare+(e.key==='ArrowDown'?3:-3));});
            separator.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();separator.setPointerCapture(e.pointerId);const move=event=>{const box=split.getBoundingClientRect();if(box.height)resize((event.clientY-box.top)/box.height*100);},end=()=>{separator.removeEventListener('pointermove',move);separator.removeEventListener('pointerup',end);separator.removeEventListener('pointercancel',end);};separator.addEventListener('pointermove',move);separator.addEventListener('pointerup',end);separator.addEventListener('pointercancel',end);});
            const scopes=[];
            const select=scope=>{if(scope)scope=this.scopeData?.get(scope.id)??scope;
                this.selectedScope=scope?.id??null;const rows=scope?.trips??this.visibleTrips;this.aggregation=aggregate(rows,true,this.downtimeNow);
                const overview=node('section',undefined,'trip-log-overview'),emphasis=node('div',undefined,'trip-log-emphasis');emphasis.append(node('strong',`${this.aggregation.tripCount} ${globalThis.WMOFLanguagePack.text(this.aggregation.tripCount===1?'3b289746-71b2-4ac3-90dd-00a0402ba34f':'1c1bf8a6-f452-4dfa-8d43-ed38d4bcae1f')}`),node('strong',percent(rows,true),'trip-log-actual'));if(this.incomplete)emphasis.lastElementChild.append(uncertainIcon());overview.append(emphasis,node('div',`Standard ${duration(this.aggregation.standardTimeMilliseconds)} · Actual ${duration(this.aggregation.productiveTimeMilliseconds)}`,'trip-log-times'));
                const ledgerRows=scope?this.trips.filter(trip=>[...scope.parents,scope].every(item=>this.key(trip,item.level)===item.key)):this.trips;this.updateDownSummary(ledgerRows);header.replaceChildren(overview);
                const columns=node('div',undefined,'trip-log-column-header');columns.setAttribute('role','row');for(const id of ['5e8f393d-72a7-4b30-ba1e-69bbd765354f','07613a20-4d6c-4fdf-a16d-6c94d28e5590','77f1eddd-89b9-4e22-9fe1-aeeb4d060722','c755d5bf-3277-4630-a938-898b8b6172dd',null]){const cell=node('span',id?globalThis.WMOFLanguagePack.text(id):'');cell.setAttribute('role','columnheader');columns.append(cell);}const downFiltered=rows.filter(trip=>!this.downTimeOnlyEnabled||TripDowntimeSummary.breakdown([trip],{now:this.downtimeNow}).hasDowntime),displayed=downFiltered.filter(trip=>this.pendingPresentationIncludes(trip)),hidden=downFiltered.length-displayed.length;lower.replaceChildren(columns);if(hidden){const notice=node('div',globalThis.WMOFLanguagePack.text('d7500001-0000-4000-8000-000000000004',{count:hidden}),'trip-log-hidden-finalized');notice.setAttribute('role','status');lower.append(notice);}lower.append(this.daySections(displayed));lower.scrollTop=0;
                path.replaceChildren();for(const item of [null,...(scope?[...scope.parents,scope]:[])]){const button=node('button',item?item.label:`${CalendarRange.dates(calendar).start} – ${CalendarRange.dates(calendar).end}`);button.type='button';if(item)button.dataset.scopeLevel=item.level;button.setAttribute('aria-pressed',String(item===scope));button.addEventListener('click',()=>select(item));path.append(button);}
                tree.querySelectorAll('[data-scope-id]').forEach(el=>el.classList.toggle('is-selected-scope',el.dataset.scopeId===this.selectedScope));
            };
            const build=(rows,remaining,parents=[])=>{
                const result=document.createDocumentFragment();if(!remaining.length)return result;const [level,...rest]=remaining,groups=new Map();for(const trip of rows){const key=this.key(trip,level);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(trip);}
                for(const [key,group] of groups){if(!group.some(trip=>this.tripPresentationIncludes(trip)))continue;const id=parents.map(parent=>parent.id).join('/')+level+key,scope={id,key,level,trips:group,label:this.label(key,level),parents},details=node('details',undefined,'trip-log-group'),summary=node('summary'),heading=node('div',undefined,'trip-log-group-heading');scopes.push(scope);details.dataset.scopeId=id;details.dataset.scopeLevel=level;details.open=this.expanded.get(id)??true;details.addEventListener('toggle',()=>{this.expanded.set(id,details.open);TripLog.scheduleVisuals();});const active=group.find(trip=>trip.running);details.classList.toggle('has-active-trip',Boolean(active));if(active){details.dataset.activeState=active.activeState||'normal';details.style.setProperty('--trip-log-active-sweep-delay',this.activeSweepDelay);}
                    heading.append(node('strong',scope.label),node('span',`${aggregate(group,true,this.downtimeNow).tripCount} trips · ${percent(group,true)}`,'trip-log-actual'));if(this.incomplete)heading.lastElementChild.append(uncertainIcon());summary.append(heading);const ledger=this.downtimeSummary(aggregate(group,true,this.downtimeNow).downtime);if(ledger)summary.append(ledger);summary.addEventListener('click',()=>select(scope));const children=node('div',undefined,'trip-log-group-children');children.append(build(group,rest,[...parents,scope]));details.append(summary,children);result.append(details);
                }return result;
            };
            tree.append(build(trips,levels));this.scopeData=new Map(scopes.map(scope=>[scope.id,scope]));select(scopes.find(scope=>scope.id===this.selectedScope)??null);split.classList.toggle('has-aggregates',scopes.length>0);split.append(upper,separator,lower);fragment.append(split);requestAnimationFrame(()=>{if(split.isConnected)resize(this.aggregateShare??32);});
        }

        daySections(trips) {
            const fragment=document.createDocumentFragment(),days=new Map();
            for(const trip of trips){const day=this.civil(trip);if(!days.has(day))days.set(day,[]);days.get(day).push(trip);}
            const format=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
            for(const [day,rows] of days){const section=node('section',undefined,'trip-log-day-section');section.dataset.day=day;
                const heading=node('h3',format.format(new Date(day+'T12:00:00Z')),'trip-log-day-heading');section.setAttribute('aria-label',heading.textContent);section.append(heading,...rows.map(trip=>this.trip(trip)));fragment.append(section);
            }return fragment;
        }

        trip(trip) {
            const standalone=breakOnly(trip);const details=node('details',undefined,'trip-log-trip'),id='trip'+trip.id;details.classList.toggle('is-break-only',standalone);details.dataset.tripId=String(trip.id);details.classList.toggle('is-active-trip',Boolean(trip.running));if(trip.running){details.dataset.activeState=trip.activeState||'normal';details.style.setProperty('--trip-log-active-sweep-delay',this.activeSweepDelay);}details.open=this.expanded.get(id)??false;details.addEventListener('toggle',()=>{this.expanded.set(id,details.open);TripLog.scheduleVisuals();});
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
            const downtime=this.downtimeSummary(TripDowntimeSummary.trip(trip,{now:this.downtimeNow}));if(downtime){this.downEditorTarget(downtime,trip);summary.append(downtime);}details.append(summary);
            const entries=node('div',undefined,'trip-log-entries'),timeline=node('div',undefined,'trip-log-timeline');entries.append(timeline);
            const events=trip.events||[],deleted=new Set(events.filter(event=>event.event==='interval.deleted').map(event=>event.value?.intervalKey));
            const visible=events.filter(event=>(!standalone&&['trip.started','trip.stopped'].includes(event.event))||(['interval.started','interval.ended'].includes(event.event)&&!deleted.has(event.value?.intervalKey)));
            if(official?.startTime)visible.push({event:'trip.official-start',timestamp:official.startTime,value:{}});
            visible.sort((a,b)=>Date.parse(iso(a.timestamp))-Date.parse(iso(b.timestamp)));
            const activeEntry=trip.running?(visible.find(event=>event.event==='interval.started'&&!events.some(e=>e.event==='interval.ended'&&e.value?.intervalKey===event.value?.intervalKey))||visible.find(event=>event.event==='trip.started')):null;
            for(const event of visible){
                if(event.event==='interval.ended')continue;
                const row=node('div',undefined,'trip-log-entry'),isInterval=event.event==='interval.started',end=isInterval?events.find(e=>e.event==='interval.ended'&&e.value?.intervalKey===event.value?.intervalKey):null;
                if(event===activeEntry){row.classList.add('is-active-entry');row.dataset.activeState=trip.activeState||'trip';row.style.setProperty('--trip-log-active-sweep-delay',this.activeSweepDelay);}
                if(isInterval){
                    const type=event.value.type,state=type==='down'?TripDowntimeSummary.approvalState(event,events):null,recorded=Math.max(0,(end?Date.parse(iso(end.timestamp)):this.downtimeNow)-Date.parse(iso(event.timestamp))),approved=state==='approved'?(TripDowntimeSummary.approved(event,end,events)||0):0,net=approved-recorded;
                    const key=type==='down'?(state==='pending'?'down':TripLog.netRange(net)):type==='lunch'?'lunch':'break';row.dataset.intervalKey=event.value.intervalKey;row.classList.add('trip-log-consolidated-interval');TripLog.accent(row,key);
                    const times=node('span',undefined,'trip-log-interval-times');for(const point of [event,...(end?[end]:[])]){const value=node('span',fmt.format(new Date(iso(point.timestamp))));TripLog.dot(value,key);times.append(value);}if(!end)times.append(node('small',globalThis.WMOFLanguagePack.text('d7600001-0000-4000-8000-000000000008')));
                    const label=node('span',undefined,'trip-log-interval-caption'),caption=node('span',undefined,'trip-log-interval-caption-lines'),icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');icon.innerHTML='<path d="M9 2h6M12 2v3M18 6l2-2"/><circle cx="12" cy="14" r="8"/><path d="M12 9v5l3 2"/>';
                    const compact=value=>duration(Math.abs(value)).replace(/^0:/,'');let title,amount=recorded,adjustment='';
                    if(type==='down'){title=globalThis.WMOFLanguagePack.text(state==='pending'?'d7300001-7888-4711-9000-000000000002':state==='approved'?'a6d2eeb0-2d5b-4a59-b059-4039e7492e39':'d7300001-7888-4711-9000-000000000003');if(state==='approved')amount=approved;if(state!=='pending'&&net!==0)adjustment=compact(net)+' '+TripLog.visualText(net>0?'surplus':'deficit');}
                    else{title=type==='lunch'?'Lunch':this.entryKind(event)==='short-break'?'Short Break':'Break';const planned=durationMilliseconds(event.value.length)+durationMilliseconds(event.value.startBuffer)+durationMilliseconds(event.value.endBuffer);if(end&&planned!==recorded)adjustment=compact(recorded-planned)+' '+TripLog.visualText(recorded>planned?'lost':'gained');}
                    caption.append(icon,node('span',title+': '+compact(amount)));if(adjustment)caption.append(node('span',adjustment,'interval-net-adjustment'));label.append(caption);if(type==='down')this.downEditorTarget(caption,trip,event.value.intervalKey);
                    if(type==='down'&&state==='pending'&&!this.showPendingEffective)TripLog.exclusion(label,'not-applied');else if(type==='down'&&state!=='pending'&&this.pendingMode==='pending-only')TripLog.exclusion(label,'totals-only');row.append(times,label);
                }else{const time=node('span',fmt.format(new Date(iso(event.timestamp))));TripLog.dot(time,'trip');row.append(time,node('span',event.event==='trip.official-start'?TripLog.officialText('officialStart'):this.entryLabel(event,event,null,events)));if(event.event==='trip.official-start')row.classList.add('is-official-start');}
                timeline.append(row);
            }
            TripLog.scheduleVisuals();
            details.append(entries);return details;
        }
        downEditorTarget(label,trip,intervalKey){
            if(this.offline&&!trip.buffered)return;
            const button=intervalKey?node('button',undefined,'trip-log-down-edit'):label;if(intervalKey){button.type='button';button.append(...label.childNodes);label.append(button);}else{button.setAttribute('role','button');button.tabIndex=0;button.dataset.downLedgerEdit='true';button.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();button.click();}});}button.setAttribute('aria-label',globalThis.WMOFLanguagePack.text('d7500001-0000-4000-8000-000000000005'));
            button.addEventListener('click',event=>{
                event.preventDefault();event.stopPropagation();
                const key=String(trip.id)+':'+(intervalKey||'ledger');this.downTapTimers??=new Map();
                const previous=this.downTapTimers.get(key);if(previous){clearTimeout(previous);this.downTapTimers.delete(key);void this.openDownEditor(trip,intervalKey,true).catch(error=>this.error(error));return;}
                if(event.detail===0){void this.openDownEditor(trip,intervalKey).catch(error=>this.error(error));return;}
                this.downTapTimers.set(key,setTimeout(()=>{this.downTapTimers.delete(key);void this.openDownEditor(trip,intervalKey).catch(error=>this.error(error));},300));
            });
        }
        async openDownEditor(trip,intervalKey,approve=false){const editor=await this.openTripEditor(trip);await editor?.focusDown({intervalKey,approve});}
        async openTripEditor(trip){
            if(this.tripEditor?.dialog.open){this.tripEditor.dialog.focus();return this.tripEditor;}
            if(this.editorOpening)return this.editorOpening;
            this.editorOpening=globalThis.TripEditor.open(trip,{...this.options,pendingDownTimeApplied:()=>this.showPendingEffective},this.calendar);
            try{this.tripEditor=await this.editorOpening;return this.tripEditor;}finally{this.editorOpening=null;}
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
        rerender(){if(!this.calendar)return;this.render({trips:this.trips,offline:this.offline,incomplete:this.incomplete,loginRequired:this.loginRequired},this.calendar);}
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
