import fs from "node:fs";
import assert from "node:assert/strict";

const source = [
    "NumberParser",
    "DurationParser",
    "SpokenTimeParser",
    "PercentParser",
    "SpeechValuePreprocessor"
]
    .map(
        name =>
            fs.readFileSync(
                new URL(
                    `../lang/en-US/${name}.js`,
                    import.meta.url
                ),
                "utf8"
            )
    )
    .join("\n");

const Preprocessor =
    Function(
        `${source}; return EnglishSpeechValuePreprocessor;`
    )();

const NumberParser =
    Function(
        `${source}; return EnglishSpokenNumberParser;`
    )();

assert.equal(
    NumberParser.normalizeText("one"),
    "1"
);
assert.equal(
    NumberParser.normalizeText("twenty five"),
    "25"
);
assert.equal(
    NumberParser.normalizeText("one hundred and five"),
    "105"
);
assert.equal(
    NumberParser.normalizeText("five point five"),
    "5.5"
);
assert.equal(
    NumberParser.normalizeText("negative three"),
    "-3"
);
assert.equal(
    NumberParser.normalizeText("five thirty"),
    "5 30"
);

assert.equal(
    Preprocessor.parse(
        "forty five minutes",
        "duration"
    ),
    45 * 60000
);
assert.equal(
    Preprocessor.normalize(
        "forty five minutes",
        "duration"
    ),
    "0:45:00"
);
assert.equal(
    Preprocessor.normalize(
        "an hour and 30",
        "duration"
    ),
    "1:30:00"
);
assert.equal(
    Preprocessor.normalize(
        "one hour 15",
        "duration"
    ),
    "1:15:00"
);
assert.equal(
    Preprocessor.normalize(
        "three twelve",
        "duration"
    ),
    "0:03:12"
);
assert.equal(
    Preprocessor.normalize(
        "3:12",
        "duration"
    ),
    "0:03:12"
);
assert.equal(
    Preprocessor.normalize(
        "1:03:12",
        "duration"
    ),
    "1:03:12"
);

assert.equal(
    Preprocessor.parse(
        "one hundred and five percent",
        "percent"
    ),
    105
);
assert.equal(
    Preprocessor.normalize(
        "one hundred and five percent",
        "percent"
    ),
    "105"
);

assert.deepEqual(
    Preprocessor.parse(
        "five thirty pm",
        "clock-parts"
    ),
    {
        hour: 5,
        minute: 30,
        meridiem: "pm",
        day: undefined
    }
);
assert.equal(
    Preprocessor.normalize(
        "five thirty pm",
        "clock"
    ),
    "5:30 pm"
);

const baseDate =
    new Date(
        2026,
        8,
        21,
        14,
        0,
        0
    );

assert.equal(
    Preprocessor.parse(
        "five thirty pm",
        "clock",
        {baseDate}
    ).getHours(),
    17
);

assert.equal(
    Preprocessor.parse(
        "five thirty pm",
        "duration"
    ),
    undefined
);

console.log(
    "PASS context-aware speech number, duration, percent, and clock preprocessing"
);
