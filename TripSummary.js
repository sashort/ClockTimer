(() => {
    'use strict';
    // Presentation contract only; fetching, assignment and persistence stay outside.
    class TripSummary {
        static build({trips = [], totals, activeTrip, scope, text, duration, percent, spokenDuration, spokenPercent}) {
            const known = value => Number.isFinite(value) && value >= 0;
            const unique = new Map();
            for (const trip of trips) unique.set(trip.id == null ? trip : String(trip.id), trip);
            const finished = [...unique.values()].filter(trip => !trip.running &&
                !(activeTrip?.id != null && String(trip.id) === String(activeTrip.id)));
            const timestamp = trip => {const value=String(trip.endTime || trip.startTime || '');
                return Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(value)?value:value.replace(' ','T')+'Z') || 0;};
            finished.sort((a,b) => timestamp(b) - timestamp(a));
            const last = finished[0];
            const counted = trip => known(trip?.countedTimeMilliseconds) ? trip.countedTimeMilliseconds : trip?.countedTimeElapsedMilliseconds;
            const lastActual = counted(last);
            const lastPercent = known(last?.standardTimeMilliseconds) && lastActual > 0
                ? last.standardTimeMilliseconds / lastActual : undefined;
            const activeActual = counted(activeTrip);
            const activePercent = known(activeTrip?.standardTimeMilliseconds) && activeActual > 0
                ? activeTrip.standardTimeMilliseconds / activeActual : undefined;
            const row = (key, standard, actual, performance) => Object.freeze({key, label:text(key+'Label'),
                standard:known(standard)?duration(standard):'---', actual:known(actual)?duration(actual):'---',
                percent:known(performance)?percent(performance):'---'});
            const rows = [row('total',totals.tripCount?totals.standardTimeMilliseconds:undefined,
                totals.tripCount?totals.countedTimeMilliseconds:undefined,totals.percent),
                row('last',last?.standardTimeMilliseconds,lastActual,lastPercent)];
            if(activeTrip)rows.push(row('active',activeTrip.standardTimeMilliseconds,activeActual,activePercent));
            const speech = [];
            if(known(lastActual))speech.push(text('lastActual',{duration:spokenDuration(lastActual)}));
            if(known(lastPercent) && known(totals.percent))speech.push(text('performances',{
                lastPercent:spokenPercent(lastPercent),scope,totalPercent:spokenPercent(totals.percent)}));
            else if(known(lastPercent))speech.push(text('lastPerformance',{percent:spokenPercent(lastPercent)}));
            else if(known(totals.percent))speech.push(text('totalPerformance',{scope,percent:spokenPercent(totals.percent)}));
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
