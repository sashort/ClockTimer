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

const clockTimer =
    fs.readFileSync(
        new URL(
            "../ClockTimer.js",
            import.meta.url
        ),
        "utf8"
    );


const index =
    fs.readFileSync(
        new URL(
            "../index.html",
            import.meta.url
        ),
        "utf8"
    );

const css =
    fs.readFileSync(
        new URL(
            "../app.css",
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
        "D#3",
        "B2",
        "G2",
        "B2",
        "D#3"
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

const endStartTransitionSource =
    app.slice(
        app.indexOf(
            "async function endCurrentIntervalOrTrip("
        ),
        app.indexOf(
            "let speechBreakPromptState"
        )
    );

assert.match(
    endStartTransitionSource,
    /const transitionTimestamp\s*=\s*effectiveTime\.getTime\(\);[\s\S]*clockTimer\.stop\(\s*new Date\(\s*transitionTimestamp\s*\)\s*\)[\s\S]*beginNewTripWorkflow\(\{[\s\S]*tripMoment:\s*new Date\(\s*transitionTimestamp\s*\)/
);

assert.doesNotMatch(
    endStartTransitionSource,
    /clockTimer\.stop\(\s*transactionTime\s*\)/
);

console.log(
    "PASS Ready end/start transitions share one immutable millisecond boundary"
);

assert.match(
    app,
    /const reserveStartChime\s*=[\s\S]*transitionChimeAllowed[\s\S]*startChimeEnabled[\s\S]*if \(reserveStartChime\)[\s\S]*incrementSemanticDisable\(\s*"chime"\s*\)/
);
assert.match(
    app,
    /transitionChimePlayed[\s\S]*reserveStartChime &&[\s\S]*!transitionChimePlayed[\s\S]*cancelSemanticDisable\(\s*"chime"\s*\)/
);

assert.match(
    app,
    /async function onTripStarted\([\s\S]*consumeAnnouncementAction\(\s*"trip-started",\s*"chime"[\s\S]*consumeAnnouncementAction\(\s*"trip-started",\s*"summary"/
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

assert.match(
    clockTimer,
    /async endInterval\([\s\S]*suppressTripResumed\s*=\s*false[\s\S]*#emitSemanticIntervalEnded\([\s\S]*suppressTripResumed/
);

assert.match(
    clockTimer,
    /intervalType === "down"[\s\S]*"downTimeEnded"[\s\S]*if \(suppressTripResumed\)[\s\S]*return true;[\s\S]*"tripResumed"/
);

assert.match(
    app,
    /async function startBreakInterval\([\s\S]*intervalType[\s\S]*"down"[\s\S]*\.endInterval\([\s\S]*transactionTime,[\s\S]*suppressTripResumed:[\s\S]*true[\s\S]*\.startInterval\(/
);

console.log(
    "PASS down-to-break transition ends Down without emitting an intermediate Trip Resumed event"
);

console.log(
    "PASS standalone five-note transition suppresses the later start chime while preserving speech layers"
);


assert.match(
    app,
    /pendingEndStartTripSpeech[\s\S]*function onTripEnded[\s\S]*endingIntoNewTrip[\s\S]*pendingEndStartTripSpeech\s*=\s*speech[\s\S]*return;/
);

assert.match(
    app,
    /const opened\s*=\s*await beginNewTripWorkflow[\s\S]*"trip-transition"[\s\S]*transitionChimePlayed\s*=\s*Boolean\(song\)/
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
    "PASS standalone transition cue is played in the new-trip workflow and trip-ended speech is not duplicated"
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

assert.match(
    index,
    /id="tripTransitionOverlay"[\s\S]*id="tripTransitionOverlayDetails"/
);

assert.match(
    css,
    /\.trip-transition-overlay-panel[\s\S]*border:\s*5px solid rgb\(169 221 247 \/ 92%\)/
);

assert.match(
    app,
    /setTimeout\([\s\S]*7000[\s\S]*tripTransitionOverlayQueue/
);

assert.doesNotMatch(
    app,
    /showTripStartTransitionOverlay/
);

assert.match(
    app,
    /onTripEnded\([\s\S]*showTripEndTransitionOverlay/
);

assert.match(
    app,
    /showTripEndTransitionOverlay\([\s\S]*totalScopeLabel\(\)[\s\S]*" Percent"[\s\S]*"Banked Toward "[\s\S]*"Over "/
);

assert.doesNotMatch(
    app,
    /showTripEndTransitionOverlay\([\s\S]*"Stop Time"[\s\S]*"Actual Time"[\s\S]*"Counted Time"[\s\S]*"Standard Time"[\s\S]*"Trip Percent"[\s\S]*"Trip Goal"/
);

assert.match(
    app,
    /document\.createElement\(\s*"code"\s*\)/
);

assert.match(
    css,
    /\.trip-transition-overlay\s*\{[\s\S]*z-index:\s*2147483644/
);

assert.match(
    css,
    /speech-mic-bar\[popover\][\s\S]*z-index:\s*2147483645/
);

assert.match(
    css,
    /\.speech-training-widget\s*\{[\s\S]*z-index:\s*2147483646/
);

assert.match(
    css,
    /\.trip-transition-overlay-row code\s*\{[\s\S]*color:\s*#111;[\s\S]*background:\s*var\(--wm-yellow, #ffc220\)/
);

console.log(
    "PASS trip-end overlay shows for seven seconds with emphasized code values and the intended stacking order"
);


assert.doesNotMatch(
    app,
    /waitForTripTransitionOverlay/
);

assert.match(
    app,
    /function speechRecognitionEnabled\(\)[\s\S]*speechRecognitionButton[\s\S]*aria-pressed[\s\S]*"true"/
);

assert.match(
    app,
    /resetCompletedTrip\(\)[\s\S]*beginNewTripWorkflow\(\{[\s\S]*inputMode:[\s\S]*speechRecognitionEnabled\(\)[\s\S]*\? "voice"[\s\S]*: "touch"[\s\S]*endStartTransition:\s*true/
);

assert.match(
    css,
    /\.voice-entry-surface\s*\{[\s\S]*z-index:\s*2147483647/
);

assert.match(
    css,
    /\.trip-transition-overlay\s*\{[\s\S]*pointer-events:\s*none/
);

console.log(
    "PASS trip completion opens voice entry when speech is enabled, touch entry when speech is off, while the seven-second summary remains visible"
);
