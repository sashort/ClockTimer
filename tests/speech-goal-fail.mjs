import fs from "node:fs";
import assert from "node:assert/strict";

const source =
    fs.readFileSync(
        new URL(
            "../ClockTimer.js",
            import.meta.url
        ),
        "utf8"
    );

assert.match(
    source,
    /#tick\(\)\s*\{[\s\S]*#checkGoalMisses\(\s*now\s*\)[\s\S]*#refreshRingLayout\(\s*now\s*\)/
);

console.log(
    "PASS cadence ticks evaluate goal failures before rendering the next frame"
);


const strippedDefinition =
    source.replace(
        /#checkGoalMisses\(now\)\s*\{[\s\S]*?\n        \}\n\n        #calculateTripGoalRequirementsForGoal/,
        "#calculateTripGoalRequirementsForGoal"
    );

const callMatches =
    [
        ...strippedDefinition.matchAll(
            /#checkGoalMisses\(/g
        )
    ];

assert.equal(
    callMatches.length,
    1
);

assert.match(
    strippedDefinition,
    /#tick\(\)\s*\{[\s\S]*#checkGoalMisses\(\s*now\s*\)/
);

console.log(
    "PASS goalFail evaluation is temporal-only and not mutation-driven"
);


const appSource =
    fs.readFileSync(
        new URL(
            "../app.js",
            import.meta.url
        ),
        "utf8"
    );

assert.match(
    appSource,
    /sentences\.push\(\s*"Trip Goal Failed\."\s*\)/
);

assert.match(
    appSource,
    /sentences\.push\(\s*"Total Goal Failed\."\s*\)/
);

assert.match(
    appSource,
    /return "Standard Goal Failed\."/
);

assert.match(
    appSource,
    /remaining until \$\{label\} Goal\$\{percentText\}\./
);

assert.match(
    appSource,
    /type !== "standard"[\s\S]*roundedPercent !== 100/
);

console.log(
    "PASS goal-fail speech keeps the failed-goal sentence and combines fallback goal with remaining time"
);
