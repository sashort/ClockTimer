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
    /summarySentences\.push\(\s*"Trip Goal Failed\."\s*\)/
);

assert.match(
    appSource,
    /summarySentences\.push\([\s\S]*totalScopeLabel\(\) \+ " Goal Failed\."/
);

assert.match(
    appSource,
    /\$\{formatGoalFailureDuration\([\s\S]*?remainingMilliseconds[\s\S]*?\)\} until \$\{label\} Goal\$\{percentText\}\./
);

assert.match(
    appSource,
    /const useStandardLabel\s*=\s*type === "standard"\s*\|\|\s*roundedPercent === 100/
);

assert.match(
    appSource,
    /const label\s*=\s*useStandardLabel\s*\? "Standard"/
);

assert.match(
    appSource,
    /const percentText\s*=\s*!useStandardLabel/
);

console.log(
    "PASS goal-fail speech keeps the failed-goal sentence and combines time with the fallback goal"
);


assert.match(
    appSource,
    /const announcedGoals\s*=\s*percentMode === "trip"[\s\S]*goal\?\.type ===\s*"standard"[\s\S]*goal\?\.type ===\s*"trip"[\s\S]*percentMode === "total"[\s\S]*goal\?\.type ===\s*"standard"[\s\S]*goal\?\.type ===\s*"total"/
);

assert.match(
    appSource,
    /const standardFailed\s*=\s*announcedGoals\.some/
);

assert.match(
    appSource,
    /const belowStandardFailed\s*=\s*announcedGoals\.some/
);

assert.match(
    appSource,
    /for \(const goal of announcedGoals\)/
);

console.log(
    "PASS fixed Trip/Total modes announce only Standard plus their selected goal scope"
);


assert.match(
    appSource,
    /summarySentences[\s\S]*"Standard Goal Failed\."[\s\S]*"Trip Goal Failed\."[\s\S]*totalScopeLabel\(\) \+ " Goal Failed\."[\s\S]*consumeAnnouncementAction\([\s\S]*"goal-failed",[\s\S]*"summary"/
);

assert.match(
    appSource,
    /detailSentences\.length[\s\S]*consumeAnnouncementAction\([\s\S]*"goal-failed",[\s\S]*"details"[\s\S]*spoken\.push[\s\S]*return spoken\.join/
);

assert.match(
    appSource,
    /const chime\s*=[\s\S]*consumeAnnouncementAction\([\s\S]*"goal-failed",[\s\S]*"chime"[\s\S]*runSemanticAnnouncement\([\s\S]*"goal-failed"/
);

console.log(
    "PASS goal-fail layers separate chime, failed-goal summary, and fallback/overtime details"
);
