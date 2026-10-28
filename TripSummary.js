(() => {
    'use strict';
    // Presentation contract only; fetching, assignment and persistence stay outside.
    class TripSummary {
        static build({trips = [], totals, activeTrip, scope, scopeLabel = scope, text, duration, percent, spokenDuration, spokenPercent}) {
            const breakOnly = trip => trip?.breakOnly || trip?.events?.some(event => event.event === "trip.started" && event.value?.breakOnly === true);
            if (breakOnly(activeTrip)) activeTrip = undefined;
            trips = trips.filter(trip => !breakOnly(trip));
            const known = value => Number.isFinite(value) && value >= 0;
            // Summary precision is presentation-only: truncate percentage tenths.
            // Correct binary error at exact decimal boundaries such as 100.1.
            const percentText = value => {const scaled=value*1000;
                return (Math.trunc(scaled+Number.EPSILON*Math.max(1,Math.abs(scaled)))/10).toFixed(1);};
            const sayPercent = value => spokenPercent(value,percentText(value));
            const unique = new Map();
            for (const trip of trips) unique.set(trip.id == null ? trip : String(trip.id), trip);
            const finished = [...unique.values()].filter(trip => !trip.running &&
                !(activeTrip?.id != null && String(trip.id) === String(activeTrip.id)));
            const timestamp = trip => {const value=String(trip.endTime || trip.startTime || '');
                return Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(value)?value:value.replace(' ','T')+'Z') || 0;};
            finished.sort((a,b) => timestamp(b) - timestamp(a));
            const last = finished[0];
            const counted = trip => known(trip?.countedTimeMilliseconds) ? trip.countedTimeMilliseconds : trip?.countedTimeElapsedMilliseconds;
            const lastActual = globalThis.TripTimeBank?.project(last||{})?.productiveTimeMilliseconds ?? counted(last);
            const lastPercent = known(last?.standardTimeMilliseconds) && counted(last) > 0
                ? last.standardTimeMilliseconds / counted(last) : undefined;
            const activeActual = globalThis.TripTimeBank?.project(activeTrip||{})?.productiveTimeMilliseconds ?? counted(activeTrip);
            const activePercent = known(activeTrip?.standardTimeMilliseconds) && counted(activeTrip) > 0
                ? activeTrip.standardTimeMilliseconds / counted(activeTrip) : undefined;
            const row = (key, standard, actual, performance) => Object.freeze({key, label:key==='total'?scopeLabel:text(key+'Label'),
                standard:known(standard)?duration(standard):'---', actual:known(actual)?duration(actual):'---',
                percent:known(performance)?percent(performance,percentText(performance)):'---'});
            const rows = [row('total',totals.tripCount?totals.standardTimeMilliseconds:undefined,
                totals.tripCount?(totals.productiveTimeMilliseconds??totals.countedTimeMilliseconds):undefined,totals.percent),
                row('last',last?.standardTimeMilliseconds,lastActual,lastPercent)];
            if(activeTrip)rows.push(row('active',activeTrip.standardTimeMilliseconds,activeActual,activePercent));
            const speech = [];
            if(known(lastActual))speech.push(text('lastActual',{duration:spokenDuration(lastActual)}));
            if(known(lastPercent) && known(totals.percent))speech.push(text('performances',{
                lastPercent:sayPercent(lastPercent),scope,totalPercent:sayPercent(totals.percent)}));
            else if(known(lastPercent))speech.push(text('lastPerformance',{percent:sayPercent(lastPercent)}));
            else if(known(totals.percent))speech.push(text('totalPerformance',{scope,percent:sayPercent(totals.percent)}));
            if(known(activeTrip?.standardTimeMilliseconds))speech.push(text('activeStandard',{duration:spokenDuration(activeTrip.standardTimeMilliseconds)}));
            const hasData=rows.some(row=>[row.standard,row.actual,row.percent].some(value=>value!=='---'));
            return Object.freeze({rows:Object.freeze(rows),speech:speech.join(' ') || text(hasData?'title':'noData'),lastTrip:last || null,activeTrip:activeTrip || null});
        }
        static render(document, presentation, text) {
            const table=document.createElement('table');table.className='trip-summary-table';
            const head=table.createTHead().insertRow();
            for(const label of ['',text('standardColumn'),text('actualColumn'),text('percentColumn')]){
                const cell=document.createElement('th');cell.scope='col';cell.textContent=label;head.append(cell);
            }
            const body=table.createTBody();
            for(const row of presentation.rows){const tr=body.insertRow();tr.dataset.tripSummaryRow=row.key;
                const label=document.createElement('th');label.scope='row';label.textContent=row.label;tr.append(label);
                for(const value of [row.standard,row.actual,row.percent]){const cell=tr.insertCell();cell.textContent=value;}
            }
            return table;
        }
    }
    globalThis.TripSummary=TripSummary;
})();
