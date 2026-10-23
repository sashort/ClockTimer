import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("../lang/en-US/PercentParser.js", import.meta.url), "utf8");
const Parser = Function(`${source}; return EnglishSpokenPercentParser;`)();
assert.equal(Parser.parse("100"), 100);
assert.equal(Parser.parse("100 percent"), 100);
assert.equal(Parser.parse("one ten"), 110);
assert.equal(Parser.parse("one ten percent"), 110);
assert.equal(Parser.parse("ninety five"), 95);
assert.equal(Parser.parse("one hundred and five percent"), 105);
assert.equal(Parser.parse("102.5%"), 102.5);
assert.equal(Parser.parse("oh"), 0);
assert.equal(Parser.parse("o"), 0);
assert.equal(Parser.parse("naught"), 0);
assert.equal(Parser.parse("one oh five"), 105);
assert.equal(Parser.parse("double five"), 55);
assert.equal(Parser.parse("later"), undefined);
console.log("PASS English spoken-percent parsing");

for(const [phrase,expected] of [['one twelve',112],['one twenty two',122],['two fifteen percent',215],['one 12',112],['1 twelve',112],['one two',12],['one oh five',105],['twelve',12],['twenty two',22]])assert.equal(Parser.parse(phrase),expected,phrase);
console.log('PASS colloquial hundreds preserve the leading group without changing digit sequences');
