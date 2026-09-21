import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("../lang/en-US/SpokenTimeParser.js", import.meta.url), "utf8");
const Parser = Function(`${source}; return EnglishSpokenTimeParser;`)();
const reference = new Date(2026, 8, 20, 14, 0, 0, 0);
const parts = value => {
    const result = Parser.parse(value, {baseDate: reference});
    return result && [result.getFullYear(), result.getMonth() + 1, result.getDate(), result.getHours(), result.getMinutes()];
};

assert.deepEqual(parts("five thirty"), [2026, 9, 20, 17, 30]);
assert.deepEqual(parts("5:30 AM"), [2026, 9, 21, 5, 30]);
assert.deepEqual(parts("13 45"), [2026, 9, 21, 13, 45]);
assert.deepEqual(parts("thirteen forty five"), [2026, 9, 21, 13, 45]);
assert.deepEqual(parts("five oh five"), [2026, 9, 20, 17, 5]);
assert.deepEqual(parts("quarter to six pm"), [2026, 9, 20, 17, 45]);
assert.deepEqual(parts("half past five"), [2026, 9, 20, 17, 30]);
assert.deepEqual(parts("noon tomorrow"), [2026, 9, 21, 12, 0]);
assert.deepEqual(parts("midnight"), [2026, 9, 21, 0, 0]);
assert.deepEqual(parts("today at five"), [2026, 9, 20, 17, 0]);
assert.equal(Parser.parse("twenty five sixty", {baseDate: reference}), undefined);

console.log("PASS English spoken-time parsing and future-time resolution");
