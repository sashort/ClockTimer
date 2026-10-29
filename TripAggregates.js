(() => {
    "use strict";
    const instant = value => Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(String(value)) ? value : String(value).replace(" ", "T") + "Z");
    const duration = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
    // Shares approval precedence with the entry editor; totals never invent a
    // separate approval policy or clamp an approved surplus to the logged time.
    class TripDowntimeSummary {
        static approved(started, ended, events = []) {
            if (String(started?.value?.type || '').toLowerCase() !== 'down') return undefined;
            const approval = [...events].reverse().find(event => event.event === 'interval.approval-changed' && event.value?.intervalKey === started.value?.intervalKey);
            if (approval?.value?.state === 'unapproved') return 0;
            if (approval?.value?.state === 'approved' && Number.isSafeInteger(approval.value.value) && approval.value.value >= 0) return approval.value.value;
            if (Number.isSafeInteger(started.value.approvedTime) && started.value.approvedTime >= 0) return started.value.approvedTime;
            if (!started.timestamp || !ended?.timestamp) return undefined;
            const elapsed = instant(ended.timestamp) - instant(started.timestamp);
            return Number.isSafeInteger(elapsed) && elapsed >= 0 ? elapsed : undefined;
        }
        static trip(trip, {now = Date.now()} = {}) {
            if (trip.breakOnly || trip.events?.some(event => event.event === "trip.started" && event.value?.breakOnly === true)) {
                return Object.freeze({loggedMilliseconds:0, approvedMilliseconds:0, intervalCount:0, hasDowntime:false});
            }
            const events = trip.events || [], starts = new Map(), ends = new Map(), deleted = new Set();
            for (const event of events) {
                const key = event.value?.intervalKey;
                if (!key) continue;
                if (event.event === 'interval.deleted') deleted.add(key);
                if (event.event === 'interval.started' && String(event.value?.type || '').toLowerCase() === 'down') starts.set(key, event);
                if (event.event === 'interval.ended') ends.set(key, event);
            }
            let loggedMilliseconds = 0, approvedMilliseconds = 0, intervalCount = 0;
            for (const [key, started] of starts) {
                if (deleted.has(key)) continue;
                const ended = ends.get(key), start = instant(started.timestamp);
                const finish = ended ? instant(ended.timestamp) : trip.running ? now : NaN;
                const elapsed = finish - start;
                if (!Number.isSafeInteger(elapsed) || elapsed < 0) continue;
                loggedMilliseconds += elapsed;
                approvedMilliseconds += duration(this.approved(started, ended, events));
                intervalCount++;
            }
            return Object.freeze({loggedMilliseconds, approvedMilliseconds, intervalCount,
                hasDowntime: loggedMilliseconds > 0 || approvedMilliseconds > 0});
        }
        static calculate(trips, options) {
            let loggedMilliseconds = 0, approvedMilliseconds = 0, intervalCount = 0;
            for (const trip of trips) {
                const summary = this.trip(trip, options);
                loggedMilliseconds += summary.loggedMilliseconds;
                approvedMilliseconds += summary.approvedMilliseconds;
                intervalCount += summary.intervalCount;
            }
            return Object.freeze({loggedMilliseconds, approvedMilliseconds, intervalCount,
                hasDowntime: loggedMilliseconds > 0 || approvedMilliseconds > 0});
        }
    }
    globalThis.TripDowntimeSummary = TripDowntimeSummary;
    // Work is a duration; unused break allowance is a separate credit to the bank.
    // Reconstruct old completed rows whose credited duration was clamped to zero.
    function baseTimeBank(trip) {
        if (Number.isSafeInteger(trip.productiveTimeMilliseconds) && trip.productiveTimeMilliseconds >= 0 &&
            Number.isSafeInteger(trip.allowanceCreditMilliseconds) && trip.allowanceCreditMilliseconds >= 0)
            return {productiveTimeMilliseconds:trip.productiveTimeMilliseconds,allowanceCreditMilliseconds:trip.allowanceCreditMilliseconds,
                countedTimeBalanceMilliseconds:trip.productiveTimeMilliseconds-trip.allowanceCreditMilliseconds,bankCreditCarryMilliseconds:Math.max(0,trip.allowanceCreditMilliseconds-trip.productiveTimeMilliseconds)};
        const events=trip.events||[],started=events.find(e=>e.event==='trip.started'),stopped=events.findLast(e=>e.event==='trip.stopped');
        if(trip.running||!started||!stopped||trip.breakOnly||started.value?.breakOnly)return null;
        const begin=instant(trip.startTime||started.timestamp),finish=instant(trip.endTime||stopped.timestamp);
        if(!Number.isFinite(begin)||!Number.isFinite(finish)||finish<begin)return null;
        const deleted=new Set(events.filter(e=>e.event==='interval.deleted').map(e=>e.value?.intervalKey)),segments=[];
        let credit=0;
        for(const event of events.filter(e=>e.event==='interval.started')){
            const value=event.value||{},key=value.intervalKey;if(!key||deleted.has(key))continue;
            const type=String(value.type||'').toLowerCase(),end=events.findLast(e=>e.event==='interval.ended'&&e.value?.intervalKey===key);
            const left=instant(event.timestamp),right=end?instant(end.timestamp):finish;
            if(!Number.isFinite(left)||!Number.isFinite(right)||right<left)return null;
            if(left>=finish||right<=begin)continue;
            if(!['break','lunch','down','buffer'].includes(type))continue;
            let excluded=right-left;
            if(type==='down')excluded=TripDowntimeSummary.approved(event,end,events)??excluded;
            segments.push([Math.max(begin,left),Math.min(finish,left+excluded)]);
            if(end&&['break','lunch'].includes(type)&&Number.isSafeInteger(value.length))
                credit+=Math.max(0,value.length+duration(value.startBuffer)+duration(value.endBuffer)-(right-left));
        }
        const anchor=instant(started.value?.creationAnchor),clock=String(started.value?.scheduledStart||'').match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
        if(Number.isFinite(anchor)&&clock){const scheduled=anchor+(Number(clock[1])*3600+Number(clock[2])*60+Number(clock[3]))*1000;if(scheduled>begin&&scheduled<=finish)segments.push([begin,scheduled]);}
        segments.sort((a,b)=>a[0]-b[0]);let excluded=0,cursor=begin;
        for(const [left,right] of segments){if(right>Math.max(cursor,left)){excluded+=right-Math.max(cursor,left);cursor=right;}}
        const productive=Math.max(0,finish-begin-excluded);
        // Rows with no early-return credit keep their existing accounting contract.
        if(!credit)return null;
        return {productiveTimeMilliseconds:productive,allowanceCreditMilliseconds:credit,countedTimeBalanceMilliseconds:productive-credit,bankCreditCarryMilliseconds:Math.max(0,credit-productive)};
    }
    function timeBank(trip){
        const prior=trip?.officialCorrection;
        const raw=prior?{...trip,allowanceCreditMilliseconds:prior.baseAllowanceCreditMilliseconds}:trip;
        const bank=baseTimeBank(raw);
        if(trip.running||trip.breakOnly)return bank;
        const history=(trip.events||[]).filter(e=>['trip.official-percent-set','trip.official-percent-cleared'].includes(e.event)),record=history.at(-1);
        if(record?.event==='trip.official-percent-cleared')return bank;
        const tenths=record?.value?.percentTenths??prior?.percentTenths;
        if(!Number.isSafeInteger(tenths)||tenths<0)return bank;
        const productive=bank?.productiveTimeMilliseconds??countedTime(trip),standard=Number(trip.standardTimeMilliseconds)||0,baseCredit=bank?.allowanceCreditMilliseconds??0;
        if(!(productive>0&&standard>0))return bank;
        const credit=tenths/1000*productive-standard,balance=productive-credit;
        return {...bank,productiveTimeMilliseconds:productive,allowanceCreditMilliseconds:credit,countedTimeBalanceMilliseconds:balance,bankCreditCarryMilliseconds:Math.max(0,-balance),
            officialCorrection:{percentTenths:tenths,percent:tenths/10,adjustmentMilliseconds:credit-baseCredit,baseAllowanceCreditMilliseconds:baseCredit,calculatedPercent:100*(standard+baseCredit)/productive,eventId:record?.id??prior?.eventId,createdBy:record?.value?.createdBy??prior?.createdBy,recordedAt:record?.timestamp??prior?.recordedAt}};
    }
    globalThis.TripTimeBank=Object.freeze({project:timeBank});
    // Persisted counted time is authoritative; active trips use the allotted floor after unused break credit.
    const countedTime = trip => {
        const stored = Number.isSafeInteger(trip?.countedTimeMilliseconds) && trip.countedTimeMilliseconds >= 0
            ? trip.countedTimeMilliseconds : duration(trip?.actualTimeMilliseconds);
        return trip?.running ? Math.max(0, duration(trip.allottedTimeMilliseconds) - duration(trip.allowanceCreditMilliseconds), stored) : stored;
    };
    globalThis.TripAggregates = Object.freeze({
        counted: countedTime,
        performance(trip) {
            if(!trip)return null;
            const bank=timeBank(trip),productive=bank?.productiveTimeMilliseconds??countedTime(trip);
            return productive>0?(duration(trip?.standardTimeMilliseconds)+(bank?.allowanceCreditMilliseconds??0))/productive:null;
        },
        calculate({trips, rangeWindow = null, currentTripId = null, includeActiveTrip = false, goalPercent = 1, now = Date.now()}) {
            const start = rangeWindow ? Date.parse(rangeWindow.startTime) : -Infinity, end = rangeWindow ? Date.parse(rangeWindow.endTime) : Infinity;
            if (rangeWindow && (!Number.isFinite(start) || !Number.isFinite(end) || end < start)) throw new TypeError("Invalid trip aggregation range.");
            const unique = new Map();
            for (const trip of trips) unique.set(trip.id == null ? trip : String(trip.id), trip);
            const included = [...unique.values()].filter(trip => {
                if (trip.breakOnly || trip.events?.some(event => event.event === "trip.started" && event.value?.breakOnly === true)) return false;
                const time = instant(trip.startTime);
                const active = trip.running || (currentTripId !== null && String(trip.id) === String(currentTripId));
                return (includeActiveTrip || !active) && (!rangeWindow || time >= start && time <= end);
            });
            const projections=new Map(included.map(trip=>[trip,timeBank(trip)]));
            const bank = trip => projections.get(trip);
            const sum = key => included.reduce((value, trip) => value + duration(trip[key]), 0);
            const standard = sum("standardTimeMilliseconds"), actual = sum("actualTimeMilliseconds"), counted = included.reduce((sum, trip) => sum + countedTime(trip), 0);
            const productive=included.reduce((sum,trip)=>sum+(bank(trip)?.productiveTimeMilliseconds??countedTime(trip)),0);
            const balance=included.reduce((sum,trip)=>{const value=bank(trip);return sum+(value?(trip.running?Math.max(duration(trip.allottedTimeMilliseconds)-value.allowanceCreditMilliseconds,value.countedTimeBalanceMilliseconds):value.countedTimeBalanceMilliseconds):countedTime(trip));},0);
            const credit=included.reduce((sum,trip)=>sum+(bank(trip)?.allowanceCreditMilliseconds??0),0);
            const performanceCounted=included.reduce((sum,trip)=>sum+Math.max(trip.running?duration(trip.allottedTimeMilliseconds):0,bank(trip)?.productiveTimeMilliseconds??countedTime(trip)),0);
            const earned=standard+credit;
            const goal = Number.isFinite(goalPercent) && goalPercent > 0 ? goalPercent : 1;
            return Object.freeze({includeActiveTrip: Boolean(includeActiveTrip), tripCount: included.length, standardTimeMilliseconds: standard,
                actualTimeMilliseconds: actual, countedTimeMilliseconds: counted,
                productiveTimeMilliseconds:productive,allowanceCreditMilliseconds:credit,countedTimeBalanceMilliseconds:balance,
                downtime: TripDowntimeSummary.calculate(included, {now}),
                earnedTimeMilliseconds:earned,performanceCountedTimeMilliseconds:performanceCounted,
                percent: performanceCounted > 0 ? earned / performanceCounted : null,
                goalPercent: goal, bankedTimeMilliseconds: Math.round(earned / goal - performanceCounted)});
        }
    });
})();
