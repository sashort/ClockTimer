import fs from "node:fs";
import assert from "node:assert/strict";

const source=fs.readFileSync(new URL("../lang/en-US/DurationParser.js",import.meta.url),"utf8");
const Parser=Function(`${source};return EnglishDurationParser;`)();
const parse=value=>Parser.format(Parser.parse(value));

assert.equal(parse("forty five minutes"),"0:45:00");
assert.equal(parse("one hour"),"1:00:00");
assert.equal(parse("one hour twenty minutes"),"1:20:00");
assert.equal(parse("zero thirty"),"0:30:00");
assert.equal(parse("1:30"),"1:30:00");
assert.equal(parse("1:02:03"),"1:02:03");
assert.equal(parse("159"),"1:59:00");
assert.equal(parse("530"),"5:30:00");
assert.equal(Parser.parse("199"),undefined);
assert.equal(Parser.parse("ninety minutes"),undefined);
assert.equal(Parser.parse("90"),undefined);
assert.equal(parse("two hours five minutes ten seconds"),"2:05:10");
assert.equal(Parser.parse("nonsense"),undefined);

console.log("PASS English spoken-duration parsing");
