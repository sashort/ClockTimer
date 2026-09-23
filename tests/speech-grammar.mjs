import assert from "node:assert/strict";

import {
    buildRecognitionGrammar,
    buildRecognitionPrompt
} from "../speech/grammar.js";

const context = {
    phrases: [
        "ready at <clock>",
        "standard time <duration>",
        "<goalScope> goal <percent>",
        "<mode> mode",
        "<number>"
    ],
    vocabulary: [
        "ready",
        "standard",
        "goal"
    ],
    options: {
        goalScope: [
            "trip",
            "total"
        ],
        mode: [
            "elapsed",
            "remaining"
        ]
    },
    numbers: {
        output: "digits"
    }
};

const built =
    buildRecognitionGrammar(
        context
    );

assert.equal(
    built.rule,
    "root"
);

assert.match(
    built.grammar,
    /root ::= " " command/
);
assert.match(
    built.grammar,
    /"ready at " clock/
);
assert.match(
    built.grammar,
    /"standard time " duration/
);
assert.match(
    built.grammar,
    /option-goalscope " goal " percent/
);
assert.match(
    built.grammar,
    /option-goalscope ::= "trip" \| "total"/
);
assert.match(
    built.grammar,
    /option-mode ::= "elapsed" \| "remaining"/
);
assert.match(
    built.grammar,
    /duration-bare ::= number \(" " minute-spoken\)\?/
);
assert.match(
    built.grammar,
    /percent ::= number/
);
assert.match(
    built.grammar,
    /clock ::=/
);

assert.equal(
    buildRecognitionGrammar({
        vocabulary: [
            "start",
            "stop"
        ]
    }),
    undefined
);

const prompt =
    buildRecognitionPrompt(
        context
    );

assert.match(
    prompt,
    /ready at five thirty/
);
assert.match(
    prompt,
    /standard time one hour fifteen/
);
assert.match(
    prompt,
    /trip goal one hundred percent/
);

const unsafe =
    buildRecognitionGrammar({
        phrases: [
            'say "hello"'
        ]
    });

assert.match(
    unsafe.grammar,
    /\"hello\"/
);

console.log(
    "PASS speech recognition GBNF generation"
);
