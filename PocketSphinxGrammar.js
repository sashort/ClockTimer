/* Compile SpeechMenu's currently eligible, finite phrases into a PocketSphinx
 * JSGF grammar. This first-stage compiler deliberately rejects variable slots
 * and punctuation it cannot represent safely; it never broadens the grammar.
 */
(function (root) {
    "use strict";

    const TOKEN = /^[A-Za-z0-9]+(?:[ '-][A-Za-z0-9]+)*$/;

    function compile(phraseGroups, { grammarName = "clocktimer" } = {}) {
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(grammarName)) {
            throw new TypeError("Invalid JSGF grammar name.");
        }

        const phrases = new Set();
        const unsupported = [];
        const seenUnsupported = new Set();

        const addUnsupported = (phrase, reason) => {
            const key = reason + "\u0000" + phrase;
            if (seenUnsupported.has(key)) return;
            seenUnsupported.add(key);
            unsupported.push(Object.freeze({ phrase, reason }));
        };

        for (const group of phraseGroups || []) {
            const values = Array.isArray(group) ? group : group?.phrases;
            if (!Array.isArray(values)) continue;

            for (const raw of values) {
                const phrase = String(raw ?? "").trim().replace(/\s+/g, " ");
                if (!phrase) continue;

                if (/[<>]/.test(phrase)) {
                    addUnsupported(phrase, "variable-slot");
                    continue;
                }
                if (!TOKEN.test(phrase)) {
                    addUnsupported(phrase, "unsupported-token");
                    continue;
                }
                phrases.add(phrase.toLowerCase());
            }
        }

        const ordered = [...phrases].sort((a, b) => a.localeCompare(b));
        const grammar = ordered.length
            ? "#JSGF V1.0;\ngrammar " + grammarName + ";\npublic <command> =\n    "
                + ordered.join("\n    | ") + "\n    ;\n"
            : "#JSGF V1.0;\ngrammar " + grammarName + ";\n";

        return Object.freeze({
            grammar,
            phrases: Object.freeze(ordered),
            unsupported: Object.freeze(unsupported),
            complete: unsupported.length === 0
        });
    }

    root.PocketSphinxGrammar = Object.freeze({ compile });
})(globalThis);
