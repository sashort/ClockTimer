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
    /function onTripStarted\([\s\S]*tripDraftUsesEndStartTransition\(\)[\s\S]*speakSemanticText\(\s*"Trip started\."\s*\)[\s\S]*return;[\s\S]*playSemanticSong\("trip-started"\)/
);

assert.match(
    app,
    /function onTripStartedEarly[\s\S]*tripDraftUsesEndStartTransition\(\)[\s\S]*speakSemanticText\(\s*speech\s*\)[\s\S]*return;[\s\S]*playSemanticSongThenSpeak/
);

assert.match(
    app,
    /function onTripStartedLate[\s\S]*tripDraftUsesEndStartTransition\(\)[\s\S]*speakSemanticText\(\s*speech\s*\)[\s\S]*return;[\s\S]*playSemanticSongThenSpeak/
);

console.log(
    "PASS direct end-to-start transition uses one spliced cue and makes subsequent trip-start notifications speech-only"
);


assert.match(
    app,
    /startTimeSetToNow:\s*false/
);

assert.match(
    app,
    /tripDraftStartWasPushedBackToNow\(\)[\s\S]*startTimeSetToNow ===\s*true/
);

assert.match(
    app,
    /toggleTripStartsNowTarget[\s\S]*startTimeSetToNow\s*=\s*selected/
);

assert.match(
    app,
    /startTimeSetToNow:[\s\S]*tripSettingsSession[\s\S]*\.startTimeSetToNow ===[\s\S]*true/
);

console.log(
    "PASS second start chime is allowed only when Actual Start is explicitly set to Now"
);


assert.match(
    app,
    /pendingEndStartTripSpeech[\s\S]*function onTripEnded[\s\S]*endingIntoNewTrip[\s\S]*pendingEndStartTripSpeech\s*=\s*speech[\s\S]*return;/
);

assert.match(
    app,
    /const opened\s*=\s*await beginNewTripWorkflow[\s\S]*"trip-ended-started"[\s\S]*endStartTransitionChimePlayed\s*=\s*played/
);

assert.match(
    app,
    /tripDraftStartChimeAlreadyPlayed\(\)[\s\S]*endStartTransitionChimePlayed ===\s*true/
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
