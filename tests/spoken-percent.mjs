import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("../lang/en-US/PercentParser.js", import.meta.url), "utf8");
const Parser = Function(`${source}; return EnglishSpokenPercentParser;`)();
assert.equal(Parser.parse("100"), 100);
assert.equal(Parser.parse("100 percent"), 100);
assert.equal(Parser.parse("ninety five"), 95);
assert.equal(Parser.parse("one hundred and five percent"), 105);
assert.equal(Parser.parse("102.5%"), 102.5);
assert.equal(Parser.parse("later"), undefined);
console.log("PASS English spoken-percent parsing");
