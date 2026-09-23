import fs from "node:fs";

import {
    buildRecognitionGrammar
} from "../speech/grammar.js";

Function(
    fs.readFileSync(
        new URL(
            "../lang/en-US.js",
            import.meta.url
        ),
        "utf8"
    )
)();

const context =
    globalThis
        .WMOFLanguages?.["en-US"]
        ?.speech?.recognition;

const result =
    buildRecognitionGrammar(
        context
    );

if (!result?.grammar) {
    throw new Error(
        "WMOF English recognition grammar was not generated."
    );
}

process.stdout.write(
    result.grammar
);
