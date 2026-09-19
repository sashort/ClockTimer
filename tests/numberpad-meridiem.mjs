import fs from 'node:fs';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const controller = new Function(`
    let numberPadState;
    function refreshNumberPad() {}
    ${section('    function splitAbsoluteDigits(', '    function renderAbsoluteDigits(')}
    ${section('    function absoluteHour24(', '    function absoluteTimelineMilliseconds(')}
    ${section('    function absoluteValuesEqual(', '    function getNumberPadClearAction(')}
    ${section('    function changeNumberPadMeridiem(', '    function formatTripTimeDisplay(')}
    ${section('    function eraseNumberPadPendingValue(', '    function runNumberPadClearShortAction(')}
    return {set: state => numberPadState = state, changeNumberPadMeridiem,
        get: () => numberPadState, absoluteHour24, numberPadHasChanges,
        eraseNumberPadPendingValue, resetNumberPadPendingValue};
`)();
function state(hour, meridiem) {
    return {mode:'absolute', pending:`${hour}4629`, meridiem, pendingDate:'2026-09-18'};
}
for (const [hour, previous, next, expectedHour, expectedMeridiem] of [
    [15,'PM','PM',15,null], [23,'PM','PM',23,null],
    [12,'AM','AM',0,null], [12,'PM','PM',12,null],
    [0,null,'AM',12,'AM'], [0,null,'PM',12,'PM'],
    [15,null,'PM',3,'PM'], [23,null,'AM',11,'AM'],
    [15,'PM','AM',3,'AM'], [15,'AM','PM',3,'PM']
]) {
    controller.set(state(hour,previous));controller.changeNumberPadMeridiem(next);
    const result=controller.get();
    assert.equal(result.pending,`${expectedHour}4629`);
    assert.equal(result.meridiem,expectedMeridiem);
    assert.equal(result.pendingDate,'2026-09-18');
    assert(controller.absoluteHour24(result)>=0 && controller.absoluteHour24(result)<=23);
}
console.log('PASS AM/PM conversion handles midnight, noon, and 24-hour input without exceeding 23');
for(let hour=0;hour<=99;hour++) {
    controller.set(state(hour,'PM'));
    for(const next of ['PM','PM','AM','AM','PM','AM','AM']) {
        controller.changeNumberPadMeridiem(next);
        const result=controller.get();
        assert(controller.absoluteHour24(result)>=0 && controller.absoluteHour24(result)<=23);
    }
}
console.log('PASS repeated toggles normalize hours and remain within a valid clock range');
assert.equal(controller.absoluteHour24(state(15,'PM')),undefined);
assert.equal(controller.absoluteHour24(state(24,null)),undefined);
assert.equal(controller.absoluteHour24({...state(3,'PM'),pending:'36099'}),undefined);
console.log('PASS invalid clock values cannot reach the 24-hour conversion');
for (const [hour, meridiem, target] of [[7,null,'AM'],[19,null,'PM'],[0,null,'AM'],[12,null,'PM'],[7,'AM','AM'],[7,'PM','PM']]) {
    const initial=state(hour,meridiem);
    controller.set({...initial,initial:initial.pending,initialMeridiem:meridiem,initialDate:initial.pendingDate,everEdited:false});
    controller.changeNumberPadMeridiem(target);
    assert.equal(controller.numberPadHasChanges(),false);
    assert.equal(controller.get().everEdited,false);
}
console.log('PASS applying or removing equivalent AM/PM notation does not mark the time changed');
const initial=state(7,null);
controller.set({...initial,initial:initial.pending,initialMeridiem:null,initialDate:initial.pendingDate,everEdited:false});
controller.changeNumberPadMeridiem('PM');
assert(controller.numberPadHasChanges());assert(controller.get().everEdited);
controller.changeNumberPadMeridiem('AM');assert.equal(controller.numberPadHasChanges(),false);
controller.get().pendingDate='2026-09-19';assert(controller.numberPadHasChanges());
console.log('PASS real AM/PM changes and date changes are detected, and returning to original time clears changes');

for (const initialMeridiem of ['AM', 'PM', undefined]) {
    const original = {mode:'absolute', initial:'074629', pending:'074629',
        initialDate:'2026-09-18', pendingDate:'2026-09-18',
        initialMeridiem, meridiem:initialMeridiem, source:'trip-settings'};
    controller.set({...original});
    controller.eraseNumberPadPendingValue();
    assert.equal(controller.get().pending, '');
    assert.equal(controller.get().meridiem, undefined);
    controller.resetNumberPadPendingValue();
    assert.equal(controller.get().pending, original.initial);
    assert.equal(controller.get().meridiem, initialMeridiem);
    controller.get().pending = '084629';
    controller.get().pendingDate = '2026-09-19';
    controller.eraseNumberPadPendingValue();
    assert.equal(controller.get().pending, '');
    assert.equal(controller.get().meridiem, undefined);
    controller.resetNumberPadPendingValue();
    assert.equal(controller.get().pending, original.initial);
    assert.equal(controller.get().pendingDate, original.initialDate);
    assert.equal(controller.get().meridiem, initialMeridiem);
}
console.log('PASS backspace clears original values and AM/PM; Reset restores AM, PM, or neither');

const returnController = new Function(`
    let tripSettingsNavigation = {returnTarget:'number-pad', numberPadState:{
        mode:'duration', source:'standard-time', initial:'003000', pending:'003000', everEdited:false
    }};
    const tripSettingsSession = {values:{standardTime:'0:45:00'}};
    function getTripSettingsReturnNumberPadState() { return tripSettingsNavigation.numberPadState; }
    ${section('    function normalizeTimeDigits(', '    function normalizePercentDigits(')}
    ${section('    function syncTripSettingsCallerAfterSave(', '    async function closeTripSettingsToNavigation(')}
    syncTripSettingsCallerAfterSave();
    return tripSettingsNavigation.numberPadState;
`)();
assert.equal(returnController.initial,'003000');
assert.equal(returnController.pending,'04500');
assert.equal(returnController.everEdited,true);
console.log('PASS returning from Trip Settings preserves the original and marks the new numberpad value changed');
