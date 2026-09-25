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
        ["trip-ended-started"];

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
    /endingIntoNewTrip[\s\S]*"trip-ended-started"[\s\S]*tripEndTotalSpeech/
);

assert.match(
    app,
    /beginNewTripWorkflow\(\{[\s\S]*endStartTransition:\s*true/
);

assert.match(
    app,
    /tripDraftUsesEndStartTransition\(\)[\s\S]*return;[\s\S]*playSemanticSong\("trip-started"\)/
);

assert.match(
    app,
    /function onTripStartedEarly[\s\S]*tripDraftUsesEndStartTransition\(\)[\s\S]*return;[\s\S]*playSemanticSongThenSpeak/
);

assert.match(
    app,
    /function onTripStartedLate[\s\S]*tripDraftUsesEndStartTransition\(\)[\s\S]*return;[\s\S]*playSemanticSongThenSpeak/
);

console.log(
    "PASS direct end-to-start transition uses one spliced cue and suppresses individual trip cues"
);
