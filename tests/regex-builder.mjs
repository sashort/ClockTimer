import assert from "node:assert/strict";

await import(
    "../api/admin/speech-editor/RegexBuilder.js"
);

const builder =
    globalThis.WMOFRegexBuilder;

assert.ok(
    builder,
    "Regex Builder should register globally"
);

assert.deepEqual(
    builder.inferWildcard(
        "AAA"
    ),
    [
        "letters:3"
    ]
);

assert.deepEqual(
    builder.inferWildcard(
        "###"
    ),
    [
        "digits:3"
    ]
);

assert.deepEqual(
    builder.inferWildcard(
        "##.##"
    ),
    [
        "decimal:2.2"
    ]
);

assert.deepEqual(
    builder.inferWildcard(
        "code:AAA"
    ),
    [
        "code:letters:3"
    ]
);

assert.deepEqual(
    builder.inferWildcard(
        "+"
    ),
    [
        "letters:+",
        "digits:+",
        "words:+",
        "alphanumeric:+"
    ]
);

assert.deepEqual(
    builder.templates
        .slice(
            0,
            4
        )
        .map(
            template =>
                template.group
        ),
    [
        "app",
        "app",
        "app",
        "app"
    ],
    "app templates should be grouped first"
);

assert.deepEqual(
    builder.inferWildcard(
        "12:30"
    ),
    [
        "time",
        "duration"
    ],
    "a bare two-part time is intentionally ambiguous"
);

assert.deepEqual(
    builder.inferWildcard(
        "12:30 pm"
    ),
    [
        "time"
    ]
);

assert.deepEqual(
    builder.inferWildcard(
        "1:02:03"
    ),
    [
        "duration"
    ]
);

assert.deepEqual(
    builder.inferWildcard(
        "50%"
    ),
    [
        "percent"
    ]
);

assert.deepEqual(
    builder.inferWildcard(
        "2026-09-23"
    ),
    [
        "date"
    ]
);

assert.deepEqual(
    builder.inferWildcard(
        "spokenTime:12:30 pm"
    ),
    [
        "spokenTime:time"
    ]
);

const ambiguousTime =
    builder.compile(
        "ready [at] <12:30>"
    );

assert.equal(
    ambiguousTime.valid,
    false
);

assert.match(
    ambiguousTime.error,
    /more than one template/i
);

const explicitTimeShape =
    builder.compile(
        "ready [at] <12:30 pm>"
    );

assert.equal(
    explicitTimeShape.valid,
    true,
    explicitTimeShape.error
);

const phrase =
    builder.compile(
        "Set [the] {Trip|TOTAL} goal to <percent>"
    );

assert.equal(
    phrase.valid,
    true,
    phrase.error
);

const phraseRegex =
    new RegExp(
        phrase.pattern,
        "i"
    );

assert.equal(
    phraseRegex.test(
        "set trip goal to 50"
    ),
    true
);

assert.equal(
    phraseRegex.test(
        "set the total goal to fifty"
    ),
    true
);

const optionalPrefix =
    builder.compile(
        "[please] start"
    );

assert.equal(
    optionalPrefix.valid,
    true,
    optionalPrefix.error
);

const optionalPrefixRegex =
    new RegExp(
        optionalPrefix.pattern,
        "i"
    );

assert.equal(
    optionalPrefixRegex.test(
        "start"
    ),
    true
);

assert.equal(
    optionalPrefixRegex.test(
        "please start"
    ),
    true
);

const optionalSuffix =
    builder.compile(
        "start [please]"
    );

assert.equal(
    optionalSuffix.valid,
    true,
    optionalSuffix.error
);

const optionalSuffixRegex =
    new RegExp(
        optionalSuffix.pattern,
        "i"
    );

assert.equal(
    optionalSuffixRegex.test(
        "start"
    ),
    true
);

assert.equal(
    optionalSuffixRegex.test(
        "start please"
    ),
    true
);

const letters =
    builder.compile(
        "code <AAA>"
    );

assert.equal(
    letters.valid,
    true,
    letters.error
);

const lettersRegex =
    new RegExp(
        letters.pattern,
        "i"
    );

assert.equal(
    lettersRegex.test(
        "code abc"
    ),
    true
);

assert.equal(
    lettersRegex.test(
        "code a b c"
    ),
    true
);

const decimal =
    builder.compile(
        "value <##.##>"
    );

assert.equal(
    decimal.valid,
    true,
    decimal.error
);

assert.equal(
    new RegExp(
        decimal.pattern,
        "i"
    ).test(
        "value 12.34"
    ),
    true
);

const ranged =
    builder.compile(
        "pin <digits:2..4>"
    );

assert.equal(
    ranged.valid,
    true,
    ranged.error
);

const rangedRegex =
    new RegExp(
        ranged.pattern,
        "i"
    );

assert.equal(
    rangedRegex.test(
        "pin 12"
    ),
    true
);

assert.equal(
    rangedRegex.test(
        "pin 1 2 3 4"
    ),
    true
);

assert.equal(
    rangedRegex.test(
        "pin 12345"
    ),
    false
);

const ambiguous =
    builder.compile(
        "value <+>"
    );

assert.equal(
    ambiguous.valid,
    false
);

assert.match(
    ambiguous.error,
    /more than one template/i
);

const unclosed =
    builder.compile(
        "start [please"
    );

assert.equal(
    unclosed.valid,
    false
);

assert.match(
    unclosed.error,
    /close/i
);

console.log(
    "Regex Builder tests passed."
);
