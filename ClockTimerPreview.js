(() => {
    'use strict';
    const MINUTE = 60000;
    // Real event replay, with no login, API calls, persistence, or announcements.
    function snapshot(kind, now) {
        const start = now - (120 * MINUTE - 5000);
        const scheduled = start + (kind === 1 ? 5 * MINUTE : 0);
        const iso = offset => new Date(start + offset * MINUTE).toISOString();
        const events = [{event:'trip.started', timestamp:iso(0), scheduledStartTime:new Date(scheduled).toISOString(), value:{
            timelineVersion:2, creationOffsetMilliseconds:start-scheduled, startOffsetMilliseconds:start-scheduled,
            scheduledStartOffsetMilliseconds:0, standardTimeMilliseconds:(kind === 1 ? 105 : 75)*MINUTE,
            intervalElapsedBehavior:'startLatency', autoRestartTripAfterLateBreak:false
        }}];
        const interval = (key,type,at,length,end,startBuffer=0,endBuffer=0,approved) => {
            events.push({event:'interval.started',timestamp:iso(at),value:{intervalKey:key,type,length:type === 'down' ? null : length*MINUTE,
                startBuffer:startBuffer*MINUTE || null,endBuffer:endBuffer*MINUTE || null,attributes:{}}});
            events.push({event:'interval.ended',timestamp:iso(end),value:{intervalKey:key,reason:'manual'}});
            if (approved !== undefined) events.push({event:'interval.approval-changed',timestamp:iso(end+.01),
                value:{intervalKey:key,state:'approved',value:approved*MINUTE}});
        };
        if (kind === 1) {
            interval('lunch','lunch',25,20,52,2,2);
            interval('break','break',58,8,70,1,1);
            interval('down','down',75,0,85);
        } else {
            interval('surplus','down',20,0,28,0,0,12);
            interval('deficit','down',45,0,55,0,0,5);
        }
        return {events,started:true,tripId:null,attributes:[],totals:null,addedToAggregate:false,
            sync:false,goalBounding:true,includePendingDownTime:true,timeDisplay:'remaining'};
    }
    globalThis.WMOFClockTimerPreview = {snapshot, create(timer,kind) {
        timer.enableObserverMode();
        timer.keepAspectRatio = true;
        let model, selectedAt, loop;
        const render = () => {
            if (!model) return;
            const now = new Date();
            model.attributes = [...timer.attributes].filter(a => customElements.get('clock-timer').observedAttributes.includes(a.name)).map(a => [a.name,a.value]);
            timer.applyObserverSnapshot(model,{now,mode:'trip',goal:kind === 1 ? 125 : 130,goalScope:'trip',timeDisplay:'remaining',sync:false});
            timer.dataset.sampleElapsed = String(120*MINUTE-5000 + now.getTime()-selectedAt);
        };
        return {
            apply(value) { WMOFTimerAppearance.applyGraphical(timer,value); if(model) render(); },
            start() { this.stop();selectedAt=Date.now();model=snapshot(kind,selectedAt);render();loop=setInterval(render,1000); },
            stop() { clearInterval(loop);loop=undefined; },
            get model() { return model; }
        };
    }};
})();
