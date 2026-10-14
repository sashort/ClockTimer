import fs from "node:fs";
import assert from "node:assert/strict";
import {Window} from "happy-dom";

const window = new Window({url: "https://clock.example/"});
window.eval(fs.readFileSync(new URL("../TimeRangeModel.js", import.meta.url), "utf8"));

const {TimeRange, TimeRangeTick} = window;
const t = value => new Date(`2026-10-03T${value}:00Z`);

assert.throws(
    () => TimeRange.create({type: TimeRange.Type.FIXED, start: t("10:00"), end: t("09:00")}),
    /must not precede/
);

const fixed = TimeRange.create({type: TimeRange.Type.FIXED, start: t("10:00"), end: t("10:30")});
assert.equal(fixed.ranges.length, 1);
assert.equal(fixed.group.head, fixed.ranges[0]);

assert.throws(
    () => TimeRange.create({group: fixed.group, type: TimeRange.Type.MOVEABLE, start: t("10:15"), end: t("10:20")}),
    /overlap/
);

const chain = TimeRange.create({type: TimeRange.Type.EXPANDABLE, start: t("11:00"), end: t("11:10")});
const move = TimeRange.create({group: chain.group, type: TimeRange.Type.MOVEABLE, start: t("11:10"), end: t("11:20")}).ranges[0];
const collapse = TimeRange.create({group: chain.group, type: TimeRange.Type.COLLAPSABLE, start: t("11:20"), end: t("11:30")}).ranges[0];
const move2 = TimeRange.create({group: chain.group, type: TimeRange.Type.MOVEABLE, start: t("11:30"), end: t("11:40")}).ranges[0];

assert.equal(move.next, collapse);
assert.equal(collapse.next, move2);
chain.group.tick(t("11:30"), t("11:20"));
assert.equal(chain.group.tail, move2);
assert.equal(move.next, move2, "Moveables become adjacent after Collapsable removal");

const dormant = TimeRange.create({type: TimeRange.Type.EXPANDABLE, start: t("12:00"), end: t("12:00")});
const dormantRange = dormant.ranges[0];
dormant.group.tick(t("12:05"), t("11:55"));
assert.equal(dormantRange.end.getTime(), t("12:05").getTime());

const barrier = TimeRange.create({type: TimeRange.Type.FIXED, start: t("13:00"), end: t("13:30")});
const endEvents = [];
barrier.group.addEventListener("end", event => { endEvents.push(event); });
assert.equal("END" in TimeRange.Events, false);
barrier.group.tick(t("13:30"), t("13:20"));
barrier.group.tick(t("13:31"), t("13:30"));
assert.equal(endEvents.length, 0, "Reaching or passing the group end emits no redundant end event");
assert.equal(barrier.group.tail.end.getTime(), t("13:30").getTime());

const boundaries = TimeRange.create({type: TimeRange.Type.FIXED, start: t("14:00"), end: t("14:40"), boundaries: [t("14:20"), t("14:30")]});
assert.equal(boundaries.ranges.length, 3);
assert.equal(boundaries.ranges[0].type, TimeRange.Type.COLLAPSABLE);
assert.equal(boundaries.ranges[1].type, TimeRange.Type.COLLAPSABLE);
assert.equal(boundaries.ranges[2].type, TimeRange.Type.EXPANDABLE);
assert.equal(boundaries.ranges[0].end.getTime(), boundaries.ranges[1].start.getTime());
assert.equal(boundaries.ranges[1].end.getTime(), boundaries.ranges[2].start.getTime());

const clock = new EventTarget();
const withClock = TimeRange.create({clock, type: TimeRange.Type.EXPANDABLE, start: t("15:00"), end: t("15:10")});
clock.dispatchEvent(new CustomEvent("tick", {detail: {currentTime: t("15:15"), lastTickTime: t("15:10")}}));
assert.equal(withClock.ranges[0].end.getTime(), t("15:15").getTime());

const tick = new TimeRangeTick(t("16:10"), t("16:00"));
tick.advanceTo(t("16:05"));
assert.equal(tick.remainingDelta, 5 * 60 * 1000);

console.log("PASS linked TimeRange model");
