import fs from "node:fs";
import assert from "node:assert/strict";

const app =
    fs.readFileSync(
        new URL(
            "../app.js",
            import.meta.url
        ),
        "utf8"
    );

const catalog =
    JSON.parse(
        fs.readFileSync(
            new URL(
                "../api/audio/catalog.json",
                import.meta.url
            ),
            "utf8"
        )
    );

const transition =
    catalog
        .songs
        ["trip-transition"];

assert.ok(
    transition,
    "combined end/start song must exist"
);

assert.deepEqual(
    transition.events.map(
        event => event.tone
    ),
    [
        "D#8",
        "B7",
        "G7",
        "B7",
        "D#8"
    ]
);

assert.equal(
    transition.events[2].tone,
    catalog.songs["trip-ended"].events[2].tone
);

assert.equal(
    transition.events[2].tone,
    catalog.songs["trip-started"].events[0].tone
);

assert.equal(
    transition.events.some(
        event =>
            typeof event.speech ===
            "string"
    ),
    false
);

assert.match(
    app,
    /endingIntoNewTrip[\s\S]*"trip-transition"[\s\S]*tripEndTotalSpeech/
);

assert.match(
    app,
    /beginNewTripWorkflow\(\{[\s\S]*endStartTransition:\s*true/
);

assert.match(
    app,
    /const suppressStartChime[\s\S]*endStartTransitionChimePlayed ===[\s\S]*true[\s\S]*startTimeSetToNow !==[\s\S]*true[\s\S]*incrementSemanticDisable\(\s*"chime"\s*\)[\s\S]*clockTimer\.start\(/
);

assert.match(
    app,
    /function onTripStarted\([\s\S]*playSemanticSongThenSpeak\(\s*"trip-started"[\s\S]*consumeSemanticAction\(\s*"summary"\s*\)/
);

assert.match(
    app,
    /function onTripStartedEarly\([\s\S]*playSemanticSongThenSpeak\(\s*"trip-started-early"/
);

assert.match(
    app,
    /function onTripStartedLate\([\s\S]*playSemanticSongThenSpeak\(\s*"trip-started-late"/
);

for (
    const name of
        [
            "trip-started",
            "trip-started-early",
            "trip-started-late"
        ]
) {
    assert.equal(
        catalog.songs[name].events.some(
            event =>
                typeof event.speech ===
                "string"
        ),
        false
    );
}

console.log(
    "PASS five-note workflow suppresses the three start chimes through the disable stack while preserving speech layers"
);


assert.match(
    app,
    /pendingEndStartTripSpeech[\s\S]*function onTripEnded[\s\S]*endingIntoNewTrip[\s\S]*pendingEndStartTripSpeech\s*=\s*speech[\s\S]*return;/
);

assert.match(
    app,
    /const opened\s*=\s*await beginNewTripWorkflow[\s\S]*"trip-transition"[\s\S]*endStartTransitionChimePlayed\s*=\s*played/
);

assert.equal(
    catalog.songs["trip-ended"].events.some(
        event =>
            typeof event.speech ===
            "string"
    ),
    false
);

console.log(
    "PASS combined cue is played in the new-trip number pad and trip-ended speech is not duplicated"
);


assert.match(
    app,
    /function consumeSemanticAction\([\s\S]*state === 0[\s\S]*return true[\s\S]*state > 0[\s\S]*state - 1[\s\S]*return false/
);

assert.match(
    app,
    /function setSemanticDisable\([\s\S]*next < -1[\s\S]*semanticDisableCounts\[layer\]\s*=\s*next/
);

console.log(
    "PASS semantic suppression uses consumable accumulators: 0 performs, -1 stays user-disabled, positive counts decrement and suppress"
);
