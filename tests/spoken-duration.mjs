import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync(
    new URL(
        "../lang/en-US/DurationParser.js",
        import.meta.url
    ),
    "utf8"
);
const Parser = Function(
    `${source};return EnglishDurationParser;`
)();

assert.match(
    source,
    /#parseClockStyleHourMinute\([\s\S]*?clockStyleHourMinute/
);
const parse =
    value =>
        Parser.format(
            Parser.parse(
                value
            )
        );

assert.equal(
    parse("forty five minutes"),
    "45:00"
);
assert.equal(
    parse("one hour"),
    "1:00:00"
);
assert.equal(
    parse("one hour twenty minutes"),
    "1:20:00"
);
assert.equal(
    parse("zero thirty"),
    "30:00"
);
assert.equal(
    parse("1:30"),
    "1:30"
);
assert.equal(
    parse("1:02:03"),
    "1:02:03"
);

/*
 * Raw digit input is anchored at the end:
 * seconds, then minutes, then hours.
 */
assert.equal(
    parse("159"),
    "1:59"
);
assert.equal(
    parse("530"),
    "5:30"
);
assert.equal(
    parse("1 1 2 6"),
    "11:26"
);
assert.equal(
    parse("one one two six"),
    "11:26"
);
assert.equal(
    parse("1 2 3 4 5"),
    "1:23:45"
);
assert.equal(
    parse("double one two six"),
    "11:26"
);
assert.equal(
    parse("o five"),
    "0:05"
);
assert.equal(
    parse("12 17"),
    "12:17"
);
assert.equal(
    parse("7 56"),
    "7:56"
);
assert.equal(
    parse("2 o 4"),
    "2:04"
);
assert.equal(
    parse("22 56"),
    "22:56"
);
assert.equal(
    parse("1 17 0 9"),
    "1:17:09"
);
assert.equal(
    parse("seventeen thirty six"),
    "17:36"
);
assert.equal(
    parse("twenty two nineteen"),
    "22:19"
);
assert.equal(
    parse("seven twenty six"),
    "7:26"
);
assert.equal(
    parse("one seventeen oh nine"),
    "1:17:09"
);
assert.equal(
    Parser.parse(
        "1 6 0"
    ),
    undefined
);

/*
 * Informal duration speech states the first unit explicitly, then allows
 * lower-order units to be omitted when position makes them unambiguous.
 */
assert.equal(
    parse(
        "an hour one and twelve"
    ),
    "1:01:12"
);
assert.equal(
    parse(
        "two hours thirty-five and forty-five"
    ),
    "2:35:45"
);
assert.equal(
    parse(
        "twenty-three minutes and twenty-four"
    ),
    "23:24"
);
assert.equal(
    parse(
        "an hour twelve seconds"
    ),
    "1:00:12"
);
assert.equal(
    parse(
        "one hour twenty"
    ),
    "1:20:00"
);
assert.equal(
    parse(
        "two hours five minutes ten seconds"
    ),
    "2:05:10"
);

assert.equal(
    Parser.parse(
        "199"
    ),
    undefined
);
assert.equal(
    Parser.parse(
        "ninety minutes"
    ),
    undefined
);
assert.equal(
    Parser.parse(
        "90"
    ),
    undefined
);
assert.equal(
    Parser.parse(
        "nonsense"
    ),
    undefined
);

console.log(
    "PASS English spoken-duration parsing"
);
