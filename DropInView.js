(() => {
    "use strict";
    // This controller owns only the observer's display. It never changes the publisher.
    class DropInView {
        constructor({root, stream, text, now = () => Date.now()}) {
            this.root = root; this.stream = stream; this.text = text; this.now = now;
            this.mode = root.querySelector('#liveStreamViewMode');
            this.start = root.querySelector('#liveStreamViewStart');
            this.end = root.querySelector('#liveStreamViewEnd');
            this.custom = root.querySelector('#liveStreamCustomRange');
            this.status = root.querySelector('#liveStreamViewStatus');
            this.timer = root.querySelector('#liveStreamClockTimer');
            this.timer.enableObserverMode?.();
            this.percent = root.querySelector('#liveStreamViewPercent');
            this.sync = root.querySelector('#liveStreamViewSync');
            this.timeDisplay = root.querySelector('#liveStreamViewTime');
            this.revision = 0; this.cache = null; this.snapshot = null;
            this.preferences = new Map(); this.userId = null;
            this.intervalTicker = setInterval(() => this.renderInterval(), 1000);
            this.mode.addEventListener('change', () => this.select());
            this.start.addEventListener('change', () => this.select());
            this.end.addEventListener('change', () => this.select());
            this.percent.addEventListener('input', () => {
                this.percentScope = this.localScope || this.snapshot?.uiState?.effective_goal_type || 'trip';
                if (this.percentScope === 'trip' && this.percent.value) this.sync.value = 'off';
                this.render();
            });
            this.sync.addEventListener('change', () => this.render());
            this.timeDisplay.addEventListener('change', () => this.render());
            root.querySelector('#liveStreamResetPercent').addEventListener('click', () => {
                this.percent.value = ''; this.percentScope = null; this.sync.value = 'user'; this.timeDisplay.value = 'user';
                this.mode.value = 'user'; this.select();
            });
            this.select();
        }
        select() {
            this.revision++; this.cache = null;
            this.custom.hidden = this.mode.value !== 'custom';
            this.render();
        }
        capturePreference() {
            return {mode:this.mode.value,start:this.start.value,end:this.end.value,percent:this.percent.value,
                percentScope:this.percentScope || null,sync:this.sync.value,timeDisplay:this.timeDisplay.value};
        }
        applyPreference(preference) {
            this.mode.value=preference.mode || 'user';this.start.value=preference.start || '';this.end.value=preference.end || '';
            this.percent.value=preference.percent || '';this.percentScope=preference.percentScope;this.goals={trip:preference.tripGoal,total:preference.totalGoal};
            this.sync.value=preference.sync || 'user';this.timeDisplay.value=preference.timeDisplay || 'user';this.select();
            this.root.dispatchEvent(new CustomEvent('drop-in-mode-changed'));
        }
        setUser(userId) {
            if (userId === this.userId) return;
            if (this.userId) this.preferences.set(this.userId, {
                mode:this.mode.value,start:this.start.value,end:this.end.value,percent:this.percent.value,
                percentScope:this.percentScope,sync:this.sync.value,timeDisplay:this.timeDisplay.value
            });
            this.clear(); this.userId = userId; this.localScope = null;
            const preference = this.preferences.get(userId);
            this.mode.value = preference?.mode || 'user';
            this.start.value = preference?.start || ''; this.end.value = preference?.end || '';
            this.percent.value = preference?.percent || ''; this.percentScope = preference?.percentScope;
            this.sync.value = preference?.sync || 'user'; this.timeDisplay.value = preference?.timeDisplay || 'user';
            this.select();
        }
        clear() {
            this.revision++; this.snapshot = null; this.cache = null;this.showComponents(null);
            this.status.textContent = '';
            const standard = this.root.querySelector('#liveStreamStandardTime');
            if (standard) standard.textContent = '-';
            this.root.querySelector('#liveStreamInterval').hidden = true;
            this.timer.applyObserverSnapshot?.({events:[],started:false,tripId:null,attributes:[],totals:null,
                addedToAggregate:false,sync:false,timeDisplay:'remaining'}, {mode:'trip'});
            for (const id of ['liveStreamPublisherMode', 'liveStreamRemoteState', 'liveStreamRemoteTime', 'liveStreamRemoteGoal',
                'liveStreamRemainingTime','liveStreamUserTripGoal','liveStreamUserModeGoal','liveStreamUserActiveGoal','liveStreamUserSync','liveStreamViewerActiveGoal']) {
                this.root.querySelector('#' + id).textContent = '—';
            }
        }
        update(snapshot) { this.snapshot = snapshot; this.renderInterval(); this.render(); }
        renderInterval() {
            const interval = this.snapshot?.uiState?.interval_state;
            const panel = this.root.querySelector('#liveStreamInterval');
            const type = interval?.intervalType;
            // open marks an open-ended interval; a timed Lunch has open:false.
            panel.hidden = !interval || !['down','break','lunch'].includes(type);
            if (panel.hidden) return;
            const timestamp = Date.parse(this.snapshot.timestamp);
            const delta = Number.isFinite(timestamp) ? Math.max(0, this.now() - timestamp) : 0;
            const remaining = Number(interval.remainingMilliseconds) - delta;
            const countUp = type === 'down' || remaining < 0;
            const milliseconds = type === 'down' ? Number(interval.elapsedMilliseconds) + delta : Math.abs(remaining);
            const name = type === 'break' && ['short','short-break','short_break'].includes(interval.breakType) ? 'shortBreak' : type;
            this.root.querySelector('#liveStreamIntervalLabel').textContent = this.text(name) + ' · ' +
                this.text(type !== 'down' && remaining < 0 ? 'overtime' : countUp ? 'elapsed' : 'remainingInterval');
            this.root.querySelector('#liveStreamIntervalTime').textContent = this.duration(milliseconds);
        }
        destroy() {clearInterval(this.intervalTicker);this.clear();}
        duration(milliseconds) {
            const seconds = Math.floor(Math.abs(milliseconds || 0) / 1000);
            return (milliseconds < 0 ? '−' : '') + [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
                .map(value => String(value).padStart(2, '0')).join(':');
        }
        showComponents(state) {
            this.displayState=state;globalThis.WMOFTimerSummaryView?.render(this.root,state);
            this.root.dispatchEvent(new CustomEvent("observer-summary-changed",{detail:state}));
            const standard = this.root.querySelector('#liveStreamStandardTime');
            if (standard) standard.textContent = state?.standard_time_component?.text || '-';
            for (const [id,key] of [['liveStreamStandardLabel','standard_time_header_text'],['liveStreamTimeLabel','time_header_text']]) {
                const label = this.root.querySelector('#' + id);
                if (label && state?.[key]) label.textContent = state[key];
            }
        }
        show(summary) {
            if (!summary) this.showComponents(null);
            this.root.querySelector('#liveStreamRemoteTime').textContent = summary
                ? this.duration(summary.countedTimeElapsedMilliseconds ?? summary.countedTimeMilliseconds) : '—';
            const counted = summary?.countedTimeElapsedMilliseconds ?? summary?.countedTimeMilliseconds;
            const percent = counted > 0 ? summary.standardTimeMilliseconds / counted : null;
            const goal = summary?.percentGoal || 1;
            const format = value => new Intl.NumberFormat(document.documentElement.lang || 'en-US',
                {style:'percent', maximumFractionDigits: 1}).format(value);
            this.root.querySelector('#liveStreamRemoteGoal').textContent = summary
                ? (percent === null ? '—' : format(percent)) + ' / ' + format(goal) : '—';
            const remaining = summary ? summary.standardTimeMilliseconds / goal - counted + (summary.allowanceCreditMilliseconds || 0) : null;
            this.root.querySelector('#liveStreamRemainingTime').textContent = Number.isFinite(remaining) ? this.duration(remaining) : '—';
            const display = this.timeDisplay.value === 'user' ? this.snapshot?.viewData?.timeDisplay || 'remaining' : this.timeDisplay.value;
            if (Number.isFinite(remaining) && display !== 'elapsed') {
                this.root.querySelector('#liveStreamRemoteTime').textContent = display === 'calculated-end'
                    ? new Date(Date.parse(this.snapshot.timestamp) + remaining).toLocaleTimeString(document.documentElement.lang || 'en-US')
                    : this.duration(remaining);
            }
        }
        project(trip, total, mode, aggregate) {
            const model = this.snapshot?.viewData?.model;
            if (!model || !this.timer.applyObserverSnapshot) {
                this.show(null); this.status.textContent = this.text('unavailable'); return;
            }
            const selected = this.mode.selectedOptions[0]?.textContent;
            const goal = this.percent.value && this.percent.checkValidity() ? Number(this.percent.value) : undefined;
            const goalScope = this.percentScope || (mode === 'user' || mode === 'auto'
                ? this.snapshot.uiState?.effective_goal_type : mode === 'trip' ? 'trip' : 'total');
            const result = this.timer.applyObserverSnapshot(model, {
                totals:aggregate, mode:mode === 'user' ? this.snapshot.viewData.mode : ['trip','auto'].includes(mode) ? mode : 'total',
                goal, goalScope, goals:this.goals,
                sync:this.sync.value === 'user' ? undefined : this.sync.value === 'on',
                timeDisplay:this.timeDisplay.value === 'user' ? undefined : this.timeDisplay.value,
                totalLabel:selected, now:new Date(this.snapshot.timestamp)
            });
            const state = result.uiState;
            this.showComponents(state);
            this.localScope = state.effective_goal_type;
            const label = this.localScope === 'total'
                ? ['user','auto','trip'].includes(mode) ? this.snapshot.viewData.range : mode : this.localScope;
            this.root.querySelector('#liveStreamViewerActiveGoal').textContent = [...this.mode.options]
                .find(option => option.value === label)?.textContent || this.text(label || 'standard');
            this.root.querySelector('#liveStreamRemoteTime').textContent = state.time_component?.text || '—';
            this.root.querySelector('#liveStreamRemainingTime').textContent = result.remaining || '—';
            this.root.querySelector('#liveStreamRemoteGoal').textContent = [state.current_percent_component?.text,
                state.goal_component?.text].filter(Boolean).join(' / ') || '—';
        }
        async render() {
            const selected = this.mode.selectedOptions[0]?.textContent || '';
            this.root.querySelector('#liveStreamViewingMode').textContent = selected;
            const snapshot = this.snapshot;
            if (!snapshot) return;
            const view = snapshot.viewData;
            const state = snapshot.uiState || {};
            this.root.querySelector('#liveStreamRemoteState').textContent = String(state.state || '—').replaceAll('_', ' ');
            const publisherMode = view?.mode === 'total' ? view.range : view?.mode;
            const publisherOption = [...this.mode.options].find(option => option.value === publisherMode);
            this.root.querySelector('#liveStreamPublisherMode').textContent = publisherOption?.textContent || publisherMode || '—';
            this.root.querySelector('#liveStreamUserTripGoal').textContent = state.trip_goal_component?.text || '—';
            this.root.querySelector('#liveStreamUserModeGoal').textContent = state.total_goal_component?.text || '—';
            const activeScope = state.effective_goal_type === 'total' ? view?.range : state.effective_goal_type;
            this.root.querySelector('#liveStreamUserActiveGoal').textContent = activeScope
                ? ([...this.mode.options].find(option => option.value === activeScope)?.textContent || this.text(activeScope)) : '—';
            this.root.querySelector('#liveStreamUserSync').textContent = typeof state.sync_enabled === 'boolean'
                ? this.text(state.sync_enabled ? 'on' : 'off') : '—';
            this.status.textContent = '';
            if (!view) { this.show(null); this.status.textContent = this.text('unavailable'); return; }
            if (['user','auto'].includes(this.mode.value)) {
                this.project(view.summary?.trip?.available ? view.summary.trip : null, view.summary?.total, this.mode.value);
                if (this.mode.value === 'user' && !this.percent.value && !this.goals?.trip && !this.goals?.total && this.sync.value === 'user' && this.timeDisplay.value === 'user') {
                    this.showComponents(state);
                    this.root.querySelector('#liveStreamRemoteTime').textContent = state.time_component?.text || '—';
                    const current = state.current_percent_component?.text, goal = state.goal_component?.text;
                    this.root.querySelector('#liveStreamRemoteGoal').textContent = [current,goal].filter(Boolean).join(' / ') || '—';
                }
                return;
            }
            if (this.mode.value === 'trip') {
                this.project(view.summary?.trip?.available ? view.summary.trip : null, view.summary?.total, 'trip'); return;
            }
            const revision = this.revision;
            let window;
            try {
                const calendar = new CalendarRange({databaseOnly:true});
                calendar.setDatabaseRecords(view.calendars);
                window = this.mode.value === 'custom'
                    ? CalendarRange.custom(this.start.value, this.end.value, calendar.getTimezone())
                    : await calendar.resolve({range:this.mode.value, at:snapshot.timestamp});
            } catch (error) {
                if (revision !== this.revision) return;
                this.show(null); this.status.textContent = this.text('invalidRange'); return;
            }
            if (revision !== this.revision || snapshot !== this.snapshot) return;
            const key = [snapshot.userId, window.startTime, window.endTime, view.tripId, view.productionFilter].join('|');
            let cache = this.cache;
            if (!cache || cache.key !== key || (!cache.pending && this.now() - cache.loadedAt > 15000)) {
                cache = this.cache = {key, loadedAt:0, pending:true};
                this.show(null); this.status.textContent = this.text('loading');
                try {
                    cache.totals = await this.stream.fetchViewerTotals(CalendarRange.tripWindow(window), {
                        excludeTripId:view.tripId, productionFilter:view.productionFilter || 'all'
                    });
                    cache.loadedAt = this.now(); cache.pending = false;
                    if (cache !== this.cache || revision !== this.revision) return;
                    // Use the newest active-trip snapshot after the historical request finishes.
                    return this.render();
                } catch (error) {
                    if (cache !== this.cache || revision !== this.revision) return;
                    cache.pending = false; this.cache = null;
                    this.show(null); this.status.textContent = this.text('failed'); return;
                }
            }
            if (cache.pending) { this.show(null); this.status.textContent = this.text('loading'); return; }
            this.project(view.summary?.trip, view.summary?.total, this.mode.value,
                {...cache.totals,...CalendarRange.tripWindow(window)});
            const dates = CalendarRange.dates(window);
            this.root.querySelector('#liveStreamViewingMode').textContent = selected + ' · ' + dates.start + ' – ' + dates.end;
        }
    }
    globalThis.WMOFDropInView = DropInView;
})();
